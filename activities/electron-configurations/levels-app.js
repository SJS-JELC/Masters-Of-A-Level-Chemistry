(function () {
  "use strict";
  const D = globalThis.ElectronData, C = globalThis.ElectronCore, S = globalThis.ElectronLevelSession;
  const M = globalThis.ALevelMastery || {};
  const LEAF = "l6-t2-1-2";
  const params = new URLSearchParams(location.search);
  const requestedPractice = params.get("practice");
  const requestedLevel = Number(params.get("level"));
  const STORE = "sjs-electron-configurations-levels-v1";
  const el = Object.fromEntries(["chooser","practiceChoices","activityScreen","finishScreen","progressSummary","masteryBar","progressGrid","questionPanel","feedback","answerPanel","answerContent","saveStatus","openReference","changePractice","finishTitle","finishContent","finishAction"].map((id) => [id, document.getElementById(id)]));
  let session = null, reviewing = false, reviewBank = null, reviewLoaded = false;
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const charge = (n) => n ? `<sup>${Math.abs(n) === 1 ? "" : Math.abs(n)}${n > 0 ? "+" : "−"}</sup>` : "";
  const symbol = (item) => `${escape(item.symbol)}${charge(item.charge)}`;
  const chargeText = (n) => n ? `${Math.abs(n)}${n > 0 ? "+" : "−"}` : "0";
  const stateText = ["empty", "one electron, spin up", "one electron, spin down", "two electrons, opposite spins"];
  const arrow = ["", "↑", "↓", "↑↓"];

  function save() {
    if (!session || reviewing) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(session));
      el.saveStatus.textContent = session.recordSaveFailed ? "Mastery evidence could not be saved; it remains in this tab and will be retried on a later accepted answer." : "";
    }
    catch (_) { el.saveStatus.textContent = "Progress could not be saved in this browser. Your current answer remains in this tab."; }
  }
  function loadSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE));
      return S.valid(saved) ? saved : null;
    } catch (_) { return null; }
  }
  function masteryLevel() {
    try { return typeof M.nextLevel === "function" ? M.nextLevel(LEAF) : 1; }
    catch (_) { return 1; }
  }
  function levelSummary(level) {
    try { return typeof M.summary === "function" ? M.summary(LEAF, level) : { score: null, mastered: false, count: 0 }; }
    catch (_) { return { score: null, mastered: false, count: 0 }; }
  }
  function showChooser() {
    el.chooser.hidden = false; el.activityScreen.hidden = true; el.finishScreen.hidden = true;
    if (typeof M.renderChoices === "function") M.renderChoices(el.practiceChoices, { leafId: LEAF, href: location.pathname });
    else el.practiceChoices.innerHTML = ["mastery", "level=1", "level=2", "level=3"].map((value) => `<a class="practice-choice" href="?leaf=${encodeURIComponent(LEAF)}&practice=${value === "mastery" ? "mastery" : "level&" + value}"><strong>${value === "mastery" ? "MASTERY" : "Level " + value.slice(-1)}</strong></a>`).join("");
  }
  function randomSeed() {
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    return Date.now() >>> 0;
  }
  function chooseLevel() {
    if (requestedPractice === "level" && [1, 2, 3].includes(requestedLevel)) return requestedLevel;
    if (requestedPractice === "mastery") return masteryLevel();
    return null;
  }
  function start(level, mode, saved) {
    reviewing = false;
    session = saved || S.create({ level, mode, leafId: LEAF }, randomSeed());
    if (!session.current && !session.completed) S.next(session);
    showActivity();
  }
  function startFromUrl() {
    const level = chooseLevel();
    if (!level) { showChooser(); return; }
    const saved = loadSave();
    if (saved && saved.mode === (requestedPractice === "mastery" ? "mastery" : "level") && saved.level === level && saved.leafId === LEAF && !saved.completed) start(level, saved.mode, saved);
    else start(level, requestedPractice === "mastery" ? "mastery" : "level");
  }
  function notation(counts, core = "") {
    return `<div class="notation">${core ? `<span>[${core}]</span>` : ""}${counts.map((n, i) => n ? `<span>${D.subshells[i]}<sup>${n}</sup></span>` : "").join("")}</div>`;
  }
  function boxMarkup(i, j, state, editable) {
    const label = `${D.subshells[i]}, orbital ${j + 1}: ${stateText[state]}`;
    return editable ? `<button type="button" class="orbital${state ? " filled" : ""}" data-orbital="${i}:${j}" aria-label="${label}"${session.result ? " disabled" : ""}>${arrow[state]}</button>` : `<span class="orbital${state ? " filled" : ""}" role="img" aria-label="${label}">${arrow[state]}</span>`;
  }
  function diagram(item, layout, editable, states) {
    const indices = layout === "energy" ? C.energyOrder(item) : D.subshells.map((_, i) => i);
    const energySteps = { "1s": 0, "2s": 4, "2p": 6, "3s": 8, "3p": 10, "4s": 12, "3d": 13, "4p": 14 };
    const steps = indices.map((i) => energySteps[D.subshells[i]]);
    const groups = indices.map((i, row) => {
      const boxes = `<div class="orbital-boxes">${states[i].map((state, j) => boxMarkup(i, j, state, editable)).join("")}</div>`;
      return layout === "energy" ? `<div class="energy-level" data-subshell="${D.subshells[i]}" style="grid-column:${"spd".indexOf(D.subshells[i][1]) + 1};grid-row:${steps.at(-1) - steps[row] + 1} / span 4"><span class="orbital-label">${D.subshells[i]}</span><div class="energy-track">${boxes}</div></div>` : `<div class="orbital-group">${boxes}<span class="orbital-label">${D.subshells[i]}</span></div>`;
    }).join("");
    if (layout === "row") return `<div class="orbital-scroll" tabindex="0" role="region" aria-label="Horizontal orbital diagram; scroll to see all subshells"><div class="orbital-row">${groups}</div></div><p class="editor-note">Subshells are in notation order. Scroll sideways if needed.</p>`;
    const columns = Math.max(...indices.map((i) => "spd".indexOf(D.subshells[i][1]) + 1));
    return `<div class="orbital-scroll energy-scroll" tabindex="0" role="region" aria-label="Orbital energy diagram with separate s, p and d columns; scroll sideways if needed"><div class="energy-diagram" style="--energy-columns:${columns}"><div class="energy-axis"><span>Increasing energy</span></div>${groups}</div></div>`;
  }
  function numericFields() {
    const core = session.current.representation === "short" ? D.cores[session.response.core] : null;
    return D.subshells.map((label, i) => core?.[i] ? "" : `<label class="subshell-entry">${label}<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-count="${i}" aria-label="Electrons in ${label}" autocomplete="off" value="${escape(session.response.counts[i])}"${session.result ? " disabled" : ""}></label>`).join("");
  }
  function construction(item, rep) {
    const card = `<div class="species-card"><div class="species-symbol">${symbol(item)}</div><div><p class="species-name">${escape(item.name)}${item.charge ? " ion" : " atom"}</p><p class="species-detail">Atomic number ${item.z} · ${item.charge ? `Charge ${chargeText(item.charge)}` : "Neutral atom"}</p></div></div>`;
    if (rep === "row" || rep === "energy") return card + `<p class="editor-note">Tap a box or press Space to cycle empty → ↑ → ↑↓ → empty. Keyboard: 1 = ↑, 2 = ↑↓, 0 = empty.</p>` + diagram(item, rep, true, session.response.boxes);
    return card + (rep === "short" ? `<label class="core-select">Noble-gas core <select id="coreSelect"${session.result ? " disabled" : ""}><option value="">Choose a core</option>${Object.keys(D.cores).map((key) => `<option${session.response.core === key ? " selected" : ""}>${key}</option>`).join("")}</select></label>` : "") + `<p class="editor-note">Enter the number of electrons in each ${rep === "short" ? "remaining " : ""}subshell. Leave unused subshells blank or enter 0.</p><div class="notation-editor" id="numericFields">${numericFields()}</div>`;
  }
  function displayConfiguration(item, rep) {
    if (rep === "full") return `<div class="configuration-display">${notation(item.counts)}</div>`;
    if (rep === "short") { const short = C.abbreviation(item); return `<div class="configuration-display">${notation(short.counts, short.core)}</div>`; }
    return diagram(item, rep, false, C.boxes(item.counts));
  }
  function identity(item, rep) {
    return `<p class="question-subtitle">${item.charge ? `This ion has charge <strong>${chargeText(item.charge)}</strong>. Which element does it belong to?` : "This configuration belongs to a neutral atom. Which element is it?"}</p>${displayConfiguration(item, rep)}<label class="identity-entry"><span>Element name or symbol</span><input id="identityInput" type="text" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escape(session.response.identity)}"${session.result ? " disabled" : ""}></label>`;
  }
  function matchingContent(q) {
    return `<p class="question-subtitle">Select every species with exactly this electron configuration. This question contributes to your Level 3 score.</p><div class="configuration-display">${notation(q.counts)}</div><div class="bonus-options">${q.options.map((id) => { const item = C.species(id); return `<label class="bonus-option"><span><span class="symbol">${symbol(item)}</span><small>${escape(item.name)} · atomic number ${item.z}</small></span><input type="checkbox" data-species="${escape(id)}" aria-label="${escape(item.name)}, charge ${chargeText(item.charge)}"${session.response.selected.includes(id) ? " checked" : ""}${session.result ? " disabled" : ""}></label>`; }).join("")}</div>`;
  }
  function reviewId(q) {
    if (q.kind === "matching") return q.reviewId || "";
    if (!reviewBank) return "";
    try { return reviewBank.id({ kind: "main", speciesId: q.speciesId, representation: q.representation, direction: q.direction, skill: `${q.direction}:${q.representation}` }); } catch (_) { return ""; }
  }
  function renderQuestion() {
    const q = session.current, matching = q.kind === "matching", item = !matching && C.species(q.speciesId);
    const title = matching ? "Match the electron configuration" : q.direction === "build" ? "Build the configuration" : "Which element is this?";
    const rep = matching ? "MATCHING" : D.representations.find((r) => r.id === q.representation).label.toUpperCase();
    const number = session.completedCount + (session.result ? 0 : 1);
    const id = reviewId(q);
    el.questionPanel.innerHTML = `<form id="answerForm"><div class="question-top"><p class="eyebrow">LEVEL ${session.level} · ${rep}</p><span class="question-number">Question ${number}</span></div><h2 tabindex="-1" id="questionTitle">${title}</h2>${matching ? matchingContent(q) : q.direction === "build" ? construction(item, q.representation) : identity(item, q.representation)}${id ? `<p class="question-id">Review ID // ${escape(id)}</p>` : ""}<p class="error" id="answerError" role="alert"></p><div class="question-actions">${!session.result && !matching ? '<button type="button" class="quiet" id="clearAnswer">Clear answer</button>' : ""}<button class="primary" type="submit">${session.result ? "Next question →" : "Check answer"}</button></div></form>`;
    el.questionPanel.querySelector("#answerForm")?.addEventListener("submit", submitEvent);
    el.questionPanel.querySelector("#clearAnswer")?.addEventListener("click", () => { session.response = C.blankResponse(); renderQuestion(); save(); });
    el.questionPanel.querySelector("#coreSelect")?.addEventListener("change", (event) => {
      session.response.core = event.target.value;
      const core = D.cores[event.target.value];
      if (core) core.forEach((n, i) => { if (n) session.response.counts[i] = ""; });
      const fields = el.questionPanel.querySelector("#numericFields"); if (fields) fields.innerHTML = numericFields(); save();
    });
    const titleNode = el.questionPanel.querySelector("#questionTitle"); titleNode?.focus({ preventScroll: true });
    if (id && globalThis.QuestionReview) QuestionReview.mount(el.questionPanel, id, loadReview);
  }
  function submitEvent(event) {
    event.preventDefault();
    if (session.result) {
      if (session.mode === "mastery") {
        const nextLevel = masteryLevel();
        if (nextLevel === null) { session.completed = true; session.current = null; session.result = null; showFinish(); return; }
        if (nextLevel !== session.level) { start(nextLevel, "mastery"); return; }
      }
      S.advance(session); showActivity(); return;
    }
    session.current.attemptSaved = true;
    save();
    const result = S.submit(session);
    if (!result.accepted) { el.questionPanel.querySelector("#answerError").textContent = result.message; save(); return; }
    showActivity();
  }
  function feedback() {
    const result = session.result, q = session.current;
    el.feedback.hidden = !result; el.answerPanel.hidden = !result;
    if (!result) return;
    el.feedback.className = `panel feedback${result.correct ? "" : " incorrect"}`;
    const description = q.kind === "matching" ? "Matching is assessed in Level 3 and cannot be skipped." : result.correct ? "Correct first attempt recorded." : "This is an incorrect first attempt. The next question is independent.";
    el.feedback.innerHTML = `<h3>${result.correct ? "Correct" : "Not quite yet"}</h3>${result.issues.length ? `<ul>${result.issues.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul>` : ""}<p>${description}</p>`;
    el.answerPanel.querySelector("summary").textContent = q.kind === "matching" ? "Checked matching answer" : "Checked answer · all four representations";
    if (q.kind === "matching") {
      el.answerContent.innerHTML = q.options.map((id) => { const item = C.species(id); return `<div class="answer-view"><h3>${symbol(item)} ${result.expected.includes(id) ? "✓ Matches" : "— Different configuration"}</h3>${notation(item.counts)}</div>`; }).join("");
    } else {
      const item = C.species(q.speciesId), short = C.abbreviation(item);
      el.answerContent.innerHTML = `<h3>${escape(item.name)} · ${symbol(item)}</h3><div class="answer-explanation">${C.explanation(item).map((line) => `<p>${escape(line)}</p>`).join("")}</div><div class="answer-view"><h3>Full notation</h3>${notation(item.counts)}</div><div class="answer-view"><h3>Abbreviated notation</h3>${short.core ? notation(short.counts, short.core) : '<p class="editor-note">There is no preceding noble-gas core for this atom. Use full notation.</p>'}</div><div class="answer-view"><h3>Boxes in a row</h3>${diagram(item, "row", false, C.boxes(item.counts))}</div><div class="answer-view"><h3>Boxes on energy levels</h3>${diagram(item, "energy", false, C.boxes(item.counts))}</div>`;
    }
  }
  function progress() {
    const summary = levelSummary(session.level);
    el.progressSummary.textContent = `${session.completedCount} answered · ${session.correctCount} correct first attempts${summary.mastered ? " · level mastered" : ""}`;
    el.masteryBar.replaceChildren();
    try { if (typeof M.bar === "function") el.masteryBar.append(M.bar(summary.score, `Level ${session.level} mastery`, session.level)); } catch (_) { /* progress remains readable if the shared meter is unavailable */ }
    el.progressGrid.innerHTML = `<div class="skill-card"><h3>Level ${session.level}</h3><p class="muted">${session.level === 1 ? "Main-group atoms · full notation and orbital boxes" : session.level === 2 ? "Main-group atoms and ions · all representations" : "All groups · matching, build and identify"}</p></div>`;
  }
  function showActivity() {
    el.chooser.hidden = true; el.finishScreen.hidden = true; el.activityScreen.hidden = session.completed;
    if (session.completed) { showFinish(); return; }
    progress(); renderQuestion(); feedback(); save();
  }
  function showFinish() {
    el.chooser.hidden = true; el.activityScreen.hidden = true; el.finishScreen.hidden = false;
    const accuracy = session.completedCount ? session.correctCount / session.completedCount : 0;
    const score = levelSummary(session.level).score;
    el.finishTitle.textContent = session.mode === "mastery" ? (masteryLevel() ? `Level ${session.level} round complete` : "All three levels complete") : `Level ${session.level} practice complete`;
    el.finishContent.innerHTML = `<p>You scored <strong>${session.correctCount} / ${session.completedCount}</strong> (${Math.round(accuracy * 100)}%). The weighted mastery score for this level is ${score === null ? "not assessed yet" : `${Math.round(score * 100)}%`}. ${session.mode === "mastery" ? "MASTERY will use the common progress record to choose the next unmet level." : "Fixed-level practice stays on this level, regardless of the award."}</p><div class="mastery-bar" data-level="${session.level}"></div>`;
    el.finishAction.textContent = session.mode === "mastery" && masteryLevel() ? "Continue MASTERY" : session.mode === "mastery" ? "Return to choices" : "Practise this level again";
    el.finishAction.onclick = () => {
      if (session.mode === "mastery") {
        const level = masteryLevel();
        if (level) { start(level, "mastery"); return; }
        showChooser();
      } else start(session.level, "level");
    };
    try { if (typeof M.bar === "function") el.finishContent.querySelector(".mastery-bar").replaceWith(M.bar(score, `Level ${session.level}`, session.level)); } catch (_) { /* visual progress is optional */ }
    save();
  }
  function setBox(button, state) {
    if (session.result) return;
    const [i, j] = button.dataset.orbital.split(":").map(Number);
    session.response.boxes[i][j] = state; button.textContent = arrow[state]; button.classList.toggle("filled", Boolean(state)); button.setAttribute("aria-label", `${D.subshells[i]}, orbital ${j + 1}: ${stateText[state]}`); save();
  }
  el.questionPanel.addEventListener("input", (event) => {
    if (!session || session.result) return;
    const field = event.target;
    if (field.matches("[data-count]")) session.response.counts[Number(field.dataset.count)] = field.value;
    if (field.id === "identityInput") session.response.identity = field.value;
    if (field.matches("[data-species]")) session.response.selected = [...el.questionPanel.querySelectorAll("[data-species]:checked")].map((input) => input.dataset.species);
    save();
  });
  el.questionPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-orbital]"); if (!button) return;
    const [i, j] = button.dataset.orbital.split(":").map(Number);
    const cycle = [0, 1, 3], index = Math.max(0, cycle.indexOf(session.response.boxes[i][j]));
    setBox(button, cycle[(index + 1) % cycle.length]);
  });
  el.questionPanel.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-orbital]"); if (!button) return;
    const [i, j] = button.dataset.orbital.split(":").map(Number), cycle = [0, 1, 3];
    const states = { "1": 1, "2": 3, "0": 0, " ": cycle[(Math.max(0, cycle.indexOf(session.response.boxes[i][j])) + 1) % cycle.length] };
    if (Object.hasOwn(states, event.key)) { event.preventDefault(); setBox(button, states[event.key]); }
  });
  el.changePractice.addEventListener("click", showChooser);
  if (globalThis.PeriodicTable) PeriodicTable.mount(el.openReference, { id: "referenceDialog" });
  if (globalThis.QuestionReview) {
    reviewBank = QuestionReview.bank("EC", D.species.flatMap((item) => D.representations.filter((r) => r.id !== "short" || C.coreOptions(item).length).flatMap((r) => ["build", "identify"].map((direction) => ({ kind: "main", speciesId: item.id, representation: r.id, direction, skill: `${direction}:${r.id}` })))), (q) => `${q.speciesId}:${q.skill}`);
  }
  function loadReview(id) {
    let q, kind = "main";
    if (id.trim().toUpperCase().startsWith("ECB-") && globalThis.ElectronSession) {
      q = ElectronSession.bonusFromReviewId(id.trim().toUpperCase());
      kind = "matching";
    } else {
      if (!reviewBank) return;
      q = reviewBank.get(id);
    }
    reviewing = true; reviewLoaded = true;
    session = S.create({ level: 3, mode: "level", leafId: LEAF, reviewing: true }, 1);
    session.current = kind === "matching" ? { ...q, kind, group: "matching", reviewId: id.trim().toUpperCase(), attemptId: `review-${id}` } : { ...q, kind, group: C.species(q.speciesId).group, attemptId: `review-${id}` };
    session.response = C.blankResponse(); session.result = null; showActivity();
  }
  globalThis.ElectronLevelsApp = { start, showChooser };
  if (reviewBank && globalThis.QuestionReview) QuestionReview.requested(loadReview);
  if (!reviewLoaded) startFromUrl();
})();
