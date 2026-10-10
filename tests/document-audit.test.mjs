import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DocumentRepository} from '../src/lib/whiteboard/document-store.ts';
import {fullDocument} from './fixtures/full-document.mjs';

test('all native records, image data, styles, polygon labels and bindings survive a fresh Node process',()=>{
  const dir=mkdtempSync(join(tmpdir(),'board-audit-')),path=join(dir,'board.json');
  try {
    const document=fullDocument(),repo=new DocumentRepository(path);
    repo.commit(0,0,document,[]);
    const script=`import {DocumentRepository} from ${JSON.stringify(new URL('../src/lib/whiteboard/document-store.ts',import.meta.url).href)};process.stdout.write(JSON.stringify(new DocumentRepository(process.argv[1]).read().document));`;
    const result=execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script,path],{cwd:resolve('.'),encoding:'utf8',stdio:['ignore','pipe','ignore']});
    assert.deepEqual(JSON.parse(result),document);
    const invalid=structuredClone(document);invalid.store['binding:audit'].toId='shape:missing';
    const before=readFileSync(path,'utf8');assert.throws(()=>repo.commit(1,0,invalid,[]));
    assert.equal(readFileSync(path,'utf8'),before);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
