/* ============================================================================
 * Positioning Pro — Feedback FX: sound + haptics  (Design Roadmap #10)
 * ----------------------------------------------------------------------------
 * Lightweight audio + haptic feedback for UI events. Web Audio for tones,
 * navigator.vibrate for haptics (works in the Capacitor WKWebView / Android;
 * degrades silently where unsupported). No dependencies.
 *
 *   const fx = FeedbackFX({ sound:true, haptics:true });
 *   fx.correct();  fx.wrong();  fx.milestone(3);  fx.knobTick();  fx.expose();
 *   fx.play('prepCharge');   // generic by name
 *
 * All methods are safe to call before any user gesture and on servers (no-op).
 * ==========================================================================*/
(function (global) {
  'use strict';

  // event -> { tones:[{f,dur,type,vol,delay,slideTo}], vibe:[ms,...] }
  const PATTERNS = {
    correct:   { tones: [{ f: 660, dur: 0.08, type: 'sine', vol: 0.18 }, { f: 990, dur: 0.12, type: 'sine', vol: 0.18, delay: 0.07 }], vibe: [18] },
    wrong:     { tones: [{ f: 220, dur: 0.18, type: 'square', vol: 0.16 }, { f: 160, dur: 0.22, type: 'square', vol: 0.14, delay: 0.10 }], vibe: [40, 60, 40] },
    close:     { tones: [{ f: 520, dur: 0.10, type: 'triangle', vol: 0.16 }], vibe: [12] },
    knobTick:  { tones: [{ f: 1300, dur: 0.02, type: 'square', vol: 0.06 }], vibe: [4] },
    detent:    { tones: [{ f: 700, dur: 0.05, type: 'triangle', vol: 0.12 }], vibe: [8] },
    milestone: { tones: [{ f: 523, dur: 0.10, type: 'sine', vol: 0.2 }, { f: 659, dur: 0.10, type: 'sine', vol: 0.2, delay: 0.09 }, { f: 784, dur: 0.16, type: 'sine', vol: 0.2, delay: 0.18 }], vibe: [15, 40, 15, 40, 25] },
    prepCharge:{ tones: [{ f: 120, dur: 0.9, type: 'sawtooth', vol: 0.12, slideTo: 520 }], vibe: [] },
    expose:    { tones: [{ f: 1000, dur: 0.35, type: 'square', vol: 0.18 }], vibe: [120] },
    ready:     { tones: [{ f: 880, dur: 0.09, type: 'sine', vol: 0.16 }], vibe: [10] },
  };

  function FeedbackFX(opts) {
    opts = opts || {};
    const settings = { sound: opts.sound !== false, haptics: opts.haptics !== false };
    let AC = null, master = null;

    function ctx() {
      if (AC) return AC;
      try {
        const C = global.AudioContext || global.webkitAudioContext;
        if (!C) return null;
        AC = new C(); master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
      } catch (e) { AC = null; }
      return AC;
    }
    function resume() { const c = ctx(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } }

    function tone(spec) {
      const c = ctx(); if (!c) return;
      const t0 = c.currentTime + (spec.delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = spec.type || 'sine';
      o.frequency.setValueAtTime(spec.f, t0);
      if (spec.slideTo) o.frequency.exponentialRampToValueAtTime(spec.slideTo, t0 + spec.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(spec.vol == null ? 0.15 : spec.vol, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + spec.dur + 0.02);
    }
    function vibrate(pattern) {
      if (!settings.haptics || !pattern || !pattern.length) return;
      try { if (global.navigator && global.navigator.vibrate) global.navigator.vibrate(pattern); } catch (e) {}
    }

    function play(name) {
      const p = PATTERNS[name]; if (!p) return false;
      if (settings.sound) { resume(); (p.tones || []).forEach(tone); }
      vibrate(p.vibe);
      return true;
    }

    const api = { play, resume,
      set: (k, v) => { settings[k] = !!v; return settings; }, settings: () => Object.assign({}, settings),
      patterns: () => Object.keys(PATTERNS) };
    // convenience methods
    Object.keys(PATTERNS).forEach(n => { api[n] = (arg) => play(n); });
    return api;
  }

  function selfTest() {
    const fails = [];
    // every pattern well-formed
    for (const [name, p] of Object.entries(PATTERNS)) {
      if (!Array.isArray(p.tones)) fails.push(name + ' missing tones array');
      (p.tones || []).forEach((t, i) => { if (typeof t.f !== 'number' || typeof t.dur !== 'number') fails.push(name + ' tone ' + i + ' malformed'); });
      if (!Array.isArray(p.vibe)) fails.push(name + ' vibe should be array');
    }
    // constructing + calling in a no-audio environment must not throw
    try {
      const fx = FeedbackFX({ sound: true, haptics: true });
      ['correct', 'wrong', 'milestone', 'knobTick', 'expose'].forEach(m => fx[m]());
      if (fx.play('nonexistent') !== false) fails.push('unknown pattern should return false');
      if (fx.play('correct') !== true) fails.push('known pattern should return true');
      const s = fx.settings(); fx.set('sound', false);
      if (fx.settings().sound !== false) fails.push('set() should toggle setting');
      if (!Array.isArray(fx.patterns())) fails.push('patterns() should list names');
    } catch (e) { fails.push('calling FX threw: ' + e.message); }
    return { pass: fails.length === 0, failures: fails };
  }

  const API = { FeedbackFX, PATTERNS, selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.FeedbackFX = FeedbackFX;
  global.FeedbackFXAPI = API;
})(typeof window !== 'undefined' ? window : globalThis);
