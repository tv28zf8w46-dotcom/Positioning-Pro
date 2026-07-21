/* ============================================================================
 * Positioning Pro - Ghost Replay / Attending Review  (Design Roadmap #18)
 * ----------------------------------------------------------------------------
 * Turns a recorded sequence of a student's SIM choices into an "attending
 * radiologist" commentary track: for each field it states the verdict and, on
 * a miss, explains what went wrong and the radiographic consequence.
 *
 * Pure + deterministic -> unit-testable, no DOM.
 *   const review = GhostReplay.review(steps);
 *   // steps: [{ field:'kvp', chosen:60, correct:70, ok:false }, ...]
 *   // review: [{ field, label, verdict:'good'|'miss'|'close', comment }, ...]
 *   GhostReplay.summary(review) // -> {score, hits, misses, headline}
 * ==========================================================================*/
(function (global) {
  'use strict';

  const LABEL = { kvp: 'kVp', mas: 'mAs', ma: 'mA', sid: 'SID', ir: 'Detector / Bucky',
    focal: 'Focal spot', cr: 'Central ray', crPos: 'CR centering', crAngle: 'Tube angle', pt: 'Patient position' };

  // consequence phrasing per field when the student is off
  function consequence(field, chosen, correct) {
    const hi = num(chosen) > num(correct);
    switch (field) {
      case 'kvp': return hi ? 'too much penetration - the image will look flat and low-contrast'
        : 'not enough penetration - the part reads underexposed and washed-out white';
      case 'mas': return hi ? 'overexposed - the receptor is saturated and detail is lost in the dark'
        : 'underexposed - the image is mottled and grainy from quantum noise';
      case 'sid': return hi ? 'increased SID drops density and needs more technique'
        : 'short SID magnifies the anatomy and blurs the edges';
      case 'cr':
      case 'crPos': return 'the central ray is off the landmark, so the anatomy of interest is clipped by the collimation field';
      case 'crAngle': return 'the tube angle distorts the joint spaces and foreshortens the part';
      case 'ir': return 'wrong detector selection - grid/AEC mismatch degrades the image';
      case 'focal': return 'large focal spot on fine anatomy reduces spatial resolution (more penumbra)';
      case 'pt': return 'the positioning itself is wrong, so the projection won’t demonstrate the required anatomy';
      default: return 'this deviates from the standard and will affect image quality';
    }
  }
  const PRAISE = ['Correct - textbook.', 'Good call.', 'Exactly right.', 'Nailed it.', 'Spot on.'];

  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : NaN; }

  function verdictOf(step) {
    if (step.ok) return 'good';
    // numeric fields: "close" if within 12% of target
    const a = num(step.chosen), b = num(step.correct);
    if (isFinite(a) && isFinite(b) && b !== 0 && Math.abs((a - b) / b) <= 0.12) return 'close';
    return 'miss';
  }

  function commentFor(step, i) {
    const label = LABEL[step.field] || step.field;
    const v = verdictOf(step);
    if (v === 'good') return { field: step.field, label, verdict: 'good', comment: PRAISE[i % PRAISE.length] };
    const chosenStr = step.chosen != null ? String(step.chosen) : '(none)';
    const corrStr = step.correct != null ? String(step.correct) : '(none)';
    if (v === 'close')
      return { field: step.field, label, verdict: 'close',
        comment: 'Close - you set ' + chosenStr + ', standard is ' + corrStr + '. Within range, but tighten it up next time.' };
    if (step.field === 'focal') {
      const choseSmall = String(step.chosen == null ? '' : step.chosen).toLowerCase().indexOf('small') >= 0;
      return { field: step.field, label, verdict: 'miss',
        comment: choseSmall
          ? 'Small focal spots are for lower kVps. Using a small focal spot on this projection accelerates tube aging.'
          : 'A large focal spot on this fine-detail projection reduces spatial resolution and adds penumbra.' };
    }
    return { field: step.field, label, verdict: 'miss',
      comment: 'You chose ' + chosenStr + '; it should be ' + corrStr + '. Here ' + consequence(step.field, step.chosen, step.correct) + '.' };
  }

  function review(steps) { return (steps || []).map(commentFor); }

  function summary(rev) {
    const hits = rev.filter(r => r.verdict === 'good').length;
    const close = rev.filter(r => r.verdict === 'close').length;
    const misses = rev.filter(r => r.verdict === 'miss').length;
    const score = rev.length ? Math.round(100 * (hits + close * 0.5) / rev.length) : 0;
    let headline;
    if (score >= 90) headline = 'Diagnostic. Ready for the board.';
    else if (score >= 70) headline = 'Solid - a couple of fixable details.';
    else if (score >= 50) headline = 'Repeatable image, but several corrections needed.';
    else headline = 'This one would be a repeat. Let’s walk through it.';
    return { score, hits, close, misses, total: rev.length, headline };
  }

  function selfTest() {
    const fails = [];
    const steps = [
      { field: 'kvp', chosen: 70, correct: 70, ok: true },
      { field: 'mas', chosen: 2.0, correct: 5.0, ok: false },      // big miss (low)
      { field: 'sid', chosen: 42, correct: 40, ok: false },         // close
      { field: 'crPos', chosen: 'off', correct: 'base 3rd MT', ok: false },
    ];
    const rev = review(steps);
    if (rev[0].verdict !== 'good') fails.push('matching kVp should be good');
    if (rev[1].verdict !== 'miss') fails.push('mAs 2 vs 5 should be a miss');
    if (!/grainy|underexposed/.test(rev[1].comment)) fails.push('low mAs should mention underexposure/grain');
    if (rev[2].verdict !== 'close') fails.push('SID 42 vs 40 should be close');
    if (rev[3].verdict !== 'miss' || !/clipped/.test(rev[3].comment)) fails.push('CR off should warn about clipping');
    const sum = summary(rev);
    if (sum.total !== 4) fails.push('summary total should be 4');
    if (!(sum.score >= 0 && sum.score <= 100)) fails.push('score out of range');
    if (typeof sum.headline !== 'string') fails.push('headline missing');
    // all-correct -> 100 + top headline
    const perfect = summary(review([{ field: 'kvp', chosen: 70, correct: 70, ok: true }, { field: 'mas', chosen: 5, correct: 5, ok: true }]));
    if (perfect.score !== 100) fails.push('all correct should score 100');
    return { pass: fails.length === 0, failures: fails };
  }

  const API = { review, summary, verdictOf, LABEL, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.GhostReplay = API;
})(typeof window !== 'undefined' ? window : globalThis);
