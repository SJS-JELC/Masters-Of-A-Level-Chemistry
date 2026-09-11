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
