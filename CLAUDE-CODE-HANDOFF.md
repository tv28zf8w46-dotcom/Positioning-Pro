# Claude Code Handoff — Incorporate SID/Bucky + volumetric beam into the app's Room3D

You are picking up a task with no prior chat context. Everything you need is here.

## Repo
- Project root: the folder containing `index.html`, `www/`, `ios/`, `android/`.
- **Live app:** `index.html` (~742 KB, single file). The app is Capacitor; `capacitor.config.json` has `"webDir": "www"`, so **whatever you change in `index.html` must be copied to `www/index.html`** (they must stay identical).
- Reference prototypes (standalone, already built & tested — reuse their code, don't reinvent):
  - `exam-room-3d.html` — SID + Bucky drill with routine model, sticky SID 40/72, Non-Bucky/Table/Wall, volumetric shader beam.
  - `beam-shader.html` — the volumetric x-ray beam shader in isolation.
  - `INTEGRATION-ROOM3D.md` — companion spec.

## Goal
Make the app's existing **Room3D** (the real WebGL exam room) the single place the user sets **SID** and **Bucky/receptor**, replacing the current flat selection buttons, and add the **green volumetric shader beam** to that room. Grade only on Expose (no correctness feedback before). Reuse the app's existing patient/tube positioning — do NOT rebuild positioning.

## Current state / gotchas
- `three.min.js` was just restored to root and `www/` (it had gone missing, which caused the "3D room unavailable — WebGL is off" fallback). Confirm both copies exist before starting.
- Room3D is an IIFE: `var Room3D=(function(){ var T=window.THREE||THREE||null; ... })()`. **It uses Three via the alias `T`, not `THREE.`** — match that style inside Room3D.
- `Room3D.init()` creates `renderer=new T.WebGLRenderer(...)`, calls `build()`, `loop()`. Scene state is pushed each render via `#room3d-mount` `data-*` attributes and read in `sync()` → `applyState({pose,bucky,sid,cr,dir,horiz,region,view,ir,pt,lat,fb,dim,hidebeam})`.

## Integration points (verified)
- **Answer setter:** `function pick(field,value){ if(state.showDetails)return; state.answers[field]=value; render(); }` — call this to record SID/Bucky.
- **Existing Bucky UI:** `.ir-select` / `.ir-btn` buttons already call `pick('ir','Wall bucky')`, `pick('ir','Table bucky')` (and Non-Bucky). **IR values are exactly:** `Non-Bucky`, `Table bucky`, `Wall bucky`.
- **Existing SID UI:** buttons call `pick('sid','<option>')`. **SID values (strings):** `40`, `60`, `72`.
- **No-spoiler gate:** feedback is gated on `state.showDetails` (true only after Expose). Never style the new SID/Bucky controls as correct/incorrect before then — only "selected".

## Tasks
1. **SID control → sticky slider.** Replace SID buttons with a slider that snaps to 40 and 72 (±3), keeps 60 reachable, displays inches, and calls `pick('sid', String(v))`. No green/red.
2. **Bucky control.** Keep the 3-way `.ir-btn` set (`Non-Bucky` / `Table bucky` / `Wall bucky`) → `pick('ir', ...)`. Ensure the old flat `sid`/`ir` choice tiles are suppressed when Room3D is active so there's exactly one place to set each.
3. **Volumetric shader beam.** In Room3D's `build()`/scene, replace the current beam mesh material+geometry with the shader from `beam-shader.html` (below). Drive `uTime` from the existing `loop()`. Keep the beam's existing transform (it's already aimed focal-spot→detector by the positioning code). Green `0x6ee7b7`, additive, `depthWrite:false`, `DoubleSide`.
4. **No behavior duplication.** Centering + CR angle stay in the 2D activity / `getCrTarget`. Wall selection already orients the tube via positioning — don't re-add.

### Shader to reuse (from beam-shader.html) — use `T` not `THREE` inside Room3D
```js
const beamUniforms={ uTime:{value:0}, uColor:{value:new T.Color(0x6ee7b7)} };
const beamMat=new T.ShaderMaterial({
  uniforms:beamUniforms, transparent:true, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending,
  vertexShader:`varying vec3 vN; varying vec3 vView; varying float vAxis;
    void main(){ vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal);
      vView=normalize(cameraPosition-w.xyz); vAxis=position.y;
      gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader:`precision mediump float; uniform float uTime; uniform vec3 uColor;
    varying vec3 vN; varying vec3 vView; varying float vAxis;
    void main(){ float fres=pow(1.0-abs(dot(normalize(vN),normalize(vView))),1.8);
      float scan=0.5+0.5*sin(vAxis*40.0 - uTime*3.0);
      float a=fres*(0.35+0.45*scan)*0.9; gl_FragColor=vec4(uColor,a); }`
});
// geometry: T.ConeGeometry(baseRadius, height, 40, 1, true); update beamUniforms.uTime.value in loop()
```

## Hard constraints
- Do NOT set `.position`/`.rotation` via `Object.assign` on Three objects — they're read-only to assignment; use `.position.set(...)` / `.rotation.set(...)`. (This exact bug caused a black screen in the prototype.)
- Back up `index.html` before editing (timestamped copy).
- After editing, **copy `index.html` → `www/index.html`** (must be byte-identical).
- Extract each `<script>` block and run `node --check` on it; fix any syntax error before finishing.

## Verification checklist
- [ ] App shows the 3D room (not "WebGL is off").
- [ ] SID slider snaps to 40/72, writes `state.answers.sid` as a string via `pick`.
- [ ] Bucky buttons write `state.answers.ir` as `Non-Bucky`/`Table bucky`/`Wall bucky`.
- [ ] Old flat SID/IR tiles no longer appear (no duplicate controls).
- [ ] Green shader beam renders and animates; aimed at the detector; correct for wall vs table.
- [ ] No correctness feedback before Expose (respects `state.showDetails`).
- [ ] `index.html` and `www/index.html` identical; all `<script>` blocks pass `node --check`.
- [ ] Grading on Expose still works for `sid` and `ir` (values match the EXAMS data).
