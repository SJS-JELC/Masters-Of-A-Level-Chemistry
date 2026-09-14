(function (root) {
  'use strict';

  // Keep the original store for electron evidence and legacy records. Acid
  // evidence is versioned separately so a revised progression starts empty
  // without rewriting a learner's existing v1 data.
  const key = 'masters-alevel-results-v1';
  const acidKey = 'masters-alevel-results-acid-v2';
  const acidLeaves = Object.freeze(new Set([
    'u6-t1-1-2', 'u6-t1-1-3', 'u6-t1-1-5', 'u6-t1-1-7', 'u6-t1-1-8'
  ]));
  const titrationLeaves = Object.freeze(new Set(['u6-t1-1-9']));
  const acidLevelLabels = Object.freeze({
    1: 'Level 1 · Structured', 2: 'Level 2 · Unstructured', 3: 'Level 3 · Applications'
  });
  const electronLevelLabels = Object.freeze({1: 'Level 1', 2: 'Level 2', 3: 'Level 3'});
  const labels = {
    'l6-t2-1-2': 'Electron configurations',
    'u6-t1-1-2': 'Strong Acids & pH',
    'u6-t1-1-3': 'Kw & Strong Bases',
    'u6-t1-1-5': 'Weak Acid Calculations',
    'u6-t1-1-7': 'Making Buffers',
    'u6-t1-1-8': 'Buffer Calculations',
    'u6-t1-1-9': 'pH Titration Curves'
  };
  const config = Object.freeze(Object.fromEntries([
    ['l6-t2-1-2', {label: labels['l6-t2-1-2'], halfLives: {1: 3, 2: 3, 3: 3}, progressionVersion: 1, levelLabels: electronLevelLabels}],
    ...[...acidLeaves].map(leafId => [leafId, {
      label: labels[leafId], halfLives: {1: 2, 2: 2, 3: 2}, progressionVersion: 2, levelLabels: acidLevelLabels
    }]),
    ...[...titrationLeaves].map(leafId => [leafId, {
      label: labels[leafId], halfLives: {2: 2, 3: 2}, progressionVersion: 1,
      availableGrades: [2, 3], levelLabels: {2: 'Level 2 · Unstructured', 3: 'Level 3 · Applications'}
    }])
  ].map(([leafId, value]) => [leafId, Object.freeze({
    label: value.label, halfLives: Object.freeze(value.halfLives), progressionVersion: value.progressionVersion,
    availableGrades: Object.freeze(value.availableGrades || [1, 2, 3]),
    levelLabels: Object.freeze(value.levelLabels)
  })])));
  const historicalConfig = Object.freeze({
    'u6-t1-1-4': Object.freeze({label: 'Ka & pKa', progressionVersion: 1})
  });
  const knownLeaves = new Set([...Object.keys(config), ...Object.keys(historicalConfig)]);
  const threshold = 0.8;
  let records = [], serial = 0;

  function storage() { try { return root.localStorage; } catch (_) { return null; } }
  function activeVersion(leafId) { return config[leafId]?.progressionVersion; }
  function valid(item, now, {historical = true} = {}) {
    if (!item || typeof item.id !== 'string' || item.id.length === 0 || !Number.isSafeInteger(item.level) || ![1, 2, 3].includes(item.level) ||
      ![0, 0.5, 1].includes(item.score) || !Number.isFinite(item.completedAt) || item.completedAt <= 0 || item.completedAt > now) return false;
    if (!knownLeaves.has(item.leafId) || (!historical && !Object.hasOwn(config, item.leafId))) return false;
    if (item.progressionVersion !== undefined && item.progressionVersion !== 1 && item.progressionVersion !== 2) return false;
    return true;
  }
  function clean(items, now = Date.now(), options = {}) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => {
      if (!valid(item, now, options) || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).map(item => {
      const cleaned = {id: item.id, leafId: item.leafId, level: item.level, score: item.score, completedAt: item.completedAt};
      if (item.progressionVersion !== undefined) cleaned.progressionVersion = item.progressionVersion;
      return cleaned;
    }).sort((a, b) => a.completedAt - b.completedAt);
  }
  function readStore(source, storeKey, now) {
    if (!source || typeof source.getItem !== 'function') return [];
    try { return clean(JSON.parse(source.getItem(storeKey) || '[]'), now); } catch (_) { return []; }
  }
  function read(source = storage(), now = Date.now()) {
    return clean([...readStore(source, key, now), ...readStore(source, acidKey, now)], now);
  }
  // Exposes retained historical records for audits/review tools. Active
  // summaries intentionally apply the progression-version filter below.
  function history(source = storage(), now = Date.now()) {
    return clean([...readStore(source, key, now), ...readStore(source, acidKey, now)], now, {historical: true});
  }
  // A record already persisted by another tab is the winning first attempt;
  // in-memory evidence is appended only when no saved record has that id.
  function currentRecords() { return clean([...read(), ...records], Date.now()); }
  function refresh() { records = currentRecords(); return records.map(item => ({...item})); }
  function evidenceFor(leafId) {
    const version = activeVersion(leafId);
    return records.filter(item => item.leafId === leafId &&
      (item.progressionVersion === version || (version === 1 && item.progressionVersion === undefined)));
  }
  // Same zero-prior, question-recency recurrence as the current IGCSE runtime.
  function weightedScore(scores, halfLife = 2) {
    if (!Number.isFinite(halfLife) || halfLife <= 0 || !scores.every(score => [0, 0.5, 1].includes(score))) throw Error('Invalid mastery evidence.');
    if (!scores.length) return null;
    const decay = 2 ** (-1 / halfLife);
    return scores.reduce((value, score) => value * decay + score * (1 - decay), 0);
  }
  function summary(leafId, level) {
    if (!Object.hasOwn(config, leafId) || !config[leafId].availableGrades.includes(Number(level))) throw Error('Unknown mastery level.');
    const matches = evidenceFor(leafId).filter(item => item.level === Number(level));
    const score = weightedScore(matches.map(item => item.score), config[leafId].halfLives[level]);
    const latest = matches[matches.length - 1];
    const days = latest ? Math.max(0, Math.floor((Date.now() - latest.completedAt) / 86400000)) : null;
    return {level: Number(level), score, mastered: score !== null && score > threshold, count: matches.length,
      days, freshness: days === null ? 'unstarted' : days <= 7 ? 'fresh' : days <= 21 ? 'steady' : 'due'};
  }
  function achievement(leafId) {
    if (!Object.hasOwn(config, leafId)) throw Error('Unknown mastery activity.');
    const states = config[leafId].availableGrades.map(level => summary(leafId, level));
    let level = 0;
    for (const state of states) { if (!state.mastered) break; level = state.level; }
    return {level, states};
  }
  function nextLevel(leafId) { return achievement(leafId).states.find(state => !state.mastered)?.level || null; }
  function record(item) {
    const now = Date.now();
    if (!valid(item, now, {historical: false}) || !Object.hasOwn(config, item.leafId) ||
      !config[item.leafId].availableGrades.includes(item.level) ||
      (activeVersion(item.leafId) === 2 && item.progressionVersion !== undefined && item.progressionVersion !== 2) ||
      (activeVersion(item.leafId) === 1 && item.progressionVersion === 2)) throw Error('Invalid mastery result.');
    const savedItem = {...item};
    if (activeVersion(item.leafId) === 2) savedItem.progressionVersion = 2;
    records = clean([...read(), ...records, savedItem], now);
    const targetKey = activeVersion(item.leafId) === 2 ? acidKey : key;
    try {
      const source = storage();
      if (!source || typeof source.setItem !== 'function') return false;
      const targetRecords = targetKey === acidKey
        ? records.filter(entry => acidLeaves.has(entry.leafId) && entry.progressionVersion === 2)
        : records.filter(entry => !acidLeaves.has(entry.leafId) || entry.progressionVersion !== 2);
      // Include transient in-memory records so a denied write can be flushed
      // when storage becomes available again. Persisted records stay first.
      const target = clean([...readStore(source, targetKey, now), ...targetRecords, savedItem], now);
      source.setItem(targetKey, JSON.stringify(target));
      return true;
    } catch (_) { return false; }
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
    const labelsForLeaf = config[leafId].levelLabels;
    for (const option of ['mastery', ...config[leafId].availableGrades]) {
      const link = root.document.createElement('a'), label = root.document.createElement('strong'), detail = root.document.createElement('span');
      link.className = 'practice-choice'; link.dataset.practice = String(option);
      const url = new URL(href, root.document.baseURI);
      url.searchParams.set('leaf', leafId); url.searchParams.set('practice', option === 'mastery' ? 'mastery' : 'level');
      if (option !== 'mastery') url.searchParams.set('level', option); else url.searchParams.delete('level');
      link.href = url.href;
      label.textContent = option === 'mastery' ? 'MASTERY' : labelsForLeaf[option];
      if (option === 'mastery') {
        const available = config[leafId].availableGrades;
        detail.textContent = available.length === 1 ? 'Build mastery at the available level'
          : available.length === 3 ? 'Build mastery across all three levels' : 'Build mastery across the available levels';
      }
      else detail.append(bar(summary(leafId, option).score, labelsForLeaf[option] + ' mastery', option));
      link.append(label, detail); container.append(link);
    }
  }
  refresh();
  root.ALevelMastery = Object.freeze({key, acidKey, config, threshold, read, history, readHistory: history, clean, refresh, weightedScore, summary, achievement, nextLevel, record, attemptId, bar, renderChoices});
})(globalThis);
