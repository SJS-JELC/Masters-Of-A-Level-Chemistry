(async function () {
  "use strict";
  const model = window.AcidBaseLevels;
  const params = new URLSearchParams(location.search);
  const retiredLeaf = params.get("leaf") === "u6-t1-1-4";
  const leafId = retiredLeaf ? "u6-t1-1-5" : params.get("leaf");
  const practice = params.get("practice");
  const requestedLevel = Number(params.get("level"));
  const requestedReview = params.get("review");
  const scope = model.scopeFor(leafId);
  const STORAGE_KEY = "alevel-acid-levels-session-v2";
  const elements = Object.fromEntries(["scopeScreen", "scopeGrid", "choiceScreen", "choiceTitle", "practiceChoices", "practiceScreen", "routeLabel", "scopeTitle", "changeRoute", "masteryBar", "storageWarning", "questionPanel", "workedAnswer", "workedContent"].map(id => [id, document.getElementById(id)]));
  const testBridge = await window.TestModeBridge?.connect() || null;
  let memorySession = null, session = null, question = null;

  function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character])); }
  function notation(value) {
    return escapeHtml(value).replace(/pK_a|pKₐ|\bpKa\b/g, "pK<sub>a</sub>").replace(/K_a|Kₐ|\bKa\b/g, "K<sub>a</sub>").replace(/K_w|Kₓ|\bKw\b/g, "K<sub>w</sub>").replace(/M_r|Mᵣ/g, "M<sub>r</sub>").replace(/\^\(([^)]+)\)/g, "<sup>$1</sup>").replace(/\^([−-]?pH|[−-]?\d+)/g, "<sup>$1</sup>");
  }
  function randomSeed() {
    const values = new Uint32Array(1);
    return window.crypto?.getRandomValues ? window.crypto.getRandomValues(values)[0] : Date.now() >>> 0;
  }
  function api() {
    return window.ALevelMastery || {
      nextLevel: () => 1, attemptId: () => `acid-${Date.now()}-${randomSeed().toString(36)}`, record: () => false,
      summary: () => ({ score: null, mastered: false, count: 0 }), renderChoices: null, bar: null
    };
  }
  function availableLevels() { return Object.keys(scope.levels).map(Number); }
  function routeKey() { return `${leafId}:${practice}:${practice === "level" ? requestedLevel : "auto"}`; }
  function showStorageWarning(message) { elements.storageWarning.textContent = message; elements.storageWarning.hidden = false; }
  function save() {
    if (testBridge) { void testSave().catch(() => {}); return; }
    if (session?.reviewing) return;
    memorySession = session;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
    catch (_) { showStorageWarning("Progress is being kept for this open page, but this browser blocked local storage."); }
  }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return validSession(parsed) ? parsed : null;
    } catch (_) {
      showStorageWarning("Saved practice could not be read. You can continue in this open page.");
      return validSession(memorySession) ? memorySession : null;
    }
  }
  function validSession(value) {
    if (!value || value.schema !== 2 || value.routeKey !== routeKey() || value.leafId !== leafId || value.practice !== practice || !value.cycles || typeof value.cycles !== "object" || Array.isArray(value.cycles)) return false;
    if (value.fixedLevel !== (practice === "level" ? requestedLevel : null)) return false;
    for (const [key, ids] of Object.entries(value.cycles)) {
      const level = Number(key.slice(leafId.length + 1));
      if (key !== `${leafId}:${level}` || !availableLevels().includes(level) || !Array.isArray(ids) || ids.some(id => !model.templatesFor(leafId, level).includes(id))) return false;
    }
    if (value.current === null) return true;
    const current = value.current;
    if (!current || typeof current.id !== "string" || !current.id || !availableLevels().includes(current.level) || !model.templatesFor(leafId, current.level).includes(current.templateId) || !Number.isInteger(current.seed) || current.seed < 0 || current.seed > 0xffffffff || !Array.isArray(current.responses) || typeof current.working !== "string" || typeof current.submitted !== "boolean" || typeof current.recorded !== "boolean") return false;
    if (practice === "level" && current.level !== requestedLevel) return false;
    if (current.submitted ? ![0, 0.5, 1].includes(current.score) || !Number.isFinite(current.completedAt) || current.completedAt <= 0 || current.completedAt > Date.now() : current.score !== null || current.completedAt !== null || current.recorded) return false;
    try {
      const restored = model.generate(current.templateId, current.level, current.seed);
      return current.responses.length <= restored.responses.length && current.responses.every(item => typeof item === "string");
    } catch (_) { return false; }
  }
  function makeSession() { return { schema: 2, routeKey: routeKey(), leafId, practice, fixedLevel: practice === "level" ? requestedLevel : null, cycles: {}, current: null }; }
  function makeCurrent(templateId, level, seed) {
    const responses = model.generate(templateId, level, seed).responses.map(() => "");
    return { id: api().attemptId(), level, templateId, seed, responses, working: "", submitted: false, recorded: false, score: null, completedAt: null };
  }
  function freshQuestion() {
    const level = model.nextLevel(session.practice, session.fixedLevel, api(), leafId);
    if (level == null) { renderComplete(); return; }
    const key = `${leafId}:${level}`, selected = model.chooseTemplate(leafId, level, session.cycles[key], Math.random());
    session.cycles[key] = selected.used;
    session.current = makeCurrent(selected.templateId, level, randomSeed());
    save(); renderCurrent();
  }
  function renderProgress() {
    const level = session.current?.level || session.fixedLevel || api().nextLevel(leafId);
    elements.masteryBar.replaceChildren();
    if (api().bar) {
      for (const item of level == null ? availableLevels() : [level]) elements.masteryBar.append(api().bar(api().summary(leafId, item).score, model.LEVEL_LABELS[item], item));
    } else elements.masteryBar.textContent = level == null ? "All levels complete" : model.LEVEL_LABELS[level];
  }
  function responseMarkup(response, index) {
    const part = question.responses.length > 1 ? `<span class="part-label">${String.fromCharCode(97 + index)}</span>` : "";
    return `<div class="response-row${part ? "" : " single-response"}" data-response="${index}"><label for="response-${index}">${part}<span class="response-prompt">${notation(response.prompt)}</span></label><div class="answer-line"><span>${notation(response.symbol)} =</span><input class="response-input" id="response-${index}" inputmode="text" autocomplete="off" spellcheck="false" aria-describedby="response-unit-${index} response-feedback-${index}" value="${escapeHtml(session.current.responses[index] || "")}"><span id="response-unit-${index}">${notation(response.unit || "")}</span></div><p class="response-feedback" id="response-feedback-${index}" aria-live="polite"></p></div>`;
  }
  function dataRows(item) {
    return item.rows.length ? `<table class="data-table"><tbody>${item.rows.map(row => `<tr><th scope="row">${notation(row.label)}</th><td>${notation(row.value)}</td></tr>`).join("")}</tbody></table>` : "";
  }
  function reviewLink(item) {
    if (!session.current.submitted) return `<span class="review-id">${escapeHtml(item.reviewId)}</span>`;
    const url = new URL("index.html", location.href);
    url.searchParams.set("review", item.reviewId);
    return `<a class="review-id" href="${escapeHtml(url.href)}" target="_blank" rel="noopener" aria-label="Review question ${escapeHtml(item.reviewId)} in a new tab">${escapeHtml(item.reviewId)}</a>`;
  }
  function renderCurrent() {
    question = session.reviewing ? model.generateFromReview(session.current.reviewId) : model.generate(session.current.templateId, session.current.level, session.current.seed);
    if (!session.reviewing) renderProgress();
    elements.questionPanel.innerHTML = `<header class="question-header"><div><p class="question-meta">${escapeHtml(model.LEVEL_LABELS[session.current.level])}</p><h3>${notation(question.templateLabel)}</h3></div>${reviewLink(question)}</header><p>${notation(question.intro)}</p>${dataRows(question)}<p class="rounding-note">Give pH and pK<sub>a</sub> to 2 decimal places. Give other numerical answers to 3 significant figures unless exact. You can enter standard form as 1.23e-4.</p><div class="response-list">${question.responses.map(responseMarkup).join("")}</div><div class="action-row"><button class="primary" id="checkAnswers" type="button">${session.current.submitted ? "Check again" : "Check answers"}</button><p id="checkSummary" role="status"></p><button class="primary next-button" id="nextQuestion" type="button" ${!session.current.submitted || session.reviewing ? "hidden" : ""}>Next</button></div>`;
    question.responses.forEach((_, index) => document.getElementById(`response-${index}`).addEventListener("input", event => { session.current.responses[index] = event.target.value; clearFeedback(); save(); }));
    document.getElementById("checkAnswers").addEventListener("click", checkAnswers);
    document.getElementById("nextQuestion").addEventListener("click", () => testBridge ? testNext() : freshQuestion());
    elements.workedAnswer.hidden = !session.current.submitted;
    elements.workedAnswer.open = false;
    elements.workedContent.replaceChildren();
    if (session.current.submitted) restoreFeedback();
  }
  function clearFeedback() {
    elements.questionPanel.querySelectorAll(".response-row").forEach(row => { row.classList.remove("correct", "incorrect"); row.querySelector(".response-feedback").textContent = ""; });
    document.getElementById("checkSummary").textContent = "";
  }
  function mark(results) {
    results.forEach((result, index) => {
      const row = elements.questionPanel.querySelector(`[data-response="${index}"]`);
      row.classList.add(result.status);
      row.querySelector(".response-feedback").textContent = result.status === "correct" ? "Correct." : "Check this value.";
    });
  }
  function renderWorked() { elements.workedContent.innerHTML = question.working.map(line => `<p>${notation(line)}</p>`).join(""); elements.workedAnswer.hidden = false; }
  function resultMessage(score) { return score === 1 ? "All required values are correct." : score === 0.5 ? "Some required values are correct." : "None of the required values is correct yet."; }
  function recordFirstAttempt() {
    const current = session.current;
    if (session.reviewing || current.recorded) return;
    current.recorded = api().record({ id: current.id, leafId, level: current.level, score: current.score, completedAt: current.completedAt });
    if (!current.recorded) showStorageWarning("This result is retained for this open page, but the browser could not save it permanently.");
  }
  function checkAnswers() {
    const values = question.responses.map((_, index) => document.getElementById(`response-${index}`).value);
    const outcome = model.score(values, question.responses);
    if (!outcome.accepted) { document.getElementById("checkSummary").textContent = outcome.reason; return; }
    clearFeedback(); mark(outcome.results); renderWorked();
    if (!session.current.submitted) {
      session.current.submitted = true; session.current.score = outcome.score; session.current.completedAt = Date.now();
      if (testBridge) { session.current.firstResponses = values.slice(); session.current.firstResults = structuredClone(outcome.results); }
    }
    session.current.responses = values;
    if (testBridge) {
      document.getElementById("checkSummary").textContent = resultMessage(outcome.score);
      document.getElementById("checkAnswers").textContent = "Check again";
      document.getElementById("nextQuestion").hidden = false;
      save();
      testReport(outcome);
      return;
    }
    recordFirstAttempt();
    elements.questionPanel.querySelector(".review-id").outerHTML = reviewLink(question);
    document.getElementById("checkSummary").textContent = resultMessage(outcome.score);
    document.getElementById("checkAnswers").textContent = "Check again";
    document.getElementById("nextQuestion").hidden = Boolean(session.reviewing);
    if (!session.reviewing) renderProgress();
    save();
  }
  function restoreFeedback() {
    const outcome = model.score(session.current.responses, question.responses);
    if (outcome.accepted) { mark(outcome.results); renderWorked(); document.getElementById("checkSummary").textContent = resultMessage(outcome.score); }
  }
  function renderComplete() {
    session.current = null; save(); renderProgress();
    elements.questionPanel.innerHTML = '<div class="complete-card"><p class="kicker">MASTERY COMPLETE</p><h3>All levels are currently mastered</h3><p>Choose a fixed level to continue practising this topic.</p></div>';
    elements.workedAnswer.hidden = true;
  }
  function renderReadOnlyReview(reviewed) {
    elements.scopeScreen.hidden = true; elements.practiceScreen.hidden = false; elements.masteryBar.hidden = true;
    elements.routeLabel.textContent = "QUESTION REVIEW"; elements.scopeTitle.textContent = reviewed.familyLabel || "Acid–base calculation";
    elements.changeRoute.href = "index.html"; elements.changeRoute.textContent = "Choose practice";
    const targets = reviewed.responses.map((response, index) => `<div class="response-row"><p>${reviewed.responses.length > 1 ? `<span class="part-label">${String.fromCharCode(97 + index)}</span> ` : ""}${notation(response.prompt)}</p><div class="review-answer-line">${notation(response.symbol)} = ____________________ ${notation(response.unit || "")}</div></div>`).join("");
    elements.questionPanel.innerHTML = `<header class="question-header"><div><p class="question-meta">READ-ONLY REVIEW</p><h3>${notation(reviewed.templateLabel)}</h3></div><span class="review-id">${escapeHtml(reviewed.reviewId)}</span></header><p>${notation(reviewed.intro)}</p>${dataRows(reviewed)}<div class="response-list">${targets}</div>`;
    elements.workedContent.innerHTML = reviewed.working.map(line => `<p>${notation(line)}</p>`).join("");
    elements.workedAnswer.hidden = false;
  }
  function fallbackChoices() {
    const base = `?leaf=${leafId}`;
    elements.practiceChoices.innerHTML = `<a class="practice-choice" href="${base}&practice=mastery"><strong>MASTERY</strong><span>Continue at the level your evidence needs.</span></a>${availableLevels().map(level => `<a class="practice-choice" href="${base}&practice=level&level=${level}"><strong>${escapeHtml(model.LEVEL_LABELS[level])}</strong><span>Keep practising this level.</span></a>`).join("")}`;
  }
  function testHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) || 1;
  }
  function testPrevious(previous) {
    if (!previous || typeof previous !== "object") return null;
    return previous.question || previous.current || previous;
  }
  function testSnapshot() {
    if (!testBridge || !session?.current) return null;
    return {
      version: "acid-base-calculations-test-v1", leafId, level: session.current.level,
      templateId: session.current.templateId, seed: session.current.seed,
      usedTemplates: session.testUsedTemplates || [session.current.templateId],
      responses: structuredClone(session.current.responses), working: session.current.working,
      firstResponses: session.current.firstResponses ? structuredClone(session.current.firstResponses) : null,
      firstResults: session.current.firstResults ? structuredClone(session.current.firstResults) : null,
      submitted: Boolean(session.current.submitted), score: session.current.score,
      completedAt: session.current.completedAt, independent: session.testIndependent !== false
    };
  }
  async function testSave() {
    const snapshot = testSnapshot();
    if (!snapshot) return;
    try { await testBridge.save(snapshot); } catch (_) { /* the parent owns persistence errors */ }
  }
  function testValidState(state) {
    if (!state || state.version !== "acid-base-calculations-test-v1" || state.leafId !== leafId || Number(state.level) !== requestedLevel || typeof state.templateId !== "string" || !model.templatesFor(leafId, requestedLevel).includes(state.templateId) || !Number.isSafeInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff || !Array.isArray(state.responses) || state.responses.some(item => typeof item !== "string") || typeof state.working !== "string" || typeof state.submitted !== "boolean") return false;
    if (state.submitted && (![0, 0.5, 1].includes(state.score) || !Number.isFinite(state.completedAt) || state.completedAt <= 0 || !Array.isArray(state.firstResponses) || state.firstResponses.length !== state.responses.length || state.firstResponses.some(item => typeof item !== "string"))) return false;
    if (!state.submitted && (state.score !== null || state.completedAt !== null)) return false;
    const generated = model.generate(state.templateId, requestedLevel, state.seed);
    if (state.responses.length !== generated.responses.length) return false;
    return !state.submitted || model.score(state.firstResponses, generated.responses).score === state.score;
  }
  function testMakeSession() {
    const state = testValidState(testBridge.state) ? testBridge.state : null;
    const previous = testPrevious(testBridge.previous);
    const seed = state ? state.seed : testHash(`${testBridge.sessionId || ""}:${testBridge.attemptId || ""}:${leafId}:${requestedLevel}`);
    const priorIds = previous?.usedTemplates || (previous?.templateId ? [previous.templateId] : []);
    const selected = state ? { templateId: state.templateId, used: state.usedTemplates || [state.templateId] } : model.chooseTemplate(leafId, requestedLevel, priorIds, (seed % 1000003) / 1000003);
    const generated = model.generate(selected.templateId, requestedLevel, seed);
    const responses = state ? state.responses.slice(0, generated.responses.length).concat(Array(Math.max(0, generated.responses.length - state.responses.length)).fill("")) : generated.responses.map(() => "");
    session = makeSession();
    session.testUsedTemplates = selected.used;
    session.testIndependent = state?.independent !== false;
    session.testReported = false;
    session.current = { id: String(testBridge.attemptId || `acid-test-${seed}`), level: requestedLevel, templateId: selected.templateId, seed, responses, firstResponses: state?.firstResponses ? state.firstResponses.slice() : null, firstResults: state?.firstResults ? structuredClone(state.firstResults) : null, working: state?.working || "", submitted: Boolean(state?.submitted), recorded: false, score: state?.score ?? null, completedAt: state?.completedAt ?? null };
  }
  async function testReport(outcome) {
    if (!testBridge || !session?.current?.submitted || session.testReported) return;
    session.testReported = true;
    const current = session.current;
    const completedAt = current.completedAt || Date.now(); current.completedAt = completedAt;
    await testSave();
    const evidence = { score: current.score, results: structuredClone(current.firstResults || outcome.results) };
    try { await testBridge.result({ score: current.score, independent: session.testIndependent !== false, completedAt, evidence }); } catch (_) { session.testReported = false; }
  }
  async function testNext() { try { await testBridge.next(); } catch (_) {} }
  async function initialiseTest() {
    document.body.classList.add("test-mode-embedded");
    document.querySelector(".ocr-home-link")?.setAttribute("hidden", "");
    document.querySelector(".brand")?.setAttribute("hidden", "");
    elements.scopeScreen.hidden = true; elements.choiceScreen.hidden = true; elements.practiceScreen.hidden = false;
    elements.masteryBar.hidden = true; elements.storageWarning.hidden = true; elements.changeRoute.hidden = true;
    elements.routeLabel.textContent = "TEST"; elements.scopeTitle.textContent = scope?.label || "Acid-base calculations";
    if (![1, 2, 3].includes(requestedLevel) || !scope) { elements.questionPanel.innerHTML = "<p>Test question level unavailable.</p>"; return; }
    testMakeSession(); renderCurrent(); await testSave();
    if (session.current.submitted) await testReport(model.score(session.current.firstResponses || session.current.responses, question.responses));
  }
  function initialise() {
    if (testBridge) { initialiseTest(); return; }
    if (retiredLeaf) {
      params.set("leaf", leafId);
      try { history.replaceState(null, "", `${location.pathname}?${params}`); } catch (_) {}
    }
    if (requestedReview) {
      try {
        const reviewed = model.generateFromReview(requestedReview);
        if (reviewed.legacy || !scope || !practice) { renderReadOnlyReview(reviewed); return; }
        if (!model.templatesFor(leafId, reviewed.level).includes(reviewed.templateId) || (practice === "level" && requestedLevel !== reviewed.level)) throw new Error("This review question does not belong to the selected topic and level.");
        session = makeSession(); session.reviewing = true;
        session.current = { ...makeCurrent(reviewed.templateId, reviewed.level, reviewed.seed), reviewId: reviewed.reviewId };
      } catch (error) {
        elements.scopeScreen.innerHTML = `<h2>Review question unavailable</h2><p>${escapeHtml(error.message)}</p><p><a href="index.html">Choose practice</a></p>`; return;
      }
    }
    if (!scope) {
      elements.scopeGrid.innerHTML = model.scopes.map(item => `<a class="scope-card" href="?leaf=${item.id}"><span>${escapeHtml(item.label)}</span><small>Choose mastery or a fixed level</small></a>`).join(""); return;
    }
    elements.scopeScreen.hidden = true;
    if (!practice) {
      elements.choiceScreen.hidden = false; elements.choiceTitle.textContent = scope.label;
      if (api().renderChoices) api().renderChoices(elements.practiceChoices, { leafId, href: "index.html" }); else fallbackChoices();
      return;
    }
    if (!(practice === "mastery" || (practice === "level" && availableLevels().includes(requestedLevel)))) { location.replace(`?leaf=${encodeURIComponent(leafId)}`); return; }
    elements.practiceScreen.hidden = false; elements.scopeTitle.textContent = scope.label; elements.changeRoute.href = `?leaf=${leafId}`;
    elements.routeLabel.textContent = session?.reviewing ? "QUESTION REVIEW" : practice === "mastery" ? "MASTERY" : model.LEVEL_LABELS[requestedLevel].toUpperCase();
    if (session?.reviewing) elements.masteryBar.hidden = true;
    else session = load() || makeSession();
    if (session.current) renderCurrent(); else freshQuestion();
  }
  initialise();
})();
