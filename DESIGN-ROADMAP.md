# Positioning Pro — Design Roadmap

Ambitious design & interaction improvements, roughly ordered by ambition. Everything below runs in the Capacitor WKWebView on iOS — no native code required.

**Before touching anything:** commit to git and push to GitHub, then work on a branch (`git checkout -b redesign`) so every change is reversible.

---

## Flagship / True 3D

### 1. Full 3D exam room (Three.js)
Replace the CSS pseudo-3D room with a real WebGL scene: orbitable camera, modeled x-ray table, wall bucky, ceiling-mounted tube on rails. Students drag the tube along its rails, rotate the gantry for cephalic/caudal angles, and the SID readout updates live. The single biggest visual upgrade possible.

### 2. Poseable 3D patient
A rigged low-poly humanoid (glTF model, animated via Three.js skeleton) that actually assumes positions: supine, prone, RPO 45°, Sim's, upright lateral. A wrong position choice makes the patient visibly pose wrong — far more instructive than a stick figure.

### 3. Volumetric x-ray beam (custom shader)
A translucent cone from tube to detector rendered with a fragment shader: animated scanlines, falloff, collimation borders that tighten/expand as the student adjusts field size. Beam turns green/red on grade.

### 4. Simulated radiograph output
After "Expose," render the resulting image: a stylized radiograph (SVG or shader-based) showing the consequences of errors — too-low kVp = underpenetrated/white, wrong CR = clipped anatomy, wrong angle = distorted joint spaces. Grading becomes visual, not just text.

### 5. AR mode (WebXR / Capacitor plugin)
Project the tube and patient onto a real tabletop through the iPhone camera; the student physically walks around to set the projection. Ambitious, but it's the demo that gets people talking.

---

## High-Impact Interactivity

### 6. Drag-to-position controls
Instead of picking CR from tiles, drag a crosshair onto the patient and rotate an angle dial for the tube. Grade by distance-from-target and degrees-off. Turns multiple choice into motor practice — which is what positioning actually is.

### 7. Physical control console
Replace kVp/mAs inputs with a skeuomorphic generator panel: rotary knobs, segmented LED displays, a two-stage "prep → expose" button with capacitor-charging whine and audible exposure tone.

### 8. Cinematic exposure sequence
On expose: room lights dim, collimator light snaps on, anatomical marker glints, beam flash, then the radiograph "develops" in on the wall monitor. ~2 seconds of theater that makes every rep satisfying.

### 9. 3D skull for positioning lines
The skull line drills (OML, IOML, GAL) drawn as glowing planes on a rotating 3D skull. Students rotate the skull until the line is perpendicular/parallel to the IR. The hardest thing to visualize from textbooks — huge pedagogical win.

### 10. Haptics + sound design
Capacitor Haptics plugin: click on knob detents, thud on bucky selection, success/failure haptic patterns. Cheap to add, massive feel upgrade on iOS.

---

## Visual Polish & Identity

### 11. Design-system pass
The slate/cyan base is strong — push it: a custom display typeface for the hero, consistent 8-pt spacing scale, glassmorphism only on floating panels, one accent gradient. Cut the ~14 different border-radius values down to 3.

### 12. Animated view transitions
Use the View Transitions API (supported in modern WKWebView) so picker → room → review morph into each other instead of hard `innerHTML` repaints.

### 13. Patient variety
Multiple patient body types/skin tones, randomized per order, with the "incoming order" card styled as a hospital requisition (patient name, DOB, clinical history). Reinforces reading real orders.

### 14. Progress constellation
Replace the practice log grid with a zoomable body map: each region glows brighter as mastery grows, failed projections pulse red. A "skill skeleton" instead of a stats table.

### 15. Dark radiology-suite ambiance
Subtle animated elements: flickering viewbox monitors on the wall, drifting dust in the beam cone, reflective floor (CSS mask gradient). Depth without performance cost.

---

## Engagement Systems

### 16. Streak fire & combo multipliers
Visible streak meter that charges up, screen-edge glow at high combo, score popups that fly to the total. Duolingo-style retention mechanics.

### 17. Timed "trauma shift" mode
Orders arrive with siren/pager sounds; the student completes a random trauma routine against a clock. Leaderboard vs. their own bests.

### 18. Ghost replay / attending review
After a SIM, replay the student's choices step-by-step with an "attending radiologist" commentary track explaining each miss.

### 19. Spaced-repetition scheduler
Track per-projection error history in localStorage and surface a daily "Due for review" queue on launch.

---

## Suggested first build

Highest-value combo: **real 3D room (#1) + drag-to-position (#6) + cinematic exposure (#8)** — one coherent upgrade that transforms both look and pedagogy.
