(function (root) {
  'use strict';
  const LIMITS = [60000, 180000, 300000, 600000];
  // Reviewed work allowances, not the number of visible answer fields. Level 3
  // templates often contain several operations inside one worked-answer part.
  const acidMinutes = Object.freeze({
    'h-to-ph': 1, 'ph-to-h': 1, 'strong-acid-direct': 3, 'strong-acid-dilution': 3,
    'strong-acid-preparation': 3, 'strong-acid-neutralisation': 5,
    'strong-base-direct': 3, 'water-ph-from-kw': 3, 'dihydroxide-direct': 3,
    'strong-base-mass': 5, 'temperature-base': 3, 'base-mass-concentration-dilution': 5,
    'base-purity': 5, 'excess-strong-base': 10,
    'weak-acid-concentration-ph': 3, 'weak-acid-pka-ph': 3, 'weak-acid-amount': 5,
    'weak-acid-reverse-concentration': 3, 'weak-acid-ph-ka': 3, 'weak-acid-ph-pka': 3,
    'weak-acid-percent': 3, 'weak-acid-pka-concentration': 3, 'weak-acid-target-mass': 5,
    'weak-acid-purity': 5, 'weak-acid-preparation-ka': 5,
    'buffer-component-ratio': 3, 'buffer-salt-amount': 3, 'buffer-salt-mass': 5,
    'buffer-salt-stock-volume': 5, 'buffer-partial-target-alkali': 10,
    'buffer-target-volume-stocks': 10, 'buffer-direct': 3, 'buffer-mixed-volumes': 5,
    'partial-buffer-moles': 5, 'partial-buffer-solutions': 10, 'buffer-after-addition': 5,
    'buffer-recipe-deviation': 10, 'partial-buffer-ka': 10
  });
  function allowance(activity, question) {
    if (activity === 'electron') return (question.kind === 'matching' || question.direction === 'build' ? 3 : 1) * 60000;
    if (activity === 'titration') return 600000;
    // Drawing requires sustained thought between edits; allow three minutes
    // idle for routine diagrams and five for the advanced Level 3 bank.
    if (activity === 'dot-and-cross') return question.level === 3 ? 300000 : 180000;
    if (activity === 'acid' && Object.hasOwn(acidMinutes, question.templateId)) return acidMinutes[question.templateId] * 60000;
    throw Error('Missing question timing allowance.');
  }
  function valid(value) {
    return Boolean(value && value.version === 1 && Number.isSafeInteger(value.activeMs) && value.activeMs >= 0 && LIMITS.includes(value.idleLimitMs));
  }
  function result(value) {
    return valid(value) && value.finished === true ? {version: 1, activeMs: value.activeMs, idleLimitMs: value.idleLimitMs} : undefined;
  }
  // Pure clock for deterministic tests. Browser sampling detects suspension;
  // deadlines themselves are independent of the frequency of timer callbacks.
  function create({id, idleLimitMs, saved, completed = false, now = () => performance.now()}) {
    if (!id || !LIMITS.includes(idleLimitMs)) throw Error('Invalid timing question.');
    const restore = valid(saved) && saved.id === id && saved.idleLimitMs === idleLimitMs && typeof saved.finished === 'boolean';
    let activeMs = restore ? saved.activeMs : 0, finished = completed || (restore && saved.finished),
      running = !finished, last = now(), deadline = last + idleLimitMs;
    const known = !completed || restore;
    function tick(visible = true, suspended = false) {
      const current = now();
      if (running && visible && !suspended && !finished) activeMs += Math.max(0, Math.min(current, deadline) - last);
      if (!visible || suspended || current >= deadline) running = false;
      last = current;
    }
    function interact(visible = true) { tick(visible); if (visible && !finished) { running = true; deadline = last + idleLimitMs; } }
    function pause() { tick(); running = false; }
    function snapshot() { return known ? {version: 1, id, activeMs: Math.floor(activeMs), idleLimitMs, finished: Boolean(finished)} : undefined; }
    function finish() { tick(); finished = true; running = false; return result(snapshot()); }
    return {id, tick, interact, pause, snapshot, finish};
  }
  let current = null, checkpoint = null, lastMono = 0, lastWall = 0, lastSave = 0, lastCheckpoint = '';
  function visible() {
    try { return !root.document.hidden && root.top.document.hasFocus(); }
    catch (_) { return !root.document.hidden && root.document.hasFocus(); }
  }
  function sample() {
    if (!current) return;
    const mono = root.performance.now(), wall = Date.now();
    // A delayed/frozen event loop is not evidence of active working time.
    const gap = mono - lastMono > 5000 || wall - lastWall > 5000 || wall < lastWall;
    current.tick(visible(), gap); lastMono = mono; lastWall = wall;
  }
  function persist() {
    const value = current?.snapshot(), signature = JSON.stringify(value);
    if (value && checkpoint && signature !== lastCheckpoint) { lastCheckpoint = signature; checkpoint(value); }
    lastSave = Date.now();
  }
  function pause() { sample(); current?.pause(); persist(); return current?.snapshot(); }
  function stop() { pause(); current = null; checkpoint = null; }
  function start(options) {
    if (current?.id === options.id) return current.snapshot();
    stop(); checkpoint = options.onCheckpoint; lastCheckpoint = '';
    current = create(options); lastMono = root.performance.now(); lastWall = Date.now(); lastSave = lastWall;
    if (!visible()) current.tick(false);
    return current.snapshot();
  }
  function finish() { sample(); const timing = current?.finish(); persist(); return timing; }
  function snapshot() { sample(); return current?.snapshot(); }
  if (root.document && root.addEventListener) {
    const interaction = event => {
      if (!event.isTrusted || !current) return;
      if (event.type === 'pointermove' && !event.buttons) return;
      sample(); current.interact(visible());
    };
    for (const type of ['keydown', 'input', 'pointerdown', 'pointermove', 'touchmove', 'wheel', 'scroll']) root.document.addEventListener(type, interaction, {capture: true, passive: true});
    root.document.addEventListener('visibilitychange', () => { if (root.document.hidden) pause(); });
    root.addEventListener('pagehide', pause);
    // Parent-to-iframe focus changes must not count as leaving the application.
    root.addEventListener('blur', () => { if (!visible()) pause(); });
    root.setInterval(() => { sample(); if (current && Date.now() - lastSave >= 5000) persist(); }, 1000);
  }
  root.ActiveQuestionTime = Object.freeze({LIMITS, acidMinutes, allowance, valid, result, create, start, stop, pause, finish, snapshot});
})(globalThis);
