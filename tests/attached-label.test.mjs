import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat } from 'tldraw';
import { labelPoint, labelFractions, readAttachedLabel } from '../src/lib/whiteboard/attached-label.ts';

test('label fractions follow parent resizing and round trip outside bounds', () => {
  const label = {x:1.2,y:-.1};
  const bounds = {x:10,y:20,w:200,h:100};
  const point = labelPoint(bounds,label);
  assert.deepEqual(point,{x:250,y:130});
  const restored = labelFractions(bounds,point);
  assert.ok(Math.abs(restored.x-label.x)<1e-10);
  assert.ok(Math.abs(restored.y-label.y)<1e-10);
  assert.equal(labelPoint({...bounds,w:400},label).x,490);
});

test('rotated parent transforms preserve local label drag coordinates', () => {
  for (const angle of [0,Math.PI/2,-Math.PI/4]) {
    const transform = Mat.Translate(150,-70).rotate(angle);
    const point = {x:120,y:-30};
    const world = transform.applyToPoint(point);
    const restored = Mat.From(Mat.Inverse(transform)).applyToPoint(world);
    assert.ok(Math.abs(restored.x-point.x)<1e-10);
    assert.ok(Math.abs(restored.y-point.y)<1e-10);
  }
});

test('invalid label metadata is ignored', () => {
  assert.equal(readAttachedLabel({meta:{attachedLabel:{text:'Invalid',size:-1,x:0,y:0}}}),null);
  assert.equal(readAttachedLabel({meta:{}}),null);
});
