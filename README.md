# Whiteboard AI agent test

Creating a harness around gpt5.6 to allow it to write and draw on a whiteboard canvas. full stack nextjs app

run "/codex login" on first boot

## Current storage — pass 3C

This supersedes the storage limitations described in the earlier pass notes below.
The complete tldraw document is authoritative and saved locally in
`.data/whiteboard.json` (ignored by Git). Set `WHITEBOARD_DATA_PATH` to use
another durable file location. Native shape records, rich text, styles, opacity,
pages, groups, bindings, assets, polygon data and attached-label metadata are
saved together. Browser refresh and server restart retain the saved document.
This repository supports one server process; it is not a multiplayer service.

The old in-memory object array is removed. Existing agent tools use a materialized
compatibility projection of supported shapes and a durable command queue. An
open board applies those commands and saves the resulting document; queued
commands survive restart even when no board is open. Unsupported native shapes
are preserved in the document but are not exposed through the existing tools.
The agent loop and legacy screenshot feedback remain unchanged in this pass.

Saves validate records and atomically replace the file. Revision checks reject
stale saves. Overlapping local and agent edits stop synchronization and preserve
an unsaved browser recovery copy when space permits. Download the board before
reloading after a conflict; then use **Board file → Recover copy** if desired.
**Download board** and **Restore board** export/import the full document as JSON.
Restoring replaces the board and retains a browser recovery copy of the previous
document when space permits. Invalid files leave the current board intact.

### Verification before the next pass

- [x] Production build and TypeScript checks.
- [x] Changed component and storage lint checks.
- [x] Document round-trip with groups, bindings, rich text, styles and labels.
- [x] Repository restart, legacy migration, stale saves and corrupt-file rejection.
- [ ] Manually confirm semi, solid and patterned fills survive refresh.
- [ ] Draw freehand, add a note and image, group shapes and bind an arrow; refresh.
- [ ] Move and edit attached labels, including rotated polygons; refresh.
- [ ] Ask the agent to edit a shape and confirm native styling remains intact.
- [ ] Download, restore, refresh, and confirm the complete board returns.
- [ ] Edit in two tabs and confirm a conflict preserves the unsaved board.

Complete the unchecked interaction checklist before beginning the next pass.

## tldraw migration — pass 1

The home page now mounts the native tldraw editor in a browser-only component.
The chat sidebar is preserved, and the editor reserves space for it on desktop
and mobile. The old whiteboard implementation remains available in the source
for subsequent migration passes.

At the end of pass 1, tldraw was not connected to `/api/objects`, the agent, or the server
screenshot renderer. Chat still operates on the old server board. Drawings in
the new editor are temporary and reset on reload; saving and synchronization
are deferred to the data integration pass.

The current pass 2 implementation below supersedes those limitations.

### Verification

- [x] Editor loads in the development browser.
- [x] Rectangle drawing, selection, moving, resizing, and rotation.
- [x] Undo and redo.
- [x] Hand keyboard shortcut, panning, and zoom controls.
- [x] Chat closes and reopens while retaining editor content.
- [x] Desktop layout and 390 × 844 mobile layout with chat open and closed.
- [x] Production compilation and TypeScript via `npx next build --webpack`.
- [x] Lint for the new editor and updated page.
- [ ] Full repository lint: existing errors remain in the legacy canvas and agent.
- [ ] Default Turbopack production build: environment blocks a worker port.

Before pass 2, manually try your usual drawing and keyboard interactions.
For a production deployment, configure `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` with
an appropriate tldraw license key.

## tldraw migration — pass 2

The tldraw editor and the existing agent now share `/api/objects`. Native
rectangles, circles, straight arrows, and text synchronize in both directions.
The existing agent loop, tool schemas, and screenshot renderer are unchanged.
The board array is shared on `globalThis` so independently bundled Next.js
routes see the same state. It remains development-only, single-process memory:
browser refresh retains saved objects; a server restart does not.

The bridge converts Cartesian Y-up coordinates and center-based degree rotations
to tldraw's Y-down coordinates and origin-based radians. Stable IDs make create
retries idempotent. Field-level patches preserve untouched original properties.
Conditional writes reject conflicts rather than silently overwrite an agent's
edit. Remote changes bypass undo history and never echo back as new saves.
Polling pauses during drawing/text editing; pending local edits are protected.
The editor shows saving/error notices and warns before leaving with unsaved work.

### Verification before pass 3

- [x] Coordinate round trips for all four supported types at five rotations.
- [x] Geometry edits preserve untouched arbitrary server colors.
- [x] Manual rectangle creation reaches the API.
- [x] Existing AI creates a circle that appears on tldraw.
- [x] Manual movement and saved objects survive browser refresh.
- [x] Manual deletion and undo restore the object.
- [x] Duplicate create retries produce one server object.
- [x] Conflicting updates/deletes return 409; unrelated field updates succeed.
- [x] TypeScript, changed-file lint, and webpack production build.
- [ ] Exact styling, movable labels, and polygon editing: pass 3.

Run the focused checks with:

```sh
node --experimental-strip-types --test --test-force-exit tests/tldraw-adapter.test.mjs
# With npm run dev running:
node --test tests/board-api.test.mjs
```

### Limits at the end of pass 2 (superseded by pass 3 below)

- Polygons remain intact in server data but are not rendered yet; a notice says so.
- Freehand drawings, images, notes, curved/elbow arrows, and non-circular ellipses
  are local-only and show an unsupported-shape notice. They do not survive reload.
- Native text reloads as a textbox; rich formatting is reduced to plain text.
- Arbitrary colors, separate stroke/fill colors, precise font sizes, fill opacity,
  label positioning, dash patterns, and other advanced styling are approximated
  in the editor. Untouched original server fields remain intact. The existing
  server screenshot reflects the legacy rendering, not exact tldraw styling.
- Groups/bindings are not persisted as relationships. Supported children and
  straight-arrow endpoints are saved as board-space geometry.
- This polling adapter is a development bridge, not a multiplayer backend.


## tldraw migration — pass 3 (initial implementation)

All five server object types now render as custom tldraw shapes: rectangles,
circles, polygons, arrows, and textboxes. They use the existing board renderer
inside tldraw so arbitrary stroke/fill colors, fill opacity, stroke width,
textbox font size/color, and label size/color/background/position are preserved.
The existing agent loop, tool schemas, and server screenshot pipeline are unchanged.

Use **Add shape** for any of the five types. Select a shape to edit its exact
properties. Polygon vertices and arrow endpoints have draggable handles; a
label has its own position handle. Polygon properties can add or remove vertices.
Select a shape and press Enter to edit its text or label, then Escape to finish.
Normal tldraw selection, movement, resizing, rotation, and undo/redo still apply.
Grid and Cartesian axes can be toggled, and the pointer readout uses Y-up coordinates.
Native rectangle/circle/straight-arrow/text creations become board shapes after
saving; use their property panel for subsequent exact styling.

### Verification before pass 4

- [x] All five types round-trip through the adapter at five rotations.
- [x] Exact colors, opacity, stroke widths, font sizes, and label fields survive conversion.
- [x] Polygon resizing scales vertices while retaining stroke and font sizes.
- [x] Browser: polygon creation, vertex dragging, adding/removing vertices, and rotation.
- [x] Browser: label dragging updates its coordinates; undo restores label position.
- [x] Browser: property edits can be undone, and Enter opens textbox editing.
- [x] Browser: saved polygon geometry, rotation, styling, and labels survive refresh.
- [x] Desktop and 390 × 844 mobile controls remain accessible with chat open.
- [x] 28 adapter tests, API conflict/retry checks, changed-file lint, and webpack production build.
- [ ] Before proceeding, try your usual AI prompts and compare their drawings with screenshots.
- [ ] Before proceeding, try your usual selection, resizing, undo/redo, and label edits.

### Remaining limits

- Board storage is still single-process memory; server restarts clear it.
- Freehand drawings, images, notes, curved/elbow arrows, and non-circular ellipses
  remain local-only and show a notice. Groups/bindings are not persisted as relationships.
- The server schema supports plain text and solid strokes. Native rich formatting,
  dash patterns, and special fills are reduced when converted to board shapes.
- The screenshot endpoint renders server objects with the existing renderer;
  it does not capture tldraw controls, selections, grid, or axes.
- Polling remains a development bridge, not multiplayer persistence.


## tldraw migration — pass 3A

Standard server objects now import as native tldraw shapes: rectangles/circles
and boxed text use geo shapes, arrows use native arrows, and native text-tool
creations stay text shapes. Saving no longer replaces native shapes with custom
ones. Native label editing, font/alignment controls, styles, and selection behavior
remain available. The agent loop and tool definitions are unchanged.

Only editable polygons use the custom board shape. They declare tldraw's shared
color, size, fill, and dash properties and use the native opacity setting. The
native style panel stays visible, including for mixed selections. The polygon
panel contains only its extra vertex and label controls, on the left so it does
not cover native styling. Add shape inherits the current shared style defaults.
The later fill consistency correction below replaces the initial custom outline/fill rendering.

The bridge keeps styles it cannot represent when applying unrelated server edits.
For example, moving an object through the agent does not reset its native dash or
font choice. Existing server colors are retained on geometry-only saves even when
the native display maps them to a palette color.

### Verification before 3B

- [x] Standard objects import as native shapes; only polygons use custom geometry.
- [x] Coordinate round trips for all five object types at five rotations.
- [x] Polygon shared color, size, and fill changes reach the agent projection.
- [x] Agent geometry updates preserve native-only style and rich-text properties.
- [x] Browser: polygon color, dashed outline, fill, thickness, labels, and movement.
- [x] Browser: Add shape creates native rectangles and exposes native text/alignment controls.
- [x] 30 adapter tests, API checks, TypeScript, changed-file lint, and webpack build.
- [ ] Try native rectangle/circle/arrow/text creation, styling, and undo/redo.
- [ ] Try polygon vertex edits and styling a mixed native/polygon selection.
- [ ] Try your usual AI prompts and confirm their objects remain editable.

### Deliberately deferred

- 3B: advanced attached-label positioning and styling on native shapes. Existing
  label coordinates/backgrounds remain in server data but native labels currently
  use native placement; textbox secondary labels are not displayed separately.
- 3C: authoritative tldraw document storage and matching screenshots. Until then,
  refresh rebuilds from the old object schema: native-only dash, overall opacity,
  font/rich-text choices, bindings, and unsupported shapes are not fully retained.
  Agent screenshots still use the old renderer and can differ from the editor.
- Arbitrary colors, independent stroke/fill colors, and exact font/line sizes map
  to native palette/size choices for display. Untouched server values remain intact.
- Server storage remains process memory and resets on restart.


## tldraw migration — pass 3B (current)

Native shapes keep their normal tldraw labels. Select a supported native shape,
open **Label options**, and choose **Add advanced label** for independent text,
position, exact font size, text color, and background. Drag the label directly or
edit Label X/Y (fractions of the parent bounds; Y increases upward). Positions may
extend beyond the shape. Plain geometric/arrow label text transfers to the advanced
label when enabled. Textbox body text stays separate from its annotation.

Advanced labels are parent-owned metadata, rendered in a canvas overlay. Their
position follows the parent's local coordinate system, including resizing and
rotation. Duplication copies the label, deletion removes it, and undo/redo restores
both together. Clicking a label selects its parent. Locked parents prevent edits.
The polygon retains its existing label and vertex handles.

The existing object bridge saves these settings as label/labelX/labelY/
labelFontSize/labelColor/labelBackground, so refresh and agent edits retain them.
Server objects with explicit advanced positioning/background/size load using the
extension automatically. The agent loop and tool definitions are unchanged.
Duplication now gets an independent server ID even when native tldraw copies the
original object's metadata.

### Verification before 3C

- [x] Exact advanced label fields round trip for native rectangles, arrows, and textboxes.
- [x] Plain native labels remain native without advanced options.
- [x] Relative positioning and rotated-parent coordinate calculations are tested.
- [x] Browser: add/edit/drag labels, including outside the parent bounds.
- [x] Browser: label drag undo/redo, parent movement, and resizing.
- [x] Browser: textbox body text and separate annotation coexist.
- [x] Browser: advanced labels and settings survive refresh.
- [x] Browser: duplicate/delete/undo carries the label with its parent.
- [x] 36 focused tests, API checks, TypeScript, changed-file lint, and webpack build.
- [ ] Try your normal AI prompts with label positions, colors, backgrounds, and sizes.
- [ ] Try label dragging after rotating a shape, plus zoom/pan and mobile input.
- [ ] Try native label editing alongside advanced labels and polygon label handles.

Run focused tests with:

```sh
node --experimental-strip-types --test --test-force-exit tests/tldraw-adapter.test.mjs tests/attached-label.test.mjs
```

### Remaining work for 3C

Full tldraw document storage, matching screenshots/exports, and native-only style
persistence remain deferred. Advanced labels are an HTML overlay and are not yet
included in native tldraw SVG/image export. The server screenshot still renders
saved label fields with the legacy renderer, so wrapping and bounds can differ.
There is one advanced label per shape; polygon labels use their existing renderer.
Advanced text is edited through Label options; native text uses normal tldraw editing.
Server memory still resets on restart.


### Polygon fill consistency correction

Polygon bodies now delegate to tldraw's native GeoShapeUtil renderer through a
rendering-only polygon path. Native theme colors, Draw/dash strokes, zoom handling,
all six fill modes, and pattern export definitions are reused directly. Custom
polygon vertices and labels remain unchanged. The rendering-only geo record is
never added to the document or the shape picker.

Semi uses the theme's opaque background-like color; Solid uses the selected
color's pastel variant. Fill and Lined fill use their respective native theme
colors, and Pattern uses native pattern rendering. Overall shape opacity remains
controlled by tldraw. There is no separate hidden polygon fill setting.

Verified with 48 tests (including every fill mode in light/dark themes), TypeScript,
changed-file lint, webpack build, and browser Semi/Pattern/Lined fill checks.
Exact fill-mode persistence across refresh remains part of 3C.
