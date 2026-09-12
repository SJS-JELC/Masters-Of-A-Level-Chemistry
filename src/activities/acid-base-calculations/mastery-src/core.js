(function (root) {
  "use strict";
  const data = root.AcidBaseData;
  const questionCore = root.AcidBaseCore;
  const SCHEMA_VERSION = 2;
  const BANK_SIGNATURE = `acid-base-${data.templates.length}-v2`;
  const superscriptDigits = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

  function parseStandardParts(value) {
    const normalised = String(value || "").trim().replace(/[−–—]/g, "-").replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => superscriptDigits[character]);
    const match = normalised.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:[eE]|(?:×|x|\*)\s*10\s*\^?\s*)([+-]?\d+)$/);
    return match ? { mantissa: match[1], exponent: match[2] } : null;
  }

  function standardValue(mantissa, exponent) {
    const first = String(mantissa || "").trim();
    const power = String(exponent || "").trim().replace(/[−–—]/g, "-");
    return first && /^[+-]?\d+$/.test(power) ? `${first}e${power}` : "";
  }

  function selectableFamilies() {
    return data.families.filter((family) => data.templates.some((template) => template.family === family.id)).map((family) => ({
      id: family.id, label: family.label,
      levels: [1, 2, 3].filter((level) => data.templates.some((template) => template.family === family.id && template.levels.includes(level)))
    }));
  }

  function nextRandom(session) {
    let value = session.rngState >>> 0;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    session.rngState = value >>> 0;
    return session.rngState / 4294967296;
  }

  function shuffle(session, values) {
    const copy = values.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(nextRandom(session) * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  function progressRecord() { return { status: "locked", attempts: 0, templateId: null }; }

  function createSession(selectedFamilies, seed) {
    const available = new Map(selectableFamilies().map((family) => [family.id, family]));
    const selected = [...new Set(selectedFamilies)].filter((id) => available.has(id));
    if (!selected.length) throw new Error("Choose at least one calculation family.");
    const progress = {};
    selected.forEach((id) => {
      progress[id] = {};
      available.get(id).levels.forEach((level) => { progress[id][level] = progressRecord(); });
    });
    const session = {
      schemaVersion: SCHEMA_VERSION, bankSignature: BANK_SIGNATURE, selectedFamilies: selected,
      level: 0, mode: "initial", queue: [], proofQueue: [], current: null, progress,
      rngState: (Number(seed) || 0x6d2b79f5) >>> 0, usedQuestionIds: [], completed: false,
      stats: { submitted: 0, firstTimeMastered: 0, proofQuestions: 0, scaffolded: 0 }
    };
    startNextLevel(session);
    return session;
  }

  function startNextLevel(session) {
    let level = session.level + 1;
    while (level <= 3 && !session.selectedFamilies.some((id) => session.progress[id][level])) level += 1;
    if (level > 3) {
      session.completed = true; session.current = null; session.queue = []; return;
    }
    session.level = level;
    session.mode = "initial";
    const items = session.selectedFamilies.filter((id) => session.progress[id][level]).map((familyId) => {
      session.progress[familyId][level].status = "pending";
      return { familyId, level, kind: "initial", templateId: null };
    });
    session.queue = shuffle(session, items);
  }

  function freshQuestionSeed(session, templateId, level, structure) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const randomPart = Math.floor(nextRandom(session) * 0x7fffffff);
      const seed = questionCore.encodeQuestionId(templateId, level, structure, randomPart);
      const id = questionCore.formatQuestionId(seed);
      if (!session.usedQuestionIds.includes(id)) {
        session.usedQuestionIds.push(id);
        return seed;
      }
    }
    throw new Error("Could not create a fresh question.");
  }

  function prepareQueue(session) {
    if (session.queue.length) return;
    if (session.proofQueue.length) {
      session.mode = "proof";
      session.queue = shuffle(session, session.proofQueue);
      session.proofQueue = [];
      return;
    }
    startNextLevel(session);
  }

  function nextQuestion(session) {
    if (session.current || session.completed) return session.current;
    prepareQueue(session);
    if (session.completed) return null;
    const item = session.queue.shift();
    const eligible = questionCore.eligibleTemplates(item.familyId, item.level);
    const template = item.templateId
      ? eligible.find((candidate) => candidate.id === item.templateId)
      : eligible[Math.floor(nextRandom(session) * eligible.length)];
    if (!template) throw new Error("The scheduled question is no longer available.");
    const structure = item.level === 3 ? "single" : "staged";
    const seed = freshQuestionSeed(session, template.id, item.level, structure);
    session.current = {
      familyId: item.familyId, level: item.level, kind: item.kind, templateId: template.id,
      structure, seed, firstSubmitted: false, scaffoldUsed: false, scaffoldParts: [], incorrectParts: [],
      firstAllCorrect: null, eligible: false, workedAvailable: false, answerRevealed: false,
      responses: [], responseModes: [], standardResponses: []
    };
    session.progress[item.familyId][item.level].status = "current";
    if (item.kind === "proof") session.stats.proofQuestions += 1;
    return session.current;
  }

  function generateCurrent(session) {
    if (!session.current) return null;
    const item = session.current;
    return questionCore.generate({ level: item.level, family: item.familyId, template: item.templateId, structure: item.structure }, item.seed);
  }

  function useScaffold(session, partIndex) {
    if (!session.current) return;
    if (!session.current.scaffoldParts.includes(partIndex)) session.current.scaffoldParts.push(partIndex);
    if (!session.current.scaffoldUsed) {
      session.current.scaffoldUsed = true;
      session.stats.scaffolded += 1;
    }
  }

  function scheduleProof(session) {
    const item = session.current;
    session.progress[item.familyId][item.level].status = "due";
    session.progress[item.familyId][item.level].templateId = item.templateId;
    if (!session.proofQueue.some((due) => due.familyId === item.familyId && due.level === item.level)) {
      session.proofQueue.push({ familyId: item.familyId, level: item.level, kind: "proof", templateId: item.templateId });
    }
  }

  function submit(session, values) {
    const question = generateCurrent(session);
    if (!question) throw new Error("There is no current question.");
    if (values.length !== question.responses.length || values.some((value) => !String(value).trim())) return { accepted: false, reason: "Complete every final answer before checking." };
    session.current.responses = values.slice();
    const results = question.responses.map((answer, index) => questionCore.markNumber(values[index], answer));
    const allCorrect = results.every((result) => result.status === "correct");
    if (!session.current.firstSubmitted) {
      session.current.firstSubmitted = true;
      session.current.firstAllCorrect = allCorrect;
      session.current.eligible = allCorrect && !session.current.scaffoldUsed;
      session.current.incorrectParts = results.map((result, index) => result.status === "correct" ? -1 : index).filter((index) => index >= 0);
      session.current.workedAvailable = !allCorrect;
      session.stats.submitted += 1;
      const record = session.progress[session.current.familyId][session.current.level];
      record.attempts += 1;
      if (session.current.eligible) {
        record.status = "mastered";
        if (session.current.kind === "initial") session.stats.firstTimeMastered += 1;
      } else {
        scheduleProof(session);
      }
      return { accepted: true, first: true, allCorrect, eligible: allCorrect && !session.current.scaffoldUsed, results, autoOpen: session.current.incorrectParts.slice() };
    }
    return { accepted: true, first: false, allCorrect, eligible: false, results, autoOpen: [] };
  }

  function continueSession(session) {
    if (!session.current?.firstSubmitted) throw new Error("Submit the question before continuing.");
    session.current = null;
    return nextQuestion(session);
  }

  function revealAnswer(session) {
    if (!session.current?.workedAvailable) return false;
    session.current.answerRevealed = true;
    return true;
  }

  function validateSession(value) {
    return Boolean(value && value.schemaVersion === SCHEMA_VERSION && value.bankSignature === BANK_SIGNATURE && Array.isArray(value.selectedFamilies) && value.progress && value.stats);
  }

  root.AcidBaseMasteryCore = Object.freeze({ SCHEMA_VERSION, BANK_SIGNATURE, selectableFamilies, parseStandardParts, standardValue, createSession, nextQuestion, generateCurrent, useScaffold, submit, continueSession, revealAnswer, validateSession });
})(typeof globalThis !== "undefined" ? globalThis : window);
