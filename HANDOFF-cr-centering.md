# Handoff — Assign CR Centering to Foot Photos (clean slate)

**App:** Positioning Pro (radiography positioning trainer)
**File to edit:** `index.html` (single-file app, ~342 KB, minified-ish long lines)
**Status:** Starting fresh. User is uploading a NEW set of foot photos. Ignore any prior uploads (IMG_7831–7838). No edits made to `index.html` yet.

---

## The task

For each new foot photo the user uploads, assign a **CR (Central Ray) centering point** — the coordinate where the central ray should enter for that projection. In the app this is the `cr:{x,y}` target the draggable crosshair is graded against.

## Where CR centering lives in the code

`PROJECTION_LANDMARKS` (search for it in `index.html`, ~char offset 239884):

```js
const PROJECTION_LANDMARKS = {
  "Foot|AP":     {photo:"ap",     vb:"0 0 360 687", tol:32, cr:{x:185,y:375}, crLabel:"Base of 3rd metatarsal"},
  "Foot|Oblique":{photo:"oblique",vb:"0 0 360 687", tol:32, cr:{x:192,y:358}, crLabel:"Base of 3rd metatarsal"},
  "Foot|Lateral":{photo:"lateral",vb:"0 0 360 686", tol:30, cr:{x:175,y:322}, crLabel:"Medial cuneiform"}
};
```

- Keyed by `region|view`. Only Foot AP/Oblique/Lateral have atlas entries; everything else falls back to a generic schematic panel.
- `cr:{x,y}` is the centering target **in the viewBox coordinate space** (`vb`). Foot viewBox is `0 0 360 687` (w=360, h≈687).
- `tol` = pass/fail radius in px (hard mode ×0.7 — see `crGroupTolPx`).
- `photo` names a key into `CR_PHOTOS`.
- `crLabel` = anatomical landmark shown on reveal.

Photos are embedded base64 in `const CR_PHOTOS = {"ap":"data:image/jpeg;base64,...","oblique":...,"lateral":...}` (search `CR_PHOTOS`). `renderCrAtlasCard()` draws the photo into the viewBox with `preserveAspectRatio="xMidYMid slice"`, overlays the target ring at `atlas.cr`, then the draggable crosshair.

**Critical gotcha:** `slice` fills the viewBox and crops overflow. So `cr:{x,y}` must be set against the **displayed/cropped** framing in the 360×687 box, NOT the raw photo pixels. Whenever a photo is swapped, re-derive x/y from the new framing (account for how the image is centered and cropped to fill 360×687).

## Correct CR landmarks (radiography reference)

- **Foot AP (dorsoplantar):** CR to base of 3rd metatarsal, ~10° cephalad (toward heel).
- **Foot Oblique (medial rotation ~30–40°):** CR to base of 3rd metatarsal, perpendicular.
- **Foot Lateral (mediolateral):** CR to medial cuneiform / base of 3rd metatarsal, perpendicular.

## Workflow for the new photos

1. When user uploads, view each photo and identify its projection (AP / Oblique / Lateral) — confirm mapping with user if unclear.
2. Back up first: copy `index.html` → dated backup (a prior one exists: `index.backup-20260703-122023.html`).
3. Embed each photo as base64 into `CR_PHOTOS` under its slot key (`ap`/`oblique`/`lateral`).
4. Find the CR landmark on each photo, convert to viewBox coords against the `slice`-cropped framing, update `cr:{x,y}` (and `crLabel` if needed) in `PROJECTION_LANDMARKS`.
5. Adjust `tol` only if needed.
6. Verify the in-app self-test still passes (~offset 340152): Foot AP must have a photo atlas + ~10° cephalic angle; Foot Lateral CR on-spot passes and far-from-spot fails; non-foot projections have no atlas entry.

## Open questions to confirm with user on new upload

1. Slot mapping: which photo → AP / Oblique / Lateral?
2. Whether to replace all three slots or only some.
3. Any preferred `tol` (grading strictness) per view.
