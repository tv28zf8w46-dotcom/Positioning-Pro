# Handoff — Incorporate SID/Bucky drill + shader beam into the app's Room3D

**Goal:** Replace the app's existing Bucky + SID selection with our polished version, make it the default, grade only on Expose (no feedback before), and add the volumetric green shader beam to the existing Room3D. Use the app's EXISTING patient/tube positioning (do not rebuild it).

**File:** `index.html` (live app, ~742 KB). **Back up first** (a backup was made this session: `index.backup-*.html`).

## What already exists in the app (confirmed)
- **Room3D** — "real WebGL exam room (Three.js). Replaces the SVG pseudo-3D room." Persistent renderer re-parented into `#room3d-mount` each render cycle; state passed via `data-*` attrs. (Note: the room code uses Three **without** the `THREE.` prefix — read the whole Room3D block before touching the scene.)
- **Patient/tube positioning** already per-projection: `getCrTarget`, `crPanelPose`, `POSITION_GROUPS` (12 refs), 40+ `patient` refs.
- **IR (Bucky) selection UI** — `.ir-select` / `.ir-btn` buttons overlaid on the room, calling `pick('ir', <value>)`. Existing values already match ours: **`Non-Bucky`**, **`Table bucky`**, **`Wall bucky`**.
- **SID selection** — buttons calling `pick('sid', '<option>')`. Exam SID values in data: **`40`, `60`, `72`** (strings).
- **Answer setter** — `function pick(field,value){ if(state.showDetails)return; state.answers[field]=value; render(); }`. Grading is deferred; details/feedback only show when `state.showDetails` is true (i.e., after Expose). So "no confirmation until Expose" is already the model — just don't surface correctness in the new UI.

## Change list (precise)
1. **SID control → sticky slider.** Replace the SID buttons with a slider that **snaps to 40 and 72** (within ±3), keeps 60 reachable, and on change calls `pick('sid', String(value))` (app stores SID as a string — match that). Show the value in inches, no green/red.
2. **Bucky control → our 3-way.** Keep/relabel the existing `.ir-btn` set to `Non-Bucky` / `Table bucky` / `Wall bucky`, calling `pick('ir', ...)` with those exact strings. Remove any duplicate/old SID+Bucky tiles from the flat answer card so there's only ONE place to set them (the room). Confirm the flat `renderChoiceCard` path for fields `sid` and `ir` is suppressed when Room3D is active.
3. **No spoilers.** The new SID/Bucky controls must not reveal correctness before Expose — mirror `state.showDetails` gating (only style as "selected", never "correct/incorrect").
4. **Shader beam.** In the Room3D scene, replace the current beam mesh with the volumetric `ShaderMaterial` cone from `beam-shader.html` / `exam-room-3d.html` (fresnel edge glow + travelling scanlines, green `0x6ee7b7`, additive, depthWrite:false). Drive `uTime` from the room's animation loop. Orient/scale it from the app's already-correct focal-spot → detector positions. Locate the existing beam object in Room3D first and swap its material+geometry, keeping its transform pipeline.
5. **Auto behaviors already handled by positioning:** wall selection → horizontal tube, centering + CR angle come from `getCrTarget` / 2D activity. Don't duplicate those.

## Correct-value reference (for grading, already in EXAMS)
- IR: `Non-Bucky`, `Table bucky`, `Wall bucky`
- SID: `40`, `60`, `72` (strings)

## Execution notes / risks
- Read the full **Room3D** block (search `Room3D`) before editing the scene — it doesn't use the `THREE.` prefix, so identify how the beam mesh + render loop are structured there.
- Make the UI edits (slider/buttons → `pick`) first and verify in isolation; then do the shader-beam swap.
- Keep everything gated on `state.showDetails` so nothing spoils the answer pre-Expose.
- Sync `www/index.html` from root after (webDir = www), back up, and run a JS syntax check on the `<script>` blocks.
