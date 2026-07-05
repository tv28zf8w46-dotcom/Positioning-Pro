/* ============================================================================
 * Positioning Pro — Requisition & Patient Variety Generator  (Roadmap #13)
 * ----------------------------------------------------------------------------
 * Generates realistic "incoming order" requisitions to wrap each practice exam:
 * patient demographics, MRN/accession, clinical history/indication tied to the
 * body part, priority (routine / STAT / trauma), body habitus, and ordering
 * provider. Deterministic via a seedable PRNG so tests & replays reproduce.
 *
 *   const req = Requisition.generate({ region:'Wrist', view:'PA', seed: 42 });
 *   req.patient // {name, age, sex, dob, mrn, habitus}
 *   req.order   // {accession, priority, exam, indication, provider, history}
 *   Requisition.card(req) // -> printable HTML requisition slip
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ---- seedable PRNG (mulberry32) ----
  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

  const FIRST_M = ['James', 'Robert', 'Michael', 'David', 'Marcus', 'Andre', 'Luis', 'Kevin', 'Omar', 'Ethan', 'Noah', 'Frank', 'Raymond', 'Curtis'];
  const FIRST_F = ['Mary', 'Linda', 'Patricia', 'Angela', 'Denise', 'Rosa', 'Aisha', 'Grace', 'Chloe', 'Nadia', 'Helen', 'Brenda', 'Tanya', 'Yuki'];
  const LAST = ['Nguyen', 'Walker', 'Johnson', 'Reyes', 'Okafor', 'Patel', 'Sullivan', 'Cruz', 'Bauer', 'Ivanov', 'Kim', 'Delgado', 'Fischer', 'Abbott', 'Mensah'];
  const PROVIDERS = ['Dr. Patel (ED)', 'Dr. Osei (Ortho)', 'Dr. Lund (Urgent Care)', 'Dr. Romano (Ortho)', 'Dr. Fischer (ED)', 'NP Grant (Sports Med)'];
  const HABITUS = [['sthenic', 'average build'], ['asthenic', 'slender — reduce technique'], ['hypersthenic', 'large habitus — increase technique'], ['pediatric', 'pediatric — minimize dose']];

  // clinical indications keyed by region; %chance trauma vs chronic
  const INDICATIONS = {
    Hand: ['crush injury to hand at work', 'fall onto outstretched hand, pain over MCPs', 'suspected boxer’s fracture', 'chronic RA follow-up', 'foreign body, glass', 'jammed finger, swelling'],
    Wrist: ['FOOSH, snuffbox tenderness (r/o scaphoid #)', 'wrist pain after fall', 'suspected distal radius fracture', 'chronic wrist pain, r/o ganglion', 'sports injury, dorsal wrist pain'],
    Elbow: ['fell off bike, unable to extend elbow', 'r/o radial head fracture', 'olecranon pain after fall', 'lateral epicondyle tenderness', 'MVC, arm pain', 'effusion on exam'],
    Forearm: ['direct blow to forearm, deformity', 'r/o both-bone fracture', 'nightstick injury to ulna', 'fall, mid-forearm pain and swelling'],
    Foot: ['stepped on nail, r/o foreign body', 'twisted foot, midfoot pain (r/o Lisfranc)', 'r/o 5th metatarsal fracture', 'dropped weight on foot', 'chronic forefoot pain', 'crush injury'],
    _default: ['pain and swelling after injury', 'r/o fracture', 'trauma, evaluate for injury'],
  };
  const PRIORITIES = [['Routine', 0.55], ['STAT', 0.28], ['Trauma', 0.17]];

  function weighted(r, table) {
    let x = r(), acc = 0;
    for (const [val, w] of table) { acc += w; if (x <= acc) return val; }
    return table[table.length - 1][0];
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

  function generate(o) {
    o = o || {};
    const seed = (o.seed != null) ? o.seed : (Date.now() ^ Math.floor(Math.random() * 1e9));
    const r = rng(seed);
    const region = o.region || 'Hand';
    const view = o.view || '';
    const sex = pick(r, ['M', 'F']);
    const first = pick(r, sex === 'M' ? FIRST_M : FIRST_F);
    const last = pick(r, LAST);
    const hab = pick(r, HABITUS);
    // age: pediatric habitus -> young
    const age = hab[0] === 'pediatric' ? int(r, 4, 16) : int(r, 17, 89);
    const year = 2026 - age;
    const dob = pad(int(r, 1, 12), 2) + '/' + pad(int(r, 1, 28), 2) + '/' + year;
    const mrn = pad(int(r, 100000, 999999), 6);
    const accession = 'XR-' + (2026) + '-' + pad(int(r, 1, 99999), 5);
    const indication = pick(r, INDICATIONS[region] || INDICATIONS._default);
    const priority = weighted(r, PRIORITIES);
    const provider = pick(r, PROVIDERS);

    return {
      seed,
      patient: { name: last + ', ' + first, first, last, age, sex, dob, mrn, habitus: hab[0], habitusNote: hab[1] },
      order: {
        accession, priority, region, view,
        exam: region + (view ? ' — ' + view : ''),
        indication, provider,
        history: age + ' y/o ' + (sex === 'M' ? 'male' : 'female') + ', ' + indication + '.',
      },
    };
  }

  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  /** Printable requisition slip HTML. */
  function card(req) {
    const p = req.patient, o = req.order;
    const pc = { 'Routine': '#38bdf8', 'STAT': '#fbbf24', 'Trauma': '#fb7185' }[o.priority] || '#8fa3c0';
    return '<div class="req-card">' +
      '<div class="req-head"><span class="req-hosp">LANIER GENERAL · Radiology</span>' +
      '<span class="req-pri" style="background:' + pc + '22;color:' + pc + ';border:1px solid ' + pc + '">' + esc(o.priority) + '</span></div>' +
      '<div class="req-exam">' + esc(o.exam) + '</div>' +
      '<div class="req-grid">' +
      '<div><label>Patient</label>' + esc(p.name) + '</div>' +
      '<div><label>MRN</label>' + esc(p.mrn) + '</div>' +
      '<div><label>DOB / Age</label>' + esc(p.dob) + ' (' + p.age + ')</div>' +
      '<div><label>Sex</label>' + esc(p.sex) + '</div>' +
      '<div><label>Accession</label>' + esc(o.accession) + '</div>' +
      '<div><label>Habitus</label>' + esc(p.habitus) + '</div>' +
      '</div>' +
      '<div class="req-hist"><label>Clinical history</label>' + esc(o.history) + '</div>' +
      '<div class="req-foot"><span>Ordered by ' + esc(o.provider) + '</span><span>' + esc(p.habitusNote) + '</span></div>' +
      '</div>';
  }

  // default stylesheet callers can inject once
  const CSS = '.req-card{font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;background:#fbfaf5;color:#1a2230;border-radius:10px;padding:14px 16px;border:1px solid #d8d2bf;max-width:420px;box-shadow:0 8px 24px rgba(0,0,0,.25)}' +
    '.req-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #c7bfa6;padding-bottom:8px}' +
    '.req-hosp{font-weight:700;letter-spacing:.04em;font-size:11px;color:#5b6472}' +
    '.req-pri{font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;text-transform:uppercase;letter-spacing:.06em}' +
    '.req-exam{font-size:18px;font-weight:700;margin:10px 0 8px}' +
    '.req-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}' +
    '.req-grid label,.req-hist label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8a8674}' +
    '.req-hist{margin-top:10px;background:#f1ecda;border-radius:8px;padding:8px 10px}' +
    '.req-foot{display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:#6b7280}';

  function generateBatch(list, seedBase) {
    return list.map((e, i) => generate({ region: e.region, view: e.view, seed: (seedBase || 1) * 1000 + i }));
  }

  function selfTest() {
    const fails = [];
    const a = generate({ region: 'Wrist', view: 'PA', seed: 7 });
    const b = generate({ region: 'Wrist', view: 'PA', seed: 7 });
    if (JSON.stringify(a) !== JSON.stringify(b)) fails.push('same seed must be deterministic');
    const c = generate({ region: 'Wrist', view: 'PA', seed: 8 });
    if (JSON.stringify(a) === JSON.stringify(c)) fails.push('different seed should differ');
    if (a.order.region !== 'Wrist') fails.push('region should carry through');
    if (!/scaphoid|wrist|fracture|radius|FOOSH|pain|ganglion/i.test(a.order.indication)) fails.push('wrist indication should be plausible: ' + a.order.indication);
    if (!(a.patient.age >= 4 && a.patient.age <= 89)) fails.push('age out of range: ' + a.patient.age);
    if (!/^XR-2026-\d{5}$/.test(a.order.accession)) fails.push('accession format wrong: ' + a.order.accession);
    const html = card(a);
    if (!/req-card/.test(html) || !/Wrist/.test(html)) fails.push('card html malformed');
    // pediatric habitus implies young age
    let foundPed = false;
    for (let s = 0; s < 60 && !foundPed; s++) { const g = generate({ region: 'Hand', seed: s }); if (g.patient.habitus === 'pediatric') { foundPed = true; if (g.patient.age > 16) fails.push('pediatric habitus should be <=16, got ' + g.patient.age); } }
    return { pass: fails.length === 0, failures: fails };
  }

  const API = { generate, generateBatch, card, CSS, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.Requisition = API;
})(typeof window !== 'undefined' ? window : globalThis);
