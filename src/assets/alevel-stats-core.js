(function (root) {
  'use strict';
  const DAY = 86400000;
  function catalogue(hierarchy, config, activities) {
    return hierarchy.flatMap(group => group.topics.map(([number, name, names]) => ({
      id: `${group.key}-${number}`, name, year: group.key.slice(0, 2), group: group.name,
      gems: names.map((name, index) => {
        const id = `${group.key}-${number}-${index + 1}`;
        return {id, name, settings: activities[id] ? config[id] : undefined};
      })
    })));
  }
  function partition(records, config) {
    const current = [], historical = [];
    for (const record of records) {
      const settings = config[record.leafId];
      const version = record.progressionVersion ?? 1;
      (settings && version === settings.progressionVersion && settings.availableGrades.includes(record.level)
        ? current : historical).push(record);
    }
    return {current, historical};
  }
  function filter(records, year, days, now) {
    const cutoff = days ? now - days * DAY : 0;
    return records.filter(record => (year === 'all' || record.leafId.startsWith(year + '-')) && record.completedAt >= cutoff);
  }
  function counts(records) {
    const result = {total: records.length, correct: 0, partial: 0, incorrect: 0, accuracy: null, latest: null,
      timed: 0, activeMs: 0, activeMsByOutcome: {correct: 0, partial: 0, incorrect: 0}, medianActiveMs: null};
    const durations = [];
    for (const record of records) {
      result[record.score === 1 ? 'correct' : record.score === 0.5 ? 'partial' : 'incorrect']++;
      result.latest = Math.max(result.latest || 0, record.completedAt);
      const timing = record.timing;
      if (timing?.version === 1 && Number.isSafeInteger(timing.activeMs) && timing.activeMs >= 0 && [60000,180000,300000,600000].includes(timing.idleLimitMs)) {
        durations.push(timing.activeMs);
        result.activeMsByOutcome[record.score === 1 ? 'correct' : record.score === 0.5 ? 'partial' : 'incorrect'] += timing.activeMs;
      }
    }
    if (result.total) result.accuracy = result.correct / result.total;
    durations.sort((a, b) => a - b);
    result.timed = durations.length; result.activeMs = durations.reduce((sum, value) => sum + value, 0);
    if (durations.length) {
      const middle = Math.floor(durations.length / 2);
      result.medianActiveMs = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
    }
    return result;
  }
  function timeline(records, days, now) {
    const bins = [];
    const midnight = value => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
    const first = records.reduce((earliest, record) => Math.min(earliest, record.completedAt), now);
    let start = midnight(days ? now - days * DAY : first);
    const end = midnight(now); end.setDate(end.getDate() + 1);
    // Calendar days remain individual bars, including in All time. Advance by
    // local date rather than 24 hours so daylight-saving days stay contiguous.
    const daily = new Map();
    for (const record of records) {
      const key = +midnight(record.completedAt);
      if (!daily.has(key)) daily.set(key, []);
      daily.get(key).push(record);
    }
    while (start < end) {
      const next = new Date(start); next.setDate(next.getDate() + 1);
      bins.push({start: +start, end: +next, counts: counts(daily.get(+start) || [])}); start = next;
    }
    const peak = bins.reduce((max, bin) => Math.max(max, bin.counts.activeMs), 0);
    const tick = Math.max(60000, Math.ceil(peak / 4 / 60000) * 60000);
    return {bins, unit: 'day', maximum: tick * 4, tick};
  }
  function build({records, topics, config, weightedScore, threshold, year = 'all', days = 0, now = Date.now()}) {
    const split = partition(records, config);
    const supported = new Set(topics.flatMap(topic => topic.gems.filter(gem => gem.settings).map(gem => gem.id)));
    const current = filter(split.current.filter(record => supported.has(record.leafId)), year, days, now);
    const visibleTopics = topics.filter(topic => (year === 'all' || topic.year === year) && topic.gems.some(gem => gem.settings));
    let mastered = 0, availableLevels = 0;
    const rows = visibleTopics.map(topic => ({...topic,
      counts: counts(current.filter(record => topic.gems.some(gem => gem.id === record.leafId))),
      gems: topic.gems.map(gem => {
        const attempts = current.filter(record => record.leafId === gem.id);
        const levels = [1, 2, 3].map(level => {
          if (!gem.settings?.availableGrades.includes(level)) return {level, available: false};
          // Share the app's exact recurrence, using this fresh history snapshot so
          // removals in another tab cannot leave stale in-memory mastery behind.
          const evidence = split.current.filter(record => record.leafId === gem.id && record.level === level);
          const score = weightedScore(evidence.map(record => record.score), config[gem.id].halfLives[level]);
          const state = {score, mastered: score !== null && score > threshold, count: evidence.length};
          availableLevels++; if (state.mastered) mastered++;
          return {level, available: true, label: gem.settings.levelLabels[level], state,
            counts: counts(attempts.filter(record => record.level === level))};
        });
        return {...gem, counts: counts(attempts), levels, recent: attempts.slice(-20)};
      })
    }));
    return {topics: rows, counts: counts(current), timeline: timeline(current, days, now), practised: new Set(current.map(record => record.leafId)).size,
      availableGems: visibleTopics.reduce((n, topic) => n + topic.gems.filter(gem => gem.settings).length, 0),
      mastered, availableLevels, historical: filter(split.historical, year, days, now)};
  }
  root.ALevelStats = Object.freeze({catalogue, partition, filter, counts, timeline, build});
})(globalThis);
