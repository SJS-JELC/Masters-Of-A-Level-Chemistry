(function (root) {
  "use strict";
  const D = root.ElectronData;
  const sum = (values) => values.reduce((a,b) => a + b, 0);
  const same = (a,b) => a.length === b.length && a.every((v,i) => v === b[i]);
  const species = (id) => D.species.find((item) => item.id === id);
  function coreOptions(item) {
    return Object.keys(D.cores).filter((key) => D.cores[key].every((n,i) => n <= item.counts[i]) && (item.charge !== 0 || sum(D.cores[key]) < item.z));
  }
  function abbreviation(item) {
    const core = coreOptions(item).at(-1) || "";
    return { core, counts: item.counts.map((n,i) => n - (D.cores[core]?.[i] || 0)) };
  }
  function boxes(counts) {
    return counts.map((n,i) => Array.from({length:D.orbitals[i]}, (_,j) => j < n - D.orbitals[i] ? 3 : j < n ? 1 : 0));
  }
  function energyOrder() {
    // Always show the complete schematic Aufbau ladder through 4p, including
    // empty subshells. Occupancies and ion removal are checked separately;
    // this is not a species-specific orbital-energy model.
    return [0,1,2,3,4,6,5,7];
  }
  function blankResponse() { return { counts: Array(8).fill(""), core: "", boxes: D.orbitals.map((n) => Array(n).fill(0)), identity: "", selected: [] }; }
  function normaliseIdentity(text) { return String(text).trim().toLowerCase().replace(/\s+/g, " "); }
  function markIdentity(item, response) {
    const answer = normaliseIdentity(response.identity);
    if (!answer) return { accepted:false, message:"Enter an element name or symbol." };
    const aliases = [item.name.toLowerCase(), item.symbol.toLowerCase()];
    if (item.symbol === "Al") aliases.push("aluminum");
    if (item.symbol === "S") aliases.push("sulphur");
    return { accepted:true, correct:aliases.includes(answer), issues: aliases.includes(answer) ? [] : ["Count the electrons, then use atomic number = electrons + ionic charge (including its sign)."] };
  }
  function markBuild(item, representation, response) {
    const issues = [];
    let counts;
    if (representation === "row" || representation === "energy") {
      if (!Array.isArray(response.boxes) || response.boxes.length !== 8 || response.boxes.some((row,i) => !Array.isArray(row) || row.length !== D.orbitals[i] || row.some((state) => ![0,1,2,3].includes(state)))) return {accepted:false,message:"Check the orbital entries."};
      counts = response.boxes.map((row) => sum(row.map((state) => state === 3 ? 2 : state ? 1 : 0)));
      response.boxes.forEach((row,i) => {
        if (row.includes(3) && row.includes(0)) issues.push(`${D.subshells[i]}: occupy each orbital singly before pairing.`);
        if (row.includes(1) && row.includes(2)) issues.push(`${D.subshells[i]}: unpaired electrons must have parallel spins.`);
      });
    } else {
      if (!Array.isArray(response.counts) || response.counts.length !== 8 || response.counts.some((v) => !/^\d*$/.test(String(v)))) return { accepted:false, message:"Use whole-number electron counts, leaving unused subshells blank." };
      counts = response.counts.map((v) => Number(v));
      counts.forEach((v,i) => { if (v > D.capacities[i]) issues.push(`${D.subshells[i]} holds at most ${D.capacities[i]} electrons.`); });
      if (representation === "short") {
        if (!D.cores[response.core]) return { accepted:false, message:"Choose a noble-gas core." };
        if (!coreOptions(item).includes(response.core)) issues.push("Choose a noble-gas core contained within this configuration; an atom cannot abbreviate itself as its own core.");
        counts = counts.map((n,i) => n + D.cores[response.core][i]);
      }
    }
    const total = sum(counts);
    if (total !== item.z - item.charge) issues.push(`You have ${total} electrons; this species needs ${item.z - item.charge}.`);
    const mismatches = counts.map((n,i) => n === item.counts[i] ? null : D.subshells[i]).filter(Boolean);
    if (mismatches.length) issues.push(`Check the occupancy of ${mismatches.join(", ")}.`);
    if (mismatches.length && item.group === "d-ions") issues.push("Form the ion from the atom: remove 4s electrons before 3d electrons.");
    if (mismatches.length && ["Cr", "Cu"].includes(item.id)) issues.push(`${item.name} is an exception to the simple filling pattern: its 4s subshell contains one electron.`);
    return { accepted:true, correct:issues.length === 0, issues };
  }
  function mark(question, response) {
    if (question.kind === "bonus") {
      const expected = question.options.filter((id) => same(species(id).counts, question.counts));
      const selected = [...new Set(response.selected || [])];
      if (selected.some((id) => !question.options.includes(id))) return {accepted:false,message:"Choose from the displayed species."};
      const correct = same(selected.slice().sort(), expected.slice().sort());
      return { accepted:true, correct, issues:correct ? [] : ["Compare complete configurations. Equal electron totals alone do not always mean identical configurations."], expected };
    }
    const item = species(question.speciesId);
    return question.direction === "identify" ? markIdentity(item, response) : markBuild(item, question.representation, response);
  }
  function explanation(item) {
    const total = item.z - item.charge;
    const lines = [`Atomic number ${item.z}; ${total} electron${total === 1 ? "" : "s"}${item.charge ? ` (${item.z} ${item.charge > 0 ? "−" : "+"} ${Math.abs(item.charge)})` : " in the neutral atom"}.`];
    if (item.group === "d-ions") lines.push("Remove electrons from the neutral atom’s 4s subshell before removing any from 3d.");
    if (item.id === "Cr") lines.push("Chromium has 3d⁵ 4s¹, rather than 3d⁴ 4s².");
    if (item.id === "Cu") lines.push("Copper has 3d¹⁰ 4s¹, rather than 3d⁹ 4s².");
    lines.push("Within a subshell, fill orbitals singly with parallel spins before pairing. Each pair has opposite spins.");
    return lines;
  }
  function validateBank() {
    const ids = new Set();
    D.species.forEach((item) => {
      if (ids.has(item.id)) throw new Error(`Duplicate species ${item.id}`);
      ids.add(item.id);
      if (item.counts.length !== 8 || item.counts.some((n,i) => !Number.isInteger(n) || n < 0 || n > D.capacities[i]) || sum(item.counts) !== item.z - item.charge) throw new Error(`Invalid occupancy for ${item.id}`);
      const boxed = markBuild(item, "row", {boxes:boxes(item.counts)});
      if (!boxed.correct) throw new Error(`Invalid box answer for ${item.id}`);
    });
    return true;
  }
  root.ElectronCore = { sum, same, species, abbreviation, coreOptions, boxes, energyOrder, blankResponse, mark, explanation, validateBank };
})(typeof globalThis !== "undefined" ? globalThis : window);
