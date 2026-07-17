/* ============================================================================
 * Positioning Pro — Spaced-Repetition Review Scheduler  (Design Roadmap #19)
 * ----------------------------------------------------------------------------
 * Tracks per-projection performance and schedules reviews with an SM-2-style
 * algorithm adapted for radiographic-positioning practice. Weak projections
 * resurface sooner; mastered ones stretch out. Surfaces a daily "Due for
 * review" queue on launch.
 *
 * Design goals:
 *   1. Pure logic + injectable clock & storage  -> fully unit-testable, and it
 *      never touches window/localStorage directly (works in Node tests).
 *   2. One flat record per projection, keyed "Region|View" -> matches the app's
 *      existing exam identity, trivially serializable.
 *   3. Framework-free. Integrate by calling record()/getDue()/stats().
 *
 * Integration sketch (in the app's grade handler + launch screen):
 *     const rs = ReviewScheduler({ storage: window.localStorage });
 *     rs.record("Foot|AP", gradePercent);          // after each attempt
 *     const queue = rs.getDue({ limit: 10 });       // on launch → "Due today"
 *     const m = rs.stats();                         // for a progress panel
 * ==========================================================================*/
(function (global) {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;

  const CONFIG = {
    passScore: 70,          // >= this counts as a successful rep
    startEase: 2.5,
    minEase: 1.3,
    firstIntervals: [1, 3], // days for reps 1 and 2; later = prev * ease
    masteredIntervalDays: 21,
    masteredMinGrade: 85,
    reviewingIntervalDays: 7,
    newBoostDays: 0,        // brand-new items are due immediately
  };

  /* ---- storage adapters -------------------------------------------------- */
  function memoryStorage() {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: k => { m.delete(k); },
    };
  }

  /* ---- score -> SM-2 quality (0..5) ------------------------------------- */
  function quality(score) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    return Math.max(0, Math.min(5, Math.round(s / 20)));
  }

  function freshRecord(id) {
    const [region, view] = String(id).split('|');
    return {
      id, region: region || '', view: view || '',
      reps: 0, ease: CONFIG.startEase, intervalDays: 0,
      dueAt: 0,                 // 0 => due now (never practiced)
      lastScore: null, lastAt: null, attempts: 0, lapses: 0,
      history: [],
    };
  }

  function masteryOf(r) {
    if (!r || (r.reps === 0 && (r.attempts || 0) === 0)) return 'new';
    if (r.reps === 0) return 'learning';   // lapsed: needs relearning
    if (r.intervalDays >= CONFIG.masteredIntervalDays && (r.lastScore || 0) >= CONFIG.masteredMinGrade) return 'mastered';
    if (r.intervalDays >= CONFIG.reviewingIntervalDays) return 'reviewing';
    return 'learning';
  }

  /* ---- core scheduler ---------------------------------------------------- */
  function ReviewScheduler(opts) {
    opts = opts || {};
    const storage = opts.storage || memoryStorage();
    const now = opts.now || (() => Date.now());
    const KEY = opts.storageKey || 'pp_review_v1';
    let deck = load();

    function load() {
      try {
        const raw = storage.getItem(KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
      } catch (e) { return {}; }
    }
    function save() { storage.setItem(KEY, JSON.stringify(deck)); return deck; }

    function get(id) { return deck[id] ? clone(deck[id]) : null; }

    /** Register an attempt. score is 0..100. Returns the updated record. */
    function record(id, score, whenTs) {
      const t = whenTs || now();
      const r = deck[id] || freshRecord(id);
      const q = quality(score);
      const passed = (Number(score) || 0) >= CONFIG.passScore;

      r.attempts += 1;
      r.lastScore = Math.round(Number(score) || 0);
      r.lastAt = t;
      r.history.push({ t, score: r.lastScore, pass: passed });
      if (r.history.length > 50) r.history.shift();

      if (!passed || q < 3) {
        // lapse: reset progression, gently reduce ease, due again next session
        r.lapses += 1;
        r.reps = 0;
        r.intervalDays = 0;
        r.ease = Math.max(CONFIG.minEase, r.ease - 0.2);
        r.dueAt = t; // resurface immediately
      } else {
        r.reps += 1;
        if (r.reps === 1) r.intervalDays = CONFIG.firstIntervals[0];
        else if (r.reps === 2) r.intervalDays = CONFIG.firstIntervals[1];
        else r.intervalDays = Math.round(r.intervalDays * r.ease);
        // SM-2 ease update
        r.ease = Math.max(CONFIG.minEase, r.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
        r.dueAt = t + r.intervalDays * DAY;
      }
      deck[id] = r;
      save();
      return clone(r);
    }

    /** Preview the interval a given score would produce, without recording. */
    function previewInterval(id, score) {
      const snapshot = deck[id] ? clone(deck[id]) : freshRecord(id);
      const q = quality(score), passed = (Number(score) || 0) >= CONFIG.passScore;
      if (!passed || q < 3) return 0;
      let reps = snapshot.reps + 1, iv = snapshot.intervalDays, ease = snapshot.ease;
      if (reps === 1) iv = CONFIG.firstIntervals[0];
      else if (reps === 2) iv = CONFIG.firstIntervals[1];
      else iv = Math.round(iv * ease);
      return iv;
    }

    /** Items due now, plus optionally never-seen items. Sorted most-overdue first. */
    function getDue(o) {
      o = o || {};
      const t = o.now || now();
      const includeNew = o.includeNew !== false;
      const universe = o.projections ? seedUniverse(o.projections) : Object.values(deck);
      const due = universe.filter(r => {
        if ((r.attempts || 0) === 0) return includeNew;   // never practiced
        return r.dueAt <= t;
      });
      due.sort((a, b) => {
        // new items after overdue reviews; then by how overdue; then hardest (low ease)
        const ov = (r) => ((r.attempts || 0) === 0 ? -1 : (t - r.dueAt));
        const d = ov(b) - ov(a);
        if (d !== 0) return d;
        return a.ease - b.ease;
      });
      return (o.limit ? due.slice(0, o.limit) : due).map(clone);
    }

    // build records for a provided projection list, merging known state
    function seedUniverse(projections) {
      return projections.map(p => {
        const id = typeof p === 'string' ? p : (p.region + '|' + p.view);
        return deck[id] ? deck[id] : freshRecord(id);
      });
    }

    /** Aggregate stats: counts by mastery, per-region rollups, overall accuracy. */
    function stats(o) {
      o = o || {};
      const records = o.projections ? seedUniverse(o.projections) : Object.values(deck);
      const byMastery = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
      const byRegion = {};
      let scored = 0, sum = 0, attempts = 0, lapses = 0;
      for (const r of records) {
        const m = masteryOf(r);
        byMastery[m] += 1;
        const reg = r.region || '?';
        byRegion[reg] = byRegion[reg] || { total: 0, mastered: 0, learning: 0, reviewing: 0, new: 0 };
        byRegion[reg].total += 1; byRegion[reg][m] += 1;
        if (r.lastScore != null) { scored++; sum += r.lastScore; }
        attempts += r.attempts; lapses += r.lapses;
      }
      return {
        total: records.length, byMastery, byRegion,
        avgLastScore: scored ? Math.round(sum / scored) : null,
        attempts, lapses,
        masteredPct: records.length ? Math.round(100 * byMastery.mastered / records.length) : 0,
      };
    }

    function mastery(id) { return masteryOf(deck[id]); }
    function reset() { deck = {}; save(); }
    function exportState() { return JSON.stringify(deck); }
    function importState(json) { try { deck = JSON.parse(json) || {}; save(); return true; } catch (e) { return false; } }

    return { record, getDue, previewInterval, stats, mastery, get, reset, save,
             exportState, importState, CONFIG, _deck: () => clone(deck) };
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---- self test --------------------------------------------------------- */
  function selfTest() {
    const fails = [];
    let t = Date.UTC(2026, 0, 1);
    const rs = ReviewScheduler({ storage: memoryStorage(), now: () => t });

    // a good pass schedules ~1 day out and creates a "learning" item
    let r = rs.record('Foot|AP', 90, t);
    if (r.reps !== 1) fails.push('first pass should set reps=1');
    if (r.intervalDays !== 1) fails.push('first pass interval should be 1, got ' + r.intervalDays);
    if (rs.mastery('Foot|AP') !== 'learning') fails.push('after 1 pass -> learning');

    // second and third passes grow the interval
    t += 1 * DAY; r = rs.record('Foot|AP', 95, t);
    if (r.intervalDays !== 3) fails.push('second pass interval should be 3, got ' + r.intervalDays);
    t += 3 * DAY; r = rs.record('Foot|AP', 95, t);
    if (!(r.intervalDays > 3)) fails.push('third pass interval should exceed 3, got ' + r.intervalDays);

    // a fail (lapse) resets progression and makes it due immediately
    r = rs.record('Foot|AP', 40, t);
    if (r.reps !== 0) fails.push('lapse should reset reps to 0');
    if (r.intervalDays !== 0) fails.push('lapse interval should be 0');
    if (r.lapses !== 1) fails.push('lapse count should be 1');
    if (r.dueAt !== t) fails.push('lapsed item should be due now');

    // due queue: lapsed item is due; ordering puts overdue reviews before new
    rs.record('Hand|PA', 88, t);                 // schedule out 1 day
    const dueNow = rs.getDue({ now: t, includeNew: false });
    if (!dueNow.some(x => x.id === 'Foot|AP')) fails.push('lapsed Foot|AP should be in due queue');
    if (dueNow.some(x => x.id === 'Hand|PA')) fails.push('freshly-scheduled Hand|PA should not be due yet');

    // includeNew surfaces never-practiced projections
    const withNew = rs.getDue({ now: t, projections: ['Foot|AP', 'Hand|PA', 'Wrist|PA'] });
    if (!withNew.some(x => x.id === 'Wrist|PA')) fails.push('never-seen Wrist|PA should appear when includeNew');

    // ease never drops below the floor
    let t2 = Date.UTC(2026, 0, 1);
    const rs2 = ReviewScheduler({ storage: memoryStorage(), now: () => t2 });
    for (let i = 0; i < 8; i++) { rs2.record('Elbow|AP', 30, t2); t2 += DAY; }
    if (rs2.get('Elbow|AP').ease < rs2.CONFIG.minEase - 1e-9) fails.push('ease dropped below floor');

    // persistence round-trip
    const store = memoryStorage();
    const a = ReviewScheduler({ storage: store, now: () => t });
    a.record('Forearm|AP', 92, t);
    const b = ReviewScheduler({ storage: store, now: () => t });
    if (!b.get('Forearm|AP')) fails.push('state did not persist across instances');

    // stats sanity
    const st = rs.stats({ projections: ['Foot|AP', 'Hand|PA', 'Wrist|PA'] });
    if (st.total !== 3) fails.push('stats total should be 3');
    if (typeof st.masteredPct !== 'number') fails.push('stats masteredPct missing');

    return { pass: fails.length === 0, failures: fails };
  }

  const API = { ReviewScheduler, memoryStorage, masteryOf, quality, CONFIG, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.ReviewScheduler = ReviewScheduler;
  global.ReviewSchedulerAPI = API;
})(typeof window !== 'undefined' ? window : globalThis);
