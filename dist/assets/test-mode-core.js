(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TestModeCore = api;
})(globalThis, function () {
  'use strict';
  const WEEK = 7 * 86400000;
  const copy = value => JSON.parse(JSON.stringify(value));
  function levelState(summary) {
    return {mode: summary.mastered ? 'check' : 'practice', required: summary.mastered && summary.days > 7 ? 2 : 1,
      streak: 0, confirmedAt: null, initialScore: summary.score};
  }
  function create(ids, catalog, summary, now, id) {
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(leaf => !catalog[leaf])) throw Error('Select available gems.');
    return {version: 1, id, selected: ids.slice(), active: true, createdAt: now, round: [], lastLeaf: null,
      current: null, previous: {}, evidence: [], submitted: 0,
      gems: Object.fromEntries(ids.map(leaf => [leaf, Object.fromEntries(catalog[leaf].levels.map(level => [level, levelState(summary(leaf, level))]))]))};
  }
  function levelFor(session, leaf) {
    return Object.keys(session.gems[leaf]).map(Number).sort((a,b) => a-b).find(level => session.gems[leaf][level].confirmedAt === null) ?? null;
  }
  function expire(session, summary, now) {
    for (const leaf of session.selected) for (const [level, state] of Object.entries(session.gems[leaf])) {
      if (state.confirmedAt !== null && (now - state.confirmedAt > WEEK || !summary(leaf, Number(level)).mastered)) session.gems[leaf][level] = levelState(summary(leaf, Number(level)));
    }
  }
  function next(session, summary, now, attemptId) {
    if (session.current && !session.current.result) return session.current;
    if (session.current) {
      const c = session.current;
      session.previous[c.leafId + ':' + c.level] = c.state;
      session.lastLeaf = c.leafId;
      session.current = null;
    }
    expire(session, summary, now);
    session.round = session.round.filter(leaf => levelFor(session, leaf) !== null);
    if (!session.round.length) {
      session.round = session.selected.filter(leaf => levelFor(session, leaf) !== null).sort((a,b) => {
        const la = levelFor(session,a), lb = levelFor(session,b);
        return la-lb || (summary(a,la).score ?? 0)-(summary(b,lb).score ?? 0) || a.localeCompare(b);
      });
    }
    if (!session.round.length) return null;
    if (session.round[0] === session.lastLeaf && session.round.length > 1) session.round.push(session.round.shift());
    const leafId = session.round.shift(), level = levelFor(session,leafId);
    session.current = {attemptId, leafId, level, state: null, result: null};
    return session.current;
  }
  function validResult(value, now) {
    return value && [0,0.5,1].includes(value.score) && typeof value.independent === 'boolean' &&
      Number.isFinite(value.completedAt) && value.completedAt > 0 && value.completedAt <= now &&
      (value.evidence === null ? !value.independent : value.evidence && value.evidence.score === value.score);
  }
  function accept(session, result, summary, now) {
    const c = session.current;
    if (!c || c.result || !validResult(result,now)) return false;
    c.result = copy(result); session.submitted++;
    const state = session.gems[c.leafId][c.level], independentPass = result.score === 1 && result.independent;
    state.streak = independentPass ? state.streak + 1 : 0;
    if (!independentPass && state.mode === 'check') { state.mode = 'practice'; state.required = 2; }
    if (independentPass && state.streak >= state.required && summary(c.leafId,c.level).mastered) state.confirmedAt = now;
    return true;
  }
  function valid(s, catalog, now = Date.now()) {
    try {
      if (!s || s.version !== 1 || typeof s.id !== 'string' || !s.id || typeof s.active !== 'boolean' ||
          !Array.isArray(s.selected) || !s.selected.length || new Set(s.selected).size !== s.selected.length ||
          !s.selected.every(leaf => catalog[leaf]) || !Array.isArray(s.round) || !s.round.every(leaf => s.selected.includes(leaf)) ||
          !Number.isInteger(s.submitted) || s.submitted < 0 || !s.previous || !Array.isArray(s.evidence)) return false;
      for (const leaf of s.selected) {
        if (Object.keys(s.gems[leaf]).length !== catalog[leaf].levels.length) return false;
        for (const level of catalog[leaf].levels) {
          const st = s.gems[leaf][level];
          if (!st || !['check','practice'].includes(st.mode) || ![1,2].includes(st.required) ||
              !Number.isInteger(st.streak) || st.streak < 0 || !(st.confirmedAt === null || (st.confirmedAt > 0 && st.confirmedAt <= now))) return false;
        }
      }
      const c = s.current;
      return c === null || (typeof c.attemptId === 'string' && c.attemptId.length > 0 && s.selected.includes(c.leafId) && catalog[c.leafId].levels.includes(c.level) && (c.result === null || validResult(c.result,now)));
    } catch (_) { return false; }
  }
  return {WEEK, create, next, accept, expire, levelFor, valid, validResult};
});
