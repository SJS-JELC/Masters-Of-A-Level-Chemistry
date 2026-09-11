(function () {
  "use strict";
  const model = window.AcidBaseLevels;
  const core = window.AcidBaseCore;
  const params = new URLSearchParams(location.search);
  const leafId = params.get("leaf");
  const practice = params.get("practice");
  const requestedLevel = Number(params.get("level"));
  const requestedReview = params.get("review");
  const scope = model.scopeFor(leafId);
  const STORAGE_KEY = "alevel-acid-levels-session-v1";
  const elements = Object.fromEntries(["scopeScreen","scopeGrid","choiceScreen","choiceTitle","practiceChoices","practiceScreen","routeLabel","scopeTitle","changeRoute","masteryBar","storageWarning","questionPanel","workedAnswer","workedContent"].map((id) => [id, document.getElementById(id)]));
  let memorySession = null;
  let session = null;
  let question = null;

  function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[character])); }
  function notation(value) { return escapeHtml(value).replace(/pK_a/g, "pK<sub>a</sub>").replace(/K_a/g, "K<sub>a</sub>").replace(/K_w/g, "K<sub>w</sub>").replace(/M_r/g, "M<sub>r</sub>").replace(/\^\(([^)]+)\)/g, "<sup>$1</sup>").replace(/10\^(-?\d+)/g, "10<sup>$1</sup>").replace(/Kₐ/g, "K<sub>a</sub>").replace(/Kₓ/g, "K<sub>w</sub>").replace(/pKₐ/g, "pK<sub>a</sub>").replace(/Mᵣ/g, "M<sub>r</sub>"); }
  function randomSeed() { const values = new Uint32Array(1); return window.crypto?.getRandomValues ? window.crypto.getRandomValues(values)[0] : (Date.now() >>> 0); }
  function api() {
    if (window.ALevelMastery) return window.ALevelMastery;
    return { nextLevel: () => 1, attemptId: () => `acid-${Date.now()}-${randomSeed().toString(36)}`, record: () => false,
      summary: () => ({ score:null, mastered:false, count:0 }), achievement: () => ({ level:null, states:[] }),
      renderChoices: null, bar: null };
  }
  function routeKey() { return `${leafId}:${practice}:${practice === "level" ? requestedLevel : "auto"}`; }
  function showStorageWarning(message) { elements.storageWarning.textContent = message; elements.storageWarning.hidden = false; }
  function save() {
    memorySession = session;
    if (session?.reviewing) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
    catch (_) { showStorageWarning("Progress is being kept for this open page, but this browser blocked local storage."); }
  }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return validSession(parsed) ? parsed : null;
    } catch (_) {
      showStorageWarning("Saved practice could not be read. You can continue in this open page.");
      return memorySession && memorySession.routeKey === routeKey() ? memorySession : null;
    }
  }
  function validSession(value) {
    if (!value || value.schema !== 1 || value.routeKey !== routeKey() || value.leafId !== leafId || value.practice !== practice || typeof value.cycles !== "object" || Array.isArray(value.cycles)) return false;
    if (practice === "level" ? value.fixedLevel !== requestedLevel : value.fixedLevel !== null) return false;
    for (const [key, ids] of Object.entries(value.cycles)) {
      const match = key.match(new RegExp(`^${leafId}:(1|2|3)$`));
      if (!match || !Array.isArray(ids) || ids.some((id) => !model.templatesFor(leafId, Number(match[1])).includes(id))) return false;
    }
    if (value.current === null) return true;
    const current = value.current;
    if (!current || typeof current.id !== "string" || !current.id || ![1,2,3].includes(current.level) || !model.templatesFor(leafId, current.level).includes(current.templateId) || !Number.isInteger(current.seed) || current.seed < 0 || !Array.isArray(current.responses) || typeof current.working !== "string" || typeof current.submitted !== "boolean" || typeof current.recorded !== "boolean") return false;
    if (practice === "level" && current.level !== requestedLevel) return false;
    if (!current.scaffold || current.scaffold.level !== current.level || !["formula","route","open"].includes(current.scaffold.mode)) return false;
    if (current.submitted ? ![0,0.5,1].includes(current.score) : current.score !== null) return false;
    try { const restored = model.generate(current.templateId, current.level, current.seed); return current.responses.length <= restored.responses.length && current.responses.every((item) => typeof item === "string"); }
    catch (_) { return false; }
  }
  function makeSession() { return { schema:1, routeKey:routeKey(), leafId, practice, fixedLevel:practice === "level" ? requestedLevel : null, cycles:{}, current:null }; }
  function cycleKey(level) { return `${leafId}:${level}`; }
  function freshQuestion() {
    const level = model.nextLevel(session.practice, session.fixedLevel, api(), leafId);
    if (level == null) { renderComplete(); return; }
    const key = cycleKey(level), selected = model.chooseTemplate(leafId, level, session.cycles[key], Math.random());
    session.cycles[key] = selected.used;
    const seed = randomSeed();
    session.current = { id:api().attemptId(), level, templateId:selected.templateId, seed, responses:[], working:"", scaffold:{ level, mode:level === 1 ? "formula" : level === 2 ? "route" : "open" }, submitted:false, recorded:false, score:null };
    save();
    renderCurrent();
  }
  function renderProgress() {
    const level = session.current?.level || (session.fixedLevel || api().nextLevel(leafId));
    elements.masteryBar.replaceChildren();
    if (level == null) {
      if (api().bar) for (const completedLevel of [1,2,3]) elements.masteryBar.append(api().bar(api().summary(leafId, completedLevel).score, model.LEVEL_LABELS[completedLevel], completedLevel));
      else elements.masteryBar.innerHTML = '<div class="fallback-bar">All levels complete</div>';
      return;
    }
    if (api().bar) elements.masteryBar.append(api().bar(api().summary(leafId, level).score, model.LEVEL_LABELS[level], level));
    else elements.masteryBar.innerHTML = `<div class="fallback-bar">${escapeHtml(model.LEVEL_LABELS[level] || "Complete")}</div>`;
  }
  function autoScaffold() {
    const level = session.current.level;
    if (level === 1) return `<aside class="auto-scaffold"><strong>Equation support</strong><p>Select the relationship shown by the data, substitute once, and keep full calculator precision until the final answer.</p></aside>`;
    if (level === 2) return `<aside class="auto-scaffold"><strong>Linked route</strong><ol><li>Convert the supplied data into amounts or concentrations.</li><li>Apply the acid–base relationship.</li><li>Round only the requested final values.</li></ol></aside>`;
    return `<aside class="auto-scaffold"><strong>Unstructured calculation</strong><p>Plan the stages yourself. The working box is optional and is never scored.</p></aside>`;
  }
  function responseMarkup(response, index) {
    const scaffold = session.current.level < 3 ? calculationScaffold(index) : "";
    return `<div class="response-row" data-response="${index}"><label for="response-${index}"><span class="part-label">${String.fromCharCode(97 + index)}</span><span class="response-prompt">${notation(response.prompt)}</span></label>${scaffold}<div class="answer-line"><span>${notation(response.symbol)} =</span><input class="response-input" id="response-${index}" inputmode="decimal" autocomplete="off" value="${escapeHtml(session.current.responses[index] || "")}"><span>${notation(response.unit || "")}</span></div><p class="response-feedback"></p></div>`;
  }
  function maskedWorking(line) {
    const source = String(line), tokens = (window.AcidBaseScaffold?.numericTokens(source) || []).filter(token => !(token.raw === "10" && source.slice(token.index + 2).startsWith("^("))).slice().reverse();
    return tokens.reduce((text, token) => text.slice(0, token.index) + "□" + text.slice(token.index + token.raw.length), source);
  }
  function calculationScaffold(index) {
    const lines = question.answerParts[index] || question.working;
    return `<div class="calculation-scaffold"><strong>Working frame</strong>${lines.map((line) => `<p>${notation(maskedWorking(line))}</p>`).join("")}</div>`;
  }
  function renderCurrent() {
    question = session.reviewing ? model.generateFromReview(session.current.reviewId) : model.generate(session.current.templateId, session.current.level, session.current.seed);
    renderProgress();
    const rows = question.rows.length ? `<table class="data-table"><tbody>${question.rows.map((row) => `<tr><th>${notation(row.label)}</th><td>${notation(row.value)}</td></tr>`).join("")}</tbody></table>` : "";
    elements.questionPanel.innerHTML = `<header class="question-header"><div><p class="question-meta">${escapeHtml(model.LEVEL_LABELS[session.current.level])}</p><h3>${notation(question.templateLabel)}</h3></div><span class="review-id">Review ID // ${escapeHtml(question.reviewId)}</span></header><p>${notation(question.intro)}</p>${rows}${autoScaffold()}<label class="working-label" for="working">Optional working</label><textarea id="working" rows="${session.current.level === 3 ? 7 : 4}" spellcheck="false">${escapeHtml(session.current.working || "")}</textarea><p class="rounding-note">Give pH and pK<sub>a</sub> to 2 decimal places. Give other numerical answers to 3 significant figures unless exact.</p><div class="response-list">${question.responses.map(responseMarkup).join("")}</div><div class="action-row"><button class="primary" id="checkAnswers" type="button">${session.current.submitted ? "Check again" : "Check answers"}</button><p id="checkSummary" role="status"></p><button class="primary next-button" id="nextQuestion" type="button" ${session.current.submitted ? "" : "hidden"}>Next</button></div>`;
    document.getElementById("working").addEventListener("input", (event) => { session.current.working = event.target.value; save(); });
    question.responses.forEach((_, index) => document.getElementById(`response-${index}`).addEventListener("input", (event) => { session.current.responses[index] = event.target.value; clearFeedback(); save(); }));
    document.getElementById("checkAnswers").addEventListener("click", checkAnswers);
    document.getElementById("nextQuestion").addEventListener("click", freshQuestion);
    elements.workedAnswer.hidden = !session.current.submitted;
    if (session.current.submitted) restoreFeedback();
  }
  function clearFeedback() {
    elements.questionPanel.querySelectorAll(".response-row").forEach((row) => { row.classList.remove("correct", "incorrect"); row.querySelector(".response-feedback").textContent = ""; });
    document.getElementById("checkSummary").textContent = "";
  }
  function mark(results) {
    results.forEach((result, index) => { const row = elements.questionPanel.querySelector(`[data-response="${index}"]`); row.classList.add(result.status); row.querySelector(".response-feedback").textContent = result.status === "correct" ? "Correct." : "Check this value."; });
  }
  function renderWorked() { elements.workedContent.innerHTML = question.working.map((line) => `<p>${notation(line)}</p>`).join(""); elements.workedAnswer.hidden = false; }
  function checkAnswers() {
    const values = question.responses.map((_, index) => document.getElementById(`response-${index}`).value);
    const outcome = model.score(values, question.responses);
    if (!outcome.accepted) { document.getElementById("checkSummary").textContent = outcome.reason; return; }
    clearFeedback(); mark(outcome.results); renderWorked();
    if (!session.current.submitted) {
      session.current.submitted = true; session.current.score = outcome.score; session.current.responses = values;
      if (!session.reviewing) {
        const saved = api().record({ id:session.current.id, leafId, level:session.current.level, score:outcome.score, completedAt:Date.now() });
        session.current.recorded = saved;
        if (!saved) showStorageWarning("This result is retained for this open page, but the browser could not save it permanently.");
      }
    } else if (!session.reviewing && !session.current.recorded) {
      session.current.recorded = api().record({ id:session.current.id, leafId, level:session.current.level, score:session.current.score, completedAt:Date.now() });
    }
    document.getElementById("checkSummary").textContent = outcome.score === 1 ? "All required values are correct." : outcome.score === 0.5 ? "Some required values are correct." : "None of the required values is correct yet.";
    document.getElementById("checkAnswers").textContent = "Check again";
    document.getElementById("nextQuestion").hidden = Boolean(session.reviewing);
    renderProgress(); save();
  }
  function restoreFeedback() {
    const outcome = model.score(session.current.responses, question.responses);
    if (outcome.accepted) { mark(outcome.results); renderWorked(); document.getElementById("checkSummary").textContent = outcome.score === 1 ? "All required values are correct." : outcome.score === 0.5 ? "Some required values are correct." : "None of the required values is correct yet."; }
  }
  function renderComplete() {
    session.current = null; save(); renderProgress();
    elements.questionPanel.innerHTML = `<div class="complete-card"><p class="kicker">MASTERY COMPLETE</p><h3>All three levels are currently mastered</h3><p>Further completed questions will update the saved evidence for this subtopic.</p></div>`;
    elements.workedAnswer.hidden = true;
  }
  function renderReadOnlyReview(reviewed) {
    elements.scopeScreen.hidden = true; elements.practiceScreen.hidden = false; elements.masteryBar.hidden = true;
    elements.routeLabel.textContent = "QUESTION REVIEW"; elements.scopeTitle.textContent = reviewed.familyLabel || "Acid–base calculation";
    elements.changeRoute.href = "index.html"; elements.changeRoute.textContent = "Choose practice";
    const rows = reviewed.rows.length ? `<table class="data-table"><tbody>${reviewed.rows.map((row) => `<tr><th>${notation(row.label)}</th><td>${notation(row.value)}</td></tr>`).join("")}</tbody></table>` : "";
    const targets = reviewed.responses.map((response, index) => `<div class="response-row"><p><span class="part-label">${String.fromCharCode(97 + index)}</span> ${notation(response.prompt)}</p><div class="review-answer-line">${notation(response.symbol)} = ____________________ ${notation(response.unit || "")}</div></div>`).join("");
    elements.questionPanel.innerHTML = `<header class="question-header"><div><p class="question-meta">READ-ONLY REVIEW</p><h3>${notation(reviewed.templateLabel)}</h3></div><span class="review-id">Review ID // ${escapeHtml(reviewed.reviewId)}</span></header><p>${notation(reviewed.intro)}</p>${rows}<div class="response-list">${targets}</div>`;
    elements.workedContent.innerHTML = reviewed.working.map((line) => `<p>${notation(line)}</p>`).join("");
    elements.workedAnswer.hidden = false;
  }
  function renderScopes() {
    elements.scopeGrid.innerHTML = model.scopes.map((item) => `<a class="scope-card" href="?leaf=${item.id}"><span>${escapeHtml(item.label)}</span><small>Choose mastery or a fixed level</small></a>`).join("");
  }
  function fallbackChoices() {
    const base = `?leaf=${leafId}`;
    elements.practiceChoices.innerHTML = `<a class="practice-choice" href="${base}&practice=mastery"><strong>MASTERY</strong><span>Continue at the level your evidence needs.</span></a>${[1,2,3].map((level) => `<a class="practice-choice" href="${base}&practice=level&level=${level}"><strong>${escapeHtml(model.LEVEL_LABELS[level])}</strong><span>Keep practising this level.</span></a>`).join("")}`;
  }
  function initialise() {
    if (requestedReview && !scope) {
      try { renderReadOnlyReview(model.generateFromReview(requestedReview)); }
      catch (error) { elements.scopeScreen.innerHTML = `<h2>Review question unavailable</h2><p>${escapeHtml(error.message)}</p><p><a href="index.html">Choose practice</a></p>`; }
      return;
    }
    if (!scope) { renderScopes(); return; }
    elements.scopeScreen.hidden = true;
    if (!practice) {
      elements.choiceScreen.hidden = false; elements.choiceTitle.textContent = scope.label;
      if (api().renderChoices) {
        api().renderChoices(elements.practiceChoices, { leafId, href:"index.html" });
        [1,2,3].forEach((level) => { const label = elements.practiceChoices.querySelector(`[data-practice="${level}"] strong`); if (label) label.textContent = model.LEVEL_LABELS[level]; });
      } else fallbackChoices();
      return;
    }
    if (!((practice === "mastery") || (practice === "level" && [1,2,3].includes(requestedLevel)))) { location.replace(`?leaf=${encodeURIComponent(leafId)}`); return; }
    elements.practiceScreen.hidden = false; elements.scopeTitle.textContent = scope.label; elements.changeRoute.href = `?leaf=${leafId}`;
    elements.routeLabel.textContent = practice === "mastery" ? "MASTERY" : model.LEVEL_LABELS[requestedLevel].toUpperCase();
    if (requestedReview) {
      try {
        const reviewed = model.generateFromReview(requestedReview);
        if (!model.templatesFor(leafId, reviewed.level).includes(reviewed.templateId)) throw new Error("This review question does not belong to the selected subtopic and level.");
        session = makeSession(); session.reviewing = true;
        session.current = { id:`review:${reviewed.reviewId}`, level:reviewed.level, templateId:reviewed.templateId, seed:reviewed.seed, reviewId:reviewed.reviewId, responses:[], working:"", scaffold:{level:reviewed.level,mode:reviewed.level===1?"formula":reviewed.level===2?"route":"open"}, submitted:false, recorded:false, score:null };
      } catch (error) { elements.practiceScreen.innerHTML = `<article class="panel question-panel"><h2>Review question unavailable</h2><p>${escapeHtml(error.message)}</p></article>`; return; }
    } else session = load() || makeSession();
    if (session.current) renderCurrent(); else freshQuestion();
  }
  initialise();
})();
