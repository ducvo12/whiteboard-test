import test from 'node:test';
import assert from 'node:assert/strict';
import {Mat,GeoShapeUtil,toRichText} from 'tldraw';
import {objectToShape,shapeToObject} from '../src/lib/whiteboard/tldraw-adapter.ts';
import {applyAgentObject} from '../src/lib/whiteboard/apply-board-command.ts';

function fixture() {
  const object={id:'test',object:'rect',x:10,y:20,w:100,h:80,rotation:0,strokeColor:'#123456',fillColor:'transparent',strokeWidth:2};
  const partial=objectToShape(object);
  let shape={...partial,typeName:'shape',parentId:'shape:group',opacity:.4,props:{...GeoShapeUtil.prototype.getDefaultProps(),...partial.props,fill:'lined-fill',font:'mono',richText:toRichText('Keep me')},meta:{...partial.meta,custom:'keep'}};
  const editor={getShape:()=>shape,getShapePageTransform:s=>Mat.Translate(s.x,s.y).rotate(s.rotation),getShapeParentTransform:()=>Mat.Identity(),getBindingsFromShape:()=>[],getTextOptions:()=>({}),updateShape:patch=>{shape={...shape,...patch,props:{...shape.props,...patch.props}};}};
  return {object,editor,get:()=>shape};
}
test('agent position edit retains native fill, rich text, opacity, parent and metadata',()=>{
  const f=fixture(),before=shapeToObject(f.editor,f.get()),original=f.get();
  applyAgentObject(f.editor,{...f.object,x:40},f.object,before);
  assert.equal(f.get().x,40);
  for(const key of ['fill','font','richText'])assert.deepEqual(f.get().props[key],original.props[key]);
  assert.equal(f.get().opacity,.4);assert.equal(f.get().parentId,'shape:group');assert.equal(f.get().meta.custom,'keep');
});
test('agent edit preserves a simultaneous nonoverlapping local move',()=>{
  const f=fixture(),before=shapeToObject(f.editor,f.get());
  f.editor.updateShape({x:50,props:{}});
  applyAgentObject(f.editor,{...f.object,strokeColor:'#ff0000'},f.object,before);
  assert.equal(f.get().x,50);
});
test('overlapping local and agent position edits are rejected before mutation',()=>{
  const f=fixture(),before=shapeToObject(f.editor,f.get());
  f.editor.updateShape({x:50,props:{}});
  assert.throws(()=>applyAgentObject(f.editor,{...f.object,x:80},f.object,before),/edited locally/);
  assert.equal(f.get().x,50);
});
