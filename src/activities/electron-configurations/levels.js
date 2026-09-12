(function (root) {
  "use strict";
  const D = root.ElectronData;
  const C = root.ElectronCore;
  const LEAF_ID = "l6-t2-1-2";
  // Kept as a documented smoke-test target; sessions themselves are open-ended.
  // Fixed-level practice continues until the pupil leaves. MASTERY advances when
  // the shared evidence API reports the next level at the Next action.
  const TARGET = 10;
  const ALL_GROUPS = D.groups.map((group) => group.id);
  const ALL_REPRESENTATIONS = D.representations.map((representation) => representation.id);
  const LEVELS = Object.freeze({
    1: Object.freeze({ groups: ["main-atoms"], representations: ["full", "row", "energy"], matching: false }),
    2: Object.freeze({ groups: ["main-atoms", "main-ions"], representations: ALL_REPRESENTATIONS, matching: false }),
    3: Object.freeze({ groups: ALL_GROUPS, representations: ALL_REPRESENTATIONS, matching: true })
  });
  const GROUP_CYCLE = ["matching", "d-atoms", "d-ions", "main-atoms", "main-ions"];

  function random(session) {
    let n = session.rng >>> 0;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    session.rng = n >>> 0;
    return (session.rng >>> 0) / 4294967296;
  }
  function shuffle(session, values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random(session) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function config(level) {
    const value = LEVELS[Number(level)];
    if (!value) throw new Error("Electron practice level must be 1, 2 or 3.");
    return value;
  }
  function pool(session, group, representation) {
    return D.species.filter((item) => {
      if (group && item.group !== group) return false;
      if (!session.groups.includes(item.group)) return false;
      return representation !== "short" || C.coreOptions(item).length > 0;
    });
  }
  function usableRepresentations(session, group) {
    return session.representations.filter((representation) => pool(session, group, representation).length);
  }
  function representationFor(session, group) {
    const eligible = usableRepresentations(session, group);
    if (!eligible.length) throw new Error(`No questions are available for ${group}.`);
    const uses = session.representationUses[group] || {};
    const least = Math.min(...eligible.map((representation) => uses[representation] || 0));
    const candidates = eligible.filter((representation) => (uses[representation] || 0) === least);
    const chosen = shuffle(session, candidates)[0];
    uses[chosen] = (uses[chosen] || 0) + 1;
    session.representationUses[group] = uses;
    return chosen;
  }
  function directionFor(session, group) {
    const counts = session.directionUses;
    const groupCounts = session.groupDirectionUses[group] || { build: 0, identify: 0 };
    const direction = groupCounts.build < groupCounts.identify ? "build" : groupCounts.identify < groupCounts.build ? "identify" : session.nextDirection;
    counts[direction] += 1;
    groupCounts[direction] += 1;
    session.groupDirectionUses[group] = groupCounts;
    session.nextDirection = direction === "build" ? "identify" : "build";
    return direction;
  }
  function attemptId(session) {
    try {
      if (root.ALevelMastery && typeof root.ALevelMastery.attemptId === "function") return root.ALevelMastery.attemptId();
    } catch (_) { /* use deterministic fallback below */ }
    session.attemptSequence += 1;
    return `ec-${session.sessionId}-${session.attemptSequence}`;
  }
  function matchingQuestion(session) {
    if (root.QuestionReview && root.ElectronSession) {
      try {
        const modulus = 2 ** D.groups.length;
        const base = (session.rng >>> 0) % Math.floor(root.QuestionReview.capacity / modulus);
        const reviewId = root.QuestionReview.format("ECB", base * modulus + (modulus - 1));
        session.rng = root.QuestionReview.parse("ECB", reviewId);
        const legacy = root.ElectronSession.bonusFromReviewId(reviewId);
        return { ...legacy, kind: "matching", group: "matching", attemptId: attemptId(session) };
      } catch (_) { /* use the local deterministic bank if a seeded legacy ID is unavailable */ }
    }
    const items = pool(session);
    const buckets = new Map();
    items.forEach((item) => {
      const key = item.counts.join(",");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });
    const eligible = [...buckets.values()].filter((bucket) => bucket.length >= 2 && items.length - bucket.length >= 3);
    if (!eligible.length) throw new Error("The matching question bank is too small for this level.");
    const matches = shuffle(session, eligible)[0];
    const positive = shuffle(session, matches).slice(0, Math.min(3, matches.length));
    const negative = shuffle(session, items.filter((item) => !C.same(item.counts, matches[0].counts))).slice(0, 3);
    return {
      kind: "matching",
      group: "matching",
      counts: matches[0].counts.slice(),
      options: shuffle(session, positive.concat(negative).map((item) => item.id)),
      attemptId: attemptId(session),
      reviewId: null
    };
  }
  function nextGroup(session) {
    if (session.level === 3) {
      const group = GROUP_CYCLE[session.cycleIndex % GROUP_CYCLE.length];
      session.cycleIndex += 1;
      return group;
    }
    const group = session.groups[session.cycleIndex % session.groups.length];
    session.cycleIndex += 1;
    return group;
  }
  function newQuestion(session) {
    const group = nextGroup(session);
    if (group === "matching") return matchingQuestion(session);
    const representation = representationFor(session, group);
    const candidates = shuffle(session, pool(session, group, representation));
    const previous = session.lastSpecies;
    const eligible = candidates.filter((item) => item.id !== previous);
    const item = (eligible.length ? eligible : candidates)[0];
    const question = {
      kind: "main", group, direction: directionFor(session, group), representation,
      speciesId: item.id, attemptId: attemptId(session)
    };
    session.lastSpecies = item.id;
    return question;
  }
  function recordAward(session, result) {
    if (session.reviewing || !session.leafId || !result || !session.current) return false;
    const id = session.current.attemptId;
    if (session.recordedAttempts.includes(id)) return true;
    session.recordedAttempts.push(id);
    const common = root.ALevelMastery;
    if (!common || typeof common.record !== "function") { session.recordSaveFailed = true; return false; }
    try {
      const saved = Boolean(common.record({
        id,
        leafId: session.leafId,
        level: session.level,
        score: result.correct ? 1 : 0,
        completedAt: Date.now()
      }));
      if (!saved) session.recordSaveFailed = true;
      return saved;
    } catch (_) { session.recordSaveFailed = true; return false; }
  }
  function finish(session) {
    session.completed = true;
    session.current = null;
    session.result = null;
    return null;
  }
  function create(options, seed) {
    if (options.leafId && String(options.leafId) !== LEAF_ID) throw new Error("Electron configurations belong to leaf l6-t2-1-2.");
    const level = Number(options.level);
    const levelConfig = config(level);
    const groups = levelConfig.groups.slice();
    const representations = levelConfig.representations.slice();
    const session = {
      version: "electron-configurations-levels-v1",
      level, mode: options.mode === "mastery" ? "mastery" : "level",
      leafId: LEAF_ID, groups, representations,
      matching: levelConfig.matching, target: TARGET,
      rng: (Number(seed) || 314159265) >>> 0,
      sessionId: `s${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      attemptSequence: 0, cycleIndex: 0, nextDirection: "build",
      directionUses: { build: 0, identify: 0 }, groupDirectionUses: {}, representationUses: {},
      completedCount: 0, correctCount: 0, current: null, response: C.blankResponse(), result: null,
      lastSpecies: null, completed: false, reviewing: Boolean(options.reviewing), awardRecorded: false,
      recordedAttempts: [], recordSaveFailed: false
    };
    next(session);
    return session;
  }
  function next(session) {
    if (session.completed) return null;
    if (session.current && !session.result) return session.current;
    session.result = null;
    session.response = C.blankResponse();
    session.current = newQuestion(session);
    return session.current;
  }
  function mark(question, response) {
    if (question.kind === "matching") {
      return C.mark({ kind: "bonus", counts: question.counts, options: question.options }, response);
    }
    return C.mark(question, response);
  }
  function submit(session) {
    if (!session.current || session.completed) return session.result;
    if (session.result) return session.result;
    const result = mark(session.current, session.response);
    if (!result.accepted) return result;
    session.result = result;
    session.completedCount += 1;
    if (result.correct) session.correctCount += 1;
    recordAward(session, result);
    return result;
  }
  function advance(session) {
    if (!session.result) return session.current;
    return next(session);
  }
  function valid(saved) {
    try {
      const integer = (value) => Number.isSafeInteger(value) && value >= 0;
      const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
      const validResponse = (response) => {
        if (!object(response) || !Array.isArray(response.counts) || response.counts.length !== 8 || response.counts.some((value) => typeof value !== "string" || value.length > 2)) return false;
        if (typeof response.identity !== "string" || response.identity.length > 80 || typeof response.core !== "string" || (response.core && !D.cores[response.core])) return false;
        if (!Array.isArray(response.selected) || new Set(response.selected).size !== response.selected.length || response.selected.some((id) => typeof id !== "string" || !C.species(id))) return false;
        return Array.isArray(response.boxes) && response.boxes.length === 8 && response.boxes.every((row, index) => Array.isArray(row) && row.length === D.orbitals[index] && row.every((state) => [0, 1, 2, 3].includes(state)));
      };
      if (!saved || saved.version !== "electron-configurations-levels-v1" || saved.leafId !== LEAF_ID || !LEVELS[saved.level]) return false;
      if (!["level", "mastery"].includes(saved.mode) || !Array.isArray(saved.groups) || !Array.isArray(saved.representations)) return false;
      const expected = LEVELS[saved.level];
      if (new Set(saved.groups).size !== saved.groups.length || new Set(saved.representations).size !== saved.representations.length || JSON.stringify(saved.groups) !== JSON.stringify(expected.groups) || JSON.stringify(saved.representations) !== JSON.stringify(expected.representations)) return false;
      if (typeof saved.rng !== "number" || !Number.isSafeInteger(saved.rng) || saved.rng <= 0 || saved.rng > 4294967295) return false;
      if (typeof saved.sessionId !== "string" || !saved.sessionId || typeof saved.nextDirection !== "string" || !["build", "identify"].includes(saved.nextDirection)) return false;
      if (![saved.completedCount, saved.correctCount, saved.cycleIndex, saved.attemptSequence].every(integer)) return false;
      if (saved.correctCount > saved.completedCount || saved.target !== TARGET) return false;
      if (typeof saved.completed !== "boolean" || typeof saved.reviewing !== "boolean") return false;
      if (!saved.directionUses || ![saved.directionUses.build, saved.directionUses.identify].every((n) => Number.isSafeInteger(n) && n >= 0)) return false;
      if (!object(saved.groupDirectionUses) || Object.entries(saved.groupDirectionUses).some(([group, counts]) => !saved.groups.includes(group) || !object(counts) || !integer(counts.build) || !integer(counts.identify))) return false;
      if (!object(saved.representationUses) || Object.entries(saved.representationUses).some(([group, uses]) => !saved.groups.includes(group) || !object(uses) || Object.entries(uses).some(([representation, count]) => !saved.representations.includes(representation) || !integer(count)))) return false;
      if (!validResponse(saved.response)) return false;
      if (!Array.isArray(saved.recordedAttempts) || new Set(saved.recordedAttempts).size !== saved.recordedAttempts.length || saved.recordedAttempts.some((id) => typeof id !== "string")) return false;
      if (typeof saved.recordSaveFailed !== "boolean") return false;
      if (saved.lastSpecies !== null && (typeof saved.lastSpecies !== "string" || !pool(saved).some((item) => item.id === saved.lastSpecies))) return false;
      if (!saved.completed && !saved.current) return false;
      if (saved.completed && (saved.current !== null || saved.result !== null)) return false;
      if (saved.current) {
        if (!saved.current.attemptId || typeof saved.current.attemptId !== "string") return false;
        if (saved.current.kind === "main") {
          if (!saved.groups.includes(saved.current.group) || !saved.representations.includes(saved.current.representation) || !["build", "identify"].includes(saved.current.direction) || (saved.current.attemptSaved !== undefined && typeof saved.current.attemptSaved !== "boolean")) return false;
          if (!pool(saved, saved.current.group, saved.current.representation).some((item) => item.id === saved.current.speciesId)) return false;
        } else if (saved.current.kind === "matching") {
          if (saved.level !== 3 || !Array.isArray(saved.current.options) || saved.current.options.length < 5 || saved.current.options.length > 6 || new Set(saved.current.options).size !== saved.current.options.length || saved.current.options.some((id) => typeof id !== "string" || !pool(saved).some((item) => item.id === id)) || !Array.isArray(saved.current.counts) || saved.current.counts.length !== 8 || saved.current.counts.some((count) => !Number.isInteger(count) || count < 0 || count > 10) || (saved.current.reviewId !== null && typeof saved.current.reviewId !== "string")) return false;
          const matches = saved.current.options.filter((id) => C.same(C.species(id).counts, saved.current.counts)).length;
          if (matches < 2 || matches === saved.current.options.length) return false;
        } else return false;
        if (saved.result !== null) {
          if (!saved.recordedAttempts.includes(saved.current.attemptId)) return false;
          const checked = mark(saved.current, saved.response);
          if (!checked.accepted || JSON.stringify(checked) !== JSON.stringify(saved.result)) return false;
        }
      }
      return true;
    } catch (_) { return false; }
  }
  root.ElectronLevelSession = { TARGET, LEAF_ID, LEVELS, GROUP_CYCLE, config, pool, create, next, submit, advance, valid, mark, recordAward };
})(typeof globalThis !== "undefined" ? globalThis : window);
