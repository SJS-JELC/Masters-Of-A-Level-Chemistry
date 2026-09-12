(function () {
  'use strict';
  const C = TestModeCore, alevel = Boolean(globalThis.ALevelMastery), site = alevel ? 'alevel' : 'igcse';
  const M = alevel ? ALevelMastery : MastersProgress, activities = MASTERS_ACTIVITIES;
  const key = 'masters-' + site + '-test-mode-v1';
  const $ = id => document.getElementById(id);
  const uuid = () => crypto.randomUUID();
  const catalog = {};
  const gemSemantics = new Map();
  for (const group of MASTERS_HIERARCHY) for (const [number, topic, names] of group.topics) names.forEach((name,index) => {
    const id = `${group.key}-${number}-${index+1}`, activity = activities[id];
    const settings = alevel ? M.config[id] : Object.values(IGCSEMasteryConfig.activities).find(item => item.leafId === id);
    if (activity && settings) catalog[id] = {id,name,topic,href:activity.href,levels:settings.availableGrades || [1,2,3],
      labels: alevel ? settings.levelLabels : M.bands};
  });
  let records = [], session = null, selecting = false, selection = new Set(), frame = null, timer = null;
  const map = alevel ? $('course') : document.querySelector('.map-layout');
  const tile = $('testModeTile');
  tile.setAttribute('aria-expanded','false');
  tile.setAttribute('aria-controls','testSelection');
  const host = document.createElement('section'); host.id = 'testMode'; host.className = 'test-mode';
  host.innerHTML = `<section id="testSelection" class="test-selection" hidden aria-label="Choose gems for revision">
    <div class="test-selection-content"><p id="testSelectionTitle" tabindex="-1">Select gems below</p><ul id="testChosen" class="test-chosen" aria-label="Selected gems"></ul>
    <div class="test-selection-tools"><span id="testSelectionCount" role="status"></span><button id="testClear" type="button">Clear selection</button><button id="testCancel" type="button">Cancel</button></div></div>
    <button id="testStart" type="button" aria-label="Go: start revision">GO<span aria-hidden="true">&gt;</span></button></section>
    <section id="testRevision" class="test-card" hidden aria-labelledby="testHeading"><div class="test-session-heading"><div><p class="test-eyebrow">TEST REVISION</p><h2 id="testHeading" tabindex="-1"></h2><span id="testQuestionTitle"></span><p id="testLevel"></p></div><div class="test-actions"><button id="testPause" type="button">Pause and return</button><button id="testChange" type="button">Change gems</button></div></div>
    <div id="testCurrentBars" class="test-bars"></div><p id="testReason" role="status"></p>
    <details id="testOverview"><summary>All selected gems</summary><div id="testOverviewContent"></div></details>
    <div id="testLoadStatus" role="status"></div><div id="testFrameHost"></div>
    <div id="testError" hidden role="alert"><p>This question could not be loaded. Your assessed answers are retained.</p><button id="testRetry" type="button">Retry question</button><button id="testReturnSelection" type="button">Return to selection</button></div>
    <div id="testFinish" hidden><h3>Available practice mastered</h3><p>You have confirmed every available level for your selected gems.</p><p id="testGained"></p><button id="testAgain" type="button">Revise again</button></div></section>
    <p id="testSaveStatus" role="status" hidden></p>`;
  tile.parentElement.after(host);
  if (location.protocol === 'file:') {
    const notice = $('testSaveStatus');
    notice.textContent = 'Revision is available on the website. Please open the published version to use it.';
    tile.setAttribute('aria-controls',notice.id);
    tile.onclick = () => {
      notice.hidden = !notice.hidden;
      tile.setAttribute('aria-expanded',String(!notice.hidden));
    };
    return;
  }
  tile.parentElement.append($('testSelection'));
  const navigation = document.createElement('div'); navigation.className = 'test-navigation';
  $('testPause').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg>';
  $('testPause').setAttribute('aria-label','Pause and return'); $('testPause').title = 'Pause and return';
  $('testChange').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/></svg>';
  $('testChange').setAttribute('aria-label','Change gems'); $('testChange').title = 'Change gems';
  navigation.append($('testPause'),$('testChange')); document.querySelector('main > header').append(navigation);
  document.querySelector('.test-session-heading').append($('testCurrentBars'));
  function refresh() {
    if (alevel) M.refresh();
    else { try { records = M.merge(M.read(localStorage),records); } catch (_) {} }
  }
  function summary(leaf,level) { return alevel ? M.summary(leaf,level) : M.summarise(records,leaf,level); }
  function warn() { $('testSaveStatus').hidden = false; $('testSaveStatus').textContent = 'Progress is kept for this open page, but this browser could not save it.'; }
  function save() {
    if (!session) return;
    try { localStorage.setItem(key,JSON.stringify(session)); } catch (_) { warn(); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { const parsed = JSON.parse(raw); if (C.valid(parsed,catalog)) return parsed;
        $('testSaveStatus').hidden = false; $('testSaveStatus').textContent = 'The previous revision session is no longer compatible. Your mastery history is retained.'; }
    } catch (_) { warn(); }
    return null;
  }
  function gemNodes() { return [...document.querySelectorAll('#yearGrid [data-leaf]')]; }
  function drawSelection() {
    $('testChosen').replaceChildren(...[...selection].map(id => {
      const li = document.createElement('li'), button = document.createElement('button');
      button.type = 'button'; button.textContent = catalog[id].name + ' ×'; button.setAttribute('aria-label','Remove ' + catalog[id].name);
      button.onclick = () => { selection.delete(id); drawSelection(); }; li.append(button); return li;
    }));
    $('testSelectionCount').textContent = selection.size + (selection.size === 1 ? ' gem selected' : ' gems selected');
    $('testStart').disabled = !selection.size;
    $('testClear').disabled = !selection.size;
    $('testSelectionTitle').hidden = selection.size > 0;
    for (const node of gemNodes()) {
      const id = node.dataset.leaf;
      node.classList.toggle('test-selected', selecting && selection.has(id));
      node.classList.toggle('test-unavailable', selecting && !catalog[id]);
      if (selecting) {
        if (!gemSemantics.has(node)) {
          gemSemantics.set(node,Object.fromEntries(['aria-haspopup','aria-controls','aria-expanded'].map(name => [name,node.getAttribute(name)])));
          for (const name of ['aria-haspopup','aria-controls','aria-expanded']) node.removeAttribute(name);
        }
        if (!node.dataset.testOriginalLabel) node.dataset.testOriginalLabel = node.getAttribute('aria-label') || '';
        node.setAttribute('aria-pressed',String(selection.has(id)));
        node.setAttribute('aria-disabled',String(!catalog[id]));
        node.setAttribute('aria-label',(catalog[id]?.name || node.dataset.testOriginalLabel) + (catalog[id] ? ', ' + (selection.has(id) ? 'selected for test' : 'select for test') : ', Questions not available yet'));
      } else {
        if (gemSemantics.has(node)) {
          for (const [name,value] of Object.entries(gemSemantics.get(node))) if (value !== null) node.setAttribute(name,value);
          gemSemantics.delete(node);
        }
        node.removeAttribute('aria-pressed'); node.removeAttribute('aria-disabled');
        if (node.dataset.testOriginalLabel) { node.setAttribute('aria-label',node.dataset.testOriginalLabel); delete node.dataset.testOriginalLabel; }
      }
    }
  }
  function stopFrame() { clearTimeout(timer); if (frame) frame.remove(); frame = null; }
  function selectGems() {
    document.body.classList.remove('test-revising');
    if (session) { session.active = false; save(); }
    stopFrame(); selecting = true; selection = new Set(session?.selected || [...selection]);
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('testRevision').hidden = true; $('testSelection').hidden = false; map.hidden = false;
    document.body.classList.add('test-selecting'); tile.setAttribute('aria-expanded','true'); drawSelection(); tile.focus();
  }
  function leaveSelection() {
    selecting = false; tile.setAttribute('aria-expanded','false'); document.body.classList.remove('test-selecting'); $('testSelection').hidden = true; drawSelection();
  }
  function toggleGem(event) {
    if (!selecting) return;
    const node = event.target.closest('#yearGrid [data-leaf]');
    if (!node || (event.type === 'keydown' && !['Enter',' '].includes(event.key))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const id = node.dataset.leaf; if (!catalog[id]) return;
    if (selection.has(id)) selection.delete(id); else selection.add(id); drawSelection();
  }
  document.addEventListener('click',toggleGem,true); document.addEventListener('keydown',toggleGem,true);
  function bars(leaf) {
    return catalog[leaf].levels.map(level => {
      const wrapper = document.createElement('div'), label = document.createElement('span'), state = summary(leaf,level);
      label.textContent = catalog[leaf].labels[level];
      const bar = alevel ? M.bar(state.score,label.textContent,level) : M.masteryBar(state.score,label.textContent,level);
      const detail = document.createElement('small'); detail.textContent = state.score === null ? 'Not assessed' : Math.round(state.score*100) + '% mastery';
      if (session?.gems[leaf]?.[level]?.confirmedAt) detail.textContent += ' · Confirmed';
      wrapper.append(label,bar,detail); return wrapper;
    });
  }
  function overview() {
    $('testOverviewContent').replaceChildren(...session.selected.map(leaf => {
      const row = document.createElement('section'), title = document.createElement('h3'), container = document.createElement('div');
      title.textContent = catalog[leaf].name; container.className = 'test-bars'; container.append(...bars(leaf)); row.append(title,container); return row;
    }));
  }
  function renderProgress() {
    overview(); const c = session.current;
    if (!c) return;
    const setting = session.gems[c.leafId][c.level];
    $('testHeading').textContent = catalog[c.leafId].name;
    $('testLevel').textContent = catalog[c.leafId].labels[c.level];
    $('testCurrentBars').replaceChildren(...[1,2,3].map(level => {
      const states = session.selected.filter(id => catalog[id].levels.includes(level)).map(id => summary(id,level));
      const score = states.length ? states.reduce((sum,state) => sum + (state.score || 0),0)/states.length : null;
      const colour = ['Gold','Green','Purple'][level-1], mastered = states.length && states.every(state => state.score > .8);
      const judgement = !states.length ? 'No available questions' : states.every(state => state.score === null) ? 'Not assessed' : mastered ? 'Mastered across selected gems' : 'Developing mastery';
      const box = document.createElement('div'), label = document.createElement('span'); label.textContent = colour;
      box.dataset.level = level; box.title = colour + ': ' + judgement + (score === null ? '' : ' (' + Math.round(score*100) + '% overall)');
      const bar = alevel ? M.bar(score,box.title,level) : M.masteryBar(score,box.title,level);
      box.append(label,bar); return box;
    }));
    $('testReason').textContent = c.result ? 'Review your feedback, then choose Next question.' : setting.mode === 'check'
      ? `Quick check of earlier mastery · ${setting.required === 1 ? 'one independent correct answer' : 'two consecutive independent correct answers'} needed.`
      : 'Build mastery at this level.' + (session.selected.length > 1 ? ' Questions alternate between your selected gems.' : ' Each secure level leads to the next.');
  }
  function finish() {
    stopFrame(); $('testLoadStatus').textContent = ''; $('testFinish').hidden = false;
    $('testQuestionTitle').textContent = '';
    $('testHeading').textContent = 'Revision complete'; $('testLevel').textContent = ''; $('testReason').textContent = '';
    $('testCurrentBars').replaceChildren(); $('testOverview').open = true;
    const gained = session.selected.reduce((n,leaf) => n + Object.values(session.gems[leaf]).filter(s => !(s.initialScore > 0.8)).length,0);
    $('testGained').textContent = `${session.submitted} questions assessed · ${gained} additional levels mastered.`;
    overview(); save(); $('testHeading').focus();
  }
  function loadQuestion() {
    stopFrame(); $('testError').hidden = true; $('testFinish').hidden = true;
    if (!session.current) { finish(); return; }
    renderProgress(); $('testQuestionTitle').textContent = ''; const c = session.current;
    frame = document.createElement('iframe'); frame.id = 'testQuestionFrame'; frame.title = `${catalog[c.leafId].name} — ${catalog[c.leafId].labels[c.level]} question`;
    const url = new URL(catalog[c.leafId].href,document.baseURI);
    Object.entries({leaf:c.leafId,practice:alevel?'level':'grade',level:c.level,grade:c.level,mode:'pupil',testSession:session.id,testAttempt:c.attemptId}).forEach(([k,v]) => url.searchParams.set(k,v));
    frame.src = url.href; $('testLoadStatus').textContent = 'Loading question…'; $('testFrameHost').append(frame);
    timer = setTimeout(() => { $('testLoadStatus').textContent = ''; $('testError').hidden = false; },15000);
  }
  function start(resume) {
    refresh(); leaveSelection();
    if (!resume) session = C.create([...selection],catalog,summary,Date.now(),uuid());
    session.active = true; $('testRevision').hidden = false; map.hidden = true;
    document.body.classList.add('test-revising');
    if (!session.current) C.next(session,summary,Date.now(),uuid());
    save(); loadQuestion(); $('testHeading').focus(); tile.setAttribute('aria-label','Revision: choose gems');
  }
  function persistEvidence(item) {
    if (alevel) { if (!M.record(item)) warn(); }
    else {
      refresh(); records = M.append(records,item);
      try { localStorage.setItem(M.key,JSON.stringify(records)); } catch (_) { warn(); }
    }
  }
  window.addEventListener('message', event => {
    const d = event.data, c = session?.current;
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || !d || d.channel !== 'masters-test-mode' ||
      d.sessionId !== session.id || d.attemptId !== c?.attemptId) return;
    if (d.type === 'ready') {
      frame.contentWindow.postMessage({channel:d.channel,type:'init',sessionId:session.id,attemptId:c.attemptId,
        payload:{leafId:c.leafId,level:c.level,state:c.state,previous:session.previous[c.leafId+':'+c.level] || null}},location.origin === 'null' ? '*' : location.origin);
    } else if (d.type === 'title') {
      if (typeof d.payload?.title === 'string') $('testQuestionTitle').textContent = d.payload.title.slice(0,250);
    } else if (d.type === 'resize') {
      if (Number.isFinite(d.payload?.height)) frame.style.height = Math.max(420,Math.min(12000,d.payload.height)) + 'px';
    } else if (d.type === 'state') {
      if (d.payload && typeof d.payload === 'object') { clearTimeout(timer); $('testLoadStatus').textContent = ''; c.state = d.payload; save(); }
    } else if (d.type === 'result') {
      if (c.result || !C.validResult(d.payload,Date.now())) return;
      if (d.payload.evidence !== null) {
        const item = {...d.payload.evidence,id:c.attemptId,leafId:c.leafId,[alevel?'level':'grade']:c.level,completedAt:d.payload.completedAt};
        session.evidence.push(item); save(); persistEvidence(item);
      }
      refresh(); C.accept(session,d.payload,summary,Date.now()); save(); renderProgress();
    } else if (d.type === 'next' && c.result) {
      refresh(); C.next(session,summary,Date.now(),uuid()); save(); loadQuestion(); $('testHeading').focus();
    } else if (d.type === 'error') { clearTimeout(timer); $('testLoadStatus').textContent = ''; $('testError').hidden = false; }
  });
  tile.onclick = () => { if (selecting) leaveSelection(); else selectGems(); };
  $('testStart').onclick = () => {
    if (!selection.size) return;
    const resume = Boolean(session && session.selected.length === selection.size && session.selected.every(id => selection.has(id)));
    start(resume);
  };
  $('testClear').onclick = () => { selection.clear(); drawSelection(); };
  $('testCancel').onclick = () => { leaveSelection(); tile.focus(); };
  $('testChange').onclick = selectGems; $('testReturnSelection').onclick = selectGems;
  $('testPause').onclick = () => { session.active = false; save(); stopFrame(); document.body.classList.remove('test-revising'); $('testRevision').hidden = true; map.hidden = false; tile.setAttribute('aria-label','Revision: choose gems'); tile.focus(); window.dispatchEvent(new Event('storage')); };
  $('testRetry').onclick = loadQuestion;
  $('testAgain').onclick = () => { selection = new Set(session.selected); start(false); };
  window.addEventListener('storage',event => {
    refresh();
    if (session && event.key === key && event.newValue) {
      try { const other = JSON.parse(event.newValue); if (C.valid(other,catalog)) {
        session = other; stopFrame(); document.body.classList.remove('test-revising'); $('testRevision').hidden = true; map.hidden = false;
        $('testSaveStatus').hidden = false; $('testSaveStatus').textContent = 'Revision changed in another tab. Select Revision, then GO to continue from its saved position.';
      }} catch (_) {}
    }
    if (session && !$('testRevision').hidden) renderProgress();
  });
  refresh(); session = load();
  if (session) {
    // Replay an interrupted evidence write before accepting further questions. IDs deduplicate it.
    for (const item of session.evidence) { try { persistEvidence(item); } catch (_) {} }
    tile.setAttribute('aria-label','Revision: choose gems'); selection = new Set(session.selected);
    if (session.active) start(true);
  }
})();
