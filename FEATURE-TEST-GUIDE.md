# Positioning Pro — New Feature Test Guide

Prototypes built from the design roadmap. Every file lives in `Source Code For GITHUB/`, is **standalone**, and does **not** touch the live app (`index.html`). Nothing here can break the app.

## How to launch everything
Open **`features-hub.html`** in a browser (double-click). It's a launcher with a card for each prototype — click a card to open that demo. To go back, use the browser Back button.

## Environment notes (read first)
- **Best browser:** Chrome or Edge (desktop) for full support; Safari works for most.
- **Internet required for the 3D + shader demos** (`exam-room-3d`, `skull-lines-3d`, `beam-shader`) — they load Three.js from a CDN. If offline, you'll see a "needs internet" message instead of a black screen.
- **Sound demos** (`control-console`, `feedback-fx`, `arcade`) need one click first — browsers block audio until you interact. Turn volume up.
- **AR + haptics** only fully work on a phone; on desktop they show a labeled fallback.
- If a page ever looks blank, open the browser console (F12) — every demo prints its self-test result there and on-screen.

---

## Logic modules (the tested "brains")
These `.js` files carry the real logic and each ships an automated self-test. In every demo that uses one, the self-test result is printed on screen (look for "self-test: PASS ✓"). If any reads FAIL, note which and tell me.

| Module | Powers | Self-test shown in |
|---|---|---|
| `radiograph-sim.js` | Simulated radiograph | radiograph-sim demo footer |
| `review-scheduler.js` | Spaced repetition + progress map | review-scheduler / constellation |
| `streak-combo.js` | Scoring, combos | arcade footer |
| `requisition.js` | Patient orders | arcade footer |
| `ghost-replay.js` | Attending review | attending-review footer |
| `feedback-fx.js` | Sound + haptics | feedback-fx footer |

**Pass criterion for all:** the footer/console line says PASS.

---

## Feature-by-feature test steps

### #1 — 3D Exam Room · SID & Detector (`exam-room-3d.html`)
**What it is:** a focused **SID + receptor** trainer. Centering and CR angle are NOT set here (those live in the 2D CR activity) — the room applies them automatically so the student isn't doing the same task twice.
**Test:**
1. Drag to orbit; scroll to zoom.
2. You're given a **routine** (e.g., "Chest Routine") with its projections listed; the current one is highlighted.
3. Pick the receptor: **Non-Bucky / Table Bucky / Wall Bucky**. Set SID (slider or the 40/72 preset buttons).
4. "Next projection ▸" steps through the routine; "New routine" loads a different one.
**Look for:**
- **All distances in inches, never meters.**
- Receptor is labeled **"Non-Bucky"** (not "Tabletop") — and a Non-Bucky exam sits on the table OR upright at the wall depending on the projection (e.g., Lateral Nasal Bones = Non-Bucky, upright at the wall with the IR holder pulled out).
- **SID is sticky at 40 and 72** — nudging the slider near either snaps to it; preset buttons jump exactly.
- Wall receptor **auto-swings the tube horizontal**; table/Non-Bucky-table point it down. Tube **never passes through the table**.
- **Settings persist between projections and routines** — they do NOT reset. Going from a table routine to Chest, you must remember to switch to Wall Bucky and 72 in yourself; the Facial series makes you switch from Non-Bucky (nasal) to Wall Bucky (Waters) mid-routine.
- "SID" and "Receptor" turn green independently; verdict passes only when both match the current projection (SID ±2 in); passed projections get a ✓ in the list.
**Known limits:** tube/table are schematic boxes, not modeled hardware.

### #3 — Volumetric Beam (`beam-shader.html`)
**What it is:** a shader-rendered x-ray beam cone.
**Test:** drag to orbit; move Field size and Beam intensity; toggle grade Auto/OK/Clipped.
**Look for:** animated scanlines travelling down the cone; glowing edges; dust motes drifting; the field rectangle + beam **turn green when the field is within the detector outline and red when it spills over the edge** (readout shows "% of IR").
**Known limits:** needs a GPU + internet; may be heavy on old phones.

### #4 — Simulated Radiograph (`radiograph-sim-DEMO.html`)
**What it is:** renders the resulting film from your technique.
**Test:** move kVp/mAs/SID sliders, CR offset X/Y, tube angle; change region/view; watch the film and fault list. Also click the fixed "error gallery" thumbnails.
**Look for:** low mAs → darker/grainier + "Underexposed" fault; high kVp → flatter/low-contrast fault; CR offset → anatomy **clipped by the collimation edge** + "clipped" fault; angle → skew/distortion fault. Perfect technique → "Diagnostic quality," no faults.

### #5 — AR Mode (`ar-mode.html`)
**What it is:** WebXR when available; else camera + orientation overlay.
**Test (phone ideal):** tap Start; allow camera + motion if asked; move the phone.
**Look for:** on desktop, the crosshair auto-drifts and the capability line explains the fallback; on a phone, the CR crosshair moves with the device and turns green when centered on the target square.
**Known limits:** full AR only on AR-capable phones; desktop = simulated motion.

### #7 — Generator Console (`control-console.html`)
**What it is:** skeuomorphic generator panel with sound.
**Test:** drag knobs up/down (or scroll on them); click APR presets; **press and hold PREP** until the tone stabilizes and the Ready lamp lights, then click EXPOSE.
**Look for:** LED values update; **mAs = mA × time** stays consistent (time display recomputes); PREP plays a rising "capacitor" whine and arms after ~1 s; EXPOSE only fires when armed (buzzes if not) with an exposure tone + flash.

### #8 — Cinematic Exposure (`cinematic-exposure.html`)
**Test:** press Expose.
**Look for, in order:** room dims → collimator light cone appears → "R" marker glints → white flash → radiograph fades/wipes in on the monitor → caption ends at "Diagnostic image ready." Re-running resets cleanly.

### #9 — Skull Positioning Lines (`skull-lines-3d.html`)  ← rebuilt
**What it is:** align skull reference lines/planes to the receptor.
**Test:**
1. Pick a Reference: **OML, IOML, GAL** (sagittal lines), **MSP** (plane), **IPL** (line).
2. Click New drill — read the instruction (e.g., "MSP perpendicular to the table").
3. Drag up/down to flex/extend (pitch); use Yaw and Roll sliders for MSP/IPL drills.
**Look for:**
- OML/IOML/GAL drills change with **pitch**; the "off by" shrinks toward 0 and the verdict turns green within 3°.
- **MSP** drills change with **rotation (yaw)** — "MSP perpendicular" is solved at yaw ≈ 0; "MSP parallel" (true lateral) near yaw ≈ 90.
- **IPL** drills change with **tilt (roll)** — "IPL parallel" solved at roll ≈ 0.
- The receptor plane flashes green when aligned; the hint tells you to flex/extend/rotate/tilt.
**Correctness checkpoints:** flexing the head should NOT change MSP or IPL (they're rotation/tilt references); rotating should NOT change OML. If those move the wrong readout, flag it.

### #10 — Sound & Haptics (`feedback-fx-preview.html`)
**Test:** tap each button (correct/wrong/milestone/knobTick/expose/etc.); toggle Sound/Haptics.
**Look for:** distinct tones per event; on a phone, a vibration buzz; toggles silence sound/haptics. Footer = PASS.

### #11 — Design System (`design-system.html` + `design-tokens.css`)
**Test:** open and scroll.
**Look for:** color swatches, one accent gradient, a clean type scale, an 8-pt spacing ramp, exactly **three** radii, and sample components (buttons/pills/inputs) all rendered from the token file. This is the reference for restyling the app.

### #12 — View Transitions (`view-transitions.html`)
**Test:** click a projection tile → Expose → Next patient.
**Look for:** the badge/title **morph** between screens (in Chrome/Edge); a clean fade fallback elsewhere. The status line tells you which mode you're in.

### #13 + #16 + #17 — Trauma Shift (`arcade-practice-DEMO.html`)
**Test:** click Start 60-second shift; answer each requisition (pick the matching projection).
**Look for:** a realistic requisition card (patient, DOB, priority, clinical history) each round; **correct answers build a streak → combo multiplier (×1 → ×4)** with edge glow and "+points" popups; a wrong answer resets the streak; timer counts down; end screen shows score/accuracy/best streak. Best streak persists if you play again.

### #14 — Progress Constellation (`progress-constellation.html`)
**Test:** click "Simulate a little/lots of practice"; click a body region.
**Look for:** body-map regions **glow brighter/greener as mastery rises**; clicking a region lists its projections with mastery pills; overall % updates. Reset clears it.

### #18 — Attending Review (`ghost-replay-preview.html`)
**Test:** press Play (or Next step); Shuffle case.
**Look for:** each step reveals your choice, a verdict badge (good/close/miss), and a spoken-style explanation that names the **radiographic consequence** on misses (e.g., "underexposed," "clipped"); a final scored verdict with headline.

### #19 — Spaced-Repetition Review (`review-scheduler-DEMO.html`)
**Test:** click "Practice due — do well," then "+1 day / +1 week"; also try "struggle" and "random session."
**Look for:** doing well **pushes a projection's next-due further out** (1 → 3 → longer); struggling makes it **resurface immediately**; the due-today count and skill map update as you time-travel; mastery tiers progress new → learning → reviewing → mastered.

---

## Quick sign-off checklist
- [ ] `features-hub.html` opens and all 15 cards launch.
- [ ] Every demo footer/console shows self-test **PASS**.
- [ ] 3D/shader demos render (internet on) — no black screens.
- [ ] Skull: pitch moves only the sagittal lines; yaw/roll move MSP/IPL.
- [ ] Radiograph sim faults match the errors you dial in.
- [ ] Arcade streak/combo + requisitions behave; best streak persists.
- [ ] Review scheduler pushes due-dates out on success, pulls in on failure.

Report anything that fails a "look for" and I'll fix it. None of this affects the live app until we deliberately wire a feature into `index.html`.
