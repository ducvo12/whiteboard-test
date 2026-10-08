import { createTLSchema, defaultShapeSchemas, DefaultColorStyle, DefaultSizeStyle, DefaultFillStyle, DefaultDashStyle, type TLStoreSnapshot } from '@tldraw/tlschema';
import { T } from '@tldraw/validate';
import { BoardObjectSchema } from './schemas.ts';

export const polygonRecordProps = { w:T.number,h:T.number,data:T.string,
  color:DefaultColorStyle,size:DefaultSizeStyle,fill:DefaultFillStyle,dash:DefaultDashStyle };
export const boardDocumentSchema = createTLSchema({shapes:{...defaultShapeSchemas,'board-object':{props:polygonRecordProps}}});

export function validateDocument(input: unknown): TLStoreSnapshot {
  if (!input || typeof input !== 'object' || !('schema' in input) || !('store' in input)) throw new Error('Invalid board document');
  const migrated = boardDocumentSchema.migrateStoreSnapshot(input as TLStoreSnapshot);
  if (migrated.type !== 'success') throw new Error(`Board document migration failed: ${migrated.reason}`);
  const records = migrated.value;
  for (const [id,record] of Object.entries(records)) {
    const type = boardDocumentSchema.types[record.typeName];
    if (!type || type.scope !== 'document' || record.id !== id) throw new Error('Invalid document record');
    type.validate(record);
    if (record.typeName === 'shape') {
      if (!records[record.parentId]) throw new Error('Missing shape parent');
      const visited = new Set<string>([record.id]);
      let parent = records[record.parentId];
      while (parent?.typeName === 'shape') {
        if (visited.has(parent.id)) throw new Error('Cyclic shape parents');
        visited.add(parent.id); parent = records[parent.parentId];
      }
      if (!parent || parent.typeName !== 'page') throw new Error('Invalid shape parent');
      if (record.type === 'board-object') {
        const object = BoardObjectSchema.parse(JSON.parse(record.props.data));
        if (object.object !== 'polygon') throw new Error('Expected polygon data');
      }
    }
    if (record.typeName === 'binding' && (!records[record.fromId] || !records[record.toId])) throw new Error('Missing binding target');
  }
  if (!Object.values(records).some(r=>r.typeName === 'page')) throw new Error('Missing board page');
  return {store:records,schema:boardDocumentSchema.serialize()};
}
