(function (root) {
  'use strict';

  // The curve builder owns rendering and marking.  This file supplies the
  // persistence and revision contract around that activity, so the same
  // question can run either as ordinary level practice or in an iframe
  // managed by the common revision scheduler.
  const LEAF = 'u6-t1-1-9';
  const SUPPORTED_LEVELS = Object.freeze([2, 3]);
  const VERSION = 'ph-titration-curves-test-v2';
  const PRACTICE_VERSION = 'ph-titration-curves-practice-v2';
  const STORE = 'sjs-alevel-ph-titration-curves-v2';
  const params = new URLSearchParams(root.location?.search || '');
  const requestedReview = params.get('review');
  const requestedPractice = params.get('practice');
  const requestedLevel = Number(params.get('level'));
  let activeLevel = SUPPORTED_LEVELS.includes(requestedLevel) ? requestedLevel : SUPPORTED_LEVELS[0];
  let bridge = null;
  let bridgeReady = false;
  let restored = false;
  let currentId = null;
  let currentState = null;
  let currentResult = null;
  let reported = false;
  let suppressPersistence = false;
  let savedPractice = null;
  let titleTimer = null;
  let attemptId = null;
  const recordedAttempts = new Set();

  const copy = value => {
    if (value === undefined) return undefined;
    try { return root.structuredClone ? root.structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  };
  const allQuestions = () => Array.isArray(root.TitrationData?.questions) ? root.TitrationData.questions : [];
  const questions = () => allQuestions().filter(item => item && Number(item.level) === activeLevel);
  const question = id => {
    const bank = reviewMode() ? allQuestions() : questions();
    return bank.find(item => item && item.id === id) || null;
  };
  const validId = id => typeof id === 'string' && Boolean(question(id));
  const activity = () => root.TitrationActivity;
  const reviewMode = () => Boolean(requestedReview || activity()?.isReviewing?.());
  const displayReviewId = () => activity()?.getReviewId?.() || currentId || '';
  function freshState(id) {
    const q = question(id);
    const base = q && typeof root.TitrationCore?.initial === 'function'
      ? root.TitrationCore.initial(q) : {};
    return {...base, checked: false, assisted: false, attempted: false,
      revealed: false, result: null};
  }
  function makeAttemptId() {
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  function nextQuestionId(exclude) {
    const bank = questions();
    if (!bank.length) return null;
    const index = bank.findIndex(item => item.id === exclude);
    return bank[((index < 0 ? -1 : index) + 1 + bank.length) % bank.length].id;
  }

  function setLevel(level, {load = false} = {}) {
    const next = Number(level);
    if (!SUPPORTED_LEVELS.includes(next)) return false;
    activeLevel = next;
    const app = activity();
    if (load && typeof app?.setLevel === 'function') {
      try { app.setLevel(next); } catch (_) { return false; }
    }
    return true;
  }

  function levelForPractice() {
    if (requestedPractice === 'mastery') {
      try {
        const next = root.ALevelMastery?.nextLevel?.(LEAF);
        if (SUPPORTED_LEVELS.includes(Number(next))) return Number(next);
        // Once both supported levels are mastered, continue ordinary practice
        // at the highest available level rather than inventing a new level.
        if (next === null) return SUPPORTED_LEVELS.at(-1);
      } catch (_) { /* the activity remains usable with the requested level */ }
    }
    return activeLevel;
  }

  function practiceStore() { return `${STORE}-level-${activeLevel}`; }

  function safeState(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? copy(value) : null;
  }

  // The scheduler accepts only the common evidence scores. A curve result can
  // award individual rubric items, but mastery evidence is deliberately
  // reduced to all correct, some correct, or none correct.
  function masteryScore(result) {
    if (!result || !Array.isArray(result.items) || !result.items.length) {
      const score = Number(result?.score);
      return score >= 1 ? 1 : score > 0 ? 0.5 : 0;
    }
    const marks = result.items.map(item => Boolean(item && item.correct));
    return marks.every(Boolean) ? 1 : marks.some(Boolean) ? 0.5 : 0;
  }

  function readPractice() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(practiceStore()) || 'null');
      if (!value || value.version !== PRACTICE_VERSION || value.leafId !== LEAF ||
          Number(value.level) !== activeLevel || !validId(value.questionId) || !safeState(value.state) ||
          (value.attemptId !== undefined && typeof value.attemptId !== 'string')) return null;
      return value;
    } catch (_) { return null; }
  }

  function writePractice() {
    if (bridge || reviewMode() || !currentId || !currentState) return;
    if (!attemptId) attemptId = makeAttemptId();
    const value = {version: PRACTICE_VERSION, leafId: LEAF, level: activeLevel,
      questionId: currentId, attemptId: attemptId || makeAttemptId(), state: copy(currentState)};
    try { root.localStorage?.setItem(practiceStore(), JSON.stringify(value)); }
    catch (_) { /* the activity remains usable for this page */ }
  }

  function revisionSnapshot() {
    if (!currentId || !currentState) return null;
    return {version: VERSION, leafId: LEAF, level: activeLevel, questionId: currentId,
      attemptId: attemptId || bridge?.attemptId || makeAttemptId(),
      state: copy(currentState), result: currentResult ? copy(currentResult) : null,
      completedAt: currentResult ? Date.now() : null};
  }

  function validSnapshot(value) {
    return Boolean(value && value.version === VERSION && value.leafId === LEAF &&
      Number(value.level) === activeLevel && validId(value.questionId) && safeState(value.state) &&
      Number(question(value.questionId)?.level) === activeLevel &&
      (value.attemptId === undefined || typeof value.attemptId === 'string'));
  }

  function parentTitle() {
    if (!bridge?.sessionId || !bridge?.attemptId || root.parent === root) return;
    // test-mode-bridge also observes the heading. Delay this explicit message
    // by one task so the richer bank ID wins over its optional blank ID.
    root.clearTimeout?.(titleTimer);
    titleTimer = root.setTimeout?.(() => {
      const q = question(currentId);
      try {
        root.parent.postMessage({channel: 'masters-test-mode', type: 'title',
          sessionId: bridge.sessionId, attemptId: bridge.attemptId,
           payload: {title: q?.title || 'pH titration curve', questionId: displayReviewId()}},
          root.location?.origin === 'null' ? '*' : root.location.origin);
      } catch (_) { /* parent owns the revision UI; a title is optional */ }
    }, 0);
  }

  function save() {
    if (suppressPersistence || reviewMode() || !currentId || !currentState) return;
    if (bridge) {
      try { void bridge.save(revisionSnapshot()); } catch (_) {}
    } else writePractice();
  }

  function restore(id, state) {
    if (reviewMode()) return false;
    const app = activity();
    if (!app || typeof app.loadQuestion !== 'function' || !validId(id) || Number(question(id)?.level) !== activeLevel) return false;
    try {
      // Pass an explicit blank state for a fresh scheduler question. A null
      // argument would let the standalone app recover an old local answer.
      currentId = id;
      attemptId = (typeof state?.attemptId === 'string' && state.attemptId) || attemptId || bridge?.attemptId || makeAttemptId();
      app.loadQuestion(id, safeState(state) || freshState(id));
      currentState = safeState(app.getState());
      parentTitle();
      save();
      return true;
    } catch (_) { return false; }
  }

  function initialise(detail) {
    if (!bridgeReady) return;
    const app = activity();
    if (!app || typeof app.getQuestion !== 'function' || typeof app.getState !== 'function') return;

    // The revision parent is authoritative for the selected level. The app's
    // setter also clears its current question, so select it before restoring
    // any scheduler snapshot.
    const bridgeLevel = Number(bridge?.level);
    const targetLevel = bridge && SUPPORTED_LEVELS.includes(bridgeLevel) ? bridgeLevel
      : !bridge && SUPPORTED_LEVELS.includes(requestedLevel) ? requestedLevel
      : !bridge && requestedPractice === 'mastery' && !SUPPORTED_LEVELS.includes(requestedLevel) ? levelForPractice() : null;
    if (SUPPORTED_LEVELS.includes(targetLevel) && app.getQuestion() &&
        Number(app.getQuestion()?.level) !== targetLevel) {
      suppressPersistence = true;
      try { setLevel(targetLevel, {load: true}); } finally { suppressPersistence = false; }
    }
    // Selecting the required level may replace the question synchronously;
    // the original ready-event detail then describes the previous level.
    const incomingId = app.getQuestion()?.id || detail?.questionId;
    const incomingState = app.getState() || detail?.state;
    if (!validId(incomingId)) return;

    if (reviewMode()) {
      currentId = incomingId; currentState = safeState(incomingState); currentResult = currentState?.result || null;
      parentTitle(); return;
    }

    if (bridge && !restored) {
      restored = true;
      // The current state is resumable. `previous` is only the scheduler's
      // last completed question and must not be restored as a new attempt.
      const saved = validSnapshot(bridge.state) ? bridge.state : null;
      if (saved) {
        currentResult = saved.result ? copy(saved.result) : null;
        reported = Boolean(currentResult);
        attemptId = saved.attemptId || bridge.attemptId || makeAttemptId();
        if (restore(saved.questionId, saved.state)) return;
      }
      const previous = validSnapshot(bridge.previous) ? bridge.previous : null;
      if (previous) {
        const freshId = nextQuestionId(previous.questionId);
        currentResult = null;
        reported = false;
        if (freshId && restore(freshId, null)) return;
      } else if (bridge.previous && typeof bridge.previous === 'object') {
        // A retained scheduler record from an older session version may not
        // be restorable, but its question ID can still avoid repeating it.
        const previousId = typeof bridge.previous.questionId === 'string' && validId(bridge.previous.questionId)
          ? bridge.previous.questionId : incomingId;
        const freshId = nextQuestionId(previousId);
        currentResult = null;
        reported = false;
        if (freshId && restore(freshId, null)) return;
      }
    } else if (!bridge && !restored) {
      restored = true;
      savedPractice = readPractice();
      if (savedPractice) {
        attemptId = savedPractice.attemptId || makeAttemptId();
        if (restore(savedPractice.questionId, savedPractice.state)) return;
      }
    }

    currentId = incomingId;
    if (!attemptId || (!bridge && savedPractice?.questionId !== incomingId)) attemptId = bridge?.attemptId || makeAttemptId();
    currentState = safeState(incomingState);
    currentResult = currentState?.checked ? currentResult : null;
    parentTitle();
    save();
  }

  function onReady(event) {
    initialise(event.detail || {});
  }

  function onChange(event) {
    if (!bridgeReady) return;
    const detail = event.detail || {};
    const app = activity();
    const id = detail.questionId || app?.getQuestion?.()?.id || currentId;
    if (!validId(id) || (!reviewMode() && Number(question(id)?.level) !== activeLevel)) return;
    if (id !== currentId) {
      attemptId = bridge?.attemptId || (typeof detail.state?.attemptId === 'string' ? detail.state.attemptId : makeAttemptId());
      currentResult = null;
      reported = false;
    }
    currentId = id;
    currentState = safeState(detail.state) || safeState(app?.getState?.()) || currentState;
    if (currentState?.checked !== true) currentResult = null;
    parentTitle();
    save();
  }

  async function reportScore(detail) {
    if (reviewMode()) return;
    const app = activity();
    const id = detail.questionId || app?.getQuestion?.()?.id || currentId;
    if (!validId(id) || Number(question(id)?.level) !== activeLevel) return;
    currentId = id;
    currentState = safeState(detail.state) || safeState(app?.getState?.()) || currentState;
    currentResult = detail.result && typeof detail.result === 'object' ? copy(detail.result) : null;
    const assisted = detail.assisted === true;
    const firstAttempt = detail.firstAttempt === true;
    const independent = firstAttempt && !assisted;
    const score = masteryScore(currentResult);
    if (!attemptId) attemptId = makeAttemptId();
    save();

    if (bridge) {
      if (reported) return;
      reported = true;
      const completedAt = Date.now();
      const evidence = independent ? {score, result: copy(currentResult)} : null;
      try {
        await bridge.result({score, independent, completedAt, evidence});
      } catch (_) { reported = false; }
      return;
    }

    // Practice results are evidence only on the first unassisted check. The
    // per-attempt key keeps duplicate score events idempotent while allowing
    // a later attempt at the same bank question to add fresh evidence.
    if (!independent || !root.ALevelMastery || typeof root.ALevelMastery.record !== 'function') return;
    const recordId = attemptId || `${LEAF}:${id}`;
    if (recordedAttempts.has(recordId)) return;
    try {
      root.ALevelMastery.record({id: recordId, leafId: LEAF, level: activeLevel,
        score, completedAt: Date.now()});
      recordedAttempts.add(recordId);
    } catch (_) { /* preserve the answer in the activity's local session */ }
  }

  function onNext(event) {
    if (reviewMode()) return;
    if (bridge) {
      // The parent scheduler owns question progression in revision mode.
      event.preventDefault();
      try { void bridge.next(); } catch (_) {}
      return;
    }
    if (requestedPractice !== 'mastery') return;
    const next = levelForPractice();
    // Stay within the current level while it is still the mastery target; the
    // activity advances to its next bank question using the default handler.
    if (next === activeLevel) return;
    if (!SUPPORTED_LEVELS.includes(next)) return;
    event.preventDefault();
    setLevel(next, {load: true});
  }

  root.addEventListener('titration:ready', onReady);
  root.addEventListener('titration:change', onChange);
  root.addEventListener('titration:score', event => { void reportScore(event.detail || {}); });
  root.addEventListener('titration:next', onNext);

  async function connect() {
    try { bridge = await root.TestModeBridge?.connect() || null; }
    catch (_) { bridge = null; }
    bridgeReady = true;
    initialise();
  }

  root.TitrationSession = Object.freeze({leafId: LEAF, get level() { return activeLevel; }, masteryScore, validSnapshot});
  void connect();
})(globalThis);
