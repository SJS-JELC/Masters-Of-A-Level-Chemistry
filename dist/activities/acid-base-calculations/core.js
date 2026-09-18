(function (root) {
  "use strict";

  const data = root.AcidBaseData;
  if (!data) throw new Error("AcidBaseData must be loaded before core.js");

  const log10 = (x) => Math.log(x) / Math.LN10;
  const pH = (h) => -log10(h);
  const hFromPH = (value) => 10 ** (-value);
  const supMap = { "-": "⁻", "+": "⁺", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pick(rng, values) {
    return values[Math.floor(rng() * values.length)];
  }

  function rounded(value, dp) {
    return Number(value.toFixed(dp));
  }

  function superscript(value) {
    return String(value).split("").map((character) => supMap[character] || character).join("");
  }

  function scientific(value, sf) {
    const figures = sf || 3;
    if (value === 0) return "0";
    const exponent = Math.floor(log10(Math.abs(value)));
    const coefficient = value / (10 ** exponent);
    return `${coefficient.toFixed(Math.max(0, figures - 1))} × 10${superscript(exponent)}`;
  }

  function decimal(value, dp) {
    return Number(value).toFixed(dp);
  }

  function display(value, format, legacy) {
    if (format === "dp2") return decimal(value, 2);
    if (format === "dp3") return decimal(value, 3);
    if (format === "integer") return decimal(value, 0);
    const figures = format === "sf4" ? 4 : 3;
    const roundedDisplay = Number(value.toPrecision(figures));
    if (!legacy && Math.abs(roundedDisplay) >= 0.001 && Math.abs(roundedDisplay) <= 10000) return roundedDisplay.toFixed(Math.max(0, figures - 1 - Math.floor(Math.log10(Math.abs(roundedDisplay)))));
    if (format === "sf4") return scientific(value, 4);
    return scientific(value, 3);
  }

  function tolerance(value, format) {
    if (format === "dp2") return 0.0051;
    if (format === "dp3") return 0.00051;
    if (format === "integer") return 0.51;
    const sf = format === "sf4" ? 4 : 3;
    if (!value) return 0.5 * 10 ** (1 - sf);
    return 0.51 * 10 ** (Math.floor(log10(Math.abs(value))) - sf + 1);
  }

  function response(key, prompt, symbol, unit, expected, format) {
    return Object.freeze({
      key, prompt, symbol, unit: unit || "", expected,
      format: format || "sf3",
      tolerance: tolerance(expected, format || "sf3")
    });
  }

  function makeQuestion(intro, rows, steps, working, audit) {
    const completeWorking = working.map((line) => /^pH = [0-9.]+$/.test(line) ? line.replace("pH = ", "pH = −log₁₀[H⁺] = ") : line);
    return { intro, rows, steps, working: completeWorking, audit: audit || [] };
  }

  function row(label, value) {
    return Object.freeze({ label, value: String(value) });
  }

  function weakAudit(acid, concentration) {
    const approximate = Math.sqrt(acid.ka * concentration);
    const exact = (-acid.ka + Math.sqrt(acid.ka ** 2 + 4 * acid.ka * concentration)) / 2;
    const dissociation = 100 * approximate / concentration;
    return {
      name: "weak-acid approximation",
      valid: dissociation < 5,
      detail: `${acid.name}: ${dissociation.toFixed(2)}% dissociation; approximate/exact [H⁺] ratio ${(approximate / exact).toFixed(4)}`
    };
  }

  function acid(rng) { return pick(rng, data.weakAcids); }
  function strongAcid(rng) { return pick(rng, data.strongAcids); }
  function monoBase(rng) { return pick(rng, data.strongBases.filter((item) => item.hydroxides === 1)); }
  function diBase(rng) { return pick(rng, data.strongBases.filter((item) => item.hydroxides === 2)); }

  function greatestCommonDivisor(a, b) {
    return b ? greatestCommonDivisor(b, a % b) : a;
  }

  function coefficient(value, formula) {
    return `${value === 1 ? "" : value}${formula}`;
  }

  function ratioMultiplier(value) {
    return String(Number(value.toFixed(3)));
  }

  function neutralisationRatio(acidItem, baseItem) {
    const divisor = greatestCommonDivisor(acidItem.protons, baseItem.hydroxides);
    return `${acidItem.formula} : ${baseItem.formula}\n${baseItem.hydroxides / divisor} : ${acidItem.protons / divisor}`;
  }

  function neutralisationEquation(acidItem, baseItem) {
    const salts = {
      hcl: { naoh: "NaCl", koh: "KCl", baoh2: "BaCl₂", sroh2: "SrCl₂" },
      hno3: { naoh: "NaNO₃", koh: "KNO₃", baoh2: "Ba(NO₃)₂", sroh2: "Sr(NO₃)₂" },
      h2so4: { naoh: "Na₂SO₄", koh: "K₂SO₄", baoh2: "BaSO₄", sroh2: "SrSO₄" }
    };
    const reactingUnits = acidItem.protons * baseItem.hydroxides / greatestCommonDivisor(acidItem.protons, baseItem.hydroxides);
    const acidCoefficient = reactingUnits / acidItem.protons;
    const baseCoefficient = reactingUnits / baseItem.hydroxides;
    return `${coefficient(acidCoefficient, acidItem.formula)} + ${coefficient(baseCoefficient, baseItem.formula)} → ${salts[acidItem.id][baseItem.id]} + ${coefficient(reactingUnits, "H₂O")}`;
  }

  function strongAcidDissociationEquation(item) {
    return item.protons === 2 ? `${item.formula} → 2H⁺ + SO₄²⁻` : "";
  }

  function dihydroxideDissociationEquation(item) {
    const ion = item.id === "baoh2" ? "Ba²⁺" : "Sr²⁺";
    return `${item.formula} → ${ion} + 2OH⁻`;
  }

  function directHToPH(rng) {
    const h = pick(rng, [0.025, 0.040, 0.075, 0.150, 0.0025, 3.20e-4]);
    const answer = pH(h);
    return makeQuestion("Calculate the pH of a solution with the hydrogen-ion concentration shown.", [row("[H⁺] / mol dm⁻³", scientific(h))],
      [response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`pH = −log₁₀[H⁺]`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function directPHToH(rng) {
    const givenPH = pick(rng, [1.25, 1.60, 2.35, 3.20, 4.85]);
    const h = hFromPH(givenPH);
    return makeQuestion("Calculate the hydrogen-ion concentration of the solution.", [row("pH", decimal(givenPH, 2))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h)],
      [`[H⁺] = 10⁻ᵖᴴ`, `[H⁺] = 10⁻${decimal(givenPH, 2)} = ${scientific(h)} mol dm⁻³`]);
  }

  function strongAcidDirect(rng) {
    const item = strongAcid(rng);
    const c = pick(rng, [0.0250, 0.0500, 0.0750, 0.150, 0.250]);
    const h = item.protons * c;
    const answer = pH(h);
    return makeQuestion(`${item.formula} is a strong acid. Assume that each mole of ${item.formula} supplies ${item.protons} mol of H⁺. Calculate the pH of the solution.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(c))],
      [response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [strongAcidDissociationEquation(item), `[H⁺] = ${item.protons} × [${item.formula}] = ${item.protons} × ${scientific(c)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`].filter(Boolean));
  }

  function strongBaseDirect(rng) {
    const item = monoBase(rng);
    const c = pick(rng, [0.0125, 0.0250, 0.0400, 0.0750, 0.125]);
    const h = 1e-14 / c;
    const answer = pH(h);
    return makeQuestion(`${item.formula} is a strong alkali. Use K_w = 1.00 × 10⁻¹⁴ mol² dm⁻⁶ to calculate the pH.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(c))],
      [response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`[OH⁻] = [${item.formula}] = ${scientific(c)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(1e-14)}/${scientific(c)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function waterPH(rng) {
    const item = pick(rng, data.kwValues);
    const h = Math.sqrt(item.kw);
    const answer = pH(h);
    return makeQuestion(`At ${item.temperature} °C, pure water has the K_w value shown.`, [row("K_w / mol² dm⁻⁶", scientific(item.kw))],
      [response("h", "Calculate the hydrogen ion concentration in pure water.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH of pure water.", "pH", "", answer, "dp2")],
      [`In pure water, [H⁺] = [OH⁻]`, `[H⁺] = √K_w = √(${scientific(item.kw)}) = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function weakAcidDirect(rng) {
    const item = acid(rng);
    const c = pick(rng, [0.100, 0.150, 0.200, 0.250, 0.300]);
    const h = Math.sqrt(item.ka * c);
    const answer = pH(h);
    return makeQuestion(`Calculate the pH of ${item.name}. Assume [H⁺] = [${item.conjugate}].`,
      [row("K_a / mol dm⁻³", scientific(item.ka)), row(`[${item.formula}] / mol dm⁻³`, scientific(c))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`K_a = [H⁺]²/[${item.formula}]`, `[H⁺] = √(K_a × [${item.formula}]) = √(${scientific(item.ka)} × ${scientific(c)}) = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`], [weakAudit(item, c)]);
  }

  function bufferDirect(rng) {
    const item = acid(rng);
    const cHA = pick(rng, [0.100, 0.150, 0.200, 0.250]);
    const ratio = pick(rng, [0.50, 0.75, 1.25, 1.50, 2.00]);
    const cA = cHA * ratio;
    const h = item.ka * cHA / cA;
    const answer = pH(h);
    return makeQuestion(`A buffer contains ${item.name} and ${item.sodiumSalt}. Calculate its pH.`,
      [row("K_a / mol dm⁻³", scientific(item.ka)), row(`[${item.formula}] / mol dm⁻³`, scientific(cHA)), row(`[${item.conjugate}] / mol dm⁻³`, scientific(cA))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`[H⁺] = K_a × [${item.formula}]/[${item.conjugate}]`, `[H⁺] = ${scientific(item.ka)} × ${scientific(cHA)}/${scientific(cA)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function neutralisationDirect(rng) {
    const a = strongAcid(rng);
    const b = pick(rng, data.strongBases);
    const ca = pick(rng, [0.0800, 0.100, 0.125, 0.150]);
    const va = pick(rng, [20.0, 25.0, 30.0]);
    const cb = pick(rng, [0.0800, 0.100, 0.125]);
    const na = ca * va / 1000;
    const reactingMultiplier = a.protons / b.hydroxides;
    const nb = na * reactingMultiplier;
    const vb = nb / cb * 1000;
    return makeQuestion(`${a.formula} is neutralised exactly by ${b.formula}. Calculate the volume of alkali required.`,
      [row(`[${a.formula}] / mol dm⁻³`, scientific(ca)), row(`Volume of ${a.formula} / cm³`, decimal(va, 1)), row(`[${b.formula}] / mol dm⁻³`, scientific(cb))],
      [response("moles", `Calculate the number of moles of ${a.formula}.`, `n(${a.formula})`, "mol", na), response("volume", `Calculate the volume of ${b.formula}.`, `Volume of ${b.formula}`, "cm³", vb, "dp2")],
      [`n(${a.formula}) = [${a.formula}] × volume of ${a.formula} = ${scientific(ca)} × ${decimal(va / 1000, 4)} = ${scientific(na)} mol`, neutralisationEquation(a, b), neutralisationRatio(a, b), `n(${b.formula}) = ${ratioMultiplier(reactingMultiplier)} × n(${a.formula}) = ${ratioMultiplier(reactingMultiplier)} × ${scientific(na)} = ${scientific(nb)} mol`, `Volume of ${b.formula} = n(${b.formula})/[${b.formula}] = ${scientific(nb)}/${scientific(cb)} = ${decimal(vb / 1000, 5)} dm³ = ${decimal(vb, 2)} cm³`]);
  }

  function strongAcidDilution(rng) {
    const item = strongAcid(rng);
    const c1 = pick(rng, [0.400, 0.500, 0.600, 0.800]);
    const v1 = pick(rng, [10.0, 20.0, 25.0]);
    const v2 = pick(rng, [100.0, 200.0, 250.0]);
    const amount = c1 * (v1 / 1000);
    const c2 = amount / (v2 / 1000);
    const h = item.protons * c2;
    const answer = pH(h);
    return makeQuestion(`${decimal(v1, 1)} cm³ of ${item.formula} is diluted with water to ${decimal(v2, 1)} cm³. Assume that each mole of ${item.formula} supplies ${item.protons} mol of H⁺. Calculate the pH of the diluted solution.`,
      [row(`Initial [${item.formula}] / mol dm⁻³`, scientific(c1))],
      [response("amount", `Calculate the number of moles of ${item.formula} transferred.`, `n(${item.formula})`, "mol", amount), response("concentration", "Calculate the diluted acid concentration.", `[${item.formula}]`, "mol dm⁻³", c2), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`n(${item.formula}) = initial [${item.formula}] × transferred volume`, `n(${item.formula}) = ${scientific(c1)} × ${decimal(v1 / 1000, 4)} = ${scientific(amount)} mol`, `Diluted [${item.formula}] = n(${item.formula})/final volume`, `Diluted [${item.formula}] = ${scientific(amount)}/${decimal(v2 / 1000, 3)} = ${scientific(c2)} mol dm⁻³`, strongAcidDissociationEquation(item), `[H⁺] = ${item.protons} × [${item.formula}] = ${item.protons} × ${scientific(c2)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`].filter(Boolean));
  }

  function strongBaseMass(rng) {
    const item = monoBase(rng);
    const mass = pick(rng, [0.280, 0.400, 0.561, 0.800]);
    const volume = pick(rng, [100.0, 200.0, 250.0, 500.0]);
    const n = mass / item.mr;
    const oh = n / (volume / 1000);
    const h = 1e-14 / oh;
    const answer = pH(h);
    return makeQuestion(`${decimal(mass, 3)} g of ${item.formula} is dissolved to make ${decimal(volume, 1)} cm³ of solution. Calculate the pH at 25 °C.`,
      [row(`M_r(${item.formula})`, decimal(item.mr, 1)), row("K_w / mol² dm⁻⁶", scientific(1e-14))],
      [response("moles", `Calculate the number of moles of ${item.formula}.`, `n(${item.formula})`, "mol", n), response("oh", "Calculate the hydroxide ion concentration.", "[OH⁻]", "mol dm⁻³", oh), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`n(${item.formula}) = mass/M_r = ${decimal(mass, 3)}/${decimal(item.mr, 1)} = ${scientific(n)} mol`, `[OH⁻] = n(${item.formula})/solution volume = ${scientific(n)}/${decimal(volume / 1000, 3)} = ${scientific(oh)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(1e-14)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function dihydroxideDirect(rng) {
    const item = diBase(rng);
    const c = pick(rng, [0.0100, 0.0150, 0.0200, 0.0250]);
    const oh = item.hydroxides * c;
    const h = 1e-14 / oh;
    const answer = pH(h);
    return makeQuestion(`${item.formula} dissociates completely in water. Calculate the pH at 25 °C.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(c)), row("K_w / mol² dm⁻⁶", scientific(1e-14))],
      [response("oh", "Calculate the hydroxide ion concentration.", "[OH⁻]", "mol dm⁻³", oh), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [dihydroxideDissociationEquation(item), `[OH⁻] = ${item.hydroxides} × [${item.formula}] = ${item.hydroxides} × ${scientific(c)} = ${scientific(oh)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(1e-14)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function temperatureBase(rng) {
    const item = monoBase(rng);
    const kw = data.kwValues.find((entry) => entry.temperature === 40);
    const c = pick(rng, [0.0150, 0.0250, 0.0400, 0.0800]);
    const h = kw.kw / c;
    const answer = pH(h);
    return makeQuestion(`A ${item.formula} solution is at ${kw.temperature} °C. Calculate its pH using the K_w value supplied.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(c)), row("K_w / mol² dm⁻⁶", scientific(kw.kw))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`[OH⁻] = [${item.formula}] = ${scientific(c)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(kw.kw)}/${scientific(c)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function weakAcidAmount(rng) {
    const item = acid(rng);
    const amount = pick(rng, [0.0150, 0.0200, 0.0250, 0.0300]);
    const volume = pick(rng, [100.0, 200.0, 250.0]);
    const c = amount / (volume / 1000);
    const h = Math.sqrt(item.ka * c);
    const answer = pH(h);
    return makeQuestion(`${scientific(amount)} mol of ${item.name} is dissolved to make ${decimal(volume, 1)} cm³ of solution. Calculate the pH.`, [row("K_a / mol dm⁻³", scientific(item.ka))],
      [response("concentration", "Calculate the acid concentration.", `[${item.formula}]`, "mol dm⁻³", c), response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`[${item.formula}] = n/volume = ${scientific(amount)}/${decimal(volume / 1000, 3)} = ${scientific(c)} mol dm⁻³`, `[H⁺] = √(K_a × [${item.formula}]) = √(${scientific(item.ka)} × ${scientific(c)}) = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`], [weakAudit(item, c)]);
  }

  function weakAcidReverse(rng) {
    const item = acid(rng);
    const originalC = pick(rng, [0.100, 0.150, 0.200, 0.250, 0.300]);
    const suppliedPH = rounded(pH(Math.sqrt(item.ka * originalC)), 2);
    const h = hFromPH(suppliedPH);
    const c = h * h / item.ka;
    return makeQuestion(`A solution of ${item.name} has the pH shown. Calculate its concentration.`, [row("pH", decimal(suppliedPH, 2)), row("K_a / mol dm⁻³", scientific(item.ka))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("concentration", `Calculate the concentration of ${item.formula}.`, `[${item.formula}]`, "mol dm⁻³", c)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `K_a = [H⁺]²/[${item.formula}]`, `[${item.formula}] = [H⁺]²/K_a = (${scientific(h)})²/${scientific(item.ka)} = ${scientific(c)} mol dm⁻³`], [weakAudit(item, c)]);
  }

  function weakAcidPka(rng) {
    const item = acid(rng);
    const c = pick(rng, [0.100, 0.150, 0.200, 0.250]);
    const suppliedPH = rounded(pH(Math.sqrt(item.ka * c)), 2);
    const h = hFromPH(suppliedPH);
    const ka = h * h / c;
    const pka = -log10(ka);
    return makeQuestion(`A weak monobasic acid, HA, has the concentration and pH shown. Calculate its pK_a.`, [row("[HA] / mol dm⁻³", scientific(c)), row("pH", decimal(suppliedPH, 2))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ka", "Calculate the acid dissociation constant.", "K_a", "mol dm⁻³", ka), response("pka", "Calculate the pK_a value.", "pK_a", "", pka, "dp2")],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `K_a = [H⁺]²/[HA] = (${scientific(h)})²/${scientific(c)} = ${scientific(ka)} mol dm⁻³`, `pK_a = −log₁₀K_a = ${decimal(pka, 2)}`]);
  }

  function weakAcidPercent(rng) {
    const item = acid(rng);
    const c = pick(rng, [0.100, 0.150, 0.200, 0.250]);
    const suppliedPH = rounded(pH(Math.sqrt(item.ka * c)), 2);
    const h = hFromPH(suppliedPH);
    const percent = 100 * h / c;
    return makeQuestion(`A ${item.name} solution has the concentration and pH shown. Calculate the percentage of acid molecules dissociated.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(c)), row("pH", decimal(suppliedPH, 2))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("percent", "Calculate the percentage dissociation.", "% dissociated", "%", percent)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `% dissociation = [H⁺]/[${item.formula}] × 100 = ${scientific(h)}/${scientific(c)} × 100 = ${scientific(percent)}%`]);
  }

  function bufferMixed(rng) {
    const item = acid(rng);
    const cHA = pick(rng, [0.150, 0.200, 0.250]);
    const vHA = pick(rng, [20.0, 25.0, 40.0]);
    const cA = pick(rng, [0.100, 0.150, 0.200]);
    const vA = pick(rng, [20.0, 25.0, 30.0]);
    const nHA = cHA * vHA / 1000;
    const nA = cA * vA / 1000;
    const h = item.ka * nHA / nA;
    const answer = pH(h);
    return makeQuestion(`A buffer is made by mixing ${item.name} with ${item.sodiumSalt}. Calculate the pH.`, [row("K_a / mol dm⁻³", scientific(item.ka)), row(`[${item.formula}] / mol dm⁻³`, scientific(cHA)), row(`Volume of ${item.formula} / cm³`, decimal(vHA, 1)), row(`[${item.sodiumSaltFormula}] / mol dm⁻³`, scientific(cA)), row(`Volume of ${item.sodiumSaltFormula} / cm³`, decimal(vA, 1))],
      [response("acidMoles", `Calculate the number of moles of ${item.formula}.`, `n(${item.formula})`, "mol", nHA), response("saltMoles", `Calculate the number of moles of ${item.conjugate}.`, `n(${item.conjugate})`, "mol", nA), response("ph", "Calculate the buffer pH.", "pH", "", answer, "dp2")],
      [`n(${item.formula}) = [${item.formula}] × volume = ${scientific(cHA)} × ${decimal(vHA / 1000, 4)} = ${scientific(nHA)} mol; n(${item.conjugate}) = [${item.conjugate}] × volume = ${scientific(cA)} × ${decimal(vA / 1000, 4)} = ${scientific(nA)} mol`, `[H⁺] = K_a × n(${item.formula})/n(${item.conjugate}) = ${scientific(item.ka)} × ${scientific(nHA)}/${scientific(nA)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function bufferReverseKa(rng) {
    const item = acid(rng);
    const cHA = pick(rng, [0.120, 0.180, 0.240]);
    const ratio = pick(rng, [0.60, 0.80, 1.25, 1.60]);
    const cA = cHA * ratio;
    const suppliedPH = rounded(pH(item.ka * cHA / cA), 2);
    const h = hFromPH(suppliedPH);
    const ka = h * cA / cHA;
    return makeQuestion(`A buffer contains a weak acid, HA, and its conjugate base, A⁻. Calculate the acid dissociation constant for HA.`, [row("[HA] / mol dm⁻³", scientific(cHA)), row("[A⁻] / mol dm⁻³", scientific(cA)), row("pH", decimal(suppliedPH, 2))],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ka", "Calculate the acid dissociation constant.", "K_a", "mol dm⁻³", ka)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `K_a = [H⁺][A⁻]/[HA] = ${scientific(h)} × ${scientific(cA)}/${scientific(cHA)} = ${scientific(ka)} mol dm⁻³`]);
  }

  function partialBufferMoles(rng) {
    const item = acid(rng);
    const nHA0 = pick(rng, [0.0200, 0.0250, 0.0300, 0.0400]);
    const fraction = pick(rng, [0.25, 0.40, 0.60, 0.75]);
    const nOH = nHA0 * fraction;
    const remaining = nHA0 - nOH;
    const answer = pH(item.ka * remaining / nOH);
    return makeQuestion(`${item.name} reacts with the stated amount of NaOH. The reaction forms a buffer. Calculate its pH.`, [row(`Initial n(${item.formula}) / mol`, scientific(nHA0)), row("n(NaOH) / mol", scientific(nOH)), row("K_a / mol dm⁻³", scientific(item.ka))],
      [response("remaining", `Calculate the number of moles of ${item.formula} remaining.`, `n(${item.formula})`, "mol", remaining), response("formed", `Calculate the number of moles of ${item.conjugate} formed.`, `n(${item.conjugate})`, "mol", nOH), response("ph", "Calculate the buffer pH.", "pH", "", answer, "dp2")],
      [`${item.formula} + OH⁻ → ${item.conjugate} + H₂O`, `n(${item.formula}) remaining = ${scientific(nHA0)} − ${scientific(nOH)} = ${scientific(remaining)} mol; n(${item.conjugate}) formed = n(OH⁻) = ${scientific(nOH)} mol`, `[H⁺] = K_a × n(${item.formula})/n(${item.conjugate}) = ${scientific(item.ka)} × ${scientific(remaining)}/${scientific(nOH)} = ${scientific(item.ka * remaining / nOH)} mol dm⁻³`, `pH = −log₁₀(${scientific(item.ka * remaining / nOH)}) = ${decimal(answer, 2)}`]);
  }

  function titrationConcentration(rng) {
    const acidItem = strongAcid(rng);
    const baseItem = monoBase(rng);
    const ca = pick(rng, [0.0800, 0.100, 0.120, 0.150]);
    const va = pick(rng, [20.0, 25.0]);
    const cb = pick(rng, [0.0800, 0.100, 0.125]);
    const acidMoles = ca * va / 1000;
    const baseMoles = acidMoles * acidItem.protons;
    const reactingMultiplier = 1 / acidItem.protons;
    const vb = baseMoles / cb * 1000;
    return makeQuestion(`${decimal(va, 1)} cm³ of ${acidItem.formula} is titrated with ${baseItem.formula}. The mean titre and alkali concentration are shown. Calculate the acid concentration.`, [row("Mean titre / cm³", decimal(vb, 2)), row(`[${baseItem.formula}] / mol dm⁻³`, scientific(cb))],
      [response("baseMoles", `Calculate the number of moles of ${baseItem.formula} in the mean titre.`, `n(${baseItem.formula})`, "mol", baseMoles), response("acidConcentration", `Calculate the concentration of ${acidItem.formula}.`, `[${acidItem.formula}]`, "mol dm⁻³", ca)],
      [`n(${baseItem.formula}) = [${baseItem.formula}] × volume of ${baseItem.formula} = ${scientific(cb)} × ${decimal(vb / 1000, 5)} = ${scientific(baseMoles)} mol`, neutralisationEquation(acidItem, baseItem), neutralisationRatio(acidItem, baseItem), `n(${acidItem.formula}) = ${ratioMultiplier(reactingMultiplier)} × n(${baseItem.formula}) = ${ratioMultiplier(reactingMultiplier)} × ${scientific(baseMoles)} = ${scientific(acidMoles)} mol`, `[${acidItem.formula}] = n(${acidItem.formula})/volume of ${acidItem.formula} = ${scientific(acidMoles)}/${decimal(va / 1000, 3)} = ${scientific(ca)} mol dm⁻³`]);
  }

  function titrationEndpointData(rng) {
    const acidVolume = pick(rng, [20.0, 25.0]);
    const acidConcentration = pick(rng, [0.0800, 0.100, 0.120, 0.150]);
    const alkaliConcentration = pick(rng, [0.0800, 0.100, 0.125]);
    const endpoint = acidConcentration * acidVolume / alkaliConcentration;
    const lower = endpoint - 0.20;
    const upper = endpoint + 0.20;
    const volumes = [endpoint - 2.0, lower, upper, endpoint + 2.0];
    const phValues = [2.35, 3.10, 10.90, 11.65];
    const calculatedC = alkaliConcentration * endpoint / acidVolume;
    return makeQuestion(`A student adds NaOH to ${decimal(acidVolume, 1)} cm³ of HCl and records pH near the sharp change. Take the equivalence volume as the midpoint of the largest pH rise. Calculate the HCl concentration.`,
      [row(`pH after ${decimal(volumes[0], 2)} cm³ NaOH`, decimal(phValues[0], 2)), row(`pH after ${decimal(volumes[1], 2)} cm³ NaOH`, decimal(phValues[1], 2)), row(`pH after ${decimal(volumes[2], 2)} cm³ NaOH`, decimal(phValues[2], 2)), row(`pH after ${decimal(volumes[3], 2)} cm³ NaOH`, decimal(phValues[3], 2)), row("[NaOH] / mol dm⁻³", scientific(alkaliConcentration))],
      [response("endpoint", "Calculate the equivalence volume.", "Equivalence volume", "cm³", endpoint, "dp2"), response("acidConcentration", "Calculate the concentration of HCl.", "[HCl]", "mol dm⁻³", calculatedC)],
      [`The largest pH rise lies between ${decimal(lower, 2)} and ${decimal(upper, 2)} cm³.`, `Equivalence volume = (${decimal(lower, 2)} + ${decimal(upper, 2)})/2 = ${decimal(endpoint, 2)} cm³`, `HCl + NaOH → NaCl + H₂O`, `At equivalence, n(HCl) = n(NaOH) = [NaOH] × equivalence volume = ${scientific(alkaliConcentration)} × ${decimal(endpoint / 1000, 5)} = ${scientific(alkaliConcentration * endpoint / 1000)} mol`, `[HCl] = n(HCl)/volume of HCl = ${scientific(alkaliConcentration * endpoint / 1000)}/${decimal(acidVolume / 1000, 3)} = ${scientific(calculatedC)} mol dm⁻³`]);
  }

  function baseMassDilution(rng) {
    const item = diBase(rng);
    const massConcentration = pick(rng, [3.43, 4.28, 5.14, 6.85]);
    const stockVolume = pick(rng, [10.0, 20.0, 25.0]);
    const finalVolume = pick(rng, [100.0, 200.0, 250.0]);
    const stockC = massConcentration / item.mr;
    const amount = stockC * (stockVolume / 1000);
    const diluteC = amount / (finalVolume / 1000);
    const oh = item.hydroxides * diluteC;
    const h = 1e-14 / oh;
    const answer = pH(h);
    return makeQuestion(`A stock solution contains ${decimal(massConcentration, 2)} g dm⁻³ of ${item.formula}. ${decimal(stockVolume, 1)} cm³ is diluted to ${decimal(finalVolume, 1)} cm³. Calculate the pH at 25 °C.`, [row(`M_r(${item.formula})`, decimal(item.mr, 1)), row("K_w / mol² dm⁻⁶", scientific(1e-14))],
      [response("stock", "Calculate the stock molar concentration.", `Stock [${item.formula}]`, "mol dm⁻³", stockC), response("amount", `Calculate the number of moles of ${item.formula} transferred.`, `n(${item.formula})`, "mol", amount), response("dilute", "Calculate the diluted molar concentration.", `Diluted [${item.formula}]`, "mol dm⁻³", diluteC), response("oh", "Calculate the hydroxide ion concentration.", "[OH⁻]", "mol dm⁻³", oh), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`Stock [${item.formula}] = mass concentration/M_r = ${decimal(massConcentration, 2)}/${decimal(item.mr, 1)} = ${scientific(stockC)} mol dm⁻³`, `n(${item.formula}) = stock [${item.formula}] × transferred volume`, `n(${item.formula}) = ${scientific(stockC)} × ${decimal(stockVolume / 1000, 4)} = ${scientific(amount)} mol`, `Diluted [${item.formula}] = n(${item.formula})/final volume`, `Diluted [${item.formula}] = ${scientific(amount)}/${decimal(finalVolume / 1000, 3)} = ${scientific(diluteC)} mol dm⁻³`, dihydroxideDissociationEquation(item), `[OH⁻] = ${item.hydroxides} × diluted [${item.formula}] = ${item.hydroxides} × ${scientific(diluteC)} = ${scientific(oh)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(1e-14)}/${scientific(oh)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function basePurity(rng) {
    const item = monoBase(rng);
    const sampleMass = pick(rng, [1.20, 1.50, 2.00, 2.50]);
    const volume = pick(rng, [250.0, 500.0]);
    const purity = pick(rng, [72.0, 80.0, 85.0, 92.0]);
    const pureMass = sampleMass * purity / 100;
    const ohActual = (pureMass / item.mr) / (volume / 1000);
    const suppliedPH = rounded(pH(1e-14 / ohActual), 2);
    const h = hFromPH(suppliedPH);
    const oh = 1e-14 / h;
    const n = oh * volume / 1000;
    const calculatedMass = n * item.mr;
    const calculatedPurity = 100 * calculatedMass / sampleMass;
    return makeQuestion(`An impure sample containing ${item.formula} is dissolved to make ${decimal(volume, 1)} cm³ of solution. Use its measured pH to calculate the percentage purity by mass.`, [row("Sample mass / g", decimal(sampleMass, 2)), row("Measured pH", decimal(suppliedPH, 2)), row(`M_r(${item.formula})`, decimal(item.mr, 1)), row("K_w / mol² dm⁻⁶", scientific(1e-14))],
      [response("oh", "Calculate the hydroxide ion concentration.", "[OH⁻]", "mol dm⁻³", oh), response("pureMass", `Calculate the mass of pure ${item.formula}.`, `m(${item.formula})`, "g", calculatedMass), response("purity", "Calculate the percentage purity.", "Purity", "%", calculatedPurity)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³; [OH⁻] = K_w/[H⁺] = ${scientific(1e-14)}/${scientific(h)} = ${scientific(oh)} mol dm⁻³`, `n(${item.formula}) = [OH⁻] × solution volume = ${scientific(oh)} × ${decimal(volume / 1000, 3)} = ${scientific(n)} mol`, `mass of ${item.formula} = n(${item.formula}) × M_r = ${scientific(n)} × ${decimal(item.mr, 1)} = ${scientific(calculatedMass)} g`, `purity = pure mass/sample mass × 100 = ${scientific(calculatedMass)}/${decimal(sampleMass, 2)} × 100 = ${scientific(calculatedPurity)}%`]);
  }

  function excessBase(rng) {
    const ca = pick(rng, [0.100, 0.120, 0.150]);
    const va = pick(rng, [20.0, 25.0]);
    const cb = pick(rng, [0.150, 0.180, 0.200]);
    const vb = pick(rng, [20.0, 25.0, 30.0]);
    const nAcid = ca * va / 1000;
    const nBase = cb * vb / 1000;
    if (nBase <= nAcid) return excessBase(rng);
    const excess = nBase - nAcid;
    const oh = excess / ((va + vb) / 1000);
    const answer = pH(1e-14 / oh);
    return makeQuestion(`Solutions of HCl and NaOH are mixed. NaOH is in excess. Calculate the pH of the final mixture at 25 °C.`, [row("[HCl] / mol dm⁻³", scientific(ca)), row("Volume of HCl / cm³", decimal(va, 1)), row("[NaOH] / mol dm⁻³", scientific(cb)), row("Volume of NaOH / cm³", decimal(vb, 1)), row("K_w / mol² dm⁻⁶", scientific(1e-14))],
      [response("excess", "Calculate the number of moles of excess hydroxide ions.", "n(OH⁻) excess", "mol", excess), response("oh", "Calculate the hydroxide ion concentration after mixing.", "[OH⁻]", "mol dm⁻³", oh), response("ph", "Calculate the final pH.", "pH", "", answer, "dp2")],
      [`n(H⁺) = [HCl] × volume of HCl = ${scientific(ca)} × ${decimal(va / 1000, 4)} = ${scientific(nAcid)} mol; n(OH⁻) = [NaOH] × volume of NaOH = ${scientific(cb)} × ${decimal(vb / 1000, 4)} = ${scientific(nBase)} mol`, `HCl + NaOH → NaCl + H₂O`, `Excess n(OH⁻) = ${scientific(nBase)} − ${scientific(nAcid)} = ${scientific(excess)} mol`, `Total volume = ${decimal(va, 1)} + ${decimal(vb, 1)} = ${decimal(va + vb, 1)} cm³; [OH⁻] = excess n(OH⁻)/total volume = ${scientific(excess)}/${decimal((va + vb) / 1000, 4)} = ${scientific(oh)} mol dm⁻³`, `[H⁺] = K_w/[OH⁻] = ${scientific(1e-14)}/${scientific(oh)} = ${scientific(1e-14 / oh)} mol dm⁻³`, `pH = −log₁₀(${scientific(1e-14 / oh)}) = ${decimal(answer, 2)}`]);
  }

  function weakAcidTargetMass(rng) {
    const item = acid(rng);
    const nominalC = pick(rng, [0.100, 0.150, 0.200, 0.250]);
    const volume = pick(rng, [100.0, 200.0, 250.0]);
    const targetPH = rounded(pH(Math.sqrt(item.ka * nominalC)), 2);
    const h = hFromPH(targetPH);
    const c = h * h / item.ka;
    const n = c * volume / 1000;
    const mass = n * item.mr;
    return makeQuestion(`Calculate the mass of ${item.name} needed to make ${decimal(volume, 1)} cm³ of solution with pH ${decimal(targetPH, 2)}.`, [row("K_a / mol dm⁻³", scientific(item.ka)), row(`M_r(${item.formula})`, decimal(item.mr, 1))],
      [response("concentration", "Calculate the required acid concentration.", `[${item.formula}]`, "mol dm⁻³", c), response("mass", "Calculate the required acid mass.", `m(${item.formula})`, "g", mass)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(targetPH, 2)} = ${scientific(h)} mol dm⁻³`, `[${item.formula}] = [H⁺]²/K_a = (${scientific(h)})²/${scientific(item.ka)} = ${scientific(c)} mol dm⁻³`, `n(${item.formula}) = [${item.formula}] × volume = ${scientific(c)} × ${decimal(volume / 1000, 3)} = ${scientific(n)} mol`, `mass = n(${item.formula}) × M_r = ${scientific(n)} × ${decimal(item.mr, 1)} = ${scientific(mass)} g`], [weakAudit(item, c)]);
  }

  function weakAcidPurity(rng) {
    const item = acid(rng);
    const sampleMass = pick(rng, [2.00, 2.50, 3.00, 4.00]);
    const volume = pick(rng, [200.0, 250.0, 500.0]);
    const nominalPurity = pick(rng, [65.0, 72.0, 80.0, 88.0]);
    const nominalC = (sampleMass * nominalPurity / 100 / item.mr) / (volume / 1000);
    const suppliedPH = rounded(pH(Math.sqrt(item.ka * nominalC)), 2);
    const h = hFromPH(suppliedPH);
    const calculatedC = h * h / item.ka;
    const pureMass = calculatedC * volume / 1000 * item.mr;
    const purity = 100 * pureMass / sampleMass;
    return makeQuestion(`An impure solid sample containing ${item.name} is dissolved to make ${decimal(volume, 1)} cm³ of solution. Use the measured pH to calculate the percentage purity by mass.`,
      [row("Sample mass / g", decimal(sampleMass, 2)), row("Measured pH", decimal(suppliedPH, 2)), row("K_a / mol dm⁻³", scientific(item.ka)), row(`M_r(${item.formula})`, decimal(item.mr, 1))],
      [response("concentration", "Calculate the concentration of the weak acid.", `[${item.formula}]`, "mol dm⁻³", calculatedC), response("pureMass", `Calculate the mass of pure ${item.name}.`, "Pure acid mass", "g", pureMass), response("purity", "Calculate the percentage purity.", "Purity", "%", purity)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `[${item.formula}] = [H⁺]²/K_a = (${scientific(h)})²/${scientific(item.ka)} = ${scientific(calculatedC)} mol dm⁻³`, `Pure acid mass = concentration × volume × M_r = ${scientific(calculatedC)} × ${decimal(volume / 1000, 3)} × ${decimal(item.mr, 1)} = ${scientific(pureMass)} g`, `purity = pure mass/sample mass × 100 = ${scientific(pureMass)}/${decimal(sampleMass, 2)} × 100 = ${scientific(purity)}%`], [weakAudit(item, calculatedC)]);
  }

  function partialBufferVolumes(rng, reverseKa) {
    const item = acid(rng);
    const cHA = pick(rng, [0.200, 0.250, 0.300]);
    const vHA = pick(rng, [25.0, 40.0, 50.0]);
    const cOH = pick(rng, [0.100, 0.150, 0.200]);
    const fraction = pick(rng, [0.30, 0.40, 0.60, 0.70]);
    const nHA0 = cHA * vHA / 1000;
    const nOH = nHA0 * fraction;
    const vOH = nOH / cOH * 1000;
    const remaining = nHA0 - nOH;
    const actualPH = pH(item.ka * remaining / nOH);
    const suppliedPH = rounded(actualPH, 2);
    const h = hFromPH(suppliedPH);
    const ka = h * nOH / remaining;
    const rows = [row(`[${item.formula}] / mol dm⁻³`, scientific(cHA)), row(`Volume of ${item.formula} / cm³`, decimal(vHA, 1)), row("[KOH] / mol dm⁻³", scientific(cOH)), row("Volume of KOH / cm³", decimal(vOH, 2))];
    if (reverseKa) rows.push(row("Buffer pH", decimal(suppliedPH, 2)));
    else rows.push(row("K_a / mol dm⁻³", scientific(item.ka)));
    const shared = [response("remaining", `Calculate the number of moles of ${item.formula} remaining.`, `n(${item.formula})`, "mol", remaining), response("formed", `Calculate the number of moles of ${item.conjugate} formed.`, `n(${item.conjugate})`, "mol", nOH)];
    if (reverseKa) {
      shared.push(response("ka", "Calculate the acid dissociation constant for the weak acid.", "K_a", "mol dm⁻³", ka));
      return makeQuestion(`${item.name} is partially neutralised by KOH to form a buffer. Use its measured pH to calculate the acid dissociation constant.`, rows, shared,
        [`n(${item.formula}) initially = [${item.formula}] × volume = ${scientific(cHA)} × ${decimal(vHA / 1000, 4)} = ${scientific(nHA0)} mol; n(OH⁻) = [KOH] × volume of KOH = ${scientific(cOH)} × ${decimal(vOH / 1000, 4)} = ${scientific(nOH)} mol`, `${item.formula} + OH⁻ → ${item.conjugate} + H₂O`, `n(${item.formula}) remaining = ${scientific(nHA0)} − ${scientific(nOH)} = ${scientific(remaining)} mol; n(${item.conjugate}) formed = n(OH⁻) = ${scientific(nOH)} mol`, `[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(suppliedPH, 2)} = ${scientific(h)} mol dm⁻³`, `K_a = [H⁺] × n(${item.conjugate})/n(${item.formula}) = ${scientific(h)} × ${scientific(nOH)}/${scientific(remaining)} = ${scientific(ka)} mol dm⁻³`]);
    }
    shared.push(response("ph", "Calculate the buffer pH.", "pH", "", actualPH, "dp2"));
    return makeQuestion(`${item.name} is partially neutralised by KOH to form a buffer. Calculate the pH.`, rows, shared,
      [`n(${item.formula}) initially = [${item.formula}] × volume = ${scientific(cHA)} × ${decimal(vHA / 1000, 4)} = ${scientific(nHA0)} mol; n(OH⁻) = [KOH] × volume of KOH = ${scientific(cOH)} × ${decimal(vOH / 1000, 4)} = ${scientific(nOH)} mol`, `${item.formula} + OH⁻ → ${item.conjugate} + H₂O`, `n(${item.formula}) remaining = ${scientific(nHA0)} − ${scientific(nOH)} = ${scientific(remaining)} mol; n(${item.conjugate}) formed = n(OH⁻) = ${scientific(nOH)} mol`, `[H⁺] = K_a × n(${item.formula})/n(${item.conjugate}) = ${scientific(item.ka)} × ${scientific(remaining)}/${scientific(nOH)} = ${scientific(item.ka * remaining / nOH)} mol dm⁻³`, `pH = −log₁₀(${scientific(item.ka * remaining / nOH)}) = ${decimal(actualPH, 2)}`]);
  }

  function targetBufferSaltMass(rng) {
    const item = acid(rng);
    const cHA = pick(rng, [0.150, 0.200, 0.250]);
    const volume = pick(rng, [100.0, 200.0, 250.0]);
    const ratio = pick(rng, [0.75, 1.25, 1.50, 2.00]);
    const targetPH = rounded(pH(item.ka / ratio), 2);
    const h = hFromPH(targetPH);
    const cA = item.ka * cHA / h;
    const saltMoles = cA * volume / 1000;
    const mass = saltMoles * item.saltMr;
    return makeQuestion(`A buffer of pH ${decimal(targetPH, 2)} is made from ${decimal(volume, 1)} cm³ of ${item.name} solution and solid ${item.sodiumSalt}. Assume the volume is unchanged. Calculate the salt mass required.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(cHA)), row("K_a / mol dm⁻³", scientific(item.ka)), row(`M_r(${item.sodiumSaltFormula})`, decimal(item.saltMr, 1))],
      [response("saltConcentration", `Calculate the required concentration of ${item.conjugate}.`, `[${item.conjugate}]`, "mol dm⁻³", cA), response("mass", `Calculate the mass of ${item.sodiumSaltFormula}.`, `m(${item.sodiumSaltFormula})`, "g", mass)],
      [`[H⁺] = 10⁻ᵖᴴ = 10⁻${decimal(targetPH, 2)} = ${scientific(h)} mol dm⁻³`, `[${item.conjugate}] = K_a[${item.formula}]/[H⁺] = ${scientific(item.ka)} × ${scientific(cHA)}/${scientific(h)} = ${scientific(cA)} mol dm⁻³`, `n(${item.sodiumSaltFormula}) = [${item.conjugate}] × solution volume = ${scientific(cA)} × ${decimal(volume / 1000, 3)} = ${scientific(saltMoles)} mol`, `mass = n(${item.sodiumSaltFormula}) × M_r = ${scientific(saltMoles)} × ${decimal(item.saltMr, 1)} = ${scientific(mass)} g`]);
  }

  function bufferRecipeDeviation(rng) {
    const item = acid(rng);
    const cHA = pick(rng, [0.150, 0.200, 0.250]);
    const volume = pick(rng, [100.0, 200.0, 250.0]);
    const target = rounded(-log10(item.ka), 2);
    const mass = cHA * volume / 1000 * item.saltMr * pick(rng, [0.80, 0.90, 1.10, 1.20]);
    const saltMoles = mass / item.saltMr;
    const cA = saltMoles / (volume / 1000);
    const h = item.ka * cHA / cA;
    const actual = pH(item.ka * cHA / cA);
    const deviation = Math.abs(actual - target);
    return makeQuestion(`A student aims to prepare a buffer of pH ${decimal(target, 2)} using ${decimal(volume, 1)} cm³ of ${item.name} and the stated mass of ${item.sodiumSalt}. Assume the volume is unchanged. Calculate the absolute difference between the actual and target pH.`, [row(`[${item.formula}] / mol dm⁻³`, scientific(cHA)), row(`m(${item.sodiumSaltFormula}) / g`, decimal(mass, 3)), row(`M_r(${item.sodiumSaltFormula})`, decimal(item.saltMr, 1)), row("K_a / mol dm⁻³", scientific(item.ka))],
      [response("saltConcentration", `Calculate the concentration of ${item.conjugate}.`, `[${item.conjugate}]`, "mol dm⁻³", cA), response("actualPH", "Calculate the actual pH.", "Actual pH", "", actual, "dp2"), response("deviation", "Calculate the absolute pH difference.", "|ΔpH|", "", deviation, "dp2")],
      [`n(${item.sodiumSaltFormula}) = mass/M_r = ${decimal(mass, 3)}/${decimal(item.saltMr, 1)} = ${scientific(saltMoles)} mol`, `[${item.conjugate}] = n(${item.sodiumSaltFormula})/solution volume = ${scientific(saltMoles)}/${decimal(volume / 1000, 3)} = ${scientific(cA)} mol dm⁻³`, `[H⁺] = K_a[${item.formula}]/[${item.conjugate}] = ${scientific(item.ka)} × ${scientific(cHA)}/${scientific(cA)} = ${scientific(h)} mol dm⁻³; actual pH = −log₁₀(${scientific(h)}) = ${decimal(actual, 2)}`, `|ΔpH| = |${decimal(actual, 2)} − ${decimal(target, 2)}| = ${decimal(deviation, 2)}`]);
  }

  function bloodBuffer(rng) {
    const ka = 4.27e-7;
    const ratio = pick(rng, [8.50, 10.0, 12.0]);
    const h = ka / ratio;
    const answer = pH(h);
    return makeQuestion(`A simplified blood buffer contains H₂CO₃ and HCO₃⁻. Calculate its pH from the concentration ratio.`, [row("K_a(H₂CO₃) / mol dm⁻³", scientific(ka)), row("[HCO₃⁻] : [H₂CO₃]", `${decimal(ratio, 2)} : 1.00`)],
      [response("h", "Calculate the hydrogen ion concentration.", "[H⁺]", "mol dm⁻³", h), response("ph", "Calculate the pH.", "pH", "", answer, "dp2")],
      [`[H⁺] = K_a[H₂CO₃]/[HCO₃⁻] = ${scientific(ka)}/${decimal(ratio, 2)} = ${scientific(h)} mol dm⁻³`, `pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function bufferAfterAddition(rng) {
    const item = acid(rng);
    const nHA0 = pick(rng, [0.0200, 0.0250, 0.0300]);
    const nA0 = pick(rng, [0.0180, 0.0240, 0.0320]);
    const addition = pick(rng, ["HCl", "NaOH"]);
    const added = pick(rng, [0.00200, 0.00300, 0.00400]);
    const nHA = addition === "HCl" ? nHA0 + added : nHA0 - added;
    const nA = addition === "HCl" ? nA0 - added : nA0 + added;
    const h = item.ka * nHA / nA;
    const answer = pH(h);
    return makeQuestion(`A buffer initially contains ${item.name} and ${item.conjugate}. ${scientific(added)} mol of ${addition} is added. Calculate the new pH; volume change may be ignored.`, [row(`Initial n(${item.formula}) / mol`, scientific(nHA0)), row(`Initial n(${item.conjugate}) / mol`, scientific(nA0)), row("K_a / mol dm⁻³", scientific(item.ka))],
      [response("acidAfter", `Calculate the number of moles of ${item.formula} after reaction.`, `n(${item.formula})`, "mol", nHA), response("baseAfter", `Calculate the number of moles of ${item.conjugate} after reaction.`, `n(${item.conjugate})`, "mol", nA), response("ph", "Calculate the new pH.", "pH", "", answer, "dp2")],
      [addition === "HCl" ? `${item.conjugate} + H⁺ → ${item.formula}` : `${item.formula} + OH⁻ → ${item.conjugate} + H₂O`, addition === "HCl" ? `n(${item.formula}) after reaction = ${scientific(nHA0)} + ${scientific(added)} = ${scientific(nHA)} mol; n(${item.conjugate}) after reaction = ${scientific(nA0)} − ${scientific(added)} = ${scientific(nA)} mol` : `n(${item.formula}) after reaction = ${scientific(nHA0)} − ${scientific(added)} = ${scientific(nHA)} mol; n(${item.conjugate}) after reaction = ${scientific(nA0)} + ${scientific(added)} = ${scientific(nA)} mol`, `[H⁺] = K_a × n(${item.formula})/n(${item.conjugate}) = ${scientific(item.ka)} × ${scientific(nHA)}/${scientific(nA)} = ${scientific(h)} mol dm⁻³; pH = −log₁₀(${scientific(h)}) = ${decimal(answer, 2)}`]);
  }

  function titreSampleMass(rng) {
    const koh = pick(rng, [0.0800, 0.100, 0.120]);
    const core = pick(rng, [18.40, 20.20, 22.60, 24.80]);
    const titres = [core + 0.85, core, core + 0.05, core - 0.05].map((x) => rounded(x, 2));
    const mean = (titres[1] + titres[2] + titres[3]) / 3;
    const nKohAliquot = koh * mean / 1000;
    const nAcidAliquot = nKohAliquot / 2;
    const totalAcid = nAcidAliquot * 25;
    const mgTablet = totalAcid * 118.1 * 1000 / 4;
    return makeQuestion(`Four tablets containing succinic acid, HOOCCH₂CH₂COOH, are dissolved and made up to 250.0 cm³. A 10.0 cm³ aliquot is titrated with KOH. The first titre is a trial. Use all concordant titres to calculate the mass of succinic acid per tablet.`, [row("[KOH] / mol dm⁻³", scientific(koh)), row("Titres / cm³", titres.map((x) => decimal(x, 2)).join(", ")), row("M_r(succinic acid)", "118.1"), row("Stoichiometry", "1 mol acid : 2 mol KOH")],
      [response("mean", "Calculate the mean concordant titre.", "Mean titre", "cm³", mean, "dp2"), response("tabletMass", "Calculate the mass of succinic acid per tablet.", "Mass per tablet", "mg", mgTablet)],
      [`Mean titre = (${decimal(titres[1], 2)} + ${decimal(titres[2], 2)} + ${decimal(titres[3], 2)})/3 = ${decimal(mean, 2)} cm³`, `n(KOH) in aliquot = [KOH] × mean titre = ${scientific(koh)} × ${decimal(mean / 1000, 5)} = ${scientific(nKohAliquot)} mol`, `HOOCCH₂CH₂COOH + 2KOH → KOOCCH₂CH₂COOK + 2H₂O`, `n(acid) in aliquot = 0.5 × n(KOH) = 0.5 × ${scientific(nKohAliquot)} = ${scientific(nAcidAliquot)} mol`, `Scale factor = 250.0/10.0 = 25.0; total n(acid) = ${scientific(nAcidAliquot)} × 25.0 = ${scientific(totalAcid)} mol`, `Total acid mass = n × M_r = ${scientific(totalAcid)} × 118.1 = ${scientific(totalAcid * 118.1)} g`, `Mass per tablet = ${scientific(totalAcid * 118.1)} × 1000 × 0.25 = ${scientific(mgTablet)} mg`]);
  }

  const builders = {
    "h-to-ph": directHToPH, "ph-to-h": directPHToH, "strong-acid-direct": strongAcidDirect,
    "strong-base-direct": strongBaseDirect, "water-ph-from-kw": waterPH, "weak-acid-direct": weakAcidDirect,
    "buffer-direct": bufferDirect, "neutralisation-direct": neutralisationDirect, "strong-acid-dilution": strongAcidDilution,
    "strong-base-mass": strongBaseMass, "dihydroxide-direct": dihydroxideDirect, "temperature-base": temperatureBase,
    "weak-acid-amount": weakAcidAmount, "weak-acid-reverse-concentration": weakAcidReverse,
    "weak-acid-pka": weakAcidPka, "weak-acid-percent": weakAcidPercent, "buffer-mixed-volumes": bufferMixed,
    "buffer-reverse-ka": bufferReverseKa, "partial-buffer-moles": partialBufferMoles,
    "titration-concentration": titrationConcentration, "titration-endpoint-data": titrationEndpointData,
    "base-mass-concentration-dilution": baseMassDilution,
    "base-purity": basePurity, "excess-strong-base": excessBase, "weak-acid-target-mass": weakAcidTargetMass,
    "weak-acid-purity": weakAcidPurity,
    "partial-buffer-volumes": (rng) => partialBufferVolumes(rng, false), "partial-buffer-ka": (rng) => partialBufferVolumes(rng, true),
    "target-buffer-salt-mass": targetBufferSaltMass, "buffer-recipe-deviation": bufferRecipeDeviation,
    "blood-buffer-ph": bloodBuffer, "buffer-after-addition": bufferAfterAddition,
    "titre-sample-mass": titreSampleMass
  };

  function eligibleTemplates(familyId, level) {
    return data.templates.filter((template) => template.levels.includes(Number(level)) && (!familyId || familyId === "any" || template.family === familyId));
  }

  function familyOptions(level) {
    const available = new Set(eligibleTemplates("any", level).map((template) => template.family));
    return [{ id: "any", label: "Any numerical family" }].concat(data.families.filter((family) => available.has(family.id)));
  }

  function templateOptions(familyId, level) {
    return [{ id: "random", label: "Random compatible variation" }].concat(eligibleTemplates(familyId, level));
  }

  const questionIdPrefix = "AB";
  const questionIdModulus = 1024;
  const questionIdRadix = 36;
  const questionIdDigits = 6;
  const questionIdCapacity = questionIdRadix ** questionIdDigits;
  const maximumRandomPart = Math.floor((questionIdCapacity - 1) / questionIdModulus);

  function encodeQuestionId(templateId, level, structure, randomPart) {
    const templateIndex = data.templates.findIndex((template) => template.id === templateId);
    if (templateIndex < 0) throw new Error(`Unknown template ${templateId}.`);
    const structureIndex = structure === "single" ? 1 : 0;
    const configCode = templateIndex + data.templates.length * ((Number(level) - 1) + 3 * structureIndex);
    return (Number(randomPart) % (maximumRandomPart + 1)) * questionIdModulus + configCode;
  }

  function formatQuestionId(seed) {
    const value = Number(seed);
    if (!Number.isSafeInteger(value) || value < 0 || value >= questionIdCapacity) throw new Error("The question ID value is outside the valid range.");
    return `${questionIdPrefix}-${value.toString(questionIdRadix).toUpperCase().padStart(questionIdDigits, "0")}`;
  }

  function decodeQuestionId(value) {
    const match = String(value || "").trim().toUpperCase().match(/^(?:AB-)?([0-9A-Z]{6})$/);
    if (!match) throw new Error("Enter an ID in the form AB-4K7X2Q.");
    const seed = Number.parseInt(match[1], questionIdRadix);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= questionIdCapacity) throw new Error("The question ID value is outside the valid range.");
    const configCode = seed % questionIdModulus;
    const templateIndex = configCode % data.templates.length;
    const packedOptions = Math.floor(configCode / data.templates.length);
    const level = packedOptions % 3 + 1;
    const structureIndex = Math.floor(packedOptions / 3);
    const template = data.templates[templateIndex];
    if (!template || structureIndex > 1 || !template.levels.includes(level)) throw new Error("This is not a valid acid–base question ID.");
    return { seed, level, structure: structureIndex === 1 ? "single" : "staged", template };
  }

  function atomicWorkingLines(lines) {
    return lines.flatMap((line) => String(line).split(";")).map((line) => line.trim()).filter(Boolean);
  }

  function printWorkingSpace(lines, maximumMillimetres) {
    const units = atomicWorkingLines(lines).reduce((total, line) => {
      const equationParts = line.split(" = ");
      if (equationParts.length < 2) {
        return total + 0.75 + Math.max(0, Math.ceil(line.length / 72) - 1) * 0.5;
      }
      return total + equationParts.slice(1).reduce((lineTotal, right, index) => {
        const left = index === 0 ? equationParts[0] : "";
        const displayedLength = left.length + right.length + 3;
        const wrapAllowance = Math.max(0, Math.ceil(displayedLength / 62) - 1) * 0.65;
        const fractionAllowance = right.includes("/") ? 0.35 : 0;
        return lineTotal + 1 + wrapAllowance + fractionAllowance;
      }, 0);
    }, 0);
    const requestedMaximum = Number(maximumMillimetres);
    const maximum = Number.isFinite(requestedMaximum) ? Math.min(200, Math.max(20, requestedMaximum)) : 58;
    const unstructured = maximum > 58;
    const minimum = unstructured ? 30 : 20;
    const millimetres = Math.min(maximum, Math.max(minimum, 12 + (unstructured ? 8.5 : 5) * units));
    return Math.round(millimetres * 2) / 2;
  }

  function partitionWorking(lines, responses) {
    const atomic = atomicWorkingLines(lines);
    if (responses.length <= 1) return [atomic];
    const parts = [];
    let cursor = 0;
    responses.slice(0, -1).forEach((answer, index) => {
      const expected = display(answer.expected, answer.format, true);
      const latestEnd = atomic.length - (responses.length - index - 1);
      let end = atomic.findIndex((line, lineIndex) => lineIndex >= cursor && lineIndex < latestEnd && line.includes(expected));
      if (end < cursor) end = Math.min(cursor, latestEnd - 1);
      parts.push(atomic.slice(cursor, end + 1));
      cursor = end + 1;
    });
    parts.push(atomic.slice(cursor));
    return parts;
  }

  function resolveStructure(requested, level, stepCount, rng) {
    if (stepCount === 1) return "direct";
    if (requested === "staged" || requested === "single") return requested;
    if (Number(level) === 1) return "staged";
    if (Number(level) === 2) return rng() < 0.7 ? "staged" : "single";
    return rng() < 0.2 ? "staged" : "single";
  }

  function generate(config, seed) {
    const level = Number(config.level || 1);
    const rng = mulberry32((Number(seed) || Date.now()) >>> 0);
    const eligible = eligibleTemplates(config.family || "any", level);
    if (!eligible.length) throw new Error("No templates match these options.");
    let template = eligible.find((item) => item.id === config.template);
    if (!template) template = pick(rng, eligible);
    const raw = builders[template.id](rng);
    if (!raw || !raw.steps.length) throw new Error(`Template ${template.id} returned no numerical response.`);
    const invalidAudit = raw.audit.filter((entry) => !entry.valid);
    if (invalidAudit.length) throw new Error(invalidAudit.map((entry) => entry.detail).join("; "));
    const structure = resolveStructure(config.structure || "auto", level, raw.steps.length, rng);
    const responses = structure === "single" ? [raw.steps[raw.steps.length - 1]] : raw.steps.slice();
    const answerParts = partitionWorking(raw.working, responses);
    const family = data.families.find((item) => item.id === template.family);
    return Object.freeze({
      seed: Number(seed), level, structure, templateId: template.id, templateLabel: template.label,
      familyId: template.family, familyLabel: family.label, target: template.target,
      intro: raw.intro, rows: raw.rows, responses, allResponses: raw.steps,
      working: raw.working, answerParts, audit: raw.audit
    });
  }

  function enteredNumber(value) {
    const plainSuperscripts = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
    const normalised = String(value || "").trim().replace(/,/g, "").replace(/[−–—]/g, "-").replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => plainSuperscripts[character]);
    const power = normalised.match(/([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[×x*]\s*10\s*\^?\s*([+-]?\d+)/i);
    if (power) return Number(power[1]) * 10 ** Number(power[2]);
    const match = normalised.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    return match ? Number(match[0]) : NaN;
  }

  function markNumber(value, answer) {
    const entered = enteredNumber(value);
    if (!Number.isFinite(entered)) return { status: "missing", entered };
    return { status: Math.abs(entered - answer.expected) <= answer.tolerance ? "correct" : "incorrect", entered };
  }

  root.AcidBaseCore = Object.freeze({
    generate, eligibleTemplates, familyOptions, templateOptions, enteredNumber, markNumber,
    scientific, display, encodeQuestionId, decodeQuestionId, formatQuestionId, printWorkingSpace, questionIdPrefix, metadata: data.metadata
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
