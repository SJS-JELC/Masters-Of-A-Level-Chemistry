(function (root) {
  "use strict";

  const core = root.AcidBaseCore;
  const data = root.AcidBaseData;
  if (!core || !data) throw new Error("AcidBaseCore and AcidBaseData must load before levels.js");

  const LEVEL_LABELS = Object.freeze({ 1: "Level 1 · Direct", 2: "Level 2 · Linked", 3: "Level 3 · Unstructured" });
  const scopes = Object.freeze([
    { id: "u6-t1-1-2", label: "Strong Acids & pH", levels: {
      1: ["h-to-ph", "ph-to-h", "strong-acid-direct"],
      2: ["strong-acid-dilution"],
      3: ["strong-acid-preparation", "strong-acid-neutralisation"] } },
    { id: "u6-t1-1-3", label: "Kₓ and Strong Bases", levels: {
      1: ["strong-base-direct", "water-ph-from-kw"],
      2: ["strong-base-mass", "dihydroxide-direct", "temperature-base"],
      3: ["base-mass-concentration-dilution", "base-purity"] } },
    { id: "u6-t1-1-4", label: "Kₐ and pKₐ", levels: {
      1: ["ka-to-pka", "pka-to-ka"],
      2: ["weak-acid-pka", "ka-from-ph"],
      3: ["ka-after-reconstruction"] } },
    { id: "u6-t1-1-5", label: "Weak Acid Calculations", levels: {
      1: ["weak-acid-direct"],
      2: ["weak-acid-amount", "weak-acid-reverse-concentration", "weak-acid-percent"],
      3: ["weak-acid-target-mass", "weak-acid-purity"] } },
    { id: "u6-t1-1-7", label: "Making Buffers", levels: {
      1: ["buffer-component-ratio", "buffer-salt-amount"],
      2: ["buffer-mixed-volumes", "partial-buffer-moles"],
      3: ["target-buffer-salt-mass", "partial-buffer-volumes"] } },
    { id: "u6-t1-1-8", label: "Buffer Calculations", levels: {
      1: ["buffer-direct"],
      2: ["buffer-mixed-volumes", "partial-buffer-moles"],
      3: ["buffer-recipe-deviation", "buffer-after-addition", "partial-buffer-volumes"] } }
  ].map((scope) => Object.freeze(scope)));
  const scopeMap = new Map(scopes.map((scope) => [scope.id, scope]));

  function rng32(seed) {
    let value = Number(seed) >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(rng, values) { return values[Math.floor(rng() * values.length)]; }
  function log10(value) { return Math.log(value) / Math.LN10; }
  function sci(value) {
    const exponent = Math.floor(log10(Math.abs(value)));
    const coefficient = value / 10 ** exponent;
    return `${coefficient.toFixed(2)} × 10^${exponent}`;
  }
  function answer(key, prompt, symbol, unit, expected, format) {
    const resolved = format || "sf3";
    const tolerance = resolved === "dp2" ? 0.0051 : resolved === "dp3" ? 0.00051
      : 0.51 * 10 ** (Math.floor(log10(Math.abs(expected || 1))) - 2);
    return Object.freeze({ key, prompt, symbol, unit: unit || "", expected, format: resolved, tolerance });
  }
  function question(templateId, label, intro, rows, responses, working, seed) {
    const answerParts = responses.length === 1 ? [working] : responses.map((_, index) => [working[Math.min(index, working.length - 1)]]);
    return Object.freeze({ seed, level: 0, structure: "direct", templateId, templateLabel: label,
      familyId: "mastery", familyLabel: "Acids, bases and buffers", target: responses.at(-1).symbol,
      intro, rows: rows.map(([key, value]) => ({ label: key, value: String(value) })), responses,
      allResponses: responses, working, answerParts, audit: [] });
  }
  function acid(rng) { return pick(rng, data.weakAcids); }

  const custom = {
    "ka-to-pka": (rng, seed) => {
      const item = acid(rng), pka = -log10(item.ka);
      return question("ka-to-pka", "Kₐ to pKₐ", `Calculate pKₐ for ${item.name}.`, [["Kₐ / mol dm⁻³", sci(item.ka)]],
        [answer("pka", "Calculate pKₐ.", "pKₐ", "", pka, "dp2")], [`pKₐ = −log₁₀Kₐ = ${pka.toFixed(2)}`], seed);
    },
    "pka-to-ka": (rng, seed) => {
      const item = acid(rng), pka = Number((-log10(item.ka)).toFixed(2)), ka = 10 ** (-pka);
      return question("pka-to-ka", "pKₐ to Kₐ", "Calculate the acid dissociation constant from the supplied pKₐ.", [["pKₐ", pka.toFixed(2)]],
        [answer("ka", "Calculate Kₐ.", "Kₐ", "mol dm⁻³", ka)], [`Kₐ = 10^(−pKₐ) = ${sci(ka)} mol dm⁻³`], seed);
    },
    "ka-from-ph": (rng, seed) => {
      const item = acid(rng), c = pick(rng, [0.100, 0.150, 0.200]), h = Math.sqrt(item.ka * c), ph = Number((-log10(h)).toFixed(2));
      const roundedH = 10 ** (-ph), ka = roundedH ** 2 / c;
      return question("ka-from-ph", "Kₐ from pH and concentration", "A weak monobasic acid has the concentration and pH shown. Calculate Kₐ using the OCR weak-acid approximation.", [["[HA] / mol dm⁻³", sci(c)], ["pH", ph.toFixed(2)]],
        [answer("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", roundedH), answer("ka", "Calculate Kₐ.", "Kₐ", "mol dm⁻³", ka)],
        [`[H⁺] = 10^(−pH) = ${sci(roundedH)} mol dm⁻³`, `Kₐ = [H⁺]²/[HA] = ${sci(ka)} mol dm⁻³`], seed);
    },
    "ka-after-reconstruction": (rng, seed) => {
      const item = pick(rng, data.weakAcids.filter((entry) => entry.ka < 5e-5)), mass = pick(rng, [1.20, 1.50, 2.00]), volume = pick(rng, [200, 250, 500]);
      const c = (mass / item.mr) / (volume / 1000), ph = Number((-log10(Math.sqrt(item.ka * c))).toFixed(2));
      const h = 10 ** (-ph), ka = h ** 2 / c;
      return question("ka-after-reconstruction", "Reconstruct concentration, then Kₐ", `A ${mass.toFixed(2)} g sample of a pure weak monobasic acid (Mᵣ = ${item.mr.toFixed(1)}) is dissolved to make ${volume.toFixed(1)} cm³. Its pH is ${ph.toFixed(2)}. Calculate Kₐ.`, [],
        [answer("ka", "Calculate Kₐ.", "Kₐ", "mol dm⁻³", ka)],
        [`n(HA) = mass/Mᵣ = ${sci(mass / item.mr)} mol`, `[HA] = n/V = ${sci(c)} mol dm⁻³`, `[H⁺] = 10^(−pH) = ${sci(h)} mol dm⁻³`, `Kₐ = [H⁺]²/[HA] = ${sci(ka)} mol dm⁻³`], seed);
    },
    "strong-acid-preparation": (rng, seed) => {
      const cStock = pick(rng, [0.500, 0.800, 1.00]), finalV = pick(rng, [200, 250, 500]), targetPh = pick(rng, [1.30, 1.50, 1.70]);
      const targetC = 10 ** (-targetPh), stockV = targetC * (finalV / 1000) / cStock * 1000;
      return question("strong-acid-preparation", "Target-pH preparation", `A student must prepare ${finalV.toFixed(1)} cm³ of HCl(aq), pH ${targetPh.toFixed(2)}, from ${cStock.toFixed(3)} mol dm⁻³ HCl. Calculate the stock volume required.`, [],
        [answer("volume", "Calculate the stock volume.", "Volume", "cm³", stockV)],
        [`Target [H⁺] = [HCl] = 10^(−pH) = ${sci(targetC)} mol dm⁻³`, `n(HCl) = cV = ${sci(targetC * finalV / 1000)} mol`, `Stock volume = n/c = ${(stockV / 1000).toPrecision(3)} dm³ = ${stockV.toPrecision(3)} cm³ (1 dm³ = 1000 cm³)`], seed);
    },
    "strong-acid-neutralisation": (rng, seed) => {
      const ca = pick(rng, [0.120, 0.150, 0.180]), va = pick(rng, [25, 30]), cb = pick(rng, [0.080, 0.100]), vb = pick(rng, [20, 25]);
      const excess = ca * va / 1000 - cb * vb / 1000;
      const h = excess / ((va + vb) / 1000), ph = -log10(h);
      return question("strong-acid-neutralisation", "Excess strong acid after mixing", `HCl and NaOH are mixed. HCl is in excess. Assume solution volumes are additive. Calculate the final pH.`, [["[HCl] / mol dm⁻³", sci(ca)], ["HCl volume / cm³", va.toFixed(1)], ["[NaOH] / mol dm⁻³", sci(cb)], ["NaOH volume / cm³", vb.toFixed(1)]],
        [answer("ph", "Calculate the final pH.", "pH", "", ph, "dp2")],
        [`HCl + NaOH → NaCl + H₂O`, `Excess n(H⁺) = n(HCl) − n(NaOH) = ${sci(excess)} mol`, `[H⁺] = excess moles/total volume = ${sci(h)} mol dm⁻³`, `pH = −log₁₀[H⁺] = ${ph.toFixed(2)}`], seed);
    },
    "buffer-component-ratio": (rng, seed) => {
      const item = acid(rng), ph = pick(rng, [4.50, 4.75, 5.00]), h = 10 ** (-ph), ratio = item.ka / h;
      return question("buffer-component-ratio", "Buffer component ratio", `A buffer contains ${item.name} and ${item.sodiumSalt}. Calculate [${item.conjugate}]/[${item.formula}] for pH ${ph.toFixed(2)}.`, [["Kₐ / mol dm⁻³", sci(item.ka)]],
        [answer("ratio", "Calculate the concentration ratio.", `[${item.conjugate}]/[${item.formula}]`, "", ratio)],
        [`[H⁺] = 10^(−pH) = ${sci(h)} mol dm⁻³`, `[${item.conjugate}]/[${item.formula}] = Kₐ/[H⁺] = ${ratio.toPrecision(3)}`], seed);
    },
    "buffer-salt-amount": (rng, seed) => {
      const item = acid(rng), nAcid = pick(rng, [0.0200, 0.0250, 0.0300]), ratio = pick(rng, [0.5, 1.0, 1.5]), nSalt = nAcid * ratio;
      return question("buffer-salt-amount", "Acid and salt quantities", `A buffer is to contain ${sci(nAcid)} mol ${item.name} with an amount ratio n(${item.conjugate}) : n(${item.formula}) of ${ratio.toFixed(2)} : 1.00. Calculate the amount of ${item.sodiumSalt}.`, [],
        [answer("salt", "Calculate the amount of salt.", `n(${item.sodiumSaltFormula})`, "mol", nSalt)],
        [`n(${item.sodiumSaltFormula}) = ratio × n(${item.formula}) = ${sci(nSalt)} mol`], seed);
    }
  };
  const customIds = Object.freeze(Object.keys(custom));
  const reviewCapacity = 36 ** 6;
  const reviewModulus = customIds.length * 3;
  const reviewSeeds = Math.floor(reviewCapacity / reviewModulus);

  function customReviewId(templateId, level, random) {
    const index = customIds.indexOf(templateId);
    if (index < 0 || ![1, 2, 3].includes(Number(level))) throw new Error("Unsupported mastery review configuration.");
    const value = (Number(random) >>> 0) % reviewSeeds * reviewModulus + index * 3 + Number(level) - 1;
    return `ABL-${value.toString(36).toUpperCase().padStart(6, "0")}`;
  }
  function decodeCustomReview(reviewId) {
    const match = String(reviewId || "").trim().toUpperCase().match(/^ABL-([0-9A-Z]{6})$/);
    if (!match) throw new Error("Invalid acid-base mastery review ID.");
    const value = Number.parseInt(match[1], 36), code = value % reviewModulus;
    const index = Math.floor(code / 3), level = code % 3 + 1, templateId = customIds[index];
    if (!templateId) throw new Error("Unknown acid-base mastery review template.");
    return { templateId, level, seed:value };
  }

  function scopeFor(id) { return scopeMap.get(id) || null; }
  function templatesFor(scopeId, level) {
    const scope = scopeFor(scopeId);
    return scope ? (scope.levels[Number(level)] || []).slice() : [];
  }
  function chooseTemplate(scopeId, level, used, random) {
    const eligible = templatesFor(scopeId, level);
    if (!eligible.length) throw new Error("No templates are available for this scope and level.");
    const prior = Array.isArray(used) ? used.filter((id) => eligible.includes(id)) : [];
    const remaining = eligible.filter((id) => !prior.includes(id));
    const pool = remaining.length ? remaining : eligible;
    const index = Math.floor((random == null ? Math.random() : random) * pool.length);
    return { templateId: pool[Math.min(index, pool.length - 1)], used: remaining.length ? prior.concat(pool[index]) : [pool[index]] };
  }
  function generate(templateId, level, seed) {
    let generated;
    let generationSeed, reviewId;
    if (custom[templateId]) {
      reviewId = customReviewId(templateId, level, seed);
      generationSeed = Number.parseInt(reviewId.slice(4), 36);
      generated = custom[templateId](rng32(generationSeed), generationSeed);
    } else {
      generationSeed = core.encodeQuestionId(templateId, level, Number(level) === 3 ? "single" : "staged", seed);
      reviewId = core.formatQuestionId(generationSeed);
      generated = core.generate({ level, template: templateId, family: "any", structure: Number(level) === 3 ? "single" : "staged" }, generationSeed);
    }
    return Object.freeze(Object.assign({}, generated, { level: Number(level), structure:Number(level) === 3 ? "single" : Number(level) === 2 ? "staged" : generated.structure, reviewId }));
  }
  function generateFromReview(reviewId) {
    const text = String(reviewId || "").trim().toUpperCase();
    if (text.startsWith("ABL-")) {
      const decoded = decodeCustomReview(text);
      const generated = custom[decoded.templateId](rng32(decoded.seed), decoded.seed);
      return Object.freeze(Object.assign({}, generated, { level:decoded.level, reviewId:text }));
    }
    const decoded = core.decodeQuestionId(text);
    const generated = core.generate({ level:decoded.level, template:decoded.template.id, family:decoded.template.family, structure:decoded.structure }, decoded.seed);
    return Object.freeze(Object.assign({}, generated, { reviewId:text }));
  }
  function score(values, responses) {
    if (!Array.isArray(values) || values.length !== responses.length || values.some((value) => !String(value).trim())) return { accepted: false, reason: "Complete every required numerical response before checking." };
    const results = responses.map((response, index) => core.markNumber(values[index], response));
    if (results.some((result) => result.status === "missing")) return { accepted:false, reason:"Enter a valid number in every required response before checking." };
    const correct = results.filter((result) => result.status === "correct").length;
    return { accepted: true, results, score: correct === responses.length ? 1 : correct ? 0.5 : 0 };
  }
  function nextLevel(mode, fixedLevel, api, leafId) {
    return mode === "mastery" ? api.nextLevel(leafId) : Number(fixedLevel);
  }

  root.AcidBaseLevels = Object.freeze({ LEVEL_LABELS, scopes, scopeFor, templatesFor, chooseTemplate, generate, generateFromReview, customReviewId, decodeCustomReview, score, nextLevel });
})(typeof globalThis !== "undefined" ? globalThis : window);

/* Authoritative revision-2 model. This final wrapper replaces the earlier
   draft wrapper while leaving the historical implementation above untouched
   for byte-for-byte AB-/ABL- review compatibility. */
(function (root) {
  "use strict";

  const compatibilityModel = root.AcidBaseLevels;
  const data = root.AcidBaseData;
  const version = 2;
  const LEVEL_LABELS = Object.freeze({
    1: "Level 1 · Structured",
    2: "Level 2 · Unstructured",
    3: "Level 3 · Applications"
  });

  const definitions = [
    ["u6-t1-1-2", "Strong Acids & pH",
      ["h-to-ph", "ph-to-h", "strong-acid-direct", "strong-acid-dilution"],
      ["strong-acid-preparation", "strong-acid-neutralisation"]],
    ["u6-t1-1-3", "Kw & Strong Bases",
      ["strong-base-direct", "water-ph-from-kw", "dihydroxide-direct", "strong-base-mass", "temperature-base"],
      ["base-mass-concentration-dilution", "base-purity", "excess-strong-base"]],
    ["u6-t1-1-5", "Weak Acid Calculations",
      ["weak-acid-concentration-ph", "weak-acid-pka-ph", "weak-acid-amount", "weak-acid-reverse-concentration", "weak-acid-ph-ka", "weak-acid-ph-pka", "weak-acid-percent", "weak-acid-pka-concentration"],
      ["weak-acid-target-mass", "weak-acid-purity", "weak-acid-preparation-ka"]],
    ["u6-t1-1-7", "Making Buffers",
      ["buffer-component-ratio", "buffer-salt-amount", "buffer-salt-mass", "buffer-salt-stock-volume"],
      ["buffer-partial-target-alkali", "buffer-target-volume-stocks"]],
    ["u6-t1-1-8", "Buffer Calculations",
      ["buffer-direct", "buffer-mixed-volumes", "partial-buffer-moles", "partial-buffer-solutions"],
      ["buffer-after-addition", "buffer-recipe-deviation", "partial-buffer-ka"]]
  ];
  const scopes = Object.freeze(definitions.map(([id, label, core, applications]) => Object.freeze({
    id, label,
    levels: Object.freeze({ 1: Object.freeze(core.slice()), 2: Object.freeze(core.slice()), 3: Object.freeze(applications.slice()) })
  })));
  const scopeMap = new Map(scopes.map((scope) => [scope.id, scope]));

  // The order is persisted in AB2 review IDs. Append only.
  const templateRows = [
    ["h-to-ph", "pH and [H⁺]", "[H⁺] to pH", "pH"],
    ["ph-to-h", "pH and [H⁺]", "pH to [H⁺]", "[H⁺]"],
    ["strong-acid-direct", "Strong acids", "Strong-acid concentration to pH", "pH"],
    ["strong-acid-dilution", "Strong acids", "Dilution to strong-acid pH", "pH"],
    ["strong-acid-preparation", "Strong acids", "Stock volume for target pH", "Volume"],
    ["strong-acid-neutralisation", "Strong acids", "Excess strong acid after mixing", "pH"],
    ["strong-base-direct", "Kw & Strong Bases", "Direct hydroxide concentration", "pH"],
    ["water-ph-from-kw", "Kw & Strong Bases", "Pure water from supplied Kw", "pH"],
    ["dihydroxide-direct", "Kw & Strong Bases", "Dihydroxide concentration", "pH"],
    ["strong-base-mass", "Kw & Strong Bases", "Base mass and final volume", "pH"],
    ["temperature-base", "Kw & Strong Bases", "Base at supplied temperature", "pH"],
    ["base-mass-concentration-dilution", "Kw & Strong Bases", "Mass concentration and dilution", "pH"],
    ["base-purity", "Kw & Strong Bases", "Purity from measured pH", "Percentage"],
    ["excess-strong-base", "Kw & Strong Bases", "Excess strong base after mixing", "pH"],
    ["weak-acid-concentration-ph", "Weak monobasic acids", "Weak-acid concentration to pH", "pH"],
    ["weak-acid-pka-ph", "Weak monobasic acids", "pKa and concentration to pH", "pH"],
    ["weak-acid-amount", "Weak monobasic acids", "Weak-acid amount and volume", "pH"],
    ["weak-acid-reverse-concentration", "Weak monobasic acids", "pH to weak-acid concentration", "Concentration"],
    ["weak-acid-ph-ka", "Weak monobasic acids", "pH and concentration to Ka", "Ka"],
    ["weak-acid-ph-pka", "Weak monobasic acids", "pH and concentration to pKa", "pKa"],
    ["weak-acid-percent", "Weak monobasic acids", "Weak-acid percentage dissociation", "Percentage"],
    ["weak-acid-pka-concentration", "Weak monobasic acids", "pKa and pH to concentration", "Concentration"],
    ["weak-acid-target-mass", "Weak monobasic acids", "Mass for target pH", "Mass"],
    ["weak-acid-purity", "Weak monobasic acids", "Purity from pH", "Percentage"],
    ["weak-acid-preparation-ka", "Weak monobasic acids", "Preparation and pH to Ka", "Ka"],
    ["buffer-component-ratio", "Making buffers", "Target pH to component ratio", "Ratio"],
    ["buffer-salt-amount", "Making buffers", "Required salt amount", "Amount"],
    ["buffer-salt-mass", "Making buffers", "Required salt mass", "Mass"],
    ["buffer-salt-stock-volume", "Making buffers", "Required salt stock volume", "Volume"],
    ["buffer-partial-target-alkali", "Making buffers", "Alkali volume for target pH", "Volume"],
    ["buffer-target-volume-stocks", "Making buffers", "Two stock volumes for target pH", "Volume"],
    ["buffer-direct", "Buffer calculations", "Direct buffer concentrations", "pH"],
    ["buffer-mixed-volumes", "Buffer calculations", "Mixed buffer volumes", "pH"],
    ["partial-buffer-moles", "Buffer calculations", "Partial neutralisation from moles", "pH"],
    ["partial-buffer-solutions", "Buffer calculations", "Partial neutralisation from solutions", "pH"],
    ["buffer-after-addition", "Buffer calculations", "Buffer after strong acid or alkali", "pH"],
    ["buffer-recipe-deviation", "Buffer calculations", "Buffer recipe pH difference", "pH difference"],
    ["partial-buffer-ka", "Buffer calculations", "Partial-neutralisation composition to Ka", "Ka"]
  ];
  const templateIndex = new Map(templateRows.map((row, index) => [row[0], index]));
  const templates = Object.freeze(templateRows.map(([id, familyLabel, label, target]) => Object.freeze({ id, familyLabel, label, target })));

  const log10 = (x) => Math.log(x) / Math.LN10;
  const phOf = (h) => -log10(h);
  const hOf = (ph) => 10 ** (-ph);
  const dp = (x, places) => Number(x).toFixed(places);
  function scientific(x) {
    if (x === 0) return "0";
    const roundedDisplay = Number(x.toPrecision(3));
    if (Math.abs(roundedDisplay) >= 0.001 && Math.abs(roundedDisplay) <= 10000) {
      return roundedDisplay.toFixed(Math.max(0, 3 - 1 - Math.floor(Math.log10(Math.abs(roundedDisplay)))));
    }
    let exponent = Math.floor(log10(Math.abs(x)));
    let coefficient = Number((x / 10 ** exponent).toPrecision(3));
    if (Math.abs(coefficient) >= 10) {
      coefficient /= 10;
      exponent += 1;
    }
    return `${coefficient.toFixed(2)} × 10^${exponent}`;
  }
  function rng32(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value + 0x6D2B79F5) >>> 0;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, values) => values[Math.floor(rng() * values.length)];
  const weakAcid = (rng) => pick(rng, data.weakAcids.filter((item) => item.ka > 0 && item.mr > 0 && item.saltMr > 0));
  const strongAcid = (rng) => pick(rng, data.strongAcids.filter((item) => item.protons === 1));
  const monoBase = (rng) => pick(rng, data.strongBases.filter((item) => item.hydroxides === 1));
  const diBase = (rng) => pick(rng, data.strongBases.filter((item) => item.hydroxides === 2));

  function tolerance(expected, format) {
    if (format === "dp2") return 0.0051;
    if (format === "integer") return 0.51;
    return 0.51 * 10 ** (Math.floor(log10(Math.abs(expected || 1))) - 2);
  }
  function response(key, prompt, symbol, unit, expected, format = "sf3") {
    return Object.freeze({ key, prompt, symbol, unit: unit || "", expected, format, tolerance: tolerance(expected, format) });
  }
  function weakAudit(name, ka, concentration) {
    const approximate = Math.sqrt(ka * concentration);
    const exact = (-ka + Math.sqrt(ka * ka + 4 * ka * concentration)) / 2;
    const dissociation = approximate / concentration;
    return { name: "weak-acid approximation", valid: dissociation < 0.05 && Math.abs(approximate - exact) / exact < 0.03,
      detail: `${name}: ${(100 * dissociation).toFixed(3)}% dissociation; exact [H⁺] ${scientific(exact)} mol dm⁻³` };
  }
  function bufferAudit(nHA, nA) {
    const ratio = nA / nHA;
    return { name: "buffer composition", valid: nHA > 0 && nA > 0 && ratio >= 0.2 && ratio <= 5,
      detail: `Both components positive; n(A⁻)/n(HA) = ${ratio.toPrecision(3)}` };
  }
  function question(templateId, level, seed, intro, rows, parts, audits = []) {
    const template = templates[templateIndex.get(templateId)];
    const allResponses = parts.map((part) => part.response);
    const working = parts.flatMap((part) => part.working);
    const responses = level === 1 ? allResponses.slice() : [allResponses[allResponses.length - 1]];
    const answerParts = level === 1 ? parts.map((part) => part.working.slice()) : [working.slice()];
    const physical = allResponses.every((item) => Number.isFinite(item.expected) && item.expected >= 0 && Number.isFinite(item.tolerance));
    const completeAudits = [{ name: "finite physical values", valid: physical, detail: "All generated answers are finite and non-negative." }, ...audits];
    if (!template || !intro || !allResponses.length || !physical || completeAudits.some((entry) => !entry.valid)) {
      throw new Error(`Generated ${templateId} failed its chemistry audit.`);
    }
    return Object.freeze({
      version, seed, level, structure: level === 1 ? "staged" : "single", templateId,
      templateLabel: template.label, familyLabel: template.familyLabel, target: template.target,
      intro, rows: rows.map(([label, value]) => Object.freeze({ label, value: String(value) })),
      responses: Object.freeze(responses), allResponses: Object.freeze(allResponses),
      working: Object.freeze(working), answerParts: Object.freeze(answerParts.map(Object.freeze)),
      audit: Object.freeze(completeAudits.map(Object.freeze))
    });
  }
  const part = (answer, ...working) => ({ response: answer, working });
  const kwRow = (kw) => ["K_w / mol² dm⁻⁶", scientific(kw)];

  function strongBuilder(id, rng, seed, level) {
    if (id === "h-to-ph") {
      const h = pick(rng, [0.025, 0.040, 0.075, 0.0025, 3.20e-4]);
      const ph = phOf(h);
      return question(id, level, seed, "Calculate the pH of the solution.", [["[H⁺] / mol dm⁻³", scientific(h)]],
        [part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀[H⁺] = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)]);
    }
    if (id === "ph-to-h") {
      const ph = pick(rng, [1.25, 1.60, 2.35, 3.20, 4.85]);
      const h = hOf(ph);
      return question(id, level, seed, "Calculate the hydrogen-ion concentration of the solution.", [["pH", dp(ph, 2)]],
        [part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = 10^(−pH) = 10^(−${dp(ph, 2)}) = ${scientific(h)} mol dm⁻³`)]);
    }
    if (id === "strong-acid-direct") {
      const acid = strongAcid(rng), c = pick(rng, [0.0250, 0.0500, 0.0750, 0.150]);
      const ph = phOf(c);
      return question(id, level, seed, `${acid.name} is a monobasic strong acid. Calculate the pH of the solution.`, [[`[${acid.formula}] / mol dm⁻³`, scientific(c)]], [
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", c), `${acid.formula} → H⁺ + ${acid.formula === "HCl" ? "Cl⁻" : "NO₃⁻"}`, `[H⁺] = [${acid.formula}] = ${scientific(c)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(c)}) = ${dp(ph, 2)}`)
      ]);
    }
    if (id === "strong-acid-dilution") {
      const acid = strongAcid(rng), c1 = pick(rng, [0.400, 0.500, 0.600]), v1 = pick(rng, [10, 20, 25]), v2 = pick(rng, [100, 200, 250]);
      const n = c1 * v1 / 1000, c2 = n / (v2 / 1000), ph = phOf(c2);
      return question(id, level, seed, `${dp(v1, 1)} cm³ of ${acid.name} is diluted with water to ${dp(v2, 1)} cm³. Calculate the final pH.`, [[`Initial [${acid.formula}] / mol dm⁻³`, scientific(c1)]], [
        part(response("amount", "Calculate the amount of acid.", `n(${acid.formula})`, "mol", n), `n = cV = ${scientific(c1)} × ${dp(v1 / 1000, 4)} = ${scientific(n)} mol`),
        part(response("concentration", "Calculate the diluted concentration.", `[${acid.formula}]`, "mol dm⁻³", c2), `[${acid.formula}] = n/V = ${scientific(n)}/${dp(v2 / 1000, 4)} = ${scientific(c2)} mol dm⁻³`),
        part(response("ph", "Calculate the final pH.", "pH", "", ph, "dp2"), `[H⁺] = [${acid.formula}] = ${scientific(c2)} mol dm⁻³`, `pH = −log₁₀(${scientific(c2)}) = ${dp(ph, 2)}`)
      ]);
    }
    if (id === "strong-acid-preparation") {
      const acid = strongAcid(rng), stock = pick(rng, [0.500, 0.800, 1.00]), finalV = pick(rng, [200, 250, 500]), target = pick(rng, [1.30, 1.50, 1.70]);
      const h = hOf(target), n = h * finalV / 1000, stockV = n / stock * 1000;
      return question(id, level, seed, `Prepare ${dp(finalV, 1)} cm³ of ${acid.name} at pH ${dp(target, 2)} from a ${dp(stock, 3)} mol dm⁻³ stock solution. Calculate the stock volume.`, [], [part(response("volume", "Calculate the stock volume.", "Volume", "cm³", stockV),
        `[H⁺] = 10^(−${dp(target, 2)}) = ${scientific(h)} mol dm⁻³`,
        `n(${acid.formula}) = cV = ${scientific(h)} × ${dp(finalV / 1000, 4)} = ${scientific(n)} mol`,
        `V(stock) = n/c = ${scientific(n)}/${dp(stock, 3)} = ${scientific(stockV / 1000)} dm³ = ${stockV.toPrecision(3)} cm³`)]);
    }
    const ca = pick(rng, [0.150, 0.180, 0.200]), va = pick(rng, [25, 30]), cb = pick(rng, [0.080, 0.100]), vb = pick(rng, [20, 25]);
    const nAcid = ca * va / 1000, nBase = cb * vb / 1000, excess = nAcid - nBase, totalV = (va + vb) / 1000, h = excess / totalV, ph = phOf(h);
    return question(id, level, seed, "Hydrochloric acid is mixed with sodium hydroxide. The acid is in excess and volumes are additive. Calculate the final pH.",
      [["[HCl] / mol dm⁻³", scientific(ca)], ["HCl volume / cm³", dp(va, 1)], ["[NaOH] / mol dm⁻³", scientific(cb)], ["NaOH volume / cm³", dp(vb, 1)]], [part(response("ph", "Calculate the final pH.", "pH", "", ph, "dp2"),
        `HCl + NaOH → NaCl + H₂O`, `n(HCl) = ${scientific(ca)} × ${dp(va / 1000, 4)} = ${scientific(nAcid)} mol`,
        `n(NaOH) = ${scientific(cb)} × ${dp(vb / 1000, 4)} = ${scientific(nBase)} mol`,
        `n(H⁺) remaining = ${scientific(nAcid)} − ${scientific(nBase)} = ${scientific(excess)} mol`,
        `[H⁺] = ${scientific(excess)}/${dp(totalV, 4)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)]);
  }

  function baseBuilder(id, rng, seed, level) {
    const kw = 1.00e-14;
    if (id === "strong-base-direct" || id === "temperature-base" || id === "dihydroxide-direct") {
      const isDi = id === "dihydroxide-direct";
      const base = isDi ? diBase(rng) : monoBase(rng);
      const c = pick(rng, [0.0125, 0.0250, 0.0400, 0.0750]);
      const suppliedKw = id === "temperature-base" ? 2.92e-14 : kw;
      const oh = base.hydroxides * c, h = suppliedKw / oh, ph = phOf(h);
      const temperature = id === "temperature-base" ? 40 : 25;
      return question(id, level, seed, `${base.name} is fully dissociated at ${temperature} °C. Calculate the pH.`, [[`[${base.formula}] / mol dm⁻³`, scientific(c)], kwRow(suppliedKw)], [
        part(response("oh", "Calculate [OH⁻].", "[OH⁻]", "mol dm⁻³", oh), `${base.formula} → ${base.hydroxides === 2 ? (base.id === "baoh2" ? "Ba²⁺ + 2OH⁻" : "Sr²⁺ + 2OH⁻") : (base.id === "naoh" ? "Na⁺ + OH⁻" : "K⁺ + OH⁻")}`, `[OH⁻] = ${base.hydroxides} × ${scientific(c)} = ${scientific(oh)} mol dm⁻³`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_w/[OH⁻] = ${scientific(suppliedKw)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ]);
    }
    if (id === "water-ph-from-kw") {
      const item = pick(rng, data.kwValues), h = Math.sqrt(item.kw), ph = phOf(h);
      return question(id, level, seed, `At ${item.temperature} °C, calculate the pH of pure water.`, [kwRow(item.kw)], [
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `In pure water, [H⁺] = [OH⁻]`, `[H⁺] = √K_w = √(${scientific(item.kw)}) = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ]);
    }
    if (id === "strong-base-mass") {
      const base = monoBase(rng), mass = pick(rng, [0.800, 1.20, 1.60]), volume = pick(rng, [250, 500]);
      const n = mass / base.mr, c = n / (volume / 1000), oh = c, h = kw / oh, ph = phOf(h);
      return question(id, level, seed, `${dp(mass, 3)} g of ${base.name} is dissolved to make ${dp(volume, 1)} cm³ of solution at 25 °C. Calculate the pH.`, [["M_r", dp(base.mr, 1)], kwRow(kw)], [
        part(response("amount", "Calculate the amount of hydroxide.", `n(${base.formula})`, "mol", n), `n = m/M_r = ${dp(mass, 3)}/${dp(base.mr, 1)} = ${scientific(n)} mol`),
        part(response("oh", "Calculate [OH⁻].", "[OH⁻]", "mol dm⁻³", oh), `[OH⁻] = n/V = ${scientific(n)}/${dp(volume / 1000, 3)} = ${scientific(oh)} mol dm⁻³`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_w/[OH⁻] = ${scientific(kw)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ]);
    }
    if (id === "base-mass-concentration-dilution") {
      const base = monoBase(rng), massConcentration = pick(rng, [20.0, 24.0, 28.0]), stockV = pick(rng, [10, 20, 25]), finalV = pick(rng, [200, 250, 500]);
      const stockC = massConcentration / base.mr, n = stockC * stockV / 1000, oh = n / (finalV / 1000), h = kw / oh, ph = phOf(h);
      return question(id, level, seed, `${dp(stockV, 1)} cm³ of ${base.name} stock, with mass concentration ${dp(massConcentration, 1)} g dm⁻³, is diluted to ${dp(finalV, 1)} cm³ at 25 °C. Calculate the pH.`, [["M_r", dp(base.mr, 1)], kwRow(kw)], [part(response("ph", "Calculate the final pH.", "pH", "", ph, "dp2"),
        `c(stock) = ${dp(massConcentration, 1)}/${dp(base.mr, 1)} = ${scientific(stockC)} mol dm⁻³`,
        `n = cV = ${scientific(stockC)} × ${dp(stockV / 1000, 4)} = ${scientific(n)} mol`,
        `[OH⁻] = ${scientific(n)}/${dp(finalV / 1000, 4)} = ${scientific(oh)} mol dm⁻³`,
        `[H⁺] = K_w/[OH⁻] = ${scientific(kw)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)]);
    }
    if (id === "base-purity") {
      const base = monoBase(rng), sample = pick(rng, [1.00, 1.50, 2.00]), volume = pick(rng, [250, 500]), chosenPurity = pick(rng, [0.72, 0.80, 0.88]);
      const ohRaw = sample * chosenPurity / base.mr / (volume / 1000), measuredPH = Number(dp(phOf(kw / ohRaw), 2));
      const oh = kw / hOf(measuredPH), pureMass = oh * volume / 1000 * base.mr, purity = 100 * pureMass / sample;
      return question(id, level, seed, `A ${dp(sample, 3)} g impure sample of ${base.name} is dissolved to ${dp(volume, 1)} cm³. The impurities are inert and do not react with water. At 25 °C the pH is ${dp(measuredPH, 2)}. Calculate the percentage purity.`, [["M_r", dp(base.mr, 1)], kwRow(kw)], [part(response("purity", "Calculate the percentage purity.", "Purity", "%", purity),
        `[H⁺] = 10^(−${dp(measuredPH, 2)}) = ${scientific(hOf(measuredPH))} mol dm⁻³`, `[OH⁻] = K_w/[H⁺] = ${scientific(oh)} mol dm⁻³`,
        `n(${base.formula}) = [OH⁻]V = ${scientific(oh)} × ${dp(volume / 1000, 3)} = ${scientific(oh * volume / 1000)} mol`,
        `m(pure ${base.formula}) = nM_r = ${pureMass.toPrecision(3)} g`, `purity = ${pureMass.toPrecision(3)}/${dp(sample, 3)} × 100 = ${purity.toPrecision(3)}%`)]);
    }
    const ca = pick(rng, [0.100, 0.120]), va = pick(rng, [25, 30]), cb = pick(rng, [0.150, 0.180]), vb = pick(rng, [25, 30]);
    const nAcid = ca * va / 1000, nBase = cb * vb / 1000, excess = nBase - nAcid, totalV = (va + vb) / 1000, oh = excess / totalV, h = kw / oh, ph = phOf(h);
    return question(id, level, seed, "Sodium hydroxide is mixed with hydrochloric acid. The alkali is in excess and volumes are additive. Calculate the final pH at 25 °C.",
      [["[NaOH] / mol dm⁻³", scientific(cb)], ["NaOH volume / cm³", dp(vb, 1)], ["[HCl] / mol dm⁻³", scientific(ca)], ["HCl volume / cm³", dp(va, 1)], kwRow(kw)], [part(response("ph", "Calculate the final pH.", "pH", "", ph, "dp2"),
        `HCl + NaOH → NaCl + H₂O`, `n(NaOH) = ${scientific(nBase)} mol; n(HCl) = ${scientific(nAcid)} mol`,
        `n(OH⁻) remaining = ${scientific(excess)} mol`, `[OH⁻] = ${scientific(excess)}/${dp(totalV, 4)} = ${scientific(oh)} mol dm⁻³`,
        `[H⁺] = K_w/[OH⁻] = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)]);
  }

  function weakBuilder(id, rng, seed, level) {
    const acid = weakAcid(rng);
    const baseConcentration = pick(rng, [0.100, 0.150, 0.200, 0.250]);
    const acidPka = Number(dp(-log10(acid.ka), 2));
    const displayedKaFromPka = hOf(acidPka);
    if (id === "weak-acid-concentration-ph" || id === "weak-acid-pka-ph") {
      const ka = id === "weak-acid-pka-ph" ? displayedKaFromPka : acid.ka;
      const h = Math.sqrt(ka * baseConcentration), ph = phOf(h);
      const rows = id === "weak-acid-pka-ph" ? [["pK_a", dp(acidPka, 2)], [`[${acid.formula}] / mol dm⁻³`, scientific(baseConcentration)]] : [["K_a / mol dm⁻³", scientific(ka)], [`[${acid.formula}] / mol dm⁻³`, scientific(baseConcentration)]];
      const parts = [];
      if (id === "weak-acid-pka-ph") parts.push(part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", ka), `K_a = 10^(−pK_a) = 10^(−${dp(acidPka, 2)}) = ${scientific(ka)} mol dm⁻³`));
      parts.push(part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = √(K_a c) = √(${scientific(ka)} × ${scientific(baseConcentration)}) = ${scientific(h)} mol dm⁻³`));
      parts.push(part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`));
      return question(id, level, seed, `Calculate the pH of ${acid.name}.`, rows, parts, [weakAudit(acid.name, ka, baseConcentration)]);
    }
    if (id === "weak-acid-amount") {
      const mass = pick(rng, [3.00, 4.00, 5.00]), volume = pick(rng, [250, 400]), n = mass / acid.mr, c = n / (volume / 1000), h = Math.sqrt(acid.ka * c), ph = phOf(h);
      return question(id, level, seed, `${dp(mass, 3)} g of ${acid.name} is dissolved to make ${dp(volume, 1)} cm³ of solution. Calculate the pH.`, [["M_r", dp(acid.mr, 1)], ["K_a / mol dm⁻³", scientific(acid.ka)]], [
        part(response("amount", "Calculate the amount of acid.", `n(${acid.formula})`, "mol", n), `n = m/M_r = ${dp(mass, 3)}/${dp(acid.mr, 1)} = ${scientific(n)} mol`),
        part(response("concentration", "Calculate the acid concentration.", `[${acid.formula}]`, "mol dm⁻³", c), `c = n/V = ${scientific(n)}/${dp(volume / 1000, 3)} = ${scientific(c)} mol dm⁻³`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = √(K_a c) = √(${scientific(acid.ka)} × ${scientific(c)}) = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ], [weakAudit(acid.name, acid.ka, c)]);
    }
    if (["weak-acid-reverse-concentration", "weak-acid-ph-ka", "weak-acid-ph-pka", "weak-acid-percent", "weak-acid-pka-concentration"].includes(id)) {
      const sourceC = baseConcentration;
      const sourceKa = id === "weak-acid-pka-concentration" ? displayedKaFromPka : acid.ka;
      const shownPH = Number(dp(phOf(Math.sqrt(sourceKa * sourceC)), 2));
      const h = hOf(shownPH);
      const c = h * h / sourceKa;
      const ka = h * h / sourceC;
      const pka = -log10(ka);
      const percent = 100 * h / sourceC;
      const rows = [["pH", dp(shownPH, 2)]];
      if (["weak-acid-reverse-concentration", "weak-acid-percent"].includes(id)) rows.push(["K_a / mol dm⁻³", scientific(acid.ka)]);
      if (["weak-acid-ph-ka", "weak-acid-ph-pka", "weak-acid-percent"].includes(id)) rows.push([`[${acid.formula}] / mol dm⁻³`, scientific(sourceC)]);
      if (id === "weak-acid-pka-concentration") rows.push(["pK_a", dp(acidPka, 2)]);
      const hPart = part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = 10^(−${dp(shownPH, 2)}) = ${scientific(h)} mol dm⁻³`);
      if (id === "weak-acid-reverse-concentration" || id === "weak-acid-pka-concentration") {
        const kaUsed = id === "weak-acid-pka-concentration" ? displayedKaFromPka : acid.ka;
        const prefix = id === "weak-acid-pka-concentration" ? [part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", displayedKaFromPka), `K_a = 10^(−${dp(acidPka, 2)}) = ${scientific(displayedKaFromPka)} mol dm⁻³`)] : [];
        return question(id, level, seed, `Calculate the initial concentration of ${acid.name}.`, rows, [...prefix, hPart,
          part(response("concentration", "Calculate the initial acid concentration.", `[${acid.formula}]`, "mol dm⁻³", c), `c = [H⁺]²/K_a = (${scientific(h)})²/${scientific(kaUsed)} = ${scientific(c)} mol dm⁻³`)], [weakAudit(acid.name, kaUsed, c)]);
      }
      if (id === "weak-acid-ph-ka") return question(id, level, seed, `Calculate K_a for ${acid.name}.`, rows, [hPart, part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", ka), `K_a = [H⁺]²/c = (${scientific(h)})²/${scientific(sourceC)} = ${scientific(ka)} mol dm⁻³`)], [weakAudit(acid.name, ka, sourceC)]);
      if (id === "weak-acid-ph-pka") return question(id, level, seed, `Calculate pK_a for ${acid.name}.`, rows, [hPart, part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", ka), `K_a = [H⁺]²/c = ${scientific(ka)} mol dm⁻³`), part(response("pka", "Calculate pK_a.", "pK_a", "", pka, "dp2"), `pK_a = −log₁₀(${scientific(ka)}) = ${dp(pka, 2)}`)], [weakAudit(acid.name, ka, sourceC)]);
      return question(id, level, seed, `Calculate the percentage dissociation of ${acid.name}.`, rows, [hPart, part(response("percent", "Calculate percentage dissociation.", "Dissociation", "%", percent), `% dissociation = [H⁺]/c × 100 = ${scientific(h)}/${scientific(sourceC)} × 100 = ${percent.toPrecision(3)}%`)], [weakAudit(acid.name, acid.ka, sourceC)]);
    }
    if (id === "weak-acid-target-mass") {
      const volume = pick(rng, [250, 500]), targetRaw = phOf(Math.sqrt(acid.ka * baseConcentration)), target = Number(dp(targetRaw, 2));
      const h = hOf(target), c = h * h / acid.ka, n = c * volume / 1000, mass = n * acid.mr;
      return question(id, level, seed, `Prepare ${dp(volume, 1)} cm³ of ${acid.name} at pH ${dp(target, 2)}. Calculate the mass of pure acid required.`, [["K_a / mol dm⁻³", scientific(acid.ka)], ["M_r", dp(acid.mr, 1)]], [part(response("mass", "Calculate the required mass.", "Mass", "g", mass),
        `[H⁺] = 10^(−${dp(target, 2)}) = ${scientific(h)} mol dm⁻³`, `c = [H⁺]²/K_a = ${scientific(c)} mol dm⁻³`,
        `n = cV = ${scientific(c)} × ${dp(volume / 1000, 3)} = ${scientific(n)} mol`, `m = nM_r = ${scientific(n)} × ${dp(acid.mr, 1)} = ${mass.toPrecision(3)} g`)], [weakAudit(acid.name, acid.ka, c)]);
    }
    if (id === "weak-acid-purity") {
      const sample = pick(rng, [4.00, 5.00, 6.00]), volume = pick(rng, [250, 400]), chosen = pick(rng, [0.70, 0.80, 0.90]);
      const rawC = sample * chosen / acid.mr / (volume / 1000), measuredPH = Number(dp(phOf(Math.sqrt(acid.ka * rawC)), 2));
      const h = hOf(measuredPH), c = h * h / acid.ka, pureMass = c * volume / 1000 * acid.mr, purity = 100 * pureMass / sample;
      return question(id, level, seed, `A ${dp(sample, 3)} g impure sample of ${acid.name} is dissolved to ${dp(volume, 1)} cm³. The impurities are inert and do not ionise or react with water. The pH is ${dp(measuredPH, 2)}. Calculate the percentage purity.`, [["K_a / mol dm⁻³", scientific(acid.ka)], ["M_r", dp(acid.mr, 1)]], [part(response("purity", "Calculate the percentage purity.", "Purity", "%", purity),
        `[H⁺] = 10^(−${dp(measuredPH, 2)}) = ${scientific(h)} mol dm⁻³`, `c = [H⁺]²/K_a = ${scientific(c)} mol dm⁻³`,
        `m(pure acid) = cVM_r = ${scientific(c)} × ${dp(volume / 1000, 3)} × ${dp(acid.mr, 1)} = ${pureMass.toPrecision(3)} g`,
        `purity = ${pureMass.toPrecision(3)}/${dp(sample, 3)} × 100 = ${purity.toPrecision(3)}%`)], [weakAudit(acid.name, acid.ka, c)]);
    }
    const mass = pick(rng, [4.00, 5.00, 6.00]), purityFraction = pick(rng, [0.80, 0.90]), volume = pick(rng, [250, 400]);
    const c = mass * purityFraction / acid.mr / (volume / 1000), measuredPH = Number(dp(phOf(Math.sqrt(acid.ka * c)), 2)), h = hOf(measuredPH), ka = h * h / c;
    return question(id, level, seed, `${dp(mass, 3)} g of a ${dp(100 * purityFraction, 1)}% pure sample of ${acid.name} is dissolved to make ${dp(volume, 1)} cm³. The measured pH is ${dp(measuredPH, 2)}. Inert impurities do not ionise or react with water. Calculate K_a.`, [["M_r", dp(acid.mr, 1)]], [part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", ka),
      `m(pure acid) = ${dp(mass, 3)} × ${dp(purityFraction, 3)} = ${dp(mass * purityFraction, 3)} g`,
      `n = m/M_r = ${dp(mass * purityFraction, 3)}/${dp(acid.mr, 1)} = ${scientific(mass * purityFraction / acid.mr)} mol`,
      `c = n/V = ${scientific(c)} mol dm⁻³`, `[H⁺] = 10^(−${dp(measuredPH, 2)}) = ${scientific(h)} mol dm⁻³`,
      `K_a = [H⁺]²/c = (${scientific(h)})²/${scientific(c)} = ${scientific(ka)} mol dm⁻³`)], [weakAudit(acid.name, ka, c)]);
  }

  function makingBufferBuilder(id, rng, seed, level) {
    const acid = weakAcid(rng), acidAmount = pick(rng, [0.0200, 0.0250, 0.0300]), ratioChoice = pick(rng, [0.50, 0.75, 1.25, 1.50, 2.00]);
    const target = Number(dp(-log10(acid.ka) + log10(ratioChoice), 2));
    const h = hOf(target), ratio = acid.ka / h, saltAmount = ratio * acidAmount;
    const commonRows = [["Target pH", dp(target, 2)], ["K_a / mol dm⁻³", scientific(acid.ka)], [`Amount of ${acid.name} / mol`, scientific(acidAmount)]];
    const hPart = part(response("h", "Calculate the target [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = 10^(−${dp(target, 2)}) = ${scientific(h)} mol dm⁻³`);
    const ratioPart = part(response("ratio", "Calculate n(conjugate base)/n(acid).", `n(${acid.conjugate})/n(${acid.formula})`, "", ratio), `n(${acid.conjugate})/n(${acid.formula}) = K_a/[H⁺] = ${scientific(acid.ka)}/${scientific(h)} = ${ratio.toPrecision(3)}`);
    if (id === "buffer-component-ratio") return question(id, level, seed, `A buffer is to be made from ${acid.name} and ${acid.sodiumSalt}. Calculate the required component ratio.`, commonRows.slice(0, 2), [
      hPart,
      part(response("ratio", "Calculate n(conjugate base)/n(acid).", `n(${acid.conjugate})/n(${acid.formula})`, "", ratio), `ratio = K_a/[H⁺] = ${scientific(acid.ka)}/${scientific(h)} = ${ratio.toPrecision(3)}`)
    ], [bufferAudit(acidAmount, saltAmount)]);
    const saltPart = part(response("saltAmount", "Calculate the required salt amount.", `n(${acid.sodiumSaltFormula})`, "mol", saltAmount), `n(${acid.sodiumSaltFormula}) = ${ratio.toPrecision(3)} × ${scientific(acidAmount)} = ${scientific(saltAmount)} mol`);
    if (id === "buffer-salt-amount") return question(id, level, seed, `A buffer is to be made from ${acid.name} and ${acid.sodiumSalt}. Calculate the amount of salt required.`, commonRows, [hPart, ratioPart, saltPart], [bufferAudit(acidAmount, saltAmount)]);
    if (id === "buffer-salt-mass") {
      const mass = saltAmount * acid.saltMr;
      return question(id, level, seed, `A buffer is to be made from ${acid.name} and solid ${acid.sodiumSalt}. Calculate the salt mass required.`, [...commonRows, ["M_r of salt", dp(acid.saltMr, 1)]], [hPart, ratioPart, saltPart,
        part(response("mass", "Calculate the required salt mass.", "Mass", "g", mass), `m = nM_r = ${scientific(saltAmount)} × ${dp(acid.saltMr, 1)} = ${mass.toPrecision(3)} g`)
      ], [bufferAudit(acidAmount, saltAmount)]);
    }
    if (id === "buffer-salt-stock-volume") {
      const stock = pick(rng, [0.200, 0.250, 0.300]), stockV = saltAmount / stock * 1000;
      return question(id, level, seed, `A buffer is to be made from ${acid.name} and a ${dp(stock, 3)} mol dm⁻³ ${acid.sodiumSalt} stock solution. Calculate the salt-stock volume required.`, commonRows, [hPart, ratioPart, saltPart,
        part(response("volume", "Calculate the salt-stock volume.", "Volume", "cm³", stockV), `V = n/c = ${scientific(saltAmount)}/${dp(stock, 3)} = ${scientific(stockV / 1000)} dm³ = ${stockV.toPrecision(3)} cm³`)
      ], [bufferAudit(acidAmount, saltAmount)]);
    }
    if (id === "buffer-partial-target-alkali") {
      const acidC = pick(rng, [0.150, 0.200]), acidV = pick(rng, [100, 150]), alkaliC = pick(rng, [0.100, 0.150]), finalV = 500;
      const initial = acidC * acidV / 1000, added = initial * ratio / (1 + ratio), alkaliV = added / alkaliC * 1000;
      return question(id, level, seed, `${dp(acidV, 1)} cm³ of ${dp(acidC, 3)} mol dm⁻³ ${acid.name} is partially neutralised with ${dp(alkaliC, 3)} mol dm⁻³ sodium hydroxide, then diluted to ${dp(finalV, 1)} cm³. Calculate the alkali volume needed for pH ${dp(target, 2)}.`, [["K_a / mol dm⁻³", scientific(acid.ka)]], [part(response("volume", "Calculate the sodium hydroxide volume.", "Volume", "cm³", alkaliV),
        `[H⁺] = 10^(−${dp(target, 2)}) = ${scientific(h)} mol dm⁻³`, `n(A⁻)/n(HA) = K_a/[H⁺] = ${ratio.toPrecision(3)}`,
        `n(HA) initially = ${dp(acidC, 3)} × ${dp(acidV / 1000, 3)} = ${scientific(initial)} mol`,
        `x/(${scientific(initial)} − x) = ${ratio.toPrecision(3)}; x = ${scientific(added)} mol OH⁻`,
        `V(NaOH) = x/c = ${scientific(added)}/${dp(alkaliC, 3)} = ${scientific(alkaliV / 1000)} dm³ = ${alkaliV.toPrecision(3)} cm³`,
        `Recipe: mix ${dp(acidV, 1)} cm³ acid with ${alkaliV.toPrecision(3)} cm³ NaOH, then make up to ${dp(finalV, 1)} cm³.`)], [bufferAudit(initial - added, added),
        { name: "preparation volume", valid: acidV + alkaliV < finalV, detail: `Combined reagent volume ${dp(acidV + alkaliV, 1)} cm³ is below the ${dp(finalV, 1)} cm³ final volume.` }]);
    }
    const acidStock = pick(rng, [0.150, 0.200]), saltStock = pick(rng, [0.100, 0.250]), finalV = pick(rng, [200, 250, 500]);
    const saltV = ratio * acidStock * finalV / (saltStock + ratio * acidStock), acidV = finalV - saltV;
    return question(id, level, seed, `Prepare ${dp(finalV, 1)} cm³ of a pH ${dp(target, 2)} buffer using ${dp(acidStock, 3)} mol dm⁻³ ${acid.name} and ${dp(saltStock, 3)} mol dm⁻³ ${acid.sodiumSalt}. Use only these two solutions and assume their volumes are additive. Calculate the salt-stock volume.`, [["K_a / mol dm⁻³", scientific(acid.ka)]], [part(response("volume", "Calculate the salt-stock volume.", "Volume", "cm³", saltV),
      `[H⁺] = 10^(−${dp(target, 2)}) = ${scientific(h)} mol dm⁻³`, `n(A⁻)/n(HA) = K_a/[H⁺] = ${ratio.toPrecision(3)}`,
      `${dp(saltStock, 3)}V_s/[${dp(acidStock, 3)}(${dp(finalV, 1)} − V_s)] = ${ratio.toPrecision(3)}`,
      `V_s = ${saltV.toPrecision(3)} cm³; V_acid = ${dp(finalV, 1)} − ${saltV.toPrecision(3)} = ${acidV.toPrecision(3)} cm³`,
      `Recipe: mix ${acidV.toPrecision(3)} cm³ acid stock with ${saltV.toPrecision(3)} cm³ salt stock.`)], [bufferAudit(acidStock * acidV / 1000, saltStock * saltV / 1000)]);
  }

  function bufferBuilder(id, rng, seed, level) {
    const acid = weakAcid(rng);
    if (id === "buffer-direct") {
      const cHA = pick(rng, [0.100, 0.150, 0.200]), ratio = pick(rng, [0.50, 0.75, 1.25, 1.50, 2.00]), cA = cHA * ratio, h = acid.ka * cHA / cA, ph = phOf(h);
      return question(id, level, seed, `A buffer contains ${acid.name} and ${acid.sodiumSalt}. Calculate its pH.`, [["K_a / mol dm⁻³", scientific(acid.ka)], [`[${acid.formula}] / mol dm⁻³`, scientific(cHA)], [`[${acid.conjugate}] / mol dm⁻³`, scientific(cA)]], [
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_a[HA]/[A⁻] = ${scientific(acid.ka)} × ${scientific(cHA)}/${scientific(cA)} = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ], [bufferAudit(cHA, cA)]);
    }
    if (id === "buffer-mixed-volumes") {
      const ca = pick(rng, [0.100, 0.150, 0.200]), cs = pick(rng, [0.100, 0.150, 0.200]), va = pick(rng, [50, 100]), vs = pick(rng, [50, 75]);
      const nHA = ca * va / 1000, nA = cs * vs / 1000, h = acid.ka * nHA / nA, ph = phOf(h);
      return question(id, level, seed, `The listed ${acid.name} and ${acid.sodiumSalt} solutions are mixed. Volumes are additive. Calculate the pH.`, [[`[${acid.formula}] / mol dm⁻³`, scientific(ca)], ["Acid volume / cm³", dp(va, 1)], [`[${acid.sodiumSaltFormula}] / mol dm⁻³`, scientific(cs)], ["Salt volume / cm³", dp(vs, 1)], ["K_a / mol dm⁻³", scientific(acid.ka)]], [
        part(response("nHA", "Calculate the acid amount.", `n(${acid.formula})`, "mol", nHA), `n(HA) = cV = ${scientific(ca)} × ${dp(va / 1000, 3)} = ${scientific(nHA)} mol`),
        part(response("nA", "Calculate the conjugate-base amount.", `n(${acid.conjugate})`, "mol", nA), `n(A⁻) = cV = ${scientific(cs)} × ${dp(vs / 1000, 3)} = ${scientific(nA)} mol`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_a n(HA)/n(A⁻) = ${scientific(acid.ka)} × ${scientific(nHA)}/${scientific(nA)} = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ], [bufferAudit(nHA, nA)]);
    }
    if (id === "partial-buffer-moles") {
      const initial = pick(rng, [0.0250, 0.0300, 0.0350]), fraction = pick(rng, [0.30, 0.40, 0.50]), added = initial * fraction, remaining = initial - added, h = acid.ka * remaining / added, ph = phOf(h);
      return question(id, level, seed, `${scientific(initial)} mol ${acid.name} is partially neutralised by ${scientific(added)} mol hydroxide ions. Calculate the pH of the resulting buffer.`, [["K_a / mol dm⁻³", scientific(acid.ka)]], [
        part(response("remaining", "Calculate the acid amount remaining.", `n(${acid.formula})`, "mol", remaining), `HA + OH⁻ → A⁻ + H₂O`, `n(HA) remaining = ${scientific(initial)} − ${scientific(added)} = ${scientific(remaining)} mol`),
        part(response("formed", "Calculate the conjugate-base amount formed.", `n(${acid.conjugate})`, "mol", added), `n(A⁻) formed = n(OH⁻) = ${scientific(added)} mol`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_a n(HA)/n(A⁻) = ${scientific(acid.ka)} × ${scientific(remaining)}/${scientific(added)} = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ], [bufferAudit(remaining, added)]);
    }
    if (id === "partial-buffer-solutions") {
      const ca = pick(rng, [0.150, 0.200]), va = pick(rng, [150, 200]), cb = pick(rng, [0.100, 0.150]), vb = pick(rng, [75, 100]);
      const initial = ca * va / 1000, added = cb * vb / 1000, remaining = initial - added, h = acid.ka * remaining / added, ph = phOf(h);
      return question(id, level, seed, `${dp(va, 1)} cm³ of ${dp(ca, 3)} mol dm⁻³ ${acid.name} is mixed with ${dp(vb, 1)} cm³ of ${dp(cb, 3)} mol dm⁻³ sodium hydroxide. Calculate the pH.`, [["K_a / mol dm⁻³", scientific(acid.ka)]], [
        part(response("initial", "Calculate the initial acid amount.", `n(${acid.formula})`, "mol", initial), `n(HA) = ${dp(ca, 3)} × ${dp(va / 1000, 3)} = ${scientific(initial)} mol`),
        part(response("added", "Calculate the hydroxide amount.", "n(OH⁻)", "mol", added), `n(OH⁻) = ${dp(cb, 3)} × ${dp(vb / 1000, 3)} = ${scientific(added)} mol`),
        part(response("remaining", "Calculate the acid amount remaining.", `n(${acid.formula}) remaining`, "mol", remaining), `HA + OH⁻ → A⁻ + H₂O`, `n(HA) remaining = ${scientific(initial)} − ${scientific(added)} = ${scientific(remaining)} mol`),
        part(response("formed", "Calculate the conjugate-base amount formed.", `n(${acid.conjugate})`, "mol", added), `n(A⁻) formed = ${scientific(added)} mol`),
        part(response("h", "Calculate [H⁺].", "[H⁺]", "mol dm⁻³", h), `[H⁺] = K_a n(HA)/n(A⁻) = ${scientific(h)} mol dm⁻³`),
        part(response("ph", "Calculate pH.", "pH", "", ph, "dp2"), `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)
      ], [bufferAudit(remaining, added)]);
    }
    if (id === "buffer-after-addition") {
      const nHA = pick(rng, [0.0180, 0.0200, 0.0240]), nA = pick(rng, [0.0180, 0.0210, 0.0240]), added = pick(rng, [0.00100, 0.00150, 0.00200]), acidAddition = rng() < 0.5;
      const newHA = acidAddition ? nHA + added : nHA - added, newA = acidAddition ? nA - added : nA + added, h = acid.ka * newHA / newA, ph = phOf(h), reagent = acidAddition ? "hydrochloric acid" : "sodium hydroxide";
      return question(id, level, seed, `A ${acid.name}/${acid.sodiumSalt} buffer contains ${scientific(nHA)} mol acid and ${scientific(nA)} mol conjugate base. ${scientific(added)} mol ${reagent} is added. Calculate the new pH.`, [["K_a / mol dm⁻³", scientific(acid.ka)]], [part(response("ph", "Calculate the new pH.", "pH", "", ph, "dp2"),
        `${acidAddition ? "A⁻ + H⁺ → HA" : "HA + OH⁻ → A⁻ + H₂O"}`, `n(HA) after reaction = ${scientific(newHA)} mol; n(A⁻) after reaction = ${scientific(newA)} mol`,
        `[H⁺] = K_a n(HA)/n(A⁻) = ${scientific(acid.ka)} × ${scientific(newHA)}/${scientific(newA)} = ${scientific(h)} mol dm⁻³`,
        `pH = −log₁₀(${scientific(h)}) = ${dp(ph, 2)}`)], [bufferAudit(newHA, newA)]);
    }
    if (id === "buffer-recipe-deviation") {
      const targetAcidMass = pick(rng, [1.50, 2.00, 2.50]), targetSaltMass = pick(rng, [1.80, 2.20, 2.60]), acidError = pick(rng, [-0.080, -0.050, 0.060]), saltError = pick(rng, [-0.060, 0.050, 0.090]);
      const intendedHA = targetAcidMass / acid.mr, intendedA = targetSaltMass / acid.saltMr, targetPH = phOf(acid.ka * intendedHA / intendedA);
      const actualAcidMass = targetAcidMass + acidError, actualSaltMass = targetSaltMass + saltError, actualHA = actualAcidMass / acid.mr, actualA = actualSaltMass / acid.saltMr, actualPH = phOf(acid.ka * actualHA / actualA), difference = Math.abs(actualPH - targetPH);
      return question(id, level, seed, `A ${acid.name}/${acid.sodiumSalt} buffer recipe specifies ${dp(targetAcidMass, 3)} g acid and ${dp(targetSaltMass, 3)} g salt. The acid weighing error is ${acidError >= 0 ? "+" : ""}${dp(acidError, 3)} g and the salt weighing error is ${saltError >= 0 ? "+" : ""}${dp(saltError, 3)} g. Calculate the absolute difference between the actual and intended pH.`, [["K_a / mol dm⁻³", scientific(acid.ka)], [`M_r(${acid.formula})`, dp(acid.mr, 1)], [`M_r(${acid.sodiumSaltFormula})`, dp(acid.saltMr, 1)]], [part(response("difference", "Calculate the absolute pH difference.", "pH difference", "", difference, "dp2"),
        `Intended n(HA) = ${dp(targetAcidMass, 3)}/${dp(acid.mr, 1)} = ${scientific(intendedHA)} mol; intended n(A⁻) = ${dp(targetSaltMass, 3)}/${dp(acid.saltMr, 1)} = ${scientific(intendedA)} mol`,
        `pH(intended) = −log₁₀(K_a n(HA)/n(A⁻)) = ${dp(targetPH, 2)}`,
        `Actual masses: acid = ${dp(actualAcidMass, 3)} g; salt = ${dp(actualSaltMass, 3)} g`,
        `Actual n(HA) = ${scientific(actualHA)} mol; actual n(A⁻) = ${scientific(actualA)} mol`,
        `pH(actual) = −log₁₀(${scientific(acid.ka * actualHA / actualA)}) = ${dp(actualPH, 2)}`,
        `Absolute difference = |${dp(actualPH, 4)} − ${dp(targetPH, 4)}| = ${difference.toFixed(4)} pH units = ${dp(difference, 2)} pH units (2 d.p.)`)], [bufferAudit(actualHA, actualA), bufferAudit(intendedHA, intendedA)]);
    }
    const acidC = pick(rng, [0.150, 0.200]), acidV = pick(rng, [100, 150]), baseC = pick(rng, [0.100, 0.150]), baseV = pick(rng, [50, 75]);
    const initial = acidC * acidV / 1000, added = baseC * baseV / 1000, remaining = initial - added;
    const referencePH = Number(dp(phOf(acid.ka * remaining / added), 2)), h = hOf(referencePH), ka = h * added / remaining;
    return question(id, level, seed, `${dp(acidV, 1)} cm³ of ${dp(acidC, 3)} mol dm⁻³ ${acid.name} is partially neutralised by ${dp(baseV, 1)} cm³ of ${dp(baseC, 3)} mol dm⁻³ sodium hydroxide. The resulting pH is ${dp(referencePH, 2)}. Calculate K_a.`, [], [part(response("ka", "Calculate K_a.", "K_a", "mol dm⁻³", ka),
      `n(HA) initially = ${dp(acidC, 3)} × ${dp(acidV / 1000, 3)} = ${scientific(initial)} mol`, `n(OH⁻) = ${dp(baseC, 3)} × ${dp(baseV / 1000, 3)} = ${scientific(added)} mol`,
      `HA + OH⁻ → A⁻ + H₂O; n(HA) remaining = ${scientific(remaining)} mol; n(A⁻) = ${scientific(added)} mol`,
      `[H⁺] = 10^(−${dp(referencePH, 2)}) = ${scientific(h)} mol dm⁻³`, `K_a = [H⁺]n(A⁻)/n(HA) = ${scientific(h)} × ${scientific(added)}/${scientific(remaining)} = ${scientific(ka)} mol dm⁻³`)], [bufferAudit(remaining, added)]);
  }

  const strongIds = new Set(["h-to-ph", "ph-to-h", "strong-acid-direct", "strong-acid-dilution", "strong-acid-preparation", "strong-acid-neutralisation"]);
  const baseIds = new Set(["strong-base-direct", "water-ph-from-kw", "dihydroxide-direct", "strong-base-mass", "temperature-base", "base-mass-concentration-dilution", "base-purity", "excess-strong-base"]);
  const weakIds = new Set(["weak-acid-concentration-ph", "weak-acid-pka-ph", "weak-acid-amount", "weak-acid-reverse-concentration", "weak-acid-ph-ka", "weak-acid-ph-pka", "weak-acid-percent", "weak-acid-pka-concentration", "weak-acid-target-mass", "weak-acid-purity", "weak-acid-preparation-ka"]);
  const makingIds = new Set(["buffer-component-ratio", "buffer-salt-amount", "buffer-salt-mass", "buffer-salt-stock-volume", "buffer-partial-target-alkali", "buffer-target-volume-stocks"]);

  function templatesFor(scopeId, level) {
    const scope = scopeMap.get(scopeId);
    return scope && scope.levels[Number(level)] ? scope.levels[Number(level)].slice() : [];
  }
  function scopeFor(id) { return scopeMap.get(id) || null; }
  function chooseTemplate(scopeId, level, used, random) {
    const eligible = templatesFor(scopeId, level);
    if (!eligible.length) throw new Error("No templates are available for this scope and level.");
    const prior = Array.isArray(used) ? used.filter((id) => eligible.includes(id)) : [];
    const remaining = eligible.filter((id) => !prior.includes(id));
    const pool = remaining.length ? remaining : eligible;
    const r = random == null ? Math.random() : Number(random);
    if (!Number.isFinite(r) || r < 0 || r >= 1) throw new Error("Template random value must be in [0, 1).");
    const chosen = pool[Math.floor(r * pool.length)];
    return { templateId: chosen, used: remaining.length ? prior.concat(chosen) : [chosen] };
  }
  function validSeed(seed) {
    const value = Number(seed);
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new Error("Seed must be an unsigned 32-bit integer.");
    return value;
  }
  function reviewId(templateId, level, seed) {
    const index = templateIndex.get(templateId), numericLevel = Number(level), numericSeed = validSeed(seed);
    if (index == null || ![1, 2, 3].includes(numericLevel)) throw new Error("Unsupported acid-base review configuration.");
    return `AB2-${index.toString(36).toUpperCase()}-${numericLevel}-${numericSeed.toString(36).toUpperCase()}`;
  }
  function decodeV2(id) {
    const text = String(id || "").trim().toUpperCase();
    const match = text.match(/^AB2-([0-9A-Z]{1,2})-([123])-([0-9A-Z]{1,7})$/);
    if (!match) throw new Error("Invalid version 2 acid-base review ID.");
    const index = Number.parseInt(match[1], 36), level = Number(match[2]), seed = Number.parseInt(match[3], 36);
    if (match[1] !== index.toString(36).toUpperCase() || match[3] !== seed.toString(36).toUpperCase()) throw new Error("Non-canonical version 2 acid-base review ID.");
    const template = templates[index];
    if (!template || !Number.isSafeInteger(seed) || seed > 0xffffffff || !scopes.some((scope) => scope.levels[level].includes(template.id))) throw new Error("Unknown acid-base review template or level.");
    return { templateId: template.id, level, seed };
  }
  function generate(templateId, level, seed) {
    const numericLevel = Number(level), numericSeed = validSeed(seed);
    if (![1, 2, 3].includes(numericLevel) || !templates.some((template) => template.id === templateId) || !scopes.some((scope) => scope.levels[numericLevel].includes(templateId))) throw new Error("Template is not available at this level.");
    const rng = rng32(numericSeed);
    let generated;
    if (strongIds.has(templateId)) generated = strongBuilder(templateId, rng, numericSeed, numericLevel);
    else if (baseIds.has(templateId)) generated = baseBuilder(templateId, rng, numericSeed, numericLevel);
    else if (weakIds.has(templateId)) generated = weakBuilder(templateId, rng, numericSeed, numericLevel);
    else if (makingIds.has(templateId)) generated = makingBufferBuilder(templateId, rng, numericSeed, numericLevel);
    else generated = bufferBuilder(templateId, rng, numericSeed, numericLevel);
    return Object.freeze(Object.assign({}, generated, { reviewId: reviewId(templateId, numericLevel, numericSeed) }));
  }
  function generateFromReview(id) {
    const text = String(id || "").trim().toUpperCase();
    if (text.startsWith("AB2-")) {
      const decoded = decodeV2(text);
      return generate(decoded.templateId, decoded.level, decoded.seed);
    }
    if (text.startsWith("AB-") || text.startsWith("ABL-")) {
      const historical = compatibilityModel.generateFromReview(text);
      return Object.freeze(Object.assign({}, historical, { reviewId: text, legacy: true }));
    }
    throw new Error("Invalid acid-base review ID.");
  }
  const superscripts = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
  function strictNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const text = String(value == null ? "" : value).trim().replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => superscripts[c]).replace(/,/g, "").replace(/−/g, "-");
    if (!text) return NaN;
    const atom = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
    const power = text.match(new RegExp(`^(${atom})\\s*(?:×|x|\\*)\\s*10\\s*\\^?\\s*([+-]?\\d+)$`, "i"));
    if (power) return Number(power[1]) * 10 ** Number(power[2]);
    return new RegExp(`^${atom}(?:e[+-]?\\d+)?$`, "i").test(text) ? Number(text) : NaN;
  }
  function score(values, responses) {
    if (!Array.isArray(values) || !Array.isArray(responses) || values.length !== responses.length || values.some((value) => !String(value).trim())) return { accepted: false, reason: "Complete every required numerical response before checking." };
    const results = responses.map((item, index) => {
      const entered = strictNumber(values[index]);
      return { entered, status: Number.isFinite(entered) && Math.abs(entered - item.expected) <= item.tolerance ? "correct" : Number.isFinite(entered) ? "incorrect" : "missing" };
    });
    if (results.some((item) => item.status === "missing")) return { accepted: false, reason: "Enter a valid number in every required response before checking.", results };
    const correct = results.filter((item) => item.status === "correct").length;
    return { accepted: true, results, score: correct === responses.length ? 1 : correct ? 0.5 : 0 };
  }
  function nextLevel(mode, fixedLevel, api, leafId) { return mode === "mastery" ? api.nextLevel(leafId) : Number(fixedLevel); }

  root.AcidBaseLevels = Object.freeze({ version, LEVEL_LABELS, scopes, templates, scopeFor, templatesFor, chooseTemplate, generate, generateFromReview, score, nextLevel, decodeV2, reviewId });
})(typeof globalThis !== "undefined" ? globalThis : window);
