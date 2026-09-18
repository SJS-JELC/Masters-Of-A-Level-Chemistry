(function () {
  'use strict';
  const M = ALevelMastery, S = ALevelStats;
  const topics = S.catalogue(MASTERS_HIERARCHY, M.config, MASTERS_ACTIVITIES);
  const names = new Map(topics.flatMap(topic => topic.gems.map(gem => [gem.id, gem.name])));
  const $ = id => document.getElementById(id);
  const date = timestamp => new Date(timestamp).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  const number = value => value.toLocaleString('en-GB');
  function duration(ms) {
    if (ms === null || ms === undefined) return 'Time not recorded';
    const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60);
    if (seconds < 1) return '<1 s';
    if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
  }
  const outcome = score => score === 1 ? ['correct', '✓', 'Correct'] : score === 0.5 ? ['partial', '◐', 'Partly correct'] : ['incorrect', '×', 'Incorrect'];
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function outcomes(counts) {
    const box = node('div', 'stats-topic-results'), bar = node('div', 'stats-stack');
    bar.setAttribute('aria-hidden', 'true');
    for (const key of ['correct', 'partial', 'incorrect']) {
      const segment = node('span', key);
      segment.style.width = (counts.total ? counts[key] / counts.total * 100 : 0) + '%';
      bar.append(segment);
    }
    box.append(bar, node('p', 'stats-outcome-text', counts.total
      ? `${number(counts.correct)} correct · ${number(counts.partial)} partly correct · ${number(counts.incorrect)} incorrect`
      : 'No recorded responses in this period'));
    return box;
  }
  function metric(title, value, note) {
    const box = node('article', 'stats-metric');
    box.append(node('h2', '', title), node('p', 'stats-number', value), node('p', '', note));
    return box;
  }
  function drawTimeline(data, days) {
    const {bins, maximum, tick} = data.timeline;
    const compact = days === 30;
    const period = days ? `${days === 1 ? 'Last 24 hours' : `Last ${days} days`} · daily totals (edge days may be partial)` : 'All time · daily totals';
    $('statsChartPeriod').textContent = period;
    $('statsChartTotal').textContent = `${data.counts.timed ? duration(data.counts.activeMs) : 'No time recorded'} · ${number(data.counts.timed)} of ${number(data.counts.total)} attempts timed`;
    $('statsChartEmpty').hidden = data.counts.timed > 0;
    $('statsChartDetail').textContent = 'Select a bar for the full breakdown.';
    const axis = $('statsChartAxis'); axis.replaceChildren();
    for (let i = 4; i >= 0; i--) {
      const label = node('span', '', i ? duration(i * tick) : '0 min'); label.style.bottom = (i * 45 + 30) + 'px'; axis.append(label);
    }
    const bars = $('statsChartBars'); bars.style.setProperty('--chart-columns', bins.length);
    bars.classList.toggle('stats-chart-month', compact);
    bars.replaceChildren(...bins.map(bin => {
      const column = node('div', 'stats-chart-column'), button = node('button', 'stats-chart-bar'); button.type = 'button';
      const start = new Date(bin.start);
      const label = compact ? `${start.getDate()}/${start.getMonth() + 1}` : start.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
      const time = ms => ms === 0 ? '0 s' : duration(ms);
      const detail = `${date(bin.start)}: ${time(bin.counts.activeMs)} recorded active time — ${time(bin.counts.activeMsByOutcome.correct)} correct, ${time(bin.counts.activeMsByOutcome.partial)} partly correct, ${time(bin.counts.activeMsByOutcome.incorrect)} incorrect. ${number(bin.counts.total - bin.counts.timed)} attempts without recorded time.`;
      button.setAttribute('aria-label', detail); button.title = detail;
      button.dataset.total = bin.counts.total;
      button.dataset.activeMs = bin.counts.activeMs;
      const stack = node('span', 'stats-chart-stack'); stack.setAttribute('aria-hidden', 'true');
      stack.style.height = bin.counts.activeMs / maximum * 180 + 'px';
      for (const key of ['correct', 'partial', 'incorrect']) {
        const segment = node('span', key); segment.dataset.activeMs = bin.counts.activeMsByOutcome[key]; segment.style.height = (bin.counts.activeMs ? bin.counts.activeMsByOutcome[key] / bin.counts.activeMs * 100 : 0) + '%'; stack.append(segment);
      }
      const total = node('span', 'stats-chart-value', bin.counts.activeMs ? duration(bin.counts.activeMs) : ''); total.setAttribute('aria-hidden', 'true'); total.style.bottom = (bin.counts.activeMs / maximum * 180 + 4) + 'px';
      if (!compact) button.append(total);
      button.append(stack);
      const show = () => { $('statsChartDetail').textContent = detail; };
      button.addEventListener('focus', show); button.addEventListener('click', show); button.addEventListener('pointerenter', show);
      column.append(button, node('span', 'stats-chart-label', label)); return column;
    }));
  }
  function gemRow(gem, limited) {
    const box = node('section', 'stats-gem'); box.dataset.gem = gem.id;
    box.append(node('h3', '', gem.name));
    if (!gem.settings) { box.append(node('p', 'stats-outcome-text', 'Not available · no tracked assessment')); return box; }
    box.append(node('p', 'stats-outcome-text', `${number(gem.counts.total)} recorded attempts${gem.counts.latest ? ' · Last in period: ' + date(gem.counts.latest) : ''}`));
    box.append(node('p', 'stats-outcome-text', gem.counts.timed
      ? `Estimated active time: ${duration(gem.counts.activeMs)} · ${gem.counts.timed} of ${gem.counts.total} attempts timed`
      : 'Time not recorded'));
    const levels = node('div', 'stats-levels');
    for (const level of gem.levels) {
      const card = node('div', 'stats-level' + (level.available ? '' : ' unavailable'));
      card.dataset.level = level.level;
      card.append(node('h4', '', level.label || `Level ${level.level}`));
      if (!level.available) card.append(node('p', '', 'Not available'));
      else {
        const value = level.state.score;
        card.append(M.bar(value, `${gem.name}, Level ${level.level}: current mastery`, level.level));
        const counts = node('div', 'stats-level-counts');
        counts.setAttribute('role', 'group');counts.setAttribute('aria-label', 'Question outcomes in the selected period');
        for(const [key,symbol,label] of [['correct','✓','Correct'],['partial','◐','Partially correct'],['incorrect','×','Incorrect']]){
          const square=node('span', `stats-count-square ${key}`);
          const description=`${label}: ${number(level.counts[key])} questions in the selected period`;
          square.setAttribute('role','img');square.setAttribute('aria-label',description);square.title=description;
          const icon=node('span','stats-count-icon',symbol),total=node('span','stats-count-number',number(level.counts[key]));
          icon.setAttribute('aria-hidden','true');total.setAttribute('aria-hidden','true');
          square.append(icon,total);counts.append(square);
        }
        card.append(counts);
      }
      levels.append(card);
    }
    box.append(levels);
    if (gem.recent.length) {
      box.append(node('p', 'stats-recent-note', `Latest ${gem.recent.length} results${limited ? ' in this period' : ''} · oldest → newest`));
      const list = node('ol', 'stats-recent'); list.setAttribute('aria-label', 'Recent recorded results, oldest first');
      const detail = node('p', 'stats-result-detail', 'Select a result for its level and date.');
      for (const record of gem.recent) {
        const [kind, symbol, label] = outcome(record.score);
        const item = node('li'), button = node('button', kind, symbol);
        const description = `${label} · Level ${record.level} · ${new Date(record.completedAt).toLocaleString('en-GB')} · ${record.timing ? 'Estimated active time: ' + duration(record.timing.activeMs) : 'Time not recorded'}`;
        button.type = 'button'; button.title = description; button.setAttribute('aria-label', description);
        button.addEventListener('focus', () => { detail.textContent = description; });
        button.addEventListener('click', () => { detail.textContent = description; });
        item.append(button);
        list.append(item);
      }
      box.append(list, detail);
    }
    return box;
  }
  function storageNotice() {
    const issues = [];
    try {
      for (const key of [M.key, M.acidKey]) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || M.clean(parsed).length !== parsed.length) issues.push('Some saved results are invalid or repeated; only valid, unique attempts are shown.');
          } catch (_) { issues.push('Some saved results could not be read. Other valid saved results are still shown.'); }
        }
      }
    } catch (_) { issues.push('This browser is not allowing access to saved results. Stats cannot read your history here.'); }
    $('statsNotice').hidden = !issues.length;
    $('statsNotice').textContent = [...new Set(issues)].join(' ');
  }
  function render() {
    const open = new Set([...document.querySelectorAll('.stats-topic[open]')].map(topic => topic.dataset.topic));
    // Read fresh persisted history without changing any evidence or session state.
    storageNotice();
    const year = $('statsYear').value, days = Number($('statsPeriod').querySelector('[aria-pressed="true"]').dataset.days);
    const data = S.build({records: M.history(), topics, config: M.config, weightedScore: M.weightedScore, threshold: M.threshold, year, days});
    drawTimeline(data, days);
    $('statsOverview').replaceChildren(
      metric('Recorded attempts', number(data.counts.total), days === 1 ? 'In the last 24 hours' : days ? `In the last ${days} days` : 'Across all current practice'),
      metric('Fully correct', data.counts.accuracy === null ? '—' : Math.round(data.counts.accuracy * 100) + '%', `${number(data.counts.correct)} of ${number(data.counts.total)} recorded attempts`),
      metric('Gems practised', number(data.practised), `Of ${data.availableGems} supported gems · selected period`),
      metric('Levels mastered', `${data.mastered} / ${data.availableLevels}`, 'Current mastery · all current-progression attempts'),
      metric('Estimated active time', data.counts.timed ? duration(data.counts.activeMs) : '—', `${data.counts.timed} of ${data.counts.total} attempts timed · selected period`)
    );
    $('statsEmpty').hidden = data.counts.total > 0;
    $('statsEmpty').textContent = days ? 'No recorded responses in this period. Try All time or practise a supported gem.' : 'Your stats start with your first recorded attempt. Practise a supported gem, then return here to see your progress.';
    const rows = data.topics.map(topic => {
      const details = node('details', 'stats-topic'); details.dataset.topic = topic.id; details.open = open.has(topic.id);
      const summary = node('summary'), heading = node('div');
      heading.append(node('span', 'stats-topic-meta', topic.group), node('strong', 'stats-topic-name', topic.name),
        node('span', 'stats-topic-meta', `${number(topic.counts.total)} attempts${topic.counts.latest ? ' · Last in period: ' + date(topic.counts.latest) : ''}`));
      summary.append(heading, outcomes(topic.counts));
      const gems = node('div', 'stats-gems'); gems.append(...topic.gems.map(gem => gemRow(gem, Boolean(days))));
      details.append(summary, gems); return details;
    });
    $('statsTopicList').replaceChildren(...rows);
    $('statsHistoryCount').textContent = `(${number(data.historical.length)} ${data.historical.length === 1 ? 'attempt' : 'attempts'})`;
    const history = new Map();
    for (const record of data.historical) {
      const key = `${record.leafId}:${record.level}:${record.progressionVersion ?? 1}`;
      if (!history.has(key)) history.set(key, []);
      history.get(key).push(record);
    }
    $('statsHistoryRows').replaceChildren(...[...history.values()].map(records => {
      const first = records[0], row = node('div', 'stats-history-row');
      row.append(node('strong', '', `${names.get(first.leafId) || first.leafId} · Level ${first.level} · progression ${first.progressionVersion ?? 1}`), outcomes(S.counts(records)));
      return row;
    }));
    if (!history.size) $('statsHistoryRows').append(node('p', '', 'No earlier practice history in this selection.'));
    $('statsAnnouncement').textContent = `${number(data.counts.total)} recorded attempts across ${data.topics.length} topics. ${data.mastered} levels currently mastered.`;
  }
  $('statsYear').addEventListener('change', render);
  $('statsPeriod').addEventListener('click', event => {
    const selected = event.target.closest('button[data-days]'); if (!selected) return;
    for (const button of $('statsPeriod').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button === selected));
    render();
  });
  window.addEventListener('storage', event => { if (!event.key || [M.key, M.acidKey].includes(event.key)) render(); });
  window.addEventListener('focus', render);
  window.addEventListener('pageshow', render);
  render();
})();
