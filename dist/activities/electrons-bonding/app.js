(async function () {
  'use strict';

  const D = globalThis.BondingData;
  const C = globalThis.BondingCore;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'sjs-electrons-bonding-level-1-v1';
  const STATE_VERSION = 2;
  const params = new URLSearchParams(location.search);
  const requestedLeaf = params.get('leaf');
  const requestedQuestion = params.get('question');
  const requestedReview = params.get('review');
  const teacherMode = globalThis.ChemistryMode?.get?.() === 'teacher' || params.get('mode') === 'teacher';
  const reviewMode = teacherMode || params.has('review');
  const reviewQuestion = requestedReview && D.questions.find(item => item.id === requestedReview);
  const pinnedQuestionId = requestedQuestion || reviewQuestion?.id || null;
  const B = globalThis.TestModeBridge;
  const bridge = await B?.connect() || null;
  const testing = Boolean(bridge);
  const ActiveQuestionTime = globalThis.ActiveQuestionTime;
  let bank = D.questions.filter(item => Number(item.level) === 1);
  let attempt = null;
  let question = null;
  let storageOK = true;
  let resultSent = false;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function makeAttemptId() {
    if (globalThis.ALevelMastery?.attemptId) return globalThis.ALevelMastery.attemptId();
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function hash(value) {
    let number = 2166136261;
    for (const character of String(value)) {
      number ^= character.charCodeAt(0);
      number = Math.imul(number, 16777619);
    }
    return (number >>> 0) || 1;
  }

  function validSnapshot(value, eligible = bank) {
    const savedQuestion = D.questions.find(item => item.id === value?.questionId);
    return Boolean(value && value.version === STATE_VERSION &&
      typeof value.questionId === 'string' && eligible.some(item => item.id === value.questionId) &&
      savedQuestion && value.leafId === savedQuestion.leafId && Number(value.level) === 1 &&
      typeof value.attemptId === 'string' && value.attemptId &&
      Array.isArray(value.answers) && value.answers.length === savedQuestion.fields.length &&
      value.answers.every(answer => typeof answer === 'string') &&
      (value.marks === null || (Array.isArray(value.marks) && value.marks.length === savedQuestion.points.length && value.marks.every(mark => typeof mark === 'boolean'))) &&
      typeof value.hinted === 'boolean' && typeof value.revealed === 'boolean' &&
      (value.completedAt === null || (Number.isFinite(value.completedAt) && value.completedAt > 0)));
  }

  function readPractice() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!validSnapshot(saved, pool())) return null;
      const savedQuestion = D.questions.find(item => item.id === saved.questionId);
      if (requestedLeaf && bank.some(item => item.leafId === requestedLeaf) && savedQuestion.leafId !== requestedLeaf) return null;
      if (pinnedQuestionId && saved.questionId !== pinnedQuestionId) return null;
      return saved;
    } catch (_) {
      storageOK = false;
      return null;
    }
  }

  function snapshot() {
    if (!attempt || !question) return null;
    return {
      version: STATE_VERSION,
      questionId: question.id,
      leafId: question.leafId,
      level: 1,
      attemptId: attempt.attemptId,
      answers: currentAnswers(),
      marks: attempt.marks ? attempt.marks.slice() : null,
      hinted: Boolean(attempt.hinted),
      revealed: Boolean(attempt.revealed),
      completedAt: attempt.completedAt || null,
      timing: attempt.timing || null
    };
  }

  function currentAnswers() {
    return (question?.fields || []).map((_, index) => $(`answer-${index}`)?.value || '');
  }

  function save() {
    const saved = snapshot();
    if (!saved || reviewMode) return;
    if (testing) {
      try { void bridge.save(saved); } catch (_) { /* revision session owns its persistence */ }
      return;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
      $('saveStatus').textContent = 'Your attempt is saved in this browser.';
    } catch (_) {
      storageOK = false;
      $('saveStatus').textContent = 'Browser storage is unavailable; this attempt lasts only for this visit.';
    }
  }

  function pool() {
    if (testing) {
      return D.questions.filter(item => item.leafId === bridge.leafId && Number(item.level) === Number(bridge.level));
    }
    if (requestedLeaf && D.questions.some(item => item.leafId === requestedLeaf)) {
      return bank.filter(item => item.leafId === requestedLeaf);
    }
    return bank;
  }

  function restoredAttempt(saved, item) {
    return {
      attemptId: saved.attemptId,
      answers: saved.answers.slice(),
      marks: Array.isArray(saved.marks) ? saved.marks.slice() : null,
      hinted: Boolean(saved.hinted),
      revealed: Boolean(saved.revealed),
      completedAt: saved.completedAt || null,
      timing: saved.timing || null
    };
  }

  function chooseQuestion(items, previousId, seed) {
    if (!items.length) return null;
    let candidates = items.length > 1 && previousId ? items.filter(item => item.id !== previousId) : items;
    if (!candidates.length) candidates = items;
    return candidates[(hash(seed) - 1) % candidates.length];
  }

  async function reportAssessment(score, independent) {
    if (!attempt || !question || reviewMode) return;
    const completedAt = attempt.completedAt;
    const timing = ActiveQuestionTime.result(attempt.timing);
    const evidence = independent ? {
      score,
      questionId: question.id,
      leafId: question.leafId,
      level: 1,
      marks: attempt.marks.slice(),
      total: question.points.length,
      timing
    } : null;

    if (testing) {
      if (resultSent) return;
      resultSent = true;
      try { await bridge.result({ score, independent, completedAt, evidence }); }
      catch (_) { resultSent = false; }
      return;
    }
    if (!independent || !globalThis.ALevelMastery?.record) return;
    try {
      globalThis.ALevelMastery.record({
        id: attempt.attemptId,
        leafId: question.leafId,
        level: 1,
        score,
        completedAt,
        timing
      });
    } catch (_) {
      $('saveStatus').textContent = 'The answer is saved, but mastery evidence could not be recorded.';
    }
  }

  function pointResults() {
    return question.points.map((_, index) => Boolean(attempt.marks?.[index]));
  }

  function renderFeedback() {
    const marks = pointResults();
    const earned = marks.filter(Boolean).length;
    const answerLines = question.points.map((point, index) => {
      const answer = point;
      const correct = Boolean(marks[index]);
      const note = !correct ? ` Expected answer: ${escapeHTML(answer)}.` : '';
      return `<li class="${correct ? 'pass' : 'fail'}">${correct ? '✓' : 'Review:'} ${escapeHTML(point)}${note}</li>`;
    }).join('');
    const practiceMessage = attempt.hinted || attempt.revealed
      ? '<p class="practice-note">This assisted answer is practice and has not added mastery evidence.</p>'
      : `<p class="${earned === marks.length ? 'pass' : 'fail'}">${earned === marks.length ? 'All marking points met.' : 'Review the model answer, then try another question.'}</p>`;
    $('feedback').innerHTML = `<h3>${earned} / ${marks.length} marks</h3><ul class="mark-list">${answerLines}</ul><p><strong>Model answer:</strong> ${escapeHTML(question.sourceAnswer)}</p><p>${escapeHTML(question.feedback || '')}</p>${practiceMessage}`;
    $('feedback').hidden = false;
    $('next').hidden = false;
    $('check').disabled = true;
    $('hint').disabled = true;
    $('giveUp').hidden = true;
    $('written').querySelectorAll('textarea').forEach((input, index) => {
      input.disabled = true;
      input.setAttribute('aria-invalid', String(!marks.every(Boolean)));
      const note = $(`note-${index}`);
      note.textContent = marks.every(Boolean) ? 'Correct.' : 'See the marking points and full model answer below.';
      note.classList.toggle('error', !marks.every(Boolean));
    });
    $('next').focus({ preventScroll: true });
  }

  function applyRestoredState() {
    $('written').querySelectorAll('textarea').forEach((input, index) => {
      input.value = attempt.answers[index] || '';
    });
    if (attempt.hinted) {
      $('hintText').textContent = question.hint || 'Review the key idea in the question.';
      $('hintText').hidden = false;
    }
    if (attempt.completedAt && Array.isArray(attempt.marks)) {
      const independent = !attempt.hinted && !attempt.revealed && !reviewMode;
      renderFeedback();
      const marks = pointResults();
      void reportAssessment(C.score(marks), independent);
    }
  }

  function renderQuestion() {
    $('prompt').textContent = question.prompt;
    $('prompt').dataset.question = question.id;
    $('questionId').textContent = question.id;
    $('strand').textContent = question.strand || D.title;
    $('format').textContent = `${question.points.length} ${question.points.length === 1 ? 'mark' : 'marks'} · Level 1`;
    $('written').innerHTML = question.fields.map((field, index) => `
      <div class="answer-field">
        <label for="answer-${index}">${escapeHTML(field.label)}</label>
        <textarea id="answer-${index}" class="answer-input" rows="4" autocomplete="off" spellcheck="false" maxlength="1200" aria-describedby="note-${index}"></textarea>
        <p id="note-${index}" class="field-note"></p>
      </div>`).join('');
    $('feedback').replaceChildren();
    $('feedback').hidden = true;
    $('error').textContent = '';
    $('next').hidden = true;
    $('check').disabled = false;
    $('hint').disabled = false;
    $('giveUp').hidden = true;
    $('hintText').hidden = true;
    $('saveStatus').textContent = reviewMode ? 'Teacher/review view · no progress or timing is recorded.' :
      (storageOK ? 'Your attempt is saved in this browser.' : 'Browser storage is unavailable; this attempt lasts only for this visit.');
    if (!reviewMode) {
      // Short Level 1 recall uses the reviewed 60-second idle allowance.
      const activeAttemptId = attempt.attemptId;
      attempt.timing = ActiveQuestionTime.start({
        id: attempt.attemptId,
        idleLimitMs: 60000,
        saved: attempt.timing,
        completed: Boolean(attempt.completedAt),
        onCheckpoint: timing => {
          if (attempt?.attemptId !== activeAttemptId) return;
          attempt.timing = timing;
          save();
        }
      }) || attempt.timing;
    } else ActiveQuestionTime.stop();

    applyRestoredState();
    save();
    if (!attempt.completedAt) $('answer-0').focus({ preventScroll: true });
  }

  function begin(item, saved = null) {
    if (!item) return false;
    ActiveQuestionTime.stop();
    question = item;
    attempt = saved ? restoredAttempt(saved, item) : {
      attemptId: testing ? bridge.attemptId : makeAttemptId(),
      answers: item.fields.map(() => ''),
      marks: null,
      hinted: false,
      revealed: false,
      completedAt: null,
      timing: null
    };
    resultSent = false;
    renderQuestion();
    return true;
  }

  function nextStandalone() {
    const items = pool();
    const previousId = question?.id;
    const seed = `${attempt?.attemptId || ''}:${Date.now()}:${previousId || ''}`;
    begin(chooseQuestion(items, previousId, seed));
  }

  async function assess(showAnswer) {
    if (!question || attempt.completedAt) return;
    attempt.answers = currentAnswers();
    const checked = C.mark(question, attempt.answers, D);
    if (!showAnswer && !checked.ready) {
      checked.states.forEach((state, index) => {
        const note = $(`note-${index}`);
        const input = $(`answer-${index}`);
        if (state === 'empty' || state === 'unknown') {
          input.setAttribute('aria-invalid', 'true');
          note.classList.add('error');
          note.textContent = state === 'empty'
            ? 'Type your answer, or choose “Show answer”.'
            : 'Type your full answer, or choose “Show answer”.';
        } else {
          input.removeAttribute('aria-invalid');
          note.classList.remove('error');
          note.textContent = '';
        }
      });
      $('error').textContent = 'Type your answer before checking. No mark has been recorded yet.';
      $('giveUp').hidden = false;
      save();
      return;
    }

    attempt.marks = checked.marks;
    attempt.completedAt = Date.now();
    if (showAnswer) {
      attempt.hinted = true;
      attempt.revealed = true;
    }
    attempt.timing = ActiveQuestionTime.finish() ? ActiveQuestionTime.snapshot() : attempt.timing;
    $('error').textContent = '';
    renderFeedback();
    save();
    const marks = pointResults();
    const score = C.score(marks);
    const independent = !attempt.hinted && !attempt.revealed && !reviewMode;
    await reportAssessment(score, independent);
    save();
  }

  $('check').addEventListener('click', () => { void assess(false); });
  $('written').addEventListener('input', () => {
    if (!attempt || attempt.completedAt) return;
    attempt.answers = currentAnswers();
    if (!reviewMode) attempt.timing = ActiveQuestionTime.snapshot() || attempt.timing;
    save();
  });
  $('written').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target.matches('textarea')) {
      event.preventDefault();
      void assess(false);
    }
  });
  $('giveUp').addEventListener('click', () => { void assess(true); });
  $('hint').addEventListener('click', () => {
    if (!attempt || attempt.completedAt) return;
    attempt.hinted = true;
    $('hintText').textContent = question.hint || 'Think about the key terms used in the definition.';
    $('hintText').hidden = false;
    save();
  });
  $('next').addEventListener('click', () => {
    if (testing) { try { void bridge.next(); } catch (_) {} }
    else nextStandalone();
  });
  window.addEventListener('pagehide', () => {
    if (!reviewMode && attempt && !attempt.completedAt) attempt.timing = ActiveQuestionTime.pause() || attempt.timing;
    save();
  });

  if (!D || !C || !Array.isArray(D.questions)) {
    $('unavailable').textContent = 'The question bank could not be loaded.';
    $('unavailable').hidden = false;
    $('workspace')?.setAttribute('hidden', '');
    return;
  }

  const items = pool();
  if (testing && Number(bridge.level) !== 1) {
    $('unavailable').textContent = `This activity supports Level 1 only. The revision session requested Level ${bridge.level}.`;
    $('unavailable').hidden = false;
    $('workspace')?.setAttribute('hidden', '');
    return;
  }
  if (!items.length) {
    $('unavailable').textContent = testing
      ? `No Level 1 questions are available for ${bridge.leafId}.`
      : 'No Level 1 questions are available for this selection.';
    $('unavailable').hidden = false;
    $('workspace')?.setAttribute('hidden', '');
    return;
  }

  let restored = null;
  let initialQuestion = null;
  if (testing && validSnapshot(bridge.state, items) && bridge.state.attemptId === bridge.attemptId) {
    restored = bridge.state;
    initialQuestion = D.questions.find(item => item.id === restored.questionId);
  } else if (!testing && !reviewMode) {
    restored = readPractice();
    initialQuestion = restored && D.questions.find(item => item.id === restored.questionId);
  }
  if (!initialQuestion) {
    const previousId = testing && bridge.previous?.leafId === bridge.leafId && Number(bridge.previous?.level) === Number(bridge.level)
      ? bridge.previous.questionId : null;
    const fixed = !testing && pinnedQuestionId ? items.find(item => item.id === pinnedQuestionId) : null;
    initialQuestion = fixed || chooseQuestion(items, previousId, `${bridge?.sessionId || 'practice'}:${bridge?.attemptId || pinnedQuestionId || Date.now()}:${bridge?.leafId || requestedLeaf || 'all'}`);
    restored = null;
  }
  begin(initialQuestion, restored);

  // A review link may use ?review=EBxx; it is always a view-only attempt.
  if (requestedReview && !reviewQuestion && requestedReview.startsWith('EB')) {
    $('saveStatus').textContent = `Review question ${escapeHTML(requestedReview)} was not found; showing the first available question.`;
  }
})();
