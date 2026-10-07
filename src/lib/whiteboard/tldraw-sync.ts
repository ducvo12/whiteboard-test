import type { Editor, TLShapeId } from "tldraw";
import { BoardObjectSchema, StoredObjectSchema, type BoardObjectSchemaType, type StoredObjectSchemaType } from "./schemas";
import { changedFields, objectToShape, shapeId, shapeToObject } from "./tldraw-adapter";

type Baseline = { object: StoredObjectSchemaType; projection: BoardObjectSchemaType };

/** A single serialized save/read loop; remote updates never enter local history. */
export function connectBoard(editor: Editor, report: (message: string) => void) {
  const known = new Map<TLShapeId, Baseline>();
  const dirty = new Map<TLShapeId, number>();
  const conflicts = new Set<TLShapeId>();
  const controller = new AbortController();
  let stopped = false;
  let initialized = false;
  let timer: ReturnType<typeof setTimeout>;
  let generation = 0;
  let lastError = "";
  editor.updateInstanceState({ isReadonly: true });
  report("Loading board…");

  const unsubscribe = editor.store.listen(({ changes }) => {
    for (const record of [...Object.values(changes.added), ...Object.values(changes.updated).map(([, next]) => next), ...Object.values(changes.removed)]) {
      if (record.typeName === "shape") dirty.set(record.id, ++generation);
    }
    // Parent transforms and bound-arrow positions can change indirectly.
    if (Object.keys(changes.added).length || Object.keys(changes.updated).length || Object.keys(changes.removed).length) {
      for (const shape of editor.getCurrentPageShapes()) dirty.set(shape.id, ++generation);
    }
    // Binding edits can change an arrow's visible endpoints without changing its props.
    if ([...Object.values(changes.added), ...Object.values(changes.updated).map(([, next]) => next), ...Object.values(changes.removed)].some((r) => r.typeName === "binding")) {
      for (const shape of editor.getCurrentPageShapes()) if (shape.type === "arrow") dirty.set(shape.id, ++generation);
    }
    if (dirty.size) report("Saving board changes…");
  }, { source: "user", scope: "document" });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (dirty.size) { event.preventDefault(); event.returnValue = ""; }
  };
  window.addEventListener("beforeunload", beforeUnload);

  function remember(id: TLShapeId, baseline: Baseline) {
    const shape = editor.getShape(id);
    if (shape) editor.store.mergeRemoteChanges(() => editor.updateShape({ id, type: shape.type,
      meta: { ...shape.meta, boardId: baseline.object.id, boardKind: baseline.object.object,
        boardSnapshot: JSON.stringify(baseline) } }));
  }

  function restoreInput(snapshot: unknown, projection: BoardObjectSchemaType): BoardObjectSchemaType {
    if (typeof snapshot !== "string") return projection;
    try {
      const saved = JSON.parse(snapshot) as { object?: unknown; projection?: unknown };
      const object = BoardObjectSchema.safeParse(saved.object);
      const previous = BoardObjectSchema.safeParse(saved.projection);
      if (object.success && previous.success && object.data.object === projection.object) {
        return BoardObjectSchema.parse({ ...object.data, ...changedFields(previous.data, projection) });
      }
    } catch { /* Invalid or obsolete metadata falls back to the current shape. */ }
    return projection;
  }

  async function request(method: string, body?: unknown) {
    const response = await fetch("/api/objects", { method, cache: "no-store", signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      const error = new Error(response.status === 409 ? "An object changed elsewhere. The server version was kept; please repeat that edit." : `Board ${method.toLowerCase()} failed (${response.status}). Unsaved edits will retry.`);
      Object.assign(error, { conflict: response.status === 409 });
      throw error;
    }
    return response.json();
  }

  async function tick() {
    try {
      // Don't replace shapes or persist intermediate geometry during gestures/text editing.
      if (editor.inputs.getIsPointing() || editor.getEditingShapeId()) return;
      for (const [id, version] of [...dirty]) {
        const baseline = known.get(id);
        const shape = editor.getShape(id);
        try {
          if (!shape) {
            if (baseline) await request("DELETE", { id: baseline.object.id, expected: baseline.object });
            known.delete(id);
          } else {
            const projection = shapeToObject(editor, shape);
            if (!projection) continue;
            if (!baseline) {
              const serverId = typeof shape.meta.boardId === "string" ? shape.meta.boardId : id;
              const input = restoreInput(shape.meta.boardSnapshot, projection);
              const saved = StoredObjectSchema.parse(await request("PUT", { ...input, id: serverId }));
              known.set(id, { object: saved, projection });
              remember(id, { object: saved, projection });
            } else {
              if (projection.object !== baseline.projection.object) continue;
              const patch = changedFields(baseline.projection, projection);
              if (Object.keys(patch).length) {
                const values = baseline.object as unknown as Record<string, unknown>;
                const expected = Object.fromEntries(Object.keys(patch).map((key) => [key, values[key] ?? null]));
                await request("PATCH", { id: baseline.object.id, patch, expected });
                known.set(id, { object: { ...baseline.object, ...patch } as StoredObjectSchemaType, projection });
                remember(id, known.get(id)!);
              }
            }
          }
          if (dirty.get(id) === version) dirty.delete(id);
        } catch (error) {
          if (error instanceof Error && "conflict" in error && error.conflict) {
            dirty.delete(id);
            conflicts.add(id);
            lastError = error.message;
          } else throw error;
        }
      }
      const data = await request("GET");
      const objects = StoredObjectSchema.array().parse(data);
      if (stopped) return;
      if (editor.inputs.getIsPointing() || editor.getEditingShapeId()) return;
      const remoteIds = new Set(objects.map((obj) => shapeId(obj.id)));
      editor.store.mergeRemoteChanges(() => {
        for (const [id] of known) {
          if (!remoteIds.has(id) && !dirty.has(id)) { editor.deleteShapes([id]); known.delete(id); }
        }
        for (const obj of objects) {
          const partial = objectToShape(obj);
          const id = shapeId(obj.id);
          if (!partial || dirty.has(id)) continue;
          partial.parentId = editor.getCurrentPageId();
          if (!conflicts.has(id) && JSON.stringify(known.get(id)?.object) === JSON.stringify(obj)) continue;
          const existing = editor.getShape(id);
          if (existing && existing.type !== partial.type) {
            const selected = editor.getSelectedShapeIds().includes(id);
            editor.deleteShapes([id]);
            editor.createShape(partial);
            if (selected) editor.setSelectedShapes([...editor.getSelectedShapeIds(), id]);
          } else if (existing) editor.updateShape(partial);
          else editor.createShape(partial);
          const shape = editor.getShape(id);
          const projection = shape && shapeToObject(editor, shape);
          if (projection) { known.set(id, { object: obj, projection }); remember(id, { object: obj, projection }); }
          conflicts.delete(id);
        }
      });
      if (!initialized) {
        initialized = true;
        editor.updateInstanceState({ isReadonly: false });
        if (known.size) editor.zoomToFit();
        else editor.centerOnPoint({ x: 0, y: 0 });
      }
      const polygons = objects.filter((obj) => obj.object === "polygon").length;
      const localOnly = editor.getCurrentPageShapes().filter((shape) => !shapeToObject(editor, shape)).length;
      const approximateStyles = [...known.values()].some(({ object, projection }) => {
        const original = object as unknown as Record<string, unknown>;
        const displayed = projection as unknown as Record<string, unknown>;
        return ["strokeColor", "fillColor", "strokeWidth", "labelFontSize", "fontSize"].some((key) => original[key] !== undefined && original[key] !== displayed[key]) ||
          (object.labelX !== undefined && object.labelX !== 0.5) || (object.labelY !== undefined && object.labelY !== 0.5);
      });
      report([lastError, polygons ? `${polygons} polygon(s) are preserved on the server; display/editing comes in pass 3.` : "",
        approximateStyles ? "Some original styling is approximated in tldraw; server values are preserved." : "",
        localOnly ? `${localOnly} unsupported shape(s) or empty text: edits are local only. Use rectangles, circles, straight arrows, or text.` : "",
        dirty.size ? "Some edits are not saved yet." : ""].filter(Boolean).join(" "));
    } catch (error) {
      if (!stopped) report(error instanceof Error ? error.message : "Board connection failed. Retrying…");
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), 800);
    }
  }
  void tick();
  return () => { stopped = true; clearTimeout(timer); controller.abort(); unsubscribe(); window.removeEventListener("beforeunload", beforeUnload); };
}
