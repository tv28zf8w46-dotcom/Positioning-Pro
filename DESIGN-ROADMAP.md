# Positioning Pro — Design Roadmap

Ambitious design & interaction improvements. Everything here runs in the Capacitor WKWebView on iOS — no native code required.

**Before touching anything:** commit to git and push to GitHub, then work on a branch so every change is reversible.

---

## ✅ Shipped

Original roadmap numbers kept for reference.

- **#1 Full 3D exam room (Three.js)** — real WebGL scene (`Room3D`): orbitable camera, modeled table/wall bucky, ceiling tube, live SID readout. Replaced the CSS pseudo-3D room.
- **#6 Drag-to-position controls** — drag a crosshair onto the patient and dial the tube angle; graded by distance-from-target and degrees-off (`gradeCrDrag`, toggleable vs. tiles).
- **#10 Haptics + sound design** — `feedback-fx.js`: knob detents, success/failure cues, Capacitor haptics.
- **#14 Progress "constellation" → Skill Map** *(2026-07-17)* — a dedicated page with a large full-body silhouette (36 regions). A body part turns green/**proficient** after three 100% exposures of every view in one of its routines; amber **learning** from the first attempt. Laterality alternates so every extremity has its own limb; tap a part for per-view pip progress.
- **#16 Streak fire & combo multipliers** *(2026-07-17)* — combo multiplier tiers, screen-edge glow, flying score popups, persistent best-streak.
- **#18 Attending review** *(2026-07-17)* — "attending radiologist" commentary after a non-perfect exposure, listing only the missed/close fields, plus an end-of-SIM debrief. (A clear image gets no commentary.)
- **#19 Due-for-review queue** *(2026-07-17)* — per-projection history in localStorage; a projection stays "Due for review" until cleared with a 100%. (Simple queue, not a full spaced-repetition scheduler.)

---

## Flagship / True 3D

### 2. Poseable 3D patient
A rigged low-poly humanoid (glTF model, animated via Three.js skeleton) that actually assumes positions: supine, prone, RPO 45°, Sim's, upright lateral. A wrong position choice makes the patient visibly pose wrong — far more instructive than a stick figure.

### 3. Volumetric x-ray beam (custom shader)
A translucent cone from tube to detector rendered with a fragment shader: animated scanlines, falloff, collimation borders that tighten/expand as the student adjusts field size. Beam turns green/red on grade.

### 5. AR mode (WebXR / Capacitor plugin)
Project the tube and patient onto a real tabletop through the iPhone camera; the student physically walks around to set the projection. Ambitious, but it's the demo that gets people talking.

---

## High-Impact Interactivity

### 7. Physical control console
Replace kVp/mAs inputs with a skeuomorphic generator panel: rotary knobs, segmented LED displays, a two-stage "prep → expose" button with capacitor-charging whine and audible exposure tone.

### 8. Cinematic exposure sequence
On expose: room lights dim, collimator light snaps on, anatomical marker glints, beam flash, then the reference radiograph reveals on the wall monitor. ~2 seconds of theater that makes every rep satisfying.

### 9. 3D skull for positioning lines
The skull line drills (OML, IOML, GAL) drawn as glowing planes on a rotating 3D skull. Students rotate the skull until the line is perpendicular/parallel to the IR. The hardest thing to visualize from textbooks — huge pedagogical win.

---

## Visual Polish & Identity

### 11. Design-system pass
The slate/cyan base is strong — push it: a custom display typeface for the hero, consistent 8-pt spacing scale, glassmorphism only on floating panels, one accent gradient. Cut the ~14 different border-radius values down to 3.

### 12. Animated view transitions
Use the View Transitions API (supported in modern WKWebView) so picker → room → review morph into each other instead of hard `innerHTML` repaints.

### 13. Patient body-type variety
Multiple patient body types (asthenic / sthenic / hypersthenic) that change the technique the student should choose. Reinforces reading habitus off the patient rather than memorizing one number.

### 15. Dark radiology-suite ambiance
Subtle animated elements: flickering viewbox monitors on the wall, drifting dust in the beam cone, reflective floor (CSS mask gradient). Depth without performance cost.

---

## Engagement Systems

### 17. Timed "trauma shift" mode
Orders arrive with siren/pager sounds; the student completes a random trauma routine against a clock. Leaderboard vs. their own bests.

---

## Decided against

- **Simulated radiograph output** — the app already shows real reference radiographs after a clear image; a synthesized/stylized film added noise without pedagogical value.
- **Requisition / hospital-order cards** — cut on review; cluttered the projection screen.

---

## Suggested next build

**Cinematic exposure sequence (#8)** layered onto the existing 3D room and drag-to-position — the pieces that make each rep feel like a real exposure are the remaining high-value, low-risk polish.
