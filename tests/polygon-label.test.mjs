import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat } from 'tldraw';
import { boardProps, localBoardObject } from '../src/lib/whiteboard/tldraw-board-model.ts';
import { labelPlacement } from '../src/lib/whiteboard/label.ts';
import { readShapeLabel, polygonLabelMigration, attachedLabelUpdate } from '../src/lib/whiteboard/polygon-label.ts';
import { objectToShape, shapeToObject } from '../src/lib/whiteboard/tldraw-adapter.ts';

const object={id:'poly',object:'polygon',x:0,y:0,points:[{x:0,y:0},{x:100,y:0},{x:50,y:80}],rotation:30,strokeColor:'#123456',fillColor:'transparent',strokeWidth:2,label:'Old label',labelX:-3,labelY:4,labelFontSize:19,labelColor:'#abcdef',labelBackground:'#ffffff'};
const legacy=()=>({id:'shape:poly',type:'board-object',typeName:'shape',x:20,y:30,rotation:Math.PI/6,opacity:.7,meta:{boardId:'poly',attachedLabel:null},props:{...boardProps(object),w:200,h:160}});
const apply=(shape,patch)=>({...shape,...patch,props:{...shape.props,...patch.props}});

test('legacy label migration retains its rendered center, styling, geometry and rotation',()=>{
  const shape=legacy(),local=localBoardObject(shape.props),position=labelPlacement({...local,id:shape.id},local.label);
  const migrated=apply(shape,polygonLabelMigration(shape));
  const label=readShapeLabel(migrated);
  assert.equal(label.x,position.labelX);assert.equal(label.y,position.labelY);
  assert.equal(label.size,19);assert.equal(label.color,'#abcdef');assert.equal(label.background,'#ffffff');
  assert.equal(migrated.rotation,shape.rotation);assert.equal(migrated.opacity,.7);
  assert.deepEqual(localBoardObject(migrated.props).points,local.points);
  assert.equal(JSON.parse(migrated.props.data).label,undefined);
  assert.equal(polygonLabelMigration(migrated),null);
});
test('shared labels remain freely positioned outside bounds and clear without resurrecting legacy data',()=>{
  const shape=legacy(),label={...readShapeLabel(shape),x:-5,y:8};
  const moved=apply(shape,attachedLabelUpdate(shape,label));
  assert.deepEqual(readShapeLabel(moved),label);
  const cleared=apply(moved,attachedLabelUpdate(moved,null));
  assert.equal(readShapeLabel(cleared),null);
  assert.equal(readShapeLabel(JSON.parse(JSON.stringify(cleared))),null);
});
test('agent polygon labels use shared metadata and round-trip through compatibility view',()=>{
  const shape=objectToShape(object);
  assert.equal(JSON.parse(shape.props.data).label,undefined);
  assert.equal(readShapeLabel(shape).x,-3);
  const editor={getShapePageTransform:s=>Mat.Translate(s.x,s.y).rotate(s.rotation)};
  const projection=shapeToObject(editor,shape);
  for(const key of ['label','labelX','labelY','labelFontSize','labelColor','labelBackground']) assert.equal(projection[key],object[key]);
});
