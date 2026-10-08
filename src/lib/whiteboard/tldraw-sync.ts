import { getSnapshot, loadSnapshot, type Editor, type TLShapeId } from 'tldraw';
import { StoredObjectSchema, type BoardObjectSchemaType, type StoredObjectSchemaType } from './schemas';
import { changedFields, serverObjectId, shapeId, shapeToObject } from './tldraw-adapter';
import { applyAgentObject } from './apply-board-command';
import type { SavedBoard } from './document-store';

export const UNSAVED_BOARD_KEY = 'whiteboard-unsaved-document';

/** The complete tldraw document is saved atomically; objects are only an agent projection. */
export function connectBoard(editor:Editor, report:(message:string)=>void) {
  const controller = new AbortController();
  let stopped=false, initialized=false, blocked=false, pending=false;
  let revision=-1, sequence=0, generation=0, appliedSequence=0;
  let timer:ReturnType<typeof setTimeout>;
  let base = new Map<string,StoredObjectSchemaType>();
  let nativeBase = new Map<TLShapeId,BoardObjectSchemaType>();
  editor.updateInstanceState({isReadonly:true});
  report('Loading saved board…');
  const unsubscribe = editor.store.listen(()=>{
    if (!initialized || blocked) return;
    generation++;pending=true;report('Saving board…');
  },{source:'user',scope:'document'});
  const beforeUnload = (event:BeforeUnloadEvent)=>{if(pending){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);

  function nativeProjection() {
    const result = new Map<TLShapeId,BoardObjectSchemaType>();
    // Includes descendants, bindings, and all pages in the saved document.
    for (const shape of editor.store.allRecords()) if (shape.typeName === 'shape') {
      const object = shapeToObject(editor,shape);
      if (object && StoredObjectSchema.safeParse({...object,id:serverObjectId(shape)}).success) result.set(shape.id,object);
    }
    return result;
  }
  function compatibilityProjection(native:Map<TLShapeId,BoardObjectSchemaType>) {
    return [...native].map(([id,object])=>{
      const shape=editor.getShape(id)!, serverId=serverObjectId(shape);
      const old=base.get(serverId), before=nativeBase.get(id);
      return old && before && before.object === object.object ? {...old,...changedFields(before,object),id:serverId} : {...object,id:serverId};
    });
  }
  async function request(method:'GET'|'PUT', body?:unknown) {
    const response=await fetch('/api/board',{method,cache:'no-store',signal:controller.signal,
      ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})});
    const data=await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error ?? 'Board storage is unavailable.'),{status:response.status});
    return data;
  }
  function protectLocalCopy(message:string) {
    blocked=true;pending=true;editor.updateInstanceState({isReadonly:true});
    let saved=false;
    try { localStorage.setItem(UNSAVED_BOARD_KEY,JSON.stringify(getSnapshot(editor.store).document));saved=true; } catch { /* Large boards can exceed localStorage; downloading remains available. */ }
    report(`${message} ${saved ? 'An unsaved recovery copy is available.' : 'Keep this tab open.'} Use Download board before reloading; Recover copy can restore it after reload.`);
  }
  function load(state:SavedBoard) {
    editor.store.mergeRemoteChanges(()=>{
      if (state.document) loadSnapshot(editor.store,{document:state.document});
      editor.clearHistory();
    });
    base=new Map(state.projection.map(object=>[object.id,object]));
    nativeBase=nativeProjection();revision=state.revision;
    appliedSequence=state.commands.length ? state.commands[0].seq-1 : state.sequence;
  }
  async function tick() {
    try {
      if (blocked || editor.inputs.getIsPointing() || editor.getEditingShapeId()) return;
      const state=await request('GET') as SavedBoard;
      if (stopped || editor.inputs.getIsPointing() || editor.getEditingShapeId()) return;
      if (!initialized) load(state);
      else if (state.revision !== revision) {
        if (pending) {protectLocalCopy('Another tab saved a different board.');return;}
        load(state);
      }
      // Apply durable agent commands remotely, keeping them out of user undo history.
      if (state.commands.some(command=>command.seq>appliedSequence)) {
        const readonly=editor.getIsReadonly();
        editor.updateInstanceState({isReadonly:false});
        try {
          editor.store.mergeRemoteChanges(()=>editor.run(()=>{
            for (const command of state.commands.filter(command=>command.seq>appliedSequence)) {
              if (command.kind === 'clear') {
                if (pending && initialized) throw new Error('The agent cleared the board while local edits were unsaved.');
                editor.deleteShapes(editor.store.allRecords().filter(r=>r.typeName === 'shape').map(r=>r.id as TLShapeId));base.clear();
              } else if (command.kind === 'delete') {
                const id=shapeId(command.id), shape=editor.getShape(id), before=nativeBase.get(id);
                if (shape && before) {
                  const current=shapeToObject(editor,shape);
                  if (current && Object.keys(changedFields(before,current)).length) throw new Error('An agent deletion overlaps unsaved local edits.');
                }
                editor.deleteShapes([id]);base.delete(command.id);
              } else {
                const id=shapeId(command.object.id), existing=editor.getShape(id), before=nativeBase.get(id);
                const current=existing && shapeToObject(editor,existing);
                const local=before && current ? changedFields(before,current) : {};
                applyAgentObject(editor,command.object,base.get(command.object.id),before);
                base.set(command.object.id,command.object);
                const updated=editor.getShape(id), after=updated && shapeToObject(editor,updated);
                if(after) {
                  const baseline={...after} as unknown as Record<string,unknown>;
                  for(const key of Object.keys(local)) {
                    const value=(before as unknown as Record<string,unknown>)[key];
                    if(value === undefined) delete baseline[key];else baseline[key]=value;
                  }
                  nativeBase.set(id,baseline as BoardObjectSchemaType);
                }
              }
            }
          },{ignoreShapeLock:true,history:'ignore'}));
        } catch(error) {protectLocalCopy(error instanceof Error ? error.message : 'Agent edits conflict with local edits.');return;}
        finally {editor.updateInstanceState({isReadonly:blocked || readonly});}
        appliedSequence=state.sequence;sequence=state.sequence;generation++;pending=true;
      } else sequence=state.sequence;
      if (!initialized) {
        initialized=true;editor.updateInstanceState({isReadonly:false});
        if(editor.getCurrentPageShapeIds().size) editor.zoomToFit();else editor.centerOnPoint({x:0,y:0});
        if (!state.document) {pending=true;generation++;}
      }
      if (pending) {
        const savedGeneration=generation;
        const native=nativeProjection(), projection=compatibilityProjection(native);
        const document=getSnapshot(editor.store).document;
        try {
          const result=await request('PUT',{expectedRevision:revision,acknowledged:sequence,document,projection});
          if(stopped)return;
          revision=result.revision;base=new Map(projection.map(object=>[object.id,object]));nativeBase=native;
          pending=generation!==savedGeneration;
        } catch(error) {
          if(error && typeof error === 'object' && 'status' in error && error.status === 409) {
            // A queued agent edit is applied on the next read. Revision conflicts protect the local copy.
            const latest=await request('GET') as SavedBoard;
            if(latest.revision!==revision) protectLocalCopy('Another tab saved while this board was saving.');
            return;
          }
          throw error;
        }
      }
      report(pending ? 'Saving board…' : '');
    } catch(error) {
      if(!stopped)report(`${error instanceof Error ? error.message : 'Board storage is unavailable.'} Your edits remain in this tab; saving will retry.`);
    } finally {if(!stopped)timer=setTimeout(()=>void tick(),800);}
  }
  void tick();
  return ()=>{stopped=true;clearTimeout(timer);controller.abort();unsubscribe();window.removeEventListener('beforeunload',beforeUnload);};
}
