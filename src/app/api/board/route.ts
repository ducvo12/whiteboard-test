import { BoardConflict, getBoardRepository } from '@/lib/whiteboard/document-store';
export const runtime = 'nodejs';
export async function GET() {
  try { return Response.json(getBoardRepository().read(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'Saved board could not be read. The stored file has been kept intact.'},{status:500}); }
}
export async function PUT(request:Request) {
  try {
    const text = await request.text();
    if (text.length > 30_000_000) return Response.json({error:'Board exceeds the 30 MB local storage limit.'},{status:413});
    const input = JSON.parse(text);
    if (!Number.isInteger(input.expectedRevision) || !Number.isInteger(input.acknowledged)) throw new Error('Invalid save revision');
    const revision = getBoardRepository().commit(input.expectedRevision,input.acknowledged,input.document,input.projection);
    return Response.json({revision});
  } catch(error) {
    if (error instanceof BoardConflict) return Response.json({error:error.message},{status:409});
    return Response.json({error: error instanceof Error ? error.message : 'Board save failed.'},{status:400});
  }
}
