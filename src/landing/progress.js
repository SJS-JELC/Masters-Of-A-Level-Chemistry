(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ALevelProgress = api;
})(typeof globalThis === "undefined" ? this : globalThis, function (root) {
  "use strict";

  // These values are copied from the released electron session runtime. The
  // landing page must not load the unpublished mastery-src implementation.
  const SNAPSHOT_VERSION = 1;
  const ELECTRON_STORAGE_KEY = "sjs-electron-configurations-v1";
  const ELECTRON_VERSION = "electron-configurations-v1";
  const ELECTRON_GROUPS = Object.freeze(["main-atoms", "main-ions", "d-atoms", "d-ions"]);
  const ELECTRON_REPRESENTATIONS = Object.freeze(["full", "short", "row", "energy"]);
  const ELECTRON_TARGET = 3;
  const ELECTRON_GEMS = Object.freeze(new Set(["l6-t2-1-2", "u6-t2-7-1"]));
  const NO_ASSESSMENT_GEMS = Object.freeze(new Set([
    "l6-t2-3-3", "u6-t1-1-2", "u6-t1-1-3", "u6-t1-1-4", "u6-t1-1-5", "u6-t1-1-7", "u6-t1-1-8"
  ]));

  function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function nonnegative(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function uniqueKnown(values, known) {
    return Array.isArray(values) && values.length > 0 && new Set(values).size === values.length && values.every((value) => known.includes(value));
  }

  function exactKeys(value, expected) {
    return object(value) && Object.keys(value).sort().join("|") === expected.slice().sort().join("|");
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function validProgressRecord(value, selectedGroups) {
    if (!object(value) || !nonnegative(value.streak) || value.streak > ELECTRON_TARGET || !nonnegative(value.attempts) || value.attempts < value.streak) return false;
    if (!Array.isArray(value.streakIds) || value.streakIds.length !== value.streak || new Set(value.streakIds).size !== value.streak || value.streakIds.some((id) => typeof id !== "string" || !id)) return false;
    if (!object(value.groupUses) || Object.entries(value.groupUses).some(([group, count]) => !selectedGroups.includes(group) || !nonnegative(count))) return false;
    return sum(Object.values(value.groupUses)) === value.attempts;
  }

  // Validate only fields needed for the homepage summary. The activity remains
  // the authority for chemistry-bank and answer validation.
  function isValidElectronSession(saved) {
    try {
      if (!object(saved) || saved.version !== ELECTRON_VERSION || !uniqueKnown(saved.groups, ELECTRON_GROUPS) || !uniqueKnown(saved.representations, ELECTRON_REPRESENTATIONS)) return false;
      const keys = saved.representations.flatMap((representation) => ["build", "identify"].map((direction) => `${direction}:${representation}`));
      if (!exactKeys(saved.progress, keys) || !nonnegative(saved.rng) || saved.rng === 0 || saved.rng > 4294967295) return false;
      if (typeof saved.bonus !== "boolean" || typeof saved.bonusDue !== "boolean" || typeof saved.completed !== "boolean") return false;
      if (!object(saved.directionUses) || !nonnegative(saved.directionUses.build) || !nonnegative(saved.directionUses.identify)) return false;
      if (!object(saved.groupUses) || Object.entries(saved.groupUses).some(([group, count]) => !saved.groups.includes(group) || !nonnegative(count))) return false;
      if (!object(saved.speciesUses) || Object.entries(saved.speciesUses).some(([id, count]) => typeof id !== "string" || !id || !nonnegative(count))) return false;
      if (![saved.mainCount, saved.correctCount, saved.bonusCount, saved.bonusCorrect].every(nonnegative) || saved.correctCount > saved.mainCount || saved.bonusCorrect > saved.bonusCount) return false;
      if (!keys.every((key) => validProgressRecord(saved.progress[key], saved.groups))) return false;
      const records = Object.entries(saved.progress);
      const mainAttempts = sum(records.map(([, record]) => record.attempts));
      const buildAttempts = sum(records.filter(([key]) => key.startsWith("build:")).map(([, record]) => record.attempts));
      const identifyAttempts = sum(records.filter(([key]) => key.startsWith("identify:")).map(([, record]) => record.attempts));
      const streaks = sum(records.map(([, record]) => record.streak));
      if (mainAttempts !== saved.mainCount || buildAttempts !== saved.directionUses.build || identifyAttempts !== saved.directionUses.identify || streaks > saved.correctCount) return false;
      const groupTotals = Object.fromEntries(ELECTRON_GROUPS.map((group) => [group, 0]));
      records.forEach(([, record]) => Object.entries(record.groupUses).forEach(([group, count]) => { groupTotals[group] += count; }));
      if (Object.entries(groupTotals).some(([group, count]) => count !== (saved.groupUses[group] || 0))) return false;
      if (!object(saved.response)) return false;
      if (saved.completed) return saved.current === null && saved.result === null && keys.every((key) => saved.progress[key].streak === ELECTRON_TARGET);
      return object(saved.current) && (saved.current.kind === "main" || saved.current.kind === "bonus") && (saved.result === null || object(saved.result));
    } catch (_) {
      return false;
    }
  }

  function read(storage) {
    const snapshot = {
      schemaVersion: SNAPSHOT_VERSION,
      electron: { key: ELECTRON_STORAGE_KEY, status: "unavailable", session: null }
    };
    let source = storage;
    if (source === undefined) {
      try { source = root.localStorage; } catch (_) { source = null; }
    }
    if (!source || typeof source.getItem !== "function") return snapshot;
    let raw;
    try { raw = source.getItem(ELECTRON_STORAGE_KEY); }
    catch (_) { snapshot.electron.status = "blocked"; return snapshot; }
    if (raw === null || raw === undefined || raw === "") { snapshot.electron.status = "absent"; return snapshot; }
    if (typeof raw !== "string") { snapshot.electron.status = "corrupt"; return snapshot; }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) { snapshot.electron.status = "corrupt"; return snapshot; }
    if (!isValidElectronSession(parsed)) {
      snapshot.electron.status = parsed && parsed.version !== ELECTRON_VERSION ? "unsupported" : "corrupt";
      return snapshot;
    }
    snapshot.electron.status = "valid";
    snapshot.electron.session = parsed;
    return snapshot;
  }

  function empty(status, note) {
    return { status, note, metrics: [], percent: null };
  }

  function formatPercent(value) {
    return Number((value * 100).toFixed(2));
  }

  function scopeLabel(groups) {
    const labels = { "main-atoms": "main-group atoms", "main-ions": "main-group ions", "d-atoms": "D-block atoms", "d-ions": "D-block ions" };
    return groups.map((group) => labels[group]).join(", ");
  }

  function groupAttempts(session) {
    const totals = Object.fromEntries(ELECTRON_GROUPS.map((group) => [group, 0]));
    Object.values(session.progress).forEach((record) => Object.entries(record.groupUses).forEach(([group, count]) => { totals[group] += count; }));
    return totals;
  }

  function nativeStats(session, scopeGroups) {
    if (session.mainCount <= 0) return empty("Not assessed", "No practice recorded yet.");
    const records = Object.values(session.progress);
    const mastered = records.filter((record) => record.streak === ELECTRON_TARGET).length;
    const total = records.length;
    return {
      status: session.completed ? "Complete" : "In progress",
      note: `Saved session: mastery applies to selected skills (${scopeLabel(scopeGroups)}).`,
      metrics: [
        { label: "Mastered skills", value: `${mastered} / ${total}` },
        { label: "Accuracy", value: `${session.correctCount} / ${session.mainCount} (${formatPercent(session.correctCount / session.mainCount)}%)` },
        { label: "Questions answered", value: String(session.mainCount) }
      ],
      percent: formatPercent(mastered / total)
    };
  }

  function electronGem(session, gemId) {
    const attempts = groupAttempts(session);
    const observed = ELECTRON_GROUPS.filter((group) => attempts[group] > 0);
    if (gemId === "l6-t2-1-2") return nativeStats(session, session.groups);
    const dGroups = session.groups.filter((group) => group === "d-atoms" || group === "d-ions");
    if (!dGroups.length || !observed.some((group) => dGroups.includes(group))) return empty("Not assessed", "No answered D-block questions are recorded in the shared session.");
    if (observed.some((group) => !dGroups.includes(group))) {
      return {
        status: "Shared session",
        note: "This saved session includes D-block and other groups. Its mastery and accuracy stay at shared-session scope.",
        metrics: [
          { label: "D-block questions observed", value: String(dGroups.reduce((total, group) => total + attempts[group], 0)) },
          { label: "Session scope", value: scopeLabel(session.groups) }
        ],
        percent: null
      };
    }
    return nativeStats(session, dGroups);
  }

  function forGem(snapshot, gemId) {
    if (!snapshot || snapshot.schemaVersion !== SNAPSHOT_VERSION) return empty("Not assessed", "No saved progress snapshot is available.");
    if (ELECTRON_GEMS.has(gemId)) {
      if (snapshot.electron?.status !== "valid" || !isValidElectronSession(snapshot.electron.session)) {
        const note = snapshot.electron?.status === "unsupported" ? "Saved progress uses a different format." :
          snapshot.electron?.status === "blocked" ? "Saved progress could not be read in this browser." : "No practice recorded yet.";
        return empty("Not assessed", note);
      }
      return electronGem(snapshot.electron.session, gemId);
    }
    if (NO_ASSESSMENT_GEMS.has(gemId)) return empty("Not assessed", "This activity does not save progress yet.");
    return empty("Not assessed", "No practice recorded yet.");
  }

  return Object.freeze({
    read,
    forGem,
    isValidElectronSession,
    constants: Object.freeze({ ELECTRON_STORAGE_KEY, ELECTRON_VERSION, ELECTRON_GROUPS, ELECTRON_REPRESENTATIONS, ELECTRON_TARGET })
  });
});
