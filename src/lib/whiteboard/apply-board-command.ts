import { Mat, toRichText, type Editor } from 'tldraw';
import { changedFields, nearestColor, nearestSize, fonts, objectToShape, preserveNativeStyles, shapeId, shapeToObject } from './tldraw-adapter.ts';
import { readAttachedLabel } from './attached-label.ts';
import type { BoardObjectSchemaType, StoredObjectSchemaType } from './schemas';

/** Translate agent field edits without replacing native records, groups, or styles. */
export function applyAgentObject(editor:Editor, object:StoredObjectSchemaType, previous?:StoredObjectSchemaType, nativeBefore?:BoardObjectSchemaType) {
  const id = shapeId(object.id), existing = editor.getShape(id);
  if (!existing) {
    if (previous && nativeBefore) throw new Error('The agent updated a shape that was deleted locally. Download your unsaved board before reloading.');
    editor.createShape(objectToShape(object)); return;
  }
  const current = shapeToObject(editor,existing);
  const agentPatch = previous ? changedFields(previous,object) : object;
  const localPatch = nativeBefore && current && nativeBefore.object === current.object ? changedFields(nativeBefore,current) : {};
  for (const key of Object.keys(agentPatch)) {
    if (key in localPatch && JSON.stringify(localPatch[key]) !== JSON.stringify((agentPatch as Record<string,unknown>)[key])) throw new Error('The same shape was edited locally and by the agent. Download your unsaved board before reloading.');
  }
  const merged = {...object,...localPatch};
  const partial = objectToShape(merged);
  const geometry = ['x','y','w','h','r','points','x2','y2','rotation'].some(key=>key in agentPatch);
  const labels = ['label','labelX','labelY','labelFontSize','labelColor','labelBackground'].some(key=>key in agentPatch);
  const props = previous ? preserveNativeStyles(previous,object,partial.props as Record<string,unknown>) : {...partial.props};
  if (!geometry) for (const key of ['w','h','growY','start','end','bend']) delete props[key];
  const meta = {...existing.meta,boardId:object.id,boardKind:object.object,
    ...(labels ? {attachedLabel:partial.meta?.attachedLabel ?? null} : {})};
  if (existing.type === 'text' && object.object === 'textbox') {
    // Text remains a native text record rather than turning into a geo textbox.
    const textProps:Record<string,unknown> = {};
    if ('text' in agentPatch) textProps.richText = toRichText(object.text);
    if ('fontSize' in agentPatch) textProps.size = nearestSize(object.fontSize,fonts);
    if ('textColor' in agentPatch) textProps.color = nearestColor(object.textColor);
    if ('w' in agentPatch) { textProps.w=object.w; textProps.autoSize=false; }
    if (geometry) {
      const parent = editor.getShapeParentTransform(existing);
      const point = Mat.From(Mat.Inverse(parent)).applyToPoint({x:object.x,y:-object.y-object.h});
      editor.updateShape({id,type:'text',...point,rotation:-object.rotation*Math.PI/180-parent.rotation(),props:textProps,meta});
    } else editor.updateShape({id,type:'text',props:textProps,meta});
    return;
  }
  if (existing.type !== partial.type) throw new Error('This agent edit cannot be applied to the current native shape. Download your unsaved board before reloading.');
  if (labels && readAttachedLabel({meta}) && !readAttachedLabel(existing) &&
    (existing.type === 'arrow' || existing.type === 'geo' && existing.meta.boardKind !== 'textbox')) props.richText=toRichText('');
  if (geometry) {
    const parent = editor.getShapeParentTransform(existing);
    const point = Mat.From(Mat.Inverse(parent)).applyToPoint({x:partial.x!,y:partial.y!});
    partial.x=point.x; partial.y=point.y; partial.rotation=partial.rotation!-parent.rotation();
    if (existing.type === 'arrow') editor.deleteBindings(editor.getBindingsFromShape(existing.id,'arrow'));
  } else { delete partial.x;delete partial.y;delete partial.rotation; }
  editor.updateShape({...partial,props,meta});
}
