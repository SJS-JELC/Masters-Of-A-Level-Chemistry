(function () {
  'use strict';
  const core = MoleculeCore, data = MoleculeData, $ = id => document.getElementById(id);
  const reviewBank = QuestionReview.bank('MB',data.questions);
  function loadReview(id) {
    if(id.trim().toUpperCase().startsWith('ME-') && window.MechanismUI) { MechanismUI.loadReview(id); return; }
    const entry=reviewBank.get(id); if(window.MechanismUI?.active)MechanismUI.switchMode(false);
    questionIndex=data.questions.indexOf(entry); graph=core.empty(); history=[]; clearFeedback(); setQuestion(); render();
  }
  const canvas = $('canvas'), ns = 'http://www.w3.org/2000/svg';
  const LENGTH = 74, STEP = Math.PI / 6;
  let graph = core.empty(), history = [], element = 'C', order = 1, erasing = false, view = 'skeletal';
  let questionIndex = 0, drag = null, keyboard = null, feedback = null, chain = false;
  const listeners = new Set();
  const measure = document.createElement('canvas').getContext('2d');
  function svg(tag, attrs = {}, text) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text !== undefined) el.textContent = text;
    return el;
  }
  const say = message => { $('announcement').textContent = message; };
  const current = () => data.questions[questionIndex];
  function targetOf(node) {
    const atom = node.closest('[data-atom]');
    if (atom) return { kind: 'atom', id: Number(atom.dataset.atom) };
    const bond = node.closest('[data-bond]');
    if (bond) { const [a, b] = bond.dataset.bond.split(':').map(Number); return { kind: 'bond', a, b }; }
    return null;
  }
  function clearFeedback() {
    feedback = null;
    $('feedback').textContent = ''; $('feedback').removeAttribute('data-kind');
    $('afterCheck').hidden = true; $('answer').hidden = true;
    $('showAnswer').textContent = 'Show answer'; $('showAnswer').setAttribute('aria-expanded', 'false');
  }
  function commit(next) {
    core.assertGraph(next);
    if (JSON.stringify(next) === JSON.stringify(graph)) return false;
    history.push(core.clone(graph)); if (history.length > 100) history.shift();
    graph = core.clone(next); keyboard = null; clearFeedback(); render();
    listeners.forEach(fn => fn(core.clone(graph)));
    return true;
  }
  function undo() {
    if (!history.length) return;
    cancelGesture(); graph = history.pop(); clearFeedback(); render();
    listeners.forEach(fn => fn(core.clone(graph))); say('Last edit undone.');
  }
  function point(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(canvas.getScreenCTM().inverse());
  }
  function snap(start, end) {
    const angle = Math.round(Math.atan2(end.y - start.y, end.x - start.x) / STEP) * STEP;
    return { x: start.x + LENGTH * Math.cos(angle), y: start.y + LENGTH * Math.sin(angle) };
  }
  function destination(start, raw) {
    const scale = canvas.getScreenCTM().a || 1;
    const existing = graph.atoms.filter(a => a.id !== start.id && Math.hypot(a.x - raw.x, a.y - raw.y) <= 24 / scale)
      .sort((a, b) => Math.hypot(a.x - raw.x, a.y - raw.y) - Math.hypot(b.x - raw.x, b.y - raw.y))[0];
    return existing || snap(start, raw);
  }
  function labelFor(atom, graph) {
    const hs = core.hydrogens(graph, atom), edges = core.neighbours(graph, atom.id);
    if (view === 'skeletal' && atom.element === 'C' && edges.length) return null;
    const left = ['O', 'Cl', 'F'].includes(atom.element) && !edges.length || edges.length && edges.reduce((n, e) => n + graph.atoms.find(a => a.id === e.id).x - atom.x, 0) > 8;
    const h = hs > 0 ? 'H' : '', sub = hs > 1 ? String(hs) : '';
    const chunks = left ? [{ text: h }, { text: sub, sub: true }, { text: atom.element }] : [{ text: atom.element + h }, { text: sub, sub: true }];
    let width = 0;
    chunks.forEach(chunk => { measure.font = `700 ${chunk.sub ? 14 : 23}px Comfortaa`; chunk.width = measure.measureText(chunk.text).width; width += chunk.width; });
    measure.font = '700 23px Comfortaa';
    const elementWidth = measure.measureText(atom.element).width;
    const x = left ? atom.x + elementWidth / 2 - width : atom.x - elementWidth / 2;
    return { chunks, x, width, box: { left: x - 5, right: x + width + 5, top: atom.y - 15, bottom: atom.y + 17 } };
  }
  function endpoint(from, to, label) {
    if (!label) return from;
    const dx = to.x - from.x, dy = to.y - from.y, b = label.box;
    const tx = dx > 0 ? (b.right - from.x) / dx : dx < 0 ? (b.left - from.x) / dx : Infinity;
    const ty = dy > 0 ? (b.bottom - from.y) / dy : dy < 0 ? (b.top - from.y) / dy : Infinity;
    const t = Math.min(tx, ty, .44);
    return { x: from.x + dx * t, y: from.y + dy * t };
  }
  function bondLines(group, from, to, bondOrder) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    const offsets = bondOrder === 3 ? [-5,0,5] : bondOrder === 2 ? [-3.2, 3.2] : [0];
    offsets.forEach(offset => group.append(svg('line', { class: 'bond-line', x1: from.x - dy / length * offset, y1: from.y + dx / length * offset, x2: to.x - dy / length * offset, y2: to.y + dx / length * offset })));
  }
  function drawingViewBox(graph) {
    const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height;
    if (!w || !h) return canvas.getAttribute('viewBox');
    const extentX = Math.max(w / 2, ...graph.atoms.map(a => Math.abs(a.x) + 85));
    const extentY = Math.max(h / 2, ...graph.atoms.map(a => Math.abs(a.y) + 65));
    const scale = Math.max(extentX * 2 / w, extentY * 2 / h);
    return `${-w * scale / 2} ${-h * scale / 2} ${w * scale} ${h * scale}`;
  }
  function fit() {
    canvas.setAttribute('viewBox', drawingViewBox(graph));
  }
  function drawStructure(graph, bondLayer, atomLayer) {
    bondLayer.replaceChildren(); atomLayer.replaceChildren();
    const labels = new Map(graph.atoms.map(a => [a.id, labelFor(a, graph)]));
    const atoms = new Map(graph.atoms.map(a => [a.id, a]));
    for (const bond of graph.bonds) {
      const from = atoms.get(bond.a), to = atoms.get(bond.b);
      const group = svg('g', { class: 'bond-node', 'data-bond': `${bond.a}:${bond.b}`, tabindex: 0, role: 'button', 'aria-label': `${bond.order === 1 ? 'Single' : bond.order === 2 ? 'Double' : 'Triple'} bond between atom ${bond.a} and atom ${bond.b}` });
      group.append(svg('line', { class: 'bond-hit', x1: from.x, y1: from.y, x2: to.x, y2: to.y }));
      bondLines(group, endpoint(from, to, labels.get(from.id)), endpoint(to, from, labels.get(to.id)), bond.order);
      bondLayer.append(group);
    }
    for (const atom of graph.atoms) {
      const invalid = feedback?.atoms?.includes(atom.id), label = labels.get(atom.id);
      const hs = core.hydrogens(graph, atom);
      const group = svg('g', { class: `atom-node${invalid ? ' invalid' : ''}`, 'data-atom': atom.id, tabindex: 0, role: 'button', 'aria-label': `${core.names[atom.element]} atom ${atom.id}${hs >= 0 ? `, ${hs} implicit hydrogen${hs === 1 ? '' : 's'}` : invalid ? ', too many bonds' : ''}` });
      group.append(svg('circle', { class: 'atom-hit', cx: atom.x, cy: atom.y, r: 24 }));
      group.append(svg('circle', { class: 'focus-ring', cx: atom.x, cy: atom.y, r: 24 }));
      if (label) {
        const text = svg('text', { class: `atom-label element-${atom.element}`, x: label.x, y: atom.y });
        label.chunks.filter(c => c.text).forEach(c => text.append(svg('tspan', c.sub ? { class: 'atom-subscript' } : {}, c.text)));
        group.append(text);
      }
      if (invalid) group.append(svg('text', { class: 'invalid-mark', x: atom.x + 26, y: atom.y - 20 }, '!'));
      atomLayer.append(group);
    }
  }
  function depiction(graph) {
    const picture=svg('svg',{class:'stage-preview','aria-hidden':'true'}),bonds=svg('g'),atoms=svg('g'),annotations=svg('g');
    drawStructure(graph,bonds,atoms);picture.append(bonds,atoms,annotations);
    window.MechanismUI?.render(graph,annotations);
    // Stage previews share the editor viewport so selecting a stage does not zoom or pan.
    picture.setAttribute('viewBox',drawingViewBox(graph));
    picture.querySelectorAll('[tabindex]').forEach(el=>el.removeAttribute('tabindex'));
    return picture;
  }
  function render() {
    const focused = targetOf(document.activeElement);
    drawStructure(graph, $('bonds'), $('atoms'));
    fit(); renderPreview();
    window.MechanismUI?.render(graph);
    $('clean').disabled = graph.atoms.length < 2;
    $('undo').disabled = !history.length; $('clear').disabled = !graph.atoms.length;
    if (focused) focusTarget(focused);
  }
  function focusTarget(target) {
    const selector = target.kind === 'atom' ? `[data-atom="${target.id}"]` : `[data-bond="${target.a}:${target.b}"]`;
    const el = canvas.querySelector(selector); if (el) el.focus({ preventScroll: true });
  }
  function previewState() {
    if (drag?.moved && drag.target?.kind === 'atom' && !erasing) {
      const start = graph.atoms.find(a => a.id === drag.target.id);
      return { start, end: destination(start, drag.end) };
    }
    if (keyboard) {
      const start = graph.atoms.find(a => a.id === keyboard.id);
      return { start, end: destination(start, { x: start.x + LENGTH * Math.cos(keyboard.angle), y: start.y + LENGTH * Math.sin(keyboard.angle) }) };
    }
    return null;
  }
  function renderPreview() {
    const group = $('preview'); group.replaceChildren();
    if (drag?.moved && !erasing && (chain || !drag.target)) {
      const draft = gestureGraph(drag, drag.end), ghost = svg('g', { class: 'ghost' });
      for (const bond of draft.bonds.slice(graph.bonds.length)) {
        bondLines(ghost, draft.atoms.find(a => a.id === bond.a), draft.atoms.find(a => a.id === bond.b), bond.order);
      }
      draft.atoms.slice(graph.atoms.length).forEach(a => ghost.append(svg('circle', { cx: a.x, cy: a.y, r: 5, class: 'preview-end' })));
      group.append(ghost); return;
    }
    const state = previewState(); if (!state) return;
    const ghost = svg('g', { class: 'ghost' });
    bondLines(ghost, state.start, state.end, order);
    ghost.append(svg('circle', { cx: state.end.x, cy: state.end.y, r: 5, class: 'preview-end' }));
    if (state.end.id !== undefined) ghost.append(svg('circle', { cx: state.end.x, cy: state.end.y, r: 25, fill: 'none', class: 'preview-target', 'stroke-width': 2 }));
    group.append(ghost);
  }
  function cancelGesture() {
    if (drag && canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    drag = null; keyboard = null; renderPreview();
  }
  // Build a temporary graph so a whole drag is one undoable edit, and cancellation is lossless.
  function gestureGraph(state, end) {
    let draft = graph;
    if (state.target && state.target.kind !== 'atom') return draft;
    let start = state.target ? graph.atoms.find(a => a.id === state.target.id) : null;
    if (!start) {
      if ((element !== 'H' && core.heavyCount(graph) >= core.LIMIT || graph.atoms.length >= 100) || graph.atoms.some(a => Math.hypot(a.x - state.start.x, a.y - state.start.y) < 42)) return draft;
      draft = core.addAtom(draft, chain ? 'C' : element, state.start.x, state.start.y);
      start = draft.atoms.at(-1);
    }
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const count = chain ? Math.max(1, Math.round(distance / (LENGTH * Math.cos(STEP)))) : 1;
    const axis = Math.round(Math.atan2(end.y - start.y, end.x - start.x) / STEP) * STEP;
    for (let i = 0; i < Math.min(count, core.LIMIT); i++) {
      if ((element !== 'H' && core.heavyCount(draft) >= core.LIMIT || draft.atoms.length >= 100)) break;
      const angle = axis + (chain ? (i % 2 ? STEP : -STEP) : 0);
      const next = chain ? { x: start.x + LENGTH * Math.cos(angle), y: start.y + LENGTH * Math.sin(angle) } : destination(start, end);
      if (next.id !== undefined) return core.addBond(draft, start.id, next.id, order);
      if (draft.atoms.some(a => Math.hypot(a.x - next.x, a.y - next.y) < 42)) break;
      draft = core.addAtom(draft, chain ? 'C' : element, next.x, next.y, start.id, chain ? 1 : order);
      start = draft.atoms.at(-1);
    }
    return draft;
  }
  function grow(start, end) {
    if (end.id !== undefined) {
      if (commit(core.addBond(graph, start.id, end.id, order))) {
        say('Atoms connected.'); focusTarget({ kind: 'atom', id: end.id });
      } else say('Those atoms are already connected. Tap the bond to change its order.');
      return;
    }
    if ((element !== 'H' && core.heavyCount(graph) >= core.LIMIT || graph.atoms.length >= 100)) { say('This canvas holds up to twenty atoms. Erase an atom to make room.'); return; }
    if (graph.atoms.some(a => Math.hypot(a.x - end.x, a.y - end.y) < 42)) { say('That space is occupied. Try another direction.'); return; }
    if (commit(core.addAtom(graph, element, end.x, end.y, start.id, order))) {
      say(`${core.names[element]} added.`);
      focusTarget({ kind: 'atom', id: graph.atoms.at(-1).id });
    }
  }
  function apply(target, location) {
    if (erasing && target) { commit(core.remove(graph, target)); say('Removed.'); return; }
    if (erasing) return;
    if (target?.kind === 'atom') commit(core.setElement(graph, target.id, element));
    else if (target?.kind === 'bond') commit(core.toggleBond(graph, target.a, target.b));
    else if ((element !== 'H' && core.heavyCount(graph) >= core.LIMIT || graph.atoms.length >= 100)) say('This canvas holds up to twenty atoms.');
    else if (!graph.atoms.some(a => Math.hypot(a.x - location.x, a.y - location.y) < 42)) {
      commit(core.addAtom(graph, element, location.x, location.y));
      focusTarget({ kind: 'atom', id: graph.atoms.at(-1).id });
    }
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    event.preventDefault(); keyboard = null;
    const target = targetOf(event.target), start = point(event);
    if (target) focusTarget(target); else canvas.focus({ preventScroll: true });
    drag = { pointerId: event.pointerId, target, start, end: start, screenX: event.clientX, screenY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.end = point(event);
    drag.moved ||= Math.hypot(event.clientX - drag.screenX, event.clientY - drag.screenY) > 9;
    renderPreview();
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const state = drag, end = point(event), rect = canvas.getBoundingClientRect();
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { renderPreview(); return; }
    if (state.moved && !erasing && (chain || !state.target)) {
      if (Math.hypot(event.clientX - state.screenX, event.clientY - state.screenY) >= 18) {
        if (commit(gestureGraph(state, end))) {
          say(chain ? 'Carbon chain added. Undo removes this whole drag.' : 'Bond added.');
          focusTarget({ kind: 'atom', id: graph.atoms.at(-1).id });
        }
      }
    } else if (state.moved && state.target?.kind === 'atom' && !erasing) {
      if (Math.hypot(event.clientX - state.screenX, event.clientY - state.screenY) < 18) { renderPreview(); return; }
      const atom = graph.atoms.find(a => a.id === state.target.id);
      grow(atom, destination(atom, end));
    } else if (!state.moved) apply(state.target, state.start);
    renderPreview();
  });
  canvas.addEventListener('pointercancel', cancelGesture);
  canvas.addEventListener('lostpointercapture', () => { if (drag) { drag = null; renderPreview(); } });
  function updateTools() {
    cancelGesture();
    window.MechanismUI?.resetTool();
    document.querySelectorAll('[data-element]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.element === element && !erasing)));
    $('chain').setAttribute('aria-pressed', String(chain && !erasing));
    $('erase').setAttribute('aria-pressed', String(erasing));
    canvas.classList.toggle('erasing', erasing);
    window.MechanismUI?.render(graph);
  }
  document.querySelectorAll('[data-element]').forEach(b => b.addEventListener('click', () => { element = b.dataset.element; chain = false; erasing = false; updateTools(); }));
  function selectChain() { chain = !chain || erasing; element = 'C'; order = 1; erasing = false; updateTools(); }
  $('chain').addEventListener('click', selectChain);
  $('erase').addEventListener('click', () => { erasing = !erasing; updateTools(); });
  $('undo').addEventListener('click', undo);
  $('clean').addEventListener('click', () => {
    cancelGesture();
    const changed = commit(MoleculeLayout.clean(graph));
    say(changed ? 'Layout tidied. Connections are unchanged. Undo restores the original layout.' : 'The layout is already tidy.');
  });
  $('clear').addEventListener('click', () => { cancelGesture(); commit(core.empty()); say('Canvas cleared. Undo will restore it.'); });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    cancelGesture(); view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el === b)));
    render(); if (!$('answer').hidden) showAnswerImage();
  }));
  canvas.addEventListener('keydown', event => {
    const target = targetOf(event.target);
    if (event.key === 'Escape') { event.preventDefault(); cancelGesture(); return; }
    if (['Delete', 'Backspace'].includes(event.key) && target) { event.preventDefault(); cancelGesture(); commit(core.remove(graph, target)); canvas.focus(); return; }
    if (event.key.startsWith('Arrow') && target?.kind === 'atom' && !erasing) {
      event.preventDefault();
      keyboard = keyboard?.id === target.id ? keyboard : { id: target.id, angle: -STEP };
      if (event.key === 'ArrowLeft') keyboard.angle -= STEP;
      if (event.key === 'ArrowRight') keyboard.angle += STEP;
      if (event.key === 'ArrowUp') keyboard.angle = -Math.PI / 2;
      if (event.key === 'ArrowDown') keyboard.angle = Math.PI / 2;
      renderPreview(); return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const state = previewState();
      if (keyboard && state) { keyboard = null; grow(state.start, state.end); }
      else apply(target, { x: 0, y: 0 });
      renderPreview();
    }
  });
  canvas.addEventListener('focusout', () => { keyboard = null; renderPreview(); });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey) { if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); } return; }
    if (event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    const elementKeys = { c: 'C', o: 'O', n: 'N', f: 'F', l: 'Cl', h: 'H' };
    if (elementKeys[key]) { element = elementKeys[key]; chain = false; erasing = false; updateTools(); }
    if (key === '3') selectChain();
    if (key === 'e') { erasing = !erasing; updateTools(); }
  });
  $('check').addEventListener('click', () => {
    if (window.MechanismUI?.active) { cancelGesture(); MechanismUI.check(); return; }
    cancelGesture(); feedback = core.check(graph, current().graph);
    $('feedback').textContent = feedback.message; $('feedback').dataset.kind = feedback.kind;
    $('afterCheck').hidden = false; render();
  });
  function showAnswerImage() {
    $('answerName').textContent = current().name;
    $('answerImage').src = current().images[view];
    $('answerImage').alt = `${current().name}, ${view} formula. ${current().description}`;
  }
  $('showAnswer').addEventListener('click', () => {
    if (window.MechanismUI?.active) { MechanismUI.showAnswer(); return; }
    $('answer').hidden = !$('answer').hidden;
    $('showAnswer').textContent = $('answer').hidden ? 'Show answer' : 'Hide answer';
    $('showAnswer').setAttribute('aria-expanded', String(!$('answer').hidden));
    if (!$('answer').hidden) showAnswerImage();
  });
  $('next').addEventListener('click', () => {
    if (window.MechanismUI?.active) { MechanismUI.next(); return; }
    cancelGesture(); questionIndex = (questionIndex + 1) % data.questions.length;
    graph = core.empty(); history = []; element = 'C'; order = 1; erasing = false; chain = false;
    clearFeedback(); setQuestion(); updateTools(); render();
    listeners.forEach(fn => fn(core.clone(graph))); $('question').focus({ preventScroll: true });
  });
  function setQuestion() {
    QuestionReview.mount($('question').closest('.question-row').parentElement, reviewBank.id(current()), loadReview);
    $('question').textContent = `Draw ${current().name.toLowerCase()}.`;
    $('question').setAttribute('tabindex', '-1');
    $('questionNumber').innerHTML = `${String(questionIndex + 1).padStart(2, '0')} <span>/ ${String(data.questions.length).padStart(2, '0')}</span>`;
    $('questionNumber').setAttribute('aria-label', `Question ${questionIndex + 1} of ${data.questions.length}`);
    $('next').innerHTML = questionIndex === data.questions.length - 1 ? 'Start again <span aria-hidden="true">↻</span>' : 'Next question <span aria-hidden="true">→</span>';
  }
  window.MoleculeBuilder = Object.freeze({
    depiction,
    hasAtomLabel: (graph, atom) => Boolean(labelFor(atom, graph)),
    getGraph: () => core.clone(graph),
    exportState: () => ({graph:core.clone(graph),history:core.clone(history)}),
    importState: state => { cancelGesture(); graph=core.clone(state.graph); core.assertGraph(graph); history=core.clone(state.history||[]); clearFeedback(); render(); },
    refreshQuestion: setQuestion,
    loadReview,
    redraw: render,
    cancelGesture,
    annotationsMode: () => {cancelGesture();erasing=false;chain=false;document.querySelectorAll('[data-element],#chain,#erase').forEach(b=>b.setAttribute('aria-pressed','false'));},
    setGraph: next => { cancelGesture(); commit(core.assertGraph(core.clone(next))); },
    clear: () => { cancelGesture(); commit(core.empty()); },
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); }
  });
  new ResizeObserver(() => { if (!canvas.isConnected) return; cancelGesture(); render(); }).observe(canvas.parentElement);
  document.fonts.ready.then(render);
  setQuestion(); updateTools(); render();
})();
