export default function CanvasHud({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
  onOrigin,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
  onOrigin: () => void;
}) {
  return (
    <div className="canvas-hud" role="toolbar" aria-label="Canvas controls">
      <button type="button" aria-label="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button
        type="button"
        className="zoom-readout"
        aria-label="Reset zoom to 100 percent"
        onClick={onResetZoom}
      >
        {`${Math.round(zoom * 100)}%`}
      </button>
      <button type="button" aria-label="Zoom in" onClick={onZoomIn}>
        +
      </button>
      <span className="hud-sep" aria-hidden="true" />
      <button type="button" onClick={onFit}>
        Fit
      </button>
      <button type="button" onClick={onOrigin}>
        Origin
      </button>
    </div>
  );
}
