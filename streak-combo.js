/* ============================================================================
 * Positioning Pro — Streak & Combo Scoring Engine  (Design Roadmap #16)
 * ----------------------------------------------------------------------------
 * Turns a stream of graded attempts into arcade-style scoring: consecutive
 * correct answers build a streak, the streak drives a combo multiplier, and
 * each answer yields points (accuracy- and speed-weighted) plus UI signals
 * (edge-glow level, score popup text, milestone flags).
 *
 * Pure + injectable storage/clock -> unit-testable, no DOM required.
 *   const eng = StreakEngine({ storage: localStorage });
 *   const ev = eng.answer(true, { accuracy: 92, speedMs: 3400 });
 *   // ev = { points, multiplier, streak, tier, glow, popup, milestone, total }
 * ==========================================================================*/
(function (global) {
  'use strict';

  const CONFIG = {
    basePoints: 100,
    // streak thresholds -> combo tiers [minStreak, multiplier, label, glow(0..4)]
    tiers: [
      [0, 1.0, '', 0],
      [3, 1.5, 'Nice', 1],
      [5, 2.0, 'Hot streak', 2],
      [8, 3.0, 'On fire', 3],
      [12, 4.0, 'Unstoppable', 4],
    ],
    speedBonusMax: 50,       // max bonus points for a fast answer
    speedFullMs: 2000,       // <= this = full speed bonus
    speedZeroMs: 12000,      // >= this = no speed bonus
    milestoneEvery: 5,       // celebrate every N-streak
  };

  function tierFor(streak, cfg) {
    let t = cfg.tiers[0];
    for (const cand of cfg.tiers) if (streak >= cand[0]) t = cand;
    return { multiplier: t[1], label: t[2], glow: t[3] };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function StreakEngine(opts) {
    opts = opts || {};
    const cfg = Object.assign({}, CONFIG, opts.config || {});
    const storage = opts.storage || null;
    const KEY = opts.storageKey || 'pp_streak_v1';

    let streak = 0, total = 0, best = loadBest(), maxComboThisRun = 1, answered = 0, correctCount = 0;

    function loadBest() { try { return storage ? (parseInt(storage.getItem(KEY), 10) || 0) : 0; } catch (e) { return 0; } }
    function saveBest() { try { if (storage) storage.setItem(KEY, String(best)); } catch (e) {} }

    function speedBonus(ms) {
      if (ms == null) return 0;
      const f = clamp((cfg.speedZeroMs - ms) / (cfg.speedZeroMs - cfg.speedFullMs), 0, 1);
      return Math.round(cfg.speedBonusMax * f);
    }

    /** Register one graded attempt. correct:boolean, meta:{accuracy?0..100, speedMs?} */
    function answer(correct, meta) {
      meta = meta || {};
      answered += 1;
      if (correct) {
        streak += 1; correctCount += 1;
        const tier = tierFor(streak, cfg);
        const acc = meta.accuracy == null ? 100 : clamp(meta.accuracy, 0, 100);
        const bonus = speedBonus(meta.speedMs);
        const raw = (cfg.basePoints * (acc / 100) + bonus);
        const points = Math.round(raw * tier.multiplier);
        total += points;
        maxComboThisRun = Math.max(maxComboThisRun, tier.multiplier);
        if (streak > best) { best = streak; saveBest(); }
        const milestone = (streak % cfg.milestoneEvery === 0) ? streak : 0;
        return {
          correct: true, streak, points, multiplier: tier.multiplier,
          tier: tier.label, glow: tier.glow, total, best,
          popup: '+' + points + (tier.multiplier > 1 ? '  ×' + tier.multiplier : ''),
          milestone, newBest: streak === best && best > 0,
        };
      } else {
        const lostStreak = streak;
        streak = 0;
        return {
          correct: false, streak: 0, points: 0, multiplier: 1,
          tier: '', glow: 0, total, best,
          popup: lostStreak >= 3 ? 'Streak lost (' + lostStreak + ')' : 'Miss',
          milestone: 0, brokeStreak: lostStreak,
        };
      }
    }

    function state() {
      const tier = tierFor(streak, cfg);
      return { streak, total, best, multiplier: tier.multiplier, tier: tier.label, glow: tier.glow,
               answered, correctCount, accuracy: answered ? Math.round(100 * correctCount / answered) : 0,
               maxCombo: maxComboThisRun };
    }
    function resetRun() { streak = 0; total = 0; answered = 0; correctCount = 0; maxComboThisRun = 1; }
    function nextTierInfo() {
      // how many more correct to reach the next multiplier tier
      for (const cand of cfg.tiers) if (cand[0] > streak) return { at: cand[0], need: cand[0] - streak, multiplier: cand[1], label: cand[2] };
      return null;
    }

    return { answer, state, resetRun, nextTierInfo, config: cfg, get best() { return best; } };
  }

  function selfTest() {
    const fails = [];
    const mem = (() => { let v = null; return { getItem: () => v, setItem: (k, x) => v = x }; })();
    const e = StreakEngine({ storage: mem, config: { speedFullMs: 2000, speedZeroMs: 12000 } });

    let ev = e.answer(true, { accuracy: 100 });
    if (ev.multiplier !== 1) fails.push('streak 1 should be ×1');
    if (ev.points !== 100) fails.push('base points should be 100 at ×1 full accuracy, got ' + ev.points);

    e.answer(true, { accuracy: 100 }); ev = e.answer(true, { accuracy: 100 }); // streak 3
    if (ev.multiplier !== 1.5) fails.push('streak 3 should be ×1.5, got ' + ev.multiplier);

    for (let i = 0; i < 2; i++) ev = e.answer(true, { accuracy: 100 }); // streak 5
    if (ev.multiplier !== 2.0) fails.push('streak 5 should be ×2, got ' + ev.multiplier);
    if (ev.milestone !== 5) fails.push('streak 5 should flag milestone');

    // miss resets streak + reports broken streak
    ev = e.answer(false);
    if (ev.streak !== 0) fails.push('miss should reset streak');
    if (ev.brokeStreak !== 5) fails.push('miss should report broken streak length');

    // accuracy weighting: 50% accuracy at ×1 -> 50 pts
    const e2 = StreakEngine({ storage: mem });
    const a = e2.answer(true, { accuracy: 50 });
    if (a.points !== 50) fails.push('50% accuracy should yield 50 pts, got ' + a.points);

    // speed bonus: instant answer adds up to speedBonusMax
    const e3 = StreakEngine({ storage: mem });
    const fast = e3.answer(true, { accuracy: 100, speedMs: 1000 });
    if (fast.points <= 100) fails.push('fast answer should exceed base (speed bonus), got ' + fast.points);

    // best streak persists
    const store = (() => { let v = null; return { getItem: () => v, setItem: (k, x) => v = x }; })();
    const p1 = StreakEngine({ storage: store });
    for (let i = 0; i < 4; i++) p1.answer(true, { accuracy: 100 });
    const p2 = StreakEngine({ storage: store });
    if (p2.best < 4) fails.push('best streak should persist across instances, got ' + p2.best);

    // nextTierInfo
    const e4 = StreakEngine({ storage: mem });
    e4.answer(true, {});
    const nt = e4.nextTierInfo();
    if (!nt || nt.at !== 3) fails.push('nextTier after streak 1 should target 3');

    return { pass: fails.length === 0, failures: fails };
  }

  const API = { StreakEngine, tierFor, CONFIG, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.StreakEngine = StreakEngine;
  global.StreakComboAPI = API;
})(typeof window !== 'undefined' ? window : globalThis);
