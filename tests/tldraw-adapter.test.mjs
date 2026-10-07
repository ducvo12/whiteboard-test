import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat, GeoShapeUtil, ArrowShapeUtil, createTLStore } from 'tldraw';
import { objectToShape, shapeToObject, changedFields } from '../src/lib/whiteboard/tldraw-adapter.ts';

const paint = { strokeColor: '#344b2d', fillColor: '#c5d4b4', strokeWidth: 2, rotation: 0 };
function fixture(object) {
  const partial = objectToShape(object);
  const defaults = partial.type === 'arrow' ? ArrowShapeUtil.prototype.getDefaultProps() : GeoShapeUtil.prototype.getDefaultProps();
  const shape = { typeName: 'shape', parentId: 'page:page', index: 'a1', isLocked: false, opacity: 1, ...partial, props: { ...defaults, ...partial.props } };
  const store = createTLStore();
  store.put([shape]);
  const editor = { store, getBindingsFromShape: () => [], getTextOptions: () => ({}),
    getShapePageTransform: (s) => Mat.Translate(s.x, s.y).rotate(s.rotation) };
  return { shape, editor };
}
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`); }

for (const rotation of [0, 30, 90, 180, -45]) {
  for (const object of [
    { object: 'rect', x: -120, y: 240, w: 180, h: 90 },
    { object: 'circle', x: -40, y: 80, r: 33 },
    { object: 'textbox', x: 15, y: -70, w: 200, h: 100, text: 'Hello\nboard', textColor: '#123456', fontSize: 18 },
    { object: 'arrow', x: -40, y: 90, x2: 160, y2: -30 },
  ]) test(`${object.object}: coordinates and rotation ${rotation} round trip`, () => {
    const original = { id: 'roundtrip', ...paint, ...object, rotation };
    const { shape, editor } = fixture(original);
    const converted = shapeToObject(editor, shape);
    assert.equal(converted.object, object.object);
    for (const key of ['x', 'y', 'w', 'h', 'r', 'x2', 'y2']) if (key in object) close(converted[key], object[key]);
    close(Math.sin(converted.rotation * Math.PI / 180), Math.sin(rotation * Math.PI / 180));
    if (object.text) assert.equal(converted.text, object.text);
  });
}

test('moving an imported shape patches geometry without quantizing its original colors', () => {
  const original = { id: 'custom-color', ...paint, object: 'rect', x: 0, y: 0, w: 100, h: 100 };
  const { shape, editor } = fixture(original);
  const before = shapeToObject(editor, shape);
  const after = shapeToObject(editor, { ...shape, x: shape.x + 25 });
  assert.deepEqual(changedFields(before, after), { x: 25 });
});

test('unsupported polygons and non-circular ellipses are identified', () => {
  assert.equal(objectToShape({ id: 'polygon', ...paint, object: 'polygon', x: 0, y: 0, points: [{x:0,y:0},{x:10,y:0},{x:0,y:10}] }), null);
  const { shape, editor } = fixture({ id: 'circle', ...paint, object: 'circle', x: 0, y: 0, r: 10 });
  assert.equal(shapeToObject(editor, { ...shape, props: { ...shape.props, h: 30 } }), null);
});
