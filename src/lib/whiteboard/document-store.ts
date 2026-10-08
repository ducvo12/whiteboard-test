import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TLStoreSnapshot, TLShapeId } from 'tldraw';
import { StoredObjectSchema, type StoredObjectSchemaType } from './schemas.ts';
import { validateDocument } from './document-schema.ts';

export type BoardCommand = { seq:number; kind:'put'; object:StoredObjectSchemaType } | {seq:number;kind:'delete';id:string} | {seq:number;kind:'clear'};
export type SavedBoard = {version:1;revision:number;document:TLStoreSnapshot|null;projection:StoredObjectSchemaType[];commands:BoardCommand[];sequence:number};
export class BoardConflict extends Error {}

/** Local, single-process repository. Writes replace the file atomically before publishing state. */
export class DocumentRepository {
  private state:SavedBoard;
  private path:string;
  constructor(path:string, legacy:StoredObjectSchemaType[] = []) {
    this.path=path;
    try {
      const saved = JSON.parse(readFileSync(path,'utf8')) as SavedBoard;
      if (saved.version !== 1 || !Number.isInteger(saved.revision) || !Number.isInteger(saved.sequence) || !Array.isArray(saved.commands)) throw new Error('Invalid saved board');
      if (saved.document) saved.document = validateDocument(saved.document);
      saved.projection = StoredObjectSchema.array().parse(saved.projection);
      for (const command of saved.commands) {
        if (!Number.isInteger(command.seq) || command.seq <= 0 || command.seq > saved.sequence) throw new Error('Invalid command sequence');
        if (command.kind === 'put') StoredObjectSchema.parse(command.object);
        else if (command.kind === 'delete' && typeof command.id === 'string') continue;
        else if (command.kind !== 'clear') throw new Error('Invalid command');
      }
      this.state = saved;
    } catch(error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
      this.state = {version:1,revision:0,document:null,projection:[],commands:[],sequence:0};
      // Import the existing process's unsaved legacy board exactly once.
      for (const object of StoredObjectSchema.array().parse(legacy)) this.enqueue({kind:'put',object});
    }
  }
  read() { return structuredClone(this.state); }
  view():StoredObjectSchemaType[] {
    const objects = new Map(this.state.projection.map(object=>[object.id,object]));
    for (const command of this.state.commands) {
      if (command.kind === 'clear') objects.clear();
      else if (command.kind === 'delete') objects.delete(command.id);
      else objects.set(command.object.id,command.object);
    }
    return structuredClone([...objects.values()]);
  }
  private publish(next:SavedBoard) {
    mkdirSync(dirname(this.path),{recursive:true});
    const temporary = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temporary,JSON.stringify(next));
    const fd = openSync(temporary,'r');
    try { fsyncSync(fd); } finally {closeSync(fd);}
    renameSync(temporary,this.path);
    this.state = next;
  }
  enqueue(command: Omit<Extract<BoardCommand,{kind:'put'}>,'seq'> | Omit<Extract<BoardCommand,{kind:'delete'}>,'seq'> | {kind:'clear'}) {
    const next = structuredClone(this.state);
    next.commands.push({...command,seq:++next.sequence});
    this.publish(next);
  }
  commit(expectedRevision:number, acknowledged:number, document:unknown, projection:unknown) {
    if (expectedRevision !== this.state.revision) throw new BoardConflict('The board was saved from another tab. Reload before continuing.');
    if (acknowledged !== this.state.sequence) throw new BoardConflict('New agent edits arrived. Apply them before saving.');
    const validated = validateDocument(document);
    const objects = StoredObjectSchema.array().parse(projection);
    const ids = new Set<string>();
    for (const object of objects) {
      const id = (object.id.startsWith('shape:') ? object.id : `shape:${object.id}`) as TLShapeId;
      if (!validated.store[id] || validated.store[id].typeName !== 'shape' || ids.has(object.id)) throw new Error('Invalid compatibility projection');
      ids.add(object.id);
    }
    const next:SavedBoard = {version:1,revision:this.state.revision+1,document:validated,projection:objects,commands:[],sequence:this.state.sequence};
    this.publish(next);
    return next.revision;
  }
}

const root = globalThis as typeof globalThis & { whiteboardDocumentRepository?:DocumentRepository;whiteboardObjects?:StoredObjectSchemaType[] };
export function getBoardRepository() {
  return root.whiteboardDocumentRepository ??= new DocumentRepository(
    process.env.WHITEBOARD_DATA_PATH ?? resolve(process.cwd(),'.data/whiteboard.json'), root.whiteboardObjects ?? []);
}
