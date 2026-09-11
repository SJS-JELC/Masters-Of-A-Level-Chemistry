(function (root) {
  'use strict';
  const key = 'masters-alevel-results-v1';
  const config = Object.freeze(Object.fromEntries([
    ['l6-t2-1-2', 'Electron configurations'],
    ['u6-t1-1-2', 'Strong Acids & pH'],
    ['u6-t1-1-3', 'Kw & Strong Bases'],
    ['u6-t1-1-4', 'Ka & pKa'],
    ['u6-t1-1-5', 'Weak Acid Calculations'],
    ['u6-t1-1-7', 'Making Buffers'],
    ['u6-t1-1-8', 'Buffer Calculations']
  ].map(([leafId, label]) => [leafId, Object.freeze({label, halfLives: Object.freeze({1: 2, 2: 2, 3: 2})})])));
  const threshold = 0.8;
  let records = [], serial = 0;
  function storage() { try { return root.localStorage; } catch (_) { return null; } }
  function valid(item, now) {
    return item && typeof item.id === 'string' && item.id.length > 0 &&
      Object.hasOwn(config, item.leafId) && [1, 2, 3].includes(item.level) &&
      [0, 0.5, 1].includes(item.score) && Number.isFinite(item.completedAt) && item.completedAt > 0 && item.completedAt <= now;
  }
  function clean(items, now = Date.now()) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => {
      if (!valid(item, now) || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).map(({id, leafId, level, score, completedAt}) => ({id, leafId, level, score, completedAt}))
      .sort((a, b) => a.completedAt - b.completedAt);
  }
  function read(source = storage(), now = Date.now()) {
    try { return clean(JSON.parse(source.getItem(key) || '[]'), now); } catch (_) { return []; }
  }
  function refresh() { records = clean([...read(), ...records]); return records.map(item => ({...item})); }
  // Same zero-prior, question-recency recurrence as the current IGCSE runtime.
  function weightedScore(scores, halfLife = 2) {
    if (!Number.isFinite(halfLife) || halfLife <= 0 || !scores.every(score => [0, 0.5, 1].includes(score))) throw Error('Invalid mastery evidence.');
    if (!scores.length) return null;
    const decay = 2 ** (-1 / halfLife);
    return scores.reduce((value, score) => value * decay + score * (1 - decay), 0);
  }
  function summary(leafId, level) {
    if (!Object.hasOwn(config, leafId) || ![1, 2, 3].includes(Number(level))) throw Error('Unknown mastery level.');
    const matches = records.filter(item => item.leafId === leafId && item.level === Number(level));
    const score = weightedScore(matches.map(item => item.score), config[leafId].halfLives[level]);
    const latest = matches[matches.length - 1];
    const days = latest ? Math.max(0, Math.floor((Date.now() - latest.completedAt) / 86400000)) : null;
    return {level: Number(level), score, mastered: score !== null && score > threshold, count: matches.length,
      days, freshness: days === null ? 'unstarted' : days <= 7 ? 'fresh' : days <= 21 ? 'steady' : 'due'};
  }
  function achievement(leafId) {
    const states = [1, 2, 3].map(level => summary(leafId, level));
    let level = 0;
    for (const state of states) { if (!state.mastered) break; level = state.level; }
    return {level, states};
  }
  function nextLevel(leafId) { return achievement(leafId).states.find(state => !state.mastered)?.level || null; }
  function record(item) {
    if (!valid(item, Date.now())) throw Error('Invalid mastery result.');
    // Saved first attempts win across tabs; unsaved attempts stay in this tab.
    records = clean([...read(), ...records, item]);
    try { storage().setItem(key, JSON.stringify(records)); return true; } catch (_) { return false; }
  }
  function attemptId() {
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return Date.now().toString(36) + '-' + (++serial).toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function bar(score, label = 'Mastery', level = 1) {
    const node = root.document.createElement('span');
    node.className = 'mastery-bar'; node.dataset.level = level;
    node.setAttribute('role', 'meter'); node.setAttribute('aria-label', label);
    node.setAttribute('aria-valuemin', '0'); node.setAttribute('aria-valuemax', '1');
    node.setAttribute('aria-valuenow', String(score ?? 0));
    node.setAttribute('aria-valuetext', score === null ? 'Not assessed yet' : score > threshold ? 'Above the mastery threshold' : 'Mastery threshold not yet exceeded');
    node.style.setProperty('--mastery-fill', ((score ?? 0) * 100) + '%');
    node.style.setProperty('--mastery-threshold', (threshold * 100) + '%');
    node.innerHTML = '<span class="mastery-bar-fill" aria-hidden="true"></span><span class="mastery-bar-threshold" aria-hidden="true"></span>';
    return node;
  }
  function renderChoices(container, {leafId, href}) {
    if (!Object.hasOwn(config, leafId)) throw Error('Unknown mastery activity.');
    container.replaceChildren(); container.classList.add('practice-choices');
    for (const option of ['mastery', 1, 2, 3]) {
      const link = root.document.createElement('a'), label = root.document.createElement('strong'), detail = root.document.createElement('span');
      link.className = 'practice-choice'; link.dataset.practice = String(option);
      const url = new URL(href, root.document.baseURI);
      url.searchParams.set('leaf', leafId); url.searchParams.set('practice', option === 'mastery' ? 'mastery' : 'level');
      if (option !== 'mastery') url.searchParams.set('level', option); else url.searchParams.delete('level');
      link.href = url.href;
      label.textContent = option === 'mastery' ? 'MASTERY' : 'Level ' + option;
      if (option === 'mastery') detail.textContent = 'Build mastery across all three levels';
      else detail.append(bar(summary(leafId, option).score, 'Level ' + option + ' mastery', option));
      link.append(label, detail); container.append(link);
    }
  }
  refresh();
  root.ALevelMastery = Object.freeze({key, config, threshold, read, clean, refresh, weightedScore, summary, achievement, nextLevel, record, attemptId, bar, renderChoices});
})(globalThis);
