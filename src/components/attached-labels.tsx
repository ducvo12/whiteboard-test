"use client";

import { useRef, type ReactNode } from 'react';
import { Mat, toRichText, useEditor, useValue, type TLShape } from 'tldraw';
import { labelFractions, labelFromObject, labelPoint, type AttachedLabel } from '@/lib/whiteboard/attached-label';
import { readShapeLabel, attachedLabelUpdate } from '@/lib/whiteboard/polygon-label';
import { shapeToObject } from '@/lib/whiteboard/tldraw-adapter';

export function LabelOptions({ shape, children }: { shape: TLShape; children?: ReactNode }) {
  const editor = useEditor();
  const label = readShapeLabel(shape);
  if ((shape.type !== 'board-object' && shape.type !== 'geo' && shape.type !== 'arrow' && shape.type !== 'text') || !shapeToObject(editor, shape)) return null;
  const locked = editor.getIsReadonly() || editor.isShapeOrAncestorLocked(shape);
  function update(next: AttachedLabel) {
    if (locked) return;
    editor.markHistoryStoppingPoint('Edit attached label');
    editor.updateShape(attachedLabelUpdate(shape, next));
  }
  function clear() {
    if (locked) return;
    editor.markHistoryStoppingPoint('Clear attached label');
    editor.updateShape(attachedLabelUpdate(shape, null));
  }
  return <details className="board-properties" open key={shape.id} onPointerDown={e => e.stopPropagation()}>
    <summary>Label options</summary>
    <div className="board-property-fields">
      {!label ? <><p>Keep native text editing, or use a separately positioned label.</p><button disabled={locked} onClick={() => {
        if (locked) return;
        if (shape.type === 'board-object') {
          update({ ...labelFromObject(shapeToObject(editor, shape)!), text: 'Label' });
          return;
        }
        if (shape.type !== 'geo' && shape.type !== 'arrow' && shape.type !== 'text') return;
        const object = shapeToObject(editor, shape)!;
        const attached = labelFromObject(object);
        attached.text ||= 'Label';
        editor.markHistoryStoppingPoint('Attach label');
        editor.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, attachedLabel: attached },
          ...((shape.type === 'geo' && shape.meta.boardKind !== 'textbox') || shape.type === 'arrow' ? { props: { richText: toRichText('') } } : {}) });
      }}>Add advanced label</button></> : <>
        <p>Drag the label on the canvas. It follows its shape when moved, resized, or rotated.</p>
        <label>Label text<textarea aria-label="Advanced label text" value={label.text} disabled={locked} onKeyDown={e => e.stopPropagation()} onChange={e => update({ ...label, text: e.target.value })} /></label>
        {(['x','y','size','color','background'] as const).map(key => <label key={key}>{({x:'Label X',y:'Label Y',size:'Label size',color:'Label color',background:'Label background'})[key]}
          <input aria-label={`Advanced label ${key}`} value={label[key]} disabled={locked}
            type={['x','y','size'].includes(key) ? 'number' : 'text'} step={key === 'size' ? 1 : .05}
            onKeyDown={e => e.stopPropagation()} onChange={e => {
              const value = ['x','y','size'].includes(key) ? e.target.valueAsNumber : e.target.value;
              if (typeof value === 'number' && (!Number.isFinite(value) || (key === 'size' && value <= 0))) return;
              update({ ...label, [key]: value });
            }} />
        </label>)}
        <button disabled={locked} onClick={clear}>Clear label</button>
      </>}
      {children}
    </div>
  </details>;
}

export function AttachedLabels() {
  const editor = useEditor();
  const drag = useRef<{ id: string; label: AttachedLabel; point: {x:number;y:number} } | null>(null);
  const state = useValue('attached label positions', () => ({
    shapes: editor.getCurrentPageShapes(), zoom: editor.getCamera().z,
    screen: editor.getViewportScreenBounds(), selected: editor.getSelectedShapeIds(),
    // Subscribe to camera movement as well as zoom.
    camera: editor.getCamera(),
  }), [editor]);
  return <div className="attached-label-layer">{state.shapes.map(shape => {
    const label = readShapeLabel(shape);
    if (!label?.text.trim()) return null;
    const bounds = editor.getShapeGeometry(shape).bounds;
    const transform = editor.getShapePageTransform(shape);
    const center = editor.pageToScreen(transform.applyToPoint(labelPoint(bounds, label)));
    const localPointer = (e: React.PointerEvent) => Mat.From(Mat.Inverse(transform)).applyToPoint(editor.screenToPage({x:e.clientX,y:e.clientY}));
    return <button key={shape.id} className="attached-label" aria-label={`Move label: ${label.text}`}
      data-selected={state.selected.includes(shape.id)}
      style={{ left: center.x - state.screen.x, top: center.y - state.screen.y, fontSize: label.size,
        color: label.color, background: label.background, opacity: shape.opacity,
        transform: `translate(-50%, -50%) rotate(${transform.rotation()}rad) scale(${state.zoom})` }}
      onPointerDown={e => {
        e.stopPropagation(); e.preventDefault();
        if (editor.getIsReadonly() || editor.isShapeOrAncestorLocked(shape)) return;
        editor.markHistoryStoppingPoint('Move attached label');
        editor.setSelectedShapes([shape.id]);
        drag.current = { id:shape.id, label, point:localPointer(e) };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (drag.current?.id !== shape.id) return;
        e.stopPropagation();
        const original = labelPoint(bounds, drag.current.label), pointer = localPointer(e);
        const position = labelFractions(bounds, {x:original.x + pointer.x - drag.current.point.x,y:original.y + pointer.y - drag.current.point.y});
        editor.updateShape(attachedLabelUpdate(shape, {...label,...position}));
      }}
      onPointerUp={e => { if (drag.current?.id === shape.id) { e.stopPropagation(); drag.current = null; editor.markHistoryStoppingPoint('Finish moving label'); } }}
      onPointerCancel={() => { if (drag.current?.id === shape.id) { editor.updateShape(attachedLabelUpdate(shape, drag.current.label)); drag.current=null; } }}
    >{label.text}</button>;
  })}</div>;
}
