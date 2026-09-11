(function () {
  'use strict';
  const groups = globalThis.MASTERS_HIERARCHY, activities = globalThis.MASTERS_ACTIVITIES;
  const progress = globalThis.ALevelMastery;
  const grid = document.getElementById('yearGrid'), dialog = document.getElementById('gemDetails');
  const flip = document.getElementById('flipYear');
  const years = new Map(), faces = new Map(), gems = new Map(), topics = new Map();
  let activeYear = 'l6', teacher = 't1', selected = null;
  const icon = '<svg viewBox="-14 -16 28 34" aria-hidden="true"><path class="gem-body" d="M0 -13 L10.5 -4 L8 7.5 L0 14 L-8 7.5 L-10.5 -4 Z"/><path class="gem-facet" d="M0 -13 L0 6 L-8 7.5 L-10.5 -4 Z"/><path class="gem-facet second" d="M0 6 L8 7.5 L0 14 Z"/></svg>';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setHash(id) {
    try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (_) {}
  }
  const YEAR_KEY = 'masters-alevel-year-v1';
  function savedYear() {
    try { return localStorage.getItem(YEAR_KEY) === 'u6' ? 'u6' : 'l6'; } catch (_) { return 'l6'; }
  }
  function drawStats(id) {
    const container = document.getElementById('detailStats');
    if (Object.hasOwn(progress.config, id)) {
      progress.renderChoices(container, {leafId: id, href: activities[id].href});
    } else {
      container.classList.remove('practice-choices');
      container.replaceChildren(element('p', 'mastery-status', 'Not assessed'), element('p', 'mastery-note', 'No practice activity is available yet.'));
    }
  }
  function refreshProgress() {
    progress.refresh();
    for (const [id, button] of gems) {
      if (!Object.hasOwn(progress.config, id)) continue;
      const award = progress.achievement(id);
      const state = award.level ? award.states[award.level - 1] : award.states.find(s => s.score !== null);
      button.dataset.masteryGrade = award.level;
      for (const cls of ['fresh', 'steady', 'due', 'unstarted']) button.classList.toggle(cls, cls === (state?.freshness || 'unstarted'));
      button.setAttribute('aria-label', button.gem.name + ', ' + (award.level ? 'Level ' + award.level + ' mastered' : 'no level mastered yet') + ', practice available');
    }
    if (selected) drawStats(selected.gem.id);
  }
  function activate(year, side, updateHash = true) {
    activeYear = year; teacher = side;
    for (const item of years.values()) item.card.classList.toggle('is-flipped', year === 'u6');
    for (const [key, face] of faces) {
      const active = key.startsWith(year);
      face.inert = !active; face.setAttribute('aria-hidden', String(!active));
    }
    flip.setAttribute('aria-checked', String(year === 'u6'));
    try { localStorage.setItem(YEAR_KEY, year); } catch (_) {}
    if (updateHash) setHash(year + '-' + side);
  }
  function openGem(button, updateHash = true) {
    const gem = button.gem, activity = activities[gem.id];
    activate(gem.year, gem.teacher, false);
    if (!updateHash) expandTopic(button.closest('.topic-section').dataset.topic, true, false);
    if (selected) selected.setAttribute('aria-expanded', 'false');
    selected = button; button.setAttribute('aria-expanded', 'true');
    document.getElementById('detailPath').textContent = `${gem.groupName} · ${gem.topicName}`;
    document.getElementById('detailName').textContent = gem.name;
    document.getElementById('activityStatus').textContent = activity ? 'Practice available' : 'No activity available yet';
    document.getElementById('activityNote').textContent = activity ? activity.note : 'A practice activity has not yet been added for this subtopic.';
    refreshProgress();
    const link = document.getElementById('activityLink'); link.hidden = !activity || Boolean(activity.mastery);
    if (activity) { link.href = activity.href; link.textContent = 'Open ' + activity.label; }
    else { link.removeAttribute('href'); link.textContent = ''; }
    dialog.style.setProperty('--accent', gem.colour);
    if (!dialog.open) dialog.showModal();
    if (updateHash) setHash(gem.id);
  }
  function expandTopic(id, expanded, updateHash = true) {
    const item = topics.get(id); if (!item) return;
    const moving = [...topics.values()].filter(other => other.section.parentElement === item.section.parentElement &&
      other.section.classList.contains('expanded') !== (other === item && expanded));
    const animate = updateHash && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const before = moving.map(other => {
      // Finish any earlier transition before measuring a new layout.
      other.section.getAnimations({subtree: true}).forEach(animation => animation.finish());
      const row = other.section.querySelector('.topic-gems'), bounds = row.getBoundingClientRect();
      return {other, row, height: bounds.height, icons: [...row.querySelectorAll('svg')].map(icon => {
        const rect = icon.getBoundingClientRect();
        return {icon, x: rect.left - bounds.left, y: rect.top - bounds.top};
      })};
    });
    for (const other of moving) {
      const open = other === item && expanded;
      other.section.classList.toggle('expanded', open);
      other.trigger.setAttribute('aria-expanded', String(open));
    }
    if (animate) for (const state of before) {
      const bounds = state.row.getBoundingClientRect();
      const timing = {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'};
      for (const {icon, x, y} of state.icons) {
        const rect = icon.getBoundingClientRect();
        icon.animate([
          {transform: `translate(${x - (rect.left - bounds.left)}px, ${y - (rect.top - bounds.top)}px)`},
          {transform: 'translate(0, 0)'}
        ], timing);
      }
      state.row.animate([{height: state.height + 'px'}, {height: bounds.height + 'px'}], timing);
      if (state.other.section.classList.contains('expanded')) {
        state.row.querySelectorAll('.gem-name').forEach(name => name.animate(
          [{opacity: 0}, {opacity: 0, offset: .25}, {opacity: 1}], timing));
      }
    }
    if (updateHash) setHash(expanded ? id : item.group);
  }
  ['t1', 't2'].forEach(side => {
    const stage = element('div', 'flip-stage'); stage.id = side + '-stage';

    const card = element('div', 'flip-card'); card.id = side + '-card'; stage.append(card); grid.append(stage);
    years.set(side, {stage, card});
    groups.filter(group => group.key.endsWith(side)).forEach(group => {
      const year = group.key.startsWith('u6') ? 'u6' : 'l6';
      const face = element('section', 'year-card ' + (year === 'u6' ? 'back' : 'front'));
      face.id = group.key; face.style.setProperty('--accent', group.colour);
      face.setAttribute('aria-labelledby', 'heading-' + group.key);
      const header = element('header', 'year-heading'), heading = element('h2', '', side === 't1' ? 'Physical' : 'Organic');
      heading.id = 'heading-' + group.key; header.append(heading, element('p', 'subject-label', year === 'l6' ? 'Lower Sixth' : 'Upper Sixth')); face.append(header);
      const topicGrid = element('div', 'year-topics'); face.append(topicGrid);
      const columns = [element('div', 'topic-column'), element('div', 'topic-column')];
      topicGrid.append(...columns);
      const split = Math.ceil(group.topics.length / 2);
      group.topics.forEach(([number, topicName, names], topicIndex) => {
        const topic = element('section', 'topic-section'), title = element('h3');
        const topicId = `${group.key}-topic-${number}`;
        title.id = topicId; topic.dataset.topic = topicId; topic.setAttribute('aria-labelledby', title.id);
        const trigger = element('button', 'topic-trigger');
        trigger.type = 'button'; trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', topicId + '-gems');
        trigger.append(element('span', '', topicName)); title.append(trigger);
        const row = element('div', 'topic-gems'); row.id = topicId + '-gems';
        topics.set(topicId, {section:topic, trigger, group:group.key});
        topic.addEventListener('click', event => {
          if (event.target.closest('.gem')) return;
          activeYear = year; expandTopic(topicId, trigger.getAttribute('aria-expanded') !== 'true');
        });
        names.forEach((name, index) => {
          const id = `${group.key}-${number}-${index + 1}`, activity = activities[id];
          if (globalThis.MASTERS_DISPLAY.hiddenGems.includes(id)) return;
          const button = element('button', 'gem' + (activity ? ' available' : ' unavailable'));
          button.type = 'button'; button.dataset.leaf = id; button.title = name;
          button.setAttribute('aria-label', name + (activity ? ', practice available' : ', no activity available yet'));
          button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'gemDetails'); button.setAttribute('aria-expanded', 'false');
          button.innerHTML = icon;
          button.append(element('span', 'gem-name', name));
          button.gem = {id, name, year, teacher: side, groupName: group.name, topicName, colour: group.colour};
          button.addEventListener('click', () => openGem(button)); row.append(button); gems.set(id, button);
        });
        topic.append(title, row); columns[topicIndex < split ? 0 : 1].append(topic);
      });
      card.append(face); faces.set(group.key, face);
    });
  });
  flip.addEventListener('click', () => activate(activeYear === 'l6' ? 'u6' : 'l6', teacher));
  dialog.addEventListener('close', () => {
    if (dialog.open || !selected) return;
    const button = selected; selected = null; button.setAttribute('aria-expanded', 'false');
    if (location.hash === '#' + button.gem.id) setHash(`${button.gem.year}-${button.gem.teacher}`);
    if (!button.closest('[inert]')) button.focus({preventScroll: true});
  });
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  function readHash() {
    const original = location.hash.slice(1);
    const id = globalThis.MASTERS_DISPLAY.redirects[original] || original;
    if (id !== original) setHash(id);
    if (gems.has(id)) openGem(gems.get(id), false);
    else {
      if (dialog.open) dialog.close();
      const match = /^(l6|u6)-(t1|t2)(?:-topic-\d+)?$/.exec(id);
      activate(match ? match[1] : savedYear(), match ? match[2] : 't1', false);
      if (topics.has(id)) expandTopic(id, true, false);
    }
  }
  window.addEventListener('hashchange', readHash);
  window.addEventListener('pageshow', () => { refreshProgress(); readHash(); });
  window.addEventListener('storage', refreshProgress);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProgress(); });
  refreshProgress(); readHash();
  // Paint the remembered year before enabling subsequent card flips.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('navigation-ready')));
})();
