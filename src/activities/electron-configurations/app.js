(function () {
  "use strict";
  const D = globalThis.ElectronData, C = globalThis.ElectronCore, S = globalThis.ElectronSession;
  const STORE = "sjs-electron-configurations-v1";
  const el = Object.fromEntries(["setupScreen","activityScreen","finishScreen","setupForm","groupChoices","representationChoices","bonusToggle","setupError","resumeCard","resumeSummary","resume","changeSetup","progressSummary","progressGrid","questionPanel","feedback","answerPanel","answerContent","saveStatus","openReference","teacherNotes"].map((id) => [id,document.getElementById(id)]));
  const escape = (value) => String(value).replace(/[&<>"']/g,(c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const charge = (n) => n ? `<sup>${Math.abs(n) === 1 ? "" : Math.abs(n)}${n > 0 ? "+" : "−"}</sup>` : "";
  const symbol = (item) => `${escape(item.symbol)}${charge(item.charge)}`;
  const chargeText = (n) => n ? `${Math.abs(n)}${n > 0 ? "+" : "−"}` : "0";
  const stateText = ["empty","one electron, spin up","one electron, spin down","two electrons, opposite spins"];
  const arrow = ["","↑","↓","↑↓"];
  let session = null, reviewing = false;
  const reviewBank=QuestionReview.bank('EC',D.species.flatMap(item=>D.representations.filter(r=>r.id!=='short'||C.coreOptions(item).length).flatMap(r=>['build','identify'].map(direction=>({kind:'main',speciesId:item.id,representation:r.id,direction,skill:direction+':'+r.id})))),q=>q.speciesId+':'+q.skill);
  function loadReview(id){
    const q=id.trim().toUpperCase().startsWith('ECB-')?S.bonusFromReviewId(id):reviewBank.get(id);
    reviewing=true;
    session=S.create({groups:D.groups.map(g=>g.id),representations:D.representations.map(r=>r.id),bonus:false},1);
    session.current=q;session.response=C.blankResponse();session.result=null;show();
    const reveal=document.createElement('button');reveal.type='button';reveal.textContent='Show checked answer';
    reveal.onclick=()=>{session.result={correct:true,issues:[],expected:q.kind==='bonus'?q.options.filter(id=>C.same(C.species(id).counts,q.counts)):[]};feedback();el.feedback.hidden=true;el.answerPanel.open=true;};
    el.questionPanel.append(reveal);
  }
  function readSave() {
    try { const saved = JSON.parse(localStorage.getItem(STORE)); return S.valid(saved) ? saved : null; } catch { return null; }
  }
  function save() {
    if (!session || reviewing) return;
    try { localStorage.setItem(STORE,JSON.stringify(session)); el.saveStatus.textContent = ""; }
    catch { el.saveStatus.textContent = "This browser cannot save progress. You can still finish this session."; }
  }
  function choices(items,name) {
    return items.map((item) => `<label class="choice"><span>${escape(item.label)}<small>${escape(item.detail)}</small></span><input type="checkbox" name="${name}" value="${item.id}" checked></label>`).join("");
  }
  function setup() {
    el.setupScreen.hidden = false; el.activityScreen.hidden = true; el.finishScreen.hidden = true;
    const saved = readSave(); el.resumeCard.hidden = !saved || saved.completed;
    if (saved && !saved.completed) el.resumeSummary.textContent = `${Object.values(saved.progress).filter((p) => p.streak === S.TARGET).length} of ${Object.keys(saved.progress).length} skills mastered · ${saved.mainCount} questions answered`;
  }
  function notation(counts,core = "") {
    return `<div class="notation">${core ? `<span>[${core}]</span>` : ""}${counts.map((n,i) => n ? `<span>${D.subshells[i]}<sup>${n}</sup></span>` : "").join("")}</div>`;
  }
  function boxMarkup(i,j,state,editable) {
    const label = `${D.subshells[i]}, orbital ${j+1}: ${stateText[state]}`;
    return editable ? `<button type="button" class="orbital${state ? " filled" : ""}" data-orbital="${i}:${j}" aria-label="${label}"${session.result ? " disabled" : ""}>${arrow[state]}</button>` : `<span class="orbital${state ? " filled" : ""}" role="img" aria-label="${label}">${arrow[state]}</span>`;
  }
  function diagram(item,layout,editable,states) {
    // DOM order follows increasing energy for natural Tab / Shift+Tab navigation.
    // Grid rows place the lowest level at the bottom independently of DOM order.
    const indices = layout === "energy" ? C.energyOrder(item) : D.subshells.map((_,i) => i);
    // Quarter-height steps keep s and p columns evenly spaced. Place 3d
    // halfway between 4s and 4p without opening a larger gap in the p column.
    const energySteps = {"1s":0,"2s":4,"2p":6,"3s":8,"3p":10,"4s":12,"3d":13,"4p":14};
    const steps = indices.map((i) => energySteps[D.subshells[i]]);
    const groups = indices.map((i,row) => {
      const boxes = `<div class="orbital-boxes">${states[i].map((state,j) => boxMarkup(i,j,state,editable)).join("")}</div>`;
      return layout === "energy" ? `<div class="energy-level" data-subshell="${D.subshells[i]}" style="grid-column:${"spd".indexOf(D.subshells[i][1])+1};grid-row:${steps.at(-1)-steps[row]+1} / span 4"><span class="orbital-label">${D.subshells[i]}</span><div class="energy-track">${boxes}</div></div>` : `<div class="orbital-group">${boxes}<span class="orbital-label">${D.subshells[i]}</span></div>`;
    }).join("");
    if (layout === "row") return `<div class="orbital-scroll" tabindex="0" role="region" aria-label="Horizontal orbital diagram; scroll to see all subshells"><div class="orbital-row">${groups}</div></div><p class="editor-note">Subshells are in notation order. Scroll sideways if needed.</p>`;
    const columns = Math.max(...indices.map((i) => "spd".indexOf(D.subshells[i][1])+1));
    return `<div class="orbital-scroll energy-scroll" tabindex="0" role="region" aria-label="Orbital energy diagram with separate s, p and d columns; scroll sideways if needed"><div class="energy-diagram" style="--energy-columns:${columns}"><div class="energy-axis"><span>Increasing energy</span></div>${groups}</div></div>`;
  }
  function numericFields() {
    const core = session.current.representation === "short" ? D.cores[session.response.core] : null;
    return D.subshells.map((label,i) => core?.[i] ? "" : `<label class="subshell-entry">${label}<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-count="${i}" aria-label="Electrons in ${label}" autocomplete="off" value="${escape(session.response.counts[i])}"${session.result ? " disabled" : ""}></label>`).join("");
  }
  function construction(item,rep) {
    const card = `<div class="species-card"><div class="species-symbol">${symbol(item)}</div><div><p class="species-name">${escape(item.name)}${item.charge ? " ion" : " atom"}</p><p class="species-detail">Atomic number ${item.z} · ${item.charge ? `Charge ${chargeText(item.charge)}` : "Neutral atom"}</p></div></div>`;
    if (rep === "row" || rep === "energy") return card + `<p class="editor-note">Tap a box or press Space to cycle empty → ↑ → ↑↓ → empty. Keyboard: 1 = ↑, 2 = ↑↓, 0 = empty.</p>` + diagram(item,rep,true,session.response.boxes);
    return card + (rep === "short" ? `<label class="core-select">Noble-gas core <select id="coreSelect"${session.result ? " disabled" : ""}><option value="">Choose a core</option>${Object.keys(D.cores).map((key) => `<option${session.response.core === key ? " selected" : ""}>${key}</option>`).join("")}</select></label>` : "") + `<p class="editor-note">Enter the number of electrons in each ${rep === "short" ? "remaining " : ""}subshell. Leave unused subshells blank or enter 0.</p><div class="notation-editor" id="numericFields">${numericFields()}</div>`;
  }
  function displayConfiguration(item,rep) {
    if (rep === "full") return `<div class="configuration-display">${notation(item.counts)}</div>`;
    if (rep === "short") { const short = C.abbreviation(item); return `<div class="configuration-display">${notation(short.counts,short.core)}</div>`; }
    return diagram(item,rep,false,C.boxes(item.counts));
  }
  function identity(item,rep) {
    return `<p class="question-subtitle">${item.charge ? `This ion has charge <strong>${chargeText(item.charge)}</strong>. Which element does it belong to?` : "This configuration belongs to a neutral atom. Which element is it?"}</p>${displayConfiguration(item,rep)}<label class="identity-entry"><span>Element name or symbol</span><input id="identityInput" type="text" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escape(session.response.identity)}"${session.result ? " disabled" : ""}></label>`;
  }
  function bonusContent(q) {
    return `<p class="question-subtitle">Select every species with exactly this electron configuration.</p><div class="configuration-display">${notation(q.counts)}</div><div class="bonus-options">${q.options.map((id) => {
      const item = C.species(id);
      return `<label class="bonus-option"><span><span class="symbol">${symbol(item)}</span><small>Atomic number ${item.z}</small></span><input type="checkbox" data-species="${escape(id)}" aria-label="${escape(item.name)}, charge ${chargeText(item.charge)}"${session.response.selected.includes(id) ? " checked" : ""}${session.result ? " disabled" : ""}></label>`;
    }).join("")}</div>`;
  }
  function progress() {
    const records = Object.values(session.progress), mastered = records.filter((p) => p.streak === S.TARGET).length;
    el.progressSummary.textContent = `${mastered} / ${records.length} skills mastered`;
    el.progressGrid.innerHTML = session.representations.map((rep) => `<div class="skill-card"><h3>${D.representations.find((r) => r.id === rep).label}</h3>${["build","identify"].map((direction) => {
      const key = `${direction}:${rep}`, p = session.progress[key];
      return `<div class="skill-line${session.current?.skill === key ? " current" : ""}"><span>${direction === "build" ? "Build" : "Identify"}${p.streak === S.TARGET ? " ✓" : ""}</span><span class="dots" role="img" aria-label="${p.streak} of 3 correct${p.streak === S.TARGET ? ", mastered" : ""}">${[0,1,2].map((i) => `<span class="dot${i < p.streak ? " done" : ""}"></span>`).join("")}</span></div>`;
    }).join("")}</div>`).join("");
  }
  function renderQuestion() {
    const q = session.current, bonus = q.kind === "bonus", item = !bonus && C.species(q.speciesId);
    const title = bonus ? "Same electrons, different identities" : q.direction === "build" ? "Build the configuration" : "Which element is this?";
    const label = bonus ? "OPTIONAL CHALLENGE" : D.representations.find((r) => r.id === q.representation).label.toUpperCase();
    const number = session.mainCount + (session.result || bonus ? 0 : 1);
    el.questionPanel.innerHTML = `<div class="question-top"><p class="eyebrow">${label}</p><span class="question-number">${bonus ? "Between rounds" : `Question ${number}`}</span></div><h2 tabindex="-1" id="questionTitle">${title}</h2><form id="answerForm">${bonus ? bonusContent(q) : q.direction === "build" ? construction(item,q.representation) : identity(item,q.representation)}<p class="error" id="answerError" role="alert"></p><div class="question-actions">${!session.result && !bonus ? '<button type="button" class="quiet" id="clearAnswer">Clear answer</button>' : ""}${bonus && !session.result ? '<button type="button" class="quiet" id="skipBonus">Skip this question</button>' : ""}<button class="primary" type="submit">${session.result ? "Continue →" : "Check answer"}</button></div></form>`;
    QuestionReview.mount(el.questionPanel,bonus?q.reviewId:reviewBank.id(q),loadReview);
    document.getElementById("answerForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (session.result) { S.next(session); show(); focusQuestion(); return; }
      const result = S.submit(session);
      if (!result.accepted) { document.getElementById("answerError").textContent = result.message; return; }
      show(); el.feedback.scrollIntoView({block:"nearest",behavior:"auto"});
      el.feedback.focus();
    });
    document.getElementById("clearAnswer")?.addEventListener("click", () => { session.response = C.blankResponse(); renderQuestion(); save(); });
    document.getElementById("skipBonus")?.addEventListener("click", () => { S.skipBonus(session); show(); focusQuestion(); });
    document.getElementById("coreSelect")?.addEventListener("change", (event) => {
      session.response.core = event.target.value;
      const core = D.cores[event.target.value];
      if (core) core.forEach((n,i) => { if (n) session.response.counts[i] = ""; });
      document.getElementById("numericFields").innerHTML = numericFields(); save();
    });
  }
  function feedback() {
    const result = session.result, q = session.current;
    el.feedback.hidden = !result; el.answerPanel.hidden = !result; el.answerPanel.open = false;
    if (!result) return;
    el.feedback.className = `panel feedback${result.correct ? "" : " incorrect"}`;
    el.feedback.tabIndex = -1;
    const description = q.kind === "bonus" ? "This optional question does not change your mastery." : result.correct ? `Your ${q.direction === "build" ? "building" : "identification"} streak for this representation is ${session.progress[q.skill].streak} / 3.` : "This skill’s streak has reset. You’ll practise it again with another species.";
    el.feedback.innerHTML = `<h3>${result.correct ? "Correct" : "Not quite yet"}</h3>${result.issues.length ? `<ul>${result.issues.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul>` : ""}<p>${description}</p>`;
    if (q.kind === "bonus") {
      el.answerPanel.querySelector("summary").textContent = "Checked matching answers";
      el.answerContent.innerHTML = q.options.map((id) => { const item = C.species(id); return `<div class="answer-view"><h3>${symbol(item)} ${result.expected.includes(id) ? "✓ Matches" : "— Different configuration"}</h3>${notation(item.counts)}</div>`; }).join("");
    } else {
      el.answerPanel.querySelector("summary").textContent = "Checked answer · all four representations";
      const item = C.species(q.speciesId), short = C.abbreviation(item);
      el.answerContent.innerHTML = `<h3>${escape(item.name)} · ${symbol(item)}</h3><div class="answer-explanation">${C.explanation(item).map((line) => `<p>${escape(line)}</p>`).join("")}</div><div class="answer-view"><h3>Full notation</h3>${notation(item.counts)}</div><div class="answer-view"><h3>Abbreviated notation</h3>${short.core ? notation(short.counts,short.core) : '<p class="editor-note">There is no preceding noble-gas core for this atom. Use full notation.</p>'}</div><div class="answer-view"><h3>Boxes in a row</h3>${diagram(item,"row",false,C.boxes(item.counts))}</div><div class="answer-view"><h3>Boxes on energy levels</h3>${diagram(item,"energy",false,C.boxes(item.counts))}</div>`;
    }
  }
  function focusQuestion() { document.getElementById("questionTitle")?.focus({preventScroll:true}); el.questionPanel.scrollIntoView({block:"start",behavior:"auto"}); }
  function finish() {
    el.finishScreen.innerHTML = `<p class="eyebrow">SESSION COMPLETE</p><h2>Every selected skill mastered.</h2><p class="muted">You’ve built and identified configurations in each selected representation.</p><div class="stats"><div class="stat"><strong>${Object.keys(session.progress).length}</strong><span>skills mastered</span></div><div class="stat"><strong>${session.correctCount} / ${session.mainCount}</strong><span>correct first attempts</span></div>${session.bonusCount ? `<div class="stat"><strong>${session.bonusCorrect} / ${session.bonusCount}</strong><span>matching questions</span></div>` : ""}</div><button class="primary" id="startAnother" type="button">Start another session</button>`;
    document.getElementById("startAnother").addEventListener("click",setup);
  }
  function show() {
    el.setupScreen.hidden = true; el.activityScreen.hidden = session.completed; el.finishScreen.hidden = !session.completed;
    if (session.completed) finish(); else { progress(); renderQuestion(); feedback(); }
    save();
  }
  el.questionPanel.addEventListener("input", (event) => {
    if (!session || session.result) return;
    const field = event.target;
    if (field.matches("[data-count]")) session.response.counts[Number(field.dataset.count)] = field.value;
    if (field.id === "identityInput") session.response.identity = field.value;
    if (field.matches("[data-species]")) session.response.selected = [...el.questionPanel.querySelectorAll("[data-species]:checked")].map((input) => input.dataset.species);
    save();
  });
  function setBox(button,state) {
    if (session.result) return;
    const [i,j] = button.dataset.orbital.split(":").map(Number);
    session.response.boxes[i][j] = state;
    button.textContent = arrow[state]; button.classList.toggle("filled",Boolean(state));
    button.setAttribute("aria-label",`${D.subshells[i]}, orbital ${j+1}: ${stateText[state]}`); save();
  }
  el.questionPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-orbital]"); if (!button) return;
    const [i,j] = button.dataset.orbital.split(":").map(Number); setBox(button,[1,3,3,0][session.response.boxes[i][j]]);
  });
  el.questionPanel.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-orbital]"); if (!button) return;
    const key = event.key, states = {"1":1,"2":3,"0":0};
    if (Object.hasOwn(states,key)) { event.preventDefault(); setBox(button,states[key]); }
  });
  el.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const groups = [...el.setupForm.querySelectorAll('[name="group"]:checked')].map((input) => input.value);
    const representations = [...el.setupForm.querySelectorAll('[name="representation"]:checked')].map((input) => input.value);
    try {
      reviewing = false;
      session = S.create({groups,representations,bonus:el.bonusToggle.checked},crypto.getRandomValues(new Uint32Array(1))[0]);
      el.setupError.textContent = ""; show(); focusQuestion();
    } catch (error) { el.setupError.textContent = error.message; }
  });
  el.resume.addEventListener("click", () => { const saved = readSave(); if (saved && !saved.completed) { reviewing=false; session = saved; show(); focusQuestion(); } else setup(); });
  el.changeSetup.addEventListener("click",setup);
  PeriodicTable.mount(el.openReference,{id:"referenceDialog"});
  el.groupChoices.innerHTML = choices(D.groups,"group"); el.representationChoices.innerHTML = choices(D.representations,"representation");
  el.teacherNotes.innerHTML = `<p>Objectives: construct ground-state configurations; translate between subshell notation and orbital boxes; identify an element using electron count and charge; recognise species sharing a configuration.</p><p>Assumes knowledge of atomic number, ionic charge, subshell capacities and electron spin. Covers H–Kr and a curated selection of ions. Sc and Zn are included as d-block elements.</p><p>Full notation and noble-gas abbreviation are assessed separately here. Follow the wording of an examination question when choosing notation. Empty subshells may be omitted; smaller valid noble-gas cores are accepted.</p><p>Energy diagrams use the schematic Aufbau filling order, with 4s consistently below 3d. This teaching convention is not a species-specific measurement of orbital energies. Ground-state occupancies include the Cr and Cu exceptions, and transition-metal ions lose 4s electrons before 3d electrons. No ligand-field splitting is shown.</p><p>Each box permits at most two electrons with opposite spins. Marking also checks occupancy and parallel unpaired spins, accepting equivalent orbital permutations. Identifying an ion always includes its charge.</p><p>Sources: <a href="${D.metadata.specification}" target="_blank" rel="noopener">OCR H432 specification</a>; <a href="${D.metadata.sources[0]}" target="_blank" rel="noopener">NIST configuration data</a>; <a href="${D.metadata.sources[1]}" target="_blank" rel="noopener">OCR transition-element mark scheme</a>; <a href="${D.metadata.sources[2]}" target="_blank" rel="noopener">MIT orbital-energy discussion</a>. Accessed 4 September 2026. Detailed provenance and validation conventions accompany the editable source.</p>`;
  try { C.validateBank(); setup(); } catch { el.setupError.textContent = "The configuration bank did not pass validation. Please use a fresh copy of the activity."; el.setupForm.querySelector('button[type="submit"]').disabled = true; }
  QuestionReview.launcher(el.setupScreen,loadReview);
  QuestionReview.requested(loadReview);
})();
