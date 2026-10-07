# Whiteboard AI agent test

Creating a harness around gpt5.6 to allow it to write and draw on a whiteboard canvas. full stack nextjs app

run "/codex login" on first boot

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

## tldraw migration — pass 2 (current)

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

### Known limits

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
