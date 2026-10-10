import { createTLStore, GeoShapeUtil, ArrowShapeUtil, NoteShapeUtil, ImageShapeUtil, DrawShapeUtil, b64Vecs, toRichText } from 'tldraw';
import { boardDocumentSchema } from '../../src/lib/whiteboard/document-schema.ts';
import { objectToShape } from '../../src/lib/whiteboard/tldraw-adapter.ts';

export function fullDocument() {
  const store=createTLStore({schema:boardDocumentSchema});
  const base={typeName:'shape',parentId:'page:audit',index:'a1',x:0,y:0,rotation:0,isLocked:false,opacity:1,meta:{}};
  const geo=GeoShapeUtil.prototype.getDefaultProps();
  const asset={id:'asset:audit',typeName:'asset',type:'image',meta:{},props:{name:'Audit pixel',w:1,h:1,isAnimated:false,mimeType:'image/png',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}};
  const shapes=[{...base,id:'shape:group',type:'group',x:30,y:40,rotation:.2,props:{}}];
  for (const [i,fill] of ['semi','solid','pattern','lined-fill'].entries()) shapes.push({...base,id:`shape:fill-${i}`,type:'geo',parentId:i<2?'shape:group':'page:audit',index:`a${i+2}`,x:i*160,y:100,opacity:.65,props:{...geo,w:120,h:90,color:'blue',fill,dash:'dashed',font:'mono',richText:toRichText(fill)},meta:i===0?{attachedLabel:{text:'Audit label',x:1.2,y:-.3,size:18,color:'#123456',background:'#ffffff'}}:{}});
  shapes.push({...base,id:'shape:arrow',type:'arrow',index:'a6',x:70,y:280,props:{...ArrowShapeUtil.prototype.getDefaultProps(),start:{x:0,y:0},end:{x:180,y:-90},richText:toRichText('Bound arrow')}});
  shapes.push({...base,id:'shape:note',type:'note',index:'a7',x:650,y:100,props:{...NoteShapeUtil.prototype.getDefaultProps(),richText:toRichText('Audit note')}});
  shapes.push({...base,id:'shape:image',type:'image',index:'a8',x:650,y:340,props:{...ImageShapeUtil.prototype.getDefaultProps(),assetId:asset.id,w:90,h:90,altText:'Audit image'}});
  shapes.push({...base,id:'shape:draw',type:'draw',index:'a9',x:30,y:400,props:{...DrawShapeUtil.prototype.getDefaultProps(),isComplete:true,segments:[{type:'free',path:b64Vecs.encodePoints([{x:0,y:0,z:.5},{x:50,y:25,z:.5},{x:100,y:0,z:.5}])}]}});
  const polygon=objectToShape({id:'audit-polygon',object:'polygon',x:280,y:-430,rotation:45,points:[{x:280,y:-430},{x:430,y:-430},{x:400,y:-320},{x:300,y:-340}],strokeColor:'#123456',fillColor:'transparent',strokeWidth:2,label:'Polygon audit',labelX:-.5,labelY:1.4,labelFontSize:20,labelColor:'#abcdef',labelBackground:'#ffffff'});
  shapes.push({...base,...polygon,index:'aA'});
  store.put([{id:'page:audit',typeName:'page',name:'3C audit',index:'a1',meta:{}},asset,...shapes,{id:'binding:audit',typeName:'binding',type:'arrow',fromId:'shape:arrow',toId:'shape:fill-0',meta:{},props:{terminal:'end',normalizedAnchor:{x:.5,y:.5},isExact:false,isPrecise:true,snap:'none'}}]);
  return store.getStoreSnapshot();
}
