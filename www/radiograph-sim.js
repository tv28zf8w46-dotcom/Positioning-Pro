/* ============================================================================
 * Positioning Pro — Simulated Radiograph Output  (Design Roadmap #4)
 * ----------------------------------------------------------------------------
 * Pure, framework-free module. Given an exam, the student's answers, and the
 * correct reference, it produces a stylized SVG "radiograph" whose visible
 * quality reflects the student's technique and positioning errors:
 *
 *   - kVp / mAs / SID wrong  -> under/over-exposed, low/high contrast
 *   - CR off target          -> anatomy clipped by the collimation field
 *   - Tube angle off          -> joint-space distortion / foreshortening
 *   - Wrong detector/focal    -> loss of sharpness (penumbra blur)
 *
 * Design goals:
 *   1. Deterministic + pure  -> trivially unit-testable, no globals touched.
 *   2. Data-driven effect model -> tune pedagogy without touching the renderer.
 *   3. Region/view anatomy is pluggable via ANATOMY registry.
 *
 * Integration surface (call from the app's existing "Expose" handler):
 *     const html = RadiographSim.render(exam, state.answers, correctRef);
 *     document.getElementById('viewbox-monitor').innerHTML = html;
 *
 * `correctRef` shape (all optional; fall back to exam fields):
 *     { kvp, mas, sid, cr:{x,y}, crAngleSigned, tolPx, vb:"0 0 W H" }
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* ---- 1. EFFECT MODEL --------------------------------------------------- */
  /* Tunable thresholds that translate numeric error into visual params.
     Keep ALL pedagogy knobs here so the renderer stays dumb. */
  const EFFECT_MODEL = {
    exposure: {
      // acceptable fractional deviation before a fault is flagged
      mas_tol: 0.20,          // ±20% mAs is "fine"
      kvp_tol: 0.08,          // ±8% kVp is "fine"
      sid_tol: 0.05,          // ±5% SID is "fine"
      // how strongly deviation maps to screen density (0..1 clamp downstream)
      mas_gain: 1.4,
      kvp_gain: 1.1,
      // mAs primarily density; kVp primarily contrast (+penetration)
    },
    geometry: {
      angle_tol_deg: 3,       // within 3° = no visible distortion
      angle_gain: 0.010,      // skew per degree beyond tolerance
      // CR clipping: fraction of field the anatomy shifts toward an edge
      clip_gain: 1.0,
    },
    sharpness: {
      // blur (stdDeviation px) added for wrong detector/focal-spot choices
      wrong_focal_blur: 1.6,
      wrong_ir_blur: 0.9,
    },
    grain_base: 0.06,         // baseline film grain; rises as mAs drops (quantum mottle)
  };

  /* ---- 2. ANATOMY REGISTRY ---------------------------------------------- */
  /* Each entry returns an SVG fragment drawn in bone-white on black, sized to
     a 0..100 x 0..100 local box (the renderer scales it into the field).
     Add regions/views here — renderer & grading are anatomy-agnostic. */
  const ANATOMY = {
    'Hand|PA': handPA,
    'Hand|Oblique': handPA,          // oblique reuses PA silhouette (rotated by render)
    'Hand|Fan Lateral': handLateral,
    'Foot|AP': footAP,
    'Foot|Oblique': footAP,
    'Foot|Lateral': footLateral,
    _default: genericJoint,
  };

  function bone(d, extra) { return '<path d="' + d + '" fill="url(#rsBone)" stroke="#e8eef7" stroke-width="0.5" ' + (extra || '') + '/>'; }
  function seg(x, y0, y1, w) { const h = w / 2; return bone('M ' + (x - h) + ' ' + y0 + ' L ' + (x + h) + ' ' + y0 + ' L ' + (x + h) + ' ' + y1 + ' L ' + (x - h) + ' ' + y1 + ' Z'); }

  function handPA() {
    let s = '';
    const rays = [[30, 3], [42, 2.6], [54, 2.6], [66, 2.6], [78, 2.6]];
    // metacarpals + phalanges converging toward wrist (base ~ y=70)
    for (const [x, w] of rays) {
      s += seg(x, 40, 70, w + 1.5);           // metacarpal
      s += seg(x, 22, 40, w);                  // proximal phalanx
      s += seg(x, 10, 22, w * 0.85);           // middle/distal
    }
    s += bone('M 20 70 Q 54 78 88 70 L 84 86 Q 54 92 24 86 Z'); // carpals/wrist block
    return s;
  }
  function handLateral() {
    let s = seg(50, 8, 70, 8);                 // superimposed digits column
    s += bone('M 40 70 Q 50 80 60 70 L 58 88 Q 50 92 42 88 Z');
    return s;
  }
  function footAP() {
    let s = '';
    const rays = [[34, 3.2], [46, 2.8], [58, 2.8], [70, 2.6], [82, 2.6]];
    for (const [x, w] of rays) { s += seg(x, 34, 60, w + 1.2); s += seg(x, 16, 34, w); }
    s += bone('M 30 60 Q 58 68 86 60 L 80 82 Q 55 90 34 82 Z'); // tarsals
    return s;
  }
  function footLateral() {
    let s = bone('M 8 60 Q 30 40 70 44 L 92 40 L 92 52 Q 60 58 34 66 Q 16 72 8 72 Z'); // arch
    s += bone('M 60 44 Q 78 44 88 40 L 90 30 Q 72 32 62 40 Z');                        // heel/talus
    return s;
  }
  function genericJoint() {
    return seg(40, 12, 50, 10) + seg(60, 50, 88, 10) + bone('M 30 48 Q 50 60 70 48 L 66 56 Q 50 64 34 56 Z');
  }
  function wristPA() {
    let s = seg(42, 8, 55, 7) + seg(56, 10, 55, 5);            // radius + ulna
    s += bone('M 32 55 Q 50 62 68 55 L 66 70 Q 50 76 34 70 Z'); // carpal rows
    for (const x of [36, 46, 56, 66]) s += seg(x, 70, 92, 4.5); // metacarpal bases
    return s;
  }
  function fingerPA() {
    return seg(50, 62, 90, 9) + seg(50, 36, 60, 7.5) + seg(50, 16, 34, 6.5) + seg(50, 6, 14, 5.5);
  }
  function longBone() {
    let s = bone('M 42 10 Q 34 14 38 22 L 44 26 L 56 26 L 62 22 Q 66 14 58 10 Z');   // proximal flare
    s += seg(47, 26, 74, 7) + seg(53, 26, 74, 7);                                     // shaft cortices
    s += bone('M 40 74 L 60 74 L 66 84 Q 50 92 34 84 Z');                             // distal flare
    return s;
  }
  function kneeAP() {
    let s = bone('M 34 8 L 66 8 L 70 34 Q 60 42 50 42 Q 40 42 30 34 Z');   // distal femur + condyles
    s += bone('M 30 50 Q 50 44 70 50 L 66 62 L 60 90 L 40 90 L 34 62 Z');  // tibial plateau + shaft
    s += seg(74, 54, 88, 5);                                                // fibula
    s += bone('M 44 18 Q 50 14 56 18 L 54 30 Q 50 33 46 30 Z');            // patella shadow
    return s;
  }
  function shoulderAP() {
    let s = bone('M 8 26 L 60 20 L 62 27 L 10 33 Z');                        // clavicle
    s += bone('M 58 24 Q 76 22 80 34 Q 82 46 70 48 Q 58 46 56 34 Z');       // humeral head
    s += seg(68, 48, 90, 11);                                                // proximal humerus
    s += bone('M 46 30 Q 40 44 46 62 L 56 58 Q 52 44 56 32 Z');             // glenoid/scapula edge
    return s;
  }
  function chestPA() {
    let s = '';
    for (let i = 0; i < 7; i++) {                                            // rib arcs
      const y = 22 + i * 9;
      s += bone('M 12 ' + y + ' Q 50 ' + (y - 8) + ' 88 ' + y + ' L 88 ' + (y + 2.6) + ' Q 50 ' + (y - 5.4) + ' 12 ' + (y + 2.6) + ' Z');
    }
    s += bone('M 6 16 L 40 12 L 41 17 L 8 21 Z') + bone('M 94 16 L 60 12 L 59 17 L 92 21 Z'); // clavicles
    s += seg(50, 12, 88, 9);                                                 // spine/mediastinum
    s += bone('M 50 48 Q 68 52 70 70 Q 66 82 52 80 Q 48 64 50 48 Z', 'opacity="0.55"');       // heart shadow
    return s;
  }
  function abdomenKUB() {
    let s = seg(50, 6, 60, 10);                                              // lumbar column
    for (let i = 0; i < 5; i++) s += bone('M 40 ' + (10 + i * 10) + ' L 60 ' + (10 + i * 10) + ' L 60 ' + (16 + i * 10) + ' L 40 ' + (16 + i * 10) + ' Z', 'opacity="0.9"');
    s += bone('M 14 62 Q 30 54 46 64 L 42 84 Q 26 78 18 84 Z');              // iliac wings
    s += bone('M 86 62 Q 70 54 54 64 L 58 84 Q 74 78 82 84 Z');
    return s;
  }
  function pelvisAP() {
    let s = bone('M 10 22 Q 30 8 46 26 L 42 52 Q 28 44 16 50 Z');            // iliac wings
    s += bone('M 90 22 Q 70 8 54 26 L 58 52 Q 72 44 84 50 Z');
    s += bone('M 44 26 L 56 26 L 58 60 Q 50 66 42 60 Z');                    // sacrum/coccyx
    s += bone('M 24 56 Q 34 50 40 58 Q 42 68 32 70 Q 22 66 24 56 Z');        // femoral heads
    s += bone('M 76 56 Q 66 50 60 58 Q 58 68 68 70 Q 78 66 76 56 Z');
    s += bone('M 30 70 Q 42 76 50 74 Q 58 76 70 70 L 66 84 Q 50 90 34 84 Z');// pubic arch
    return s;
  }
  function spineAP() {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const y = 8 + i * 14;
      s += bone('M 40 ' + y + ' L 60 ' + y + ' L 60 ' + (y + 9) + ' L 40 ' + (y + 9) + ' Z');           // body
      s += bone('M 28 ' + (y + 2) + ' L 40 ' + (y + 3) + ' L 40 ' + (y + 6) + ' L 28 ' + (y + 5) + ' Z'); // transverse processes
      s += bone('M 72 ' + (y + 2) + ' L 60 ' + (y + 3) + ' L 60 ' + (y + 6) + ' L 72 ' + (y + 5) + ' Z');
    }
    return s;
  }
  function spineLat() {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const y = 8 + i * 14, x = 34 + i * 1.6;
      s += bone('M ' + x + ' ' + y + ' L ' + (x + 20) + ' ' + y + ' L ' + (x + 21) + ' ' + (y + 9) + ' L ' + (x + 1) + ' ' + (y + 9) + ' Z');
      s += bone('M ' + (x + 20) + ' ' + (y + 2) + ' L ' + (x + 32) + ' ' + (y + 4) + ' L ' + (x + 31) + ' ' + (y + 7) + ' L ' + (x + 21) + ' ' + (y + 6) + ' Z', 'opacity="0.85"');
    }
    return s;
  }
  function skullAP() {
    let s = bone('M 50 4 Q 88 8 88 44 Q 88 66 72 76 L 28 76 Q 12 66 12 44 Q 12 8 50 4 Z');  // vault
    s += '<rect x="26" y="38" width="18" height="12" rx="3" fill="#0a1524" opacity="0.75"/>' +
         '<rect x="56" y="38" width="18" height="12" rx="3" fill="#0a1524" opacity="0.75"/>'; // orbits
    s += bone('M 44 52 L 56 52 L 53 64 L 47 64 Z', 'opacity="0.9"');                          // nasal septum
    s += bone('M 30 76 Q 50 88 70 76 L 64 92 Q 50 98 36 92 Z');                               // mandible
    return s;
  }
  function skullLat() {
    let s = bone('M 40 6 Q 92 8 90 46 Q 88 68 66 72 L 40 72 Q 12 62 14 36 Q 16 12 40 6 Z');  // vault
    s += '<ellipse cx="34" cy="44" rx="8" ry="6" fill="#0a1524" opacity="0.7"/>';             // orbit
    s += bone('M 20 58 Q 28 56 34 60 L 30 70 Q 22 68 20 62 Z', 'opacity="0.9"');              // facial mass
    s += bone('M 26 70 Q 44 82 62 74 L 58 86 Q 40 92 26 80 Z');                               // mandible ramus
    return s;
  }
  function footLateralish() { return footLateral(); }

  /* Region-level fallback: exact "Region|View" keys win, then the region picks a
     representative silhouette (lateral-aware for spine and skull families). */
  function anatomyFor(exam) {
    const exact = ANATOMY[key(exam)];
    if (exact) return exact;
    const region = normalize0(exam && exam.region), view = normalize0(exam && exam.view).toLowerCase();
    const lat = /lateral|swimmer|law|schuller|smv/.test(view);
    switch (region) {
      case 'Hand': return lat ? handLateral : handPA;
      case 'Wrist': case 'Forearm': return wristPA;
      case 'Thumb/Finger': return fingerPA;
      case 'Humerus': case 'Femur': case 'Tib-Fib': return longBone;
      case 'Knee': case 'Patella': return kneeAP;
      case 'Shoulder': case 'Clavicle': case 'Scapula': return shoulderAP;
      case 'Chest': case 'Ribs': case 'Sternum': return chestPA;
      case 'Abdomen': return abdomenKUB;
      case 'Pelvis': case 'Hip': case 'Acetabulum': case 'SI Joints': case 'Sacrum/Coccyx': return pelvisAP;
      case 'C-Spine': case 'T-Spine': case 'Lumbar': case 'Neck': return lat ? spineLat : spineAP;
      case 'Cranium': case 'Facial Bones': case 'Nasal Bones': case 'Sinuses': case 'Orbits': case 'Mandible': case 'TMJ':
        return lat ? skullLat : skullAP;
      case 'Foot': case 'Calcaneus': return lat ? footLateralish : footAP;
      case 'Ankle': case 'Elbow': return genericJoint;
      default: return ANATOMY._default;
    }
  }

  /* ---- 3. GRADING -> FAULTS --------------------------------------------- */
  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
  function frac(actual, correct) { return (correct && actual != null) ? (actual - correct) / correct : 0; }

  function analyze(exam, ans, ref) {
    ref = ref || {};
    const faults = [];
    const E = EFFECT_MODEL;

    // ---- exposure ----
    const dMas = frac(num(ans.mas), num(ref.mas));
    const dKvp = frac(num(ans.kvp), num(ref.kvp));
    const dSid = frac(num(ans.sid), num(ref.sid));
    // density: too much mAs -> darker; SID up -> lighter (inverse-square, simplified)
    let density = 0.5 + E.exposure.mas_gain * 0.5 * clamp(dMas, -1, 1) - clamp(dSid, -0.5, 1);
    density = clamp(density, 0.05, 0.95);
    // contrast: higher kVp -> lower (longer scale) contrast
    let contrast = clamp(0.5 - E.exposure.kvp_gain * 0.5 * clamp(dKvp, -1, 1), 0.1, 0.95);

    if (Math.abs(dMas) > E.exposure.mas_tol)
      faults.push(fault(dMas > 0 ? 'MAS_HIGH' : 'MAS_LOW', dMas > 0 ? 'Overexposed (mAs too high)' : 'Underexposed (mAs too low)', sev(Math.abs(dMas), 0.2, 0.6)));
    if (Math.abs(dKvp) > E.exposure.kvp_tol)
      faults.push(fault(dKvp > 0 ? 'KVP_HIGH' : 'KVP_LOW', dKvp > 0 ? 'Low contrast / overpenetrated (kVp high)' : 'Underpenetrated (kVp low)', sev(Math.abs(dKvp), 0.08, 0.25)));
    if (Math.abs(dSid) > E.exposure.sid_tol)
      faults.push(fault('SID_OFF', 'SID off — density & magnification affected', sev(Math.abs(dSid), 0.05, 0.2)));

    // ---- geometry: CR position (clipping) ----
    let clipX = 0, clipY = 0;
    const vb = parseVB(ref.vb || atlasVB(exam));
    if (ref.cr && ans.crPos && isFinite(ans.crPos.x)) {
      const dx = (ans.crPos.x - ref.cr.x), dy = (ans.crPos.y - ref.cr.y);
      const tol = ref.tolPx || 30;
      const offX = dx / (vb.w || 360), offY = dy / (vb.h || 480);
      if (Math.hypot(dx, dy) > tol) {
        clipX = clamp(-offX * E.geometry.clip_gain, -0.6, 0.6);
        clipY = clamp(-offY * E.geometry.clip_gain, -0.6, 0.6);
        faults.push(fault('CR_OFF', 'Anatomy clipped — CR off centering point', sev(Math.hypot(dx, dy) / tol, 1, 3)));
      }
    }

    // ---- geometry: tube angle (distortion) ----
    let skew = 0;
    const aAns = num(ans.crAngleSigned != null ? ans.crAngleSigned : (ans.crAngle && ans.crAngle.signed));
    const aRef = num(ref.crAngleSigned) || 0;
    if (aAns != null) {
      const dA = aAns - aRef;
      if (Math.abs(dA) > E.geometry.angle_tol_deg) {
        skew = clamp(dA * E.geometry.angle_gain, -0.5, 0.5);
        faults.push(fault('ANGLE_OFF', 'Joint spaces distorted — tube angle off ' + Math.round(dA) + '°', sev(Math.abs(dA), 3, 12)));
      }
    }

    // ---- sharpness ----
    let blur = 0;
    if (ref.focal && ans.focal && normalize(ans.focal) !== normalize(ref.focal)) { blur += E.sharpness.wrong_focal_blur; faults.push(fault('FOCAL', 'Reduced sharpness — wrong focal spot', 1)); }
    if (ref.ir && ans.ir && normalize(ans.ir) !== normalize(ref.ir)) { blur += E.sharpness.wrong_ir_blur; faults.push(fault('IR', 'Detector/Bucky mismatch', 1)); }

    const grain = clamp(EFFECT_MODEL.grain_base + Math.max(0, -dMas) * 0.25, 0, 0.4);

    return { density, contrast, clipX, clipY, skew, blur, grain, faults, ok: faults.length === 0 };
  }

  function fault(code, label, severity) { return { code, label, severity }; }
  function sev(x, warn, bad) { return x >= bad ? 3 : x >= warn ? 2 : 1; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function normalize(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function parseVB(s) { const p = (s || '0 0 360 480').split(/\s+/).map(Number); return { x: p[0], y: p[1], w: p[2], h: p[3] }; }
  function atlasVB(exam) { return '0 0 360 480'; }
  function key(exam) { return normalize0(exam && exam.region) + '|' + normalize0(exam && exam.view); }
  function normalize0(v) { return v == null ? '' : String(v).trim(); }

  /* ---- 4. RENDERER ------------------------------------------------------- */
  function render(exam, ans, ref) {
    const a = analyze(exam, ans, ref || {});
    const W = 360, H = 460;
    const anat = anatomyFor(exam)();

    // exposure -> brightness/contrast via feComponentTransfer slope+intercept
    const slope = 0.4 + a.contrast * 1.6;                 // contrast
    const intercept = (a.density - 0.5) * 0.9;            // density (darkening/lightening)
    const grainOpacity = a.grain.toFixed(3);
    const blur = a.blur.toFixed(2);

    // field-of-view group transform: clip shift + angle skew
    const fx = (a.clipX * W * 0.5).toFixed(1);
    const fy = (a.clipY * H * 0.5).toFixed(1);
    const skewDeg = (a.skew * 25).toFixed(2);

    const collimated = collimation(a);

    const banner = a.ok
      ? '<div class="rs-banner rs-ok">Diagnostic quality — good exposure &amp; positioning</div>'
      : '<div class="rs-banner rs-bad">' + a.faults.length + ' fault' + (a.faults.length > 1 ? 's' : '') + ' detected</div>';
    const faultList = a.faults.map(f =>
      '<li class="rs-f rs-s' + f.severity + '"><span class="rs-dot"></span>' + esc(f.label) + '</li>').join('');

    const svg =
      '<svg class="rs-film" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
      '<defs>' +
      '<linearGradient id="rsBone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f9ff"/><stop offset="1" stop-color="#c6d2e4"/></linearGradient>' +
      '<filter id="rsFx" x="-10%" y="-10%" width="120%" height="120%">' +
      '<feComponentTransfer><feFuncR type="linear" slope="' + slope + '" intercept="' + intercept + '"/><feFuncG type="linear" slope="' + slope + '" intercept="' + intercept + '"/><feFuncB type="linear" slope="' + slope + '" intercept="' + intercept + '"/></feComponentTransfer>' +
      (a.blur > 0 ? '<feGaussianBlur stdDeviation="' + blur + '"/>' : '') +
      '</filter>' +
      '<filter id="rsGrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ' + grainOpacity + ' 0"/></filter>' +
      '<clipPath id="rsField"><rect x="' + collimated.x + '" y="' + collimated.y + '" width="' + collimated.w + '" height="' + collimated.h + '" rx="4"/></clipPath>' +
      '</defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#05070d"/>' +
      '<g clip-path="url(#rsField)">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0a1524"/>' +
      '<g filter="url(#rsFx)" transform="translate(' + fx + ' ' + fy + ') rotate(0 ' + (W / 2) + ' ' + (H / 2) + ') skewX(' + skewDeg + ')">' +
      '<g transform="translate(' + (W * 0.5 - 180) + ' ' + (H * 0.5 - 230) + ') scale(3.6)">' + anat + '</g>' +
      '</g>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" filter="url(#rsGrain)" opacity="0.5"/>' +
      '</g>' +
      collimation(a, true) +
      '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" fill="none" stroke="#1c2a40" stroke-width="1"/>' +
      '</svg>';

    return {
      analysis: a,
      svg: svg,
      html: '<div class="rs-wrap">' + banner + svg + '<ul class="rs-faults">' + faultList + '</ul></div>',
    };
  }

  function collimation(a, asBorder) {
    // tighter field when positioned well; shifts with clip so edges cut anatomy
    const W = 360, H = 460, pad = 26;
    const x = pad + a.clipX * 30, y = pad + a.clipY * 30;
    const w = W - pad * 2, h = H - pad * 2;
    if (!asBorder) return { x, y, w, h };
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#2f4a69" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>';
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---- 5. SELF TEST ------------------------------------------------------ */
  function selfTest() {
    const fails = [];
    const exam = { region: 'Hand', view: 'PA' };
    const ref = { kvp: 60, mas: 2.5, sid: 40, focal: 'Small', ir: 'Tabletop / Non-Bucky', cr: { x: 167, y: 179 }, crAngleSigned: 0, tolPx: 30, vb: '0 0 360 481' };

    // perfect technique -> no faults
    let r = render(exam, { kvp: 60, mas: 2.5, sid: 40, focal: 'Small', ir: 'Tabletop / Non-Bucky', crPos: { x: 167, y: 179 }, crAngle: { signed: 0 } }, ref);
    if (!r.analysis.ok) fails.push('perfect technique should be fault-free, got ' + JSON.stringify(r.analysis.faults.map(f => f.code)));

    // low mAs -> underexposed + grain up
    r = render(exam, { kvp: 60, mas: 1.0, sid: 40, focal: 'Small', ir: 'Tabletop / Non-Bucky', crPos: { x: 167, y: 179 }, crAngle: { signed: 0 } }, ref);
    if (!r.analysis.faults.some(f => f.code === 'MAS_LOW')) fails.push('low mAs should flag MAS_LOW');
    if (!(r.analysis.density < 0.5)) fails.push('low mAs should reduce density');

    // CR far off -> clipping fault + nonzero clip shift
    r = render(exam, { kvp: 60, mas: 2.5, sid: 40, focal: 'Small', ir: 'Tabletop / Non-Bucky', crPos: { x: 300, y: 400 }, crAngle: { signed: 0 } }, ref);
    if (!r.analysis.faults.some(f => f.code === 'CR_OFF')) fails.push('off CR should flag CR_OFF');
    if (r.analysis.clipX === 0 && r.analysis.clipY === 0) fails.push('off CR should shift field');

    // angle off -> distortion
    r = render(exam, { kvp: 60, mas: 2.5, sid: 40, focal: 'Small', ir: 'Tabletop / Non-Bucky', crPos: { x: 167, y: 179 }, crAngle: { signed: 15 } }, ref);
    if (!r.analysis.faults.some(f => f.code === 'ANGLE_OFF')) fails.push('angle 15° should flag ANGLE_OFF');

    // svg well-formed-ish
    if (!/^<svg/.test(r.svg) || !/<\/svg>$/.test(r.svg)) fails.push('svg output malformed');

    // region fallback anatomy: non-registered regions get a real silhouette, not the generic joint
    if (anatomyFor({ region: 'Chest', view: 'PA' }) === ANATOMY._default) fails.push('Chest should map to chest anatomy');
    if (anatomyFor({ region: 'Lumbar', view: 'Lateral' }) === anatomyFor({ region: 'Lumbar', view: 'AP' })) fails.push('spine lateral should differ from AP');
    if (anatomyFor({ region: 'NoSuchRegion', view: 'AP' }) !== ANATOMY._default) fails.push('unknown region should fall back to default');

    return { pass: fails.length === 0, failures: fails };
  }

  const API = { render, analyze, anatomyFor, EFFECT_MODEL, ANATOMY, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.RadiographSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
