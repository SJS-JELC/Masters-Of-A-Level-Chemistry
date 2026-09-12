(function (root) {
  "use strict";
  // Entries are explicit ground-state configurations, not an Aufbau generator.
  const subshells = ["1s", "2s", "2p", "3s", "3p", "3d", "4s", "4p"];
  const cores = {
    He: [2,0,0,0,0,0,0,0], Ne: [2,2,6,0,0,0,0,0],
    Ar: [2,2,6,2,6,0,0,0], Kr: [2,2,6,2,6,10,2,6]
  };
  function expand(text) {
    const counts = Array(8).fill(0);
    for (const token of text.split(" ")) {
      if (cores[token]) cores[token].forEach((value, i) => { counts[i] += value; });
      else {
        const match = /^(\ds|\dp|\dd)(\d+)$/.exec(token);
        if (!match || !subshells.includes(match[1])) throw new Error(`Invalid configuration: ${text}`);
        counts[subshells.indexOf(match[1])] += Number(match[2]);
      }
    }
    return counts;
  }
  const atoms = [
    ["H","Hydrogen","1s1"], ["He","Helium","1s2"],
    ["Li","Lithium","He 2s1"], ["Be","Beryllium","He 2s2"],
    ["B","Boron","He 2s2 2p1"], ["C","Carbon","He 2s2 2p2"],
    ["N","Nitrogen","He 2s2 2p3"], ["O","Oxygen","He 2s2 2p4"],
    ["F","Fluorine","He 2s2 2p5"], ["Ne","Neon","He 2s2 2p6"],
    ["Na","Sodium","Ne 3s1"], ["Mg","Magnesium","Ne 3s2"],
    ["Al","Aluminium","Ne 3s2 3p1"], ["Si","Silicon","Ne 3s2 3p2"],
    ["P","Phosphorus","Ne 3s2 3p3"], ["S","Sulfur","Ne 3s2 3p4"],
    ["Cl","Chlorine","Ne 3s2 3p5"], ["Ar","Argon","Ne 3s2 3p6"],
    ["K","Potassium","Ar 4s1"], ["Ca","Calcium","Ar 4s2"],
    ["Sc","Scandium","Ar 3d1 4s2"], ["Ti","Titanium","Ar 3d2 4s2"],
    ["V","Vanadium","Ar 3d3 4s2"], ["Cr","Chromium","Ar 3d5 4s1"],
    ["Mn","Manganese","Ar 3d5 4s2"], ["Fe","Iron","Ar 3d6 4s2"],
    ["Co","Cobalt","Ar 3d7 4s2"], ["Ni","Nickel","Ar 3d8 4s2"],
    ["Cu","Copper","Ar 3d10 4s1"], ["Zn","Zinc","Ar 3d10 4s2"],
    ["Ga","Gallium","Ar 3d10 4s2 4p1"], ["Ge","Germanium","Ar 3d10 4s2 4p2"],
    ["As","Arsenic","Ar 3d10 4s2 4p3"], ["Se","Selenium","Ar 3d10 4s2 4p4"],
    ["Br","Bromine","Ar 3d10 4s2 4p5"], ["Kr","Krypton","Ar 3d10 4s2 4p6"]
  ].map(([symbol,name,configuration], i) => ({
    id: symbol, symbol, name, z: i + 1, charge: 0, configuration,
    counts: expand(configuration), group: i >= 20 && i <= 29 ? "d-atoms" : "main-atoms"
  }));
  const ionEntries = [
    ["Li",1,"He"], ["Be",2,"He"], ["N",-3,"Ne"], ["O",-2,"Ne"], ["F",-1,"Ne"],
    ["Na",1,"Ne"], ["Mg",2,"Ne"], ["Al",3,"Ne"], ["P",-3,"Ar"], ["S",-2,"Ar"],
    ["Cl",-1,"Ar"], ["K",1,"Ar"], ["Ca",2,"Ar"], ["Ga",3,"Ar 3d10"],
    ["As",-3,"Kr"], ["Se",-2,"Kr"], ["Br",-1,"Kr"],
    ["Sc",3,"Ar"], ["Ti",2,"Ar 3d2"], ["Ti",3,"Ar 3d1"], ["Ti",4,"Ar"],
    ["V",2,"Ar 3d3"], ["V",3,"Ar 3d2"], ["Cr",2,"Ar 3d4"], ["Cr",3,"Ar 3d3"],
    ["Mn",2,"Ar 3d5"], ["Mn",3,"Ar 3d4"], ["Fe",2,"Ar 3d6"], ["Fe",3,"Ar 3d5"],
    ["Co",2,"Ar 3d7"], ["Co",3,"Ar 3d6"], ["Ni",2,"Ar 3d8"],
    ["Cu",1,"Ar 3d10"], ["Cu",2,"Ar 3d9"], ["Zn",2,"Ar 3d10"]
  ];
  const ions = ionEntries.map(([symbol,charge,configuration]) => {
    const atom = atoms.find((item) => item.symbol === symbol);
    return { ...atom, id: `${symbol}:${charge}`, charge, configuration, counts: expand(configuration), group: atom.group.replace("atoms", "ions") };
  });
  const species = [...atoms, ...ions];
  const groups = [
    { id: "main-atoms", label: "Main-group atoms", detail: "H–Kr, s and p blocks" },
    { id: "main-ions", label: "Main-group ions", detail: "Positive and negative ions" },
    { id: "d-atoms", label: "D-block atoms", detail: "Sc–Zn, including Cr and Cu" },
    { id: "d-ions", label: "D-block ions", detail: "Sc–Zn, selected charges" }
  ];
  const representations = [
    { id: "full", label: "Full notation", detail: "Every occupied subshell" },
    { id: "short", label: "Abbreviated notation", detail: "A noble-gas core" },
    { id: "row", label: "Boxes in a row", detail: "Orbitals arranged horizontally" },
    { id: "energy", label: "Boxes on energy levels", detail: "Schematic orbital energies" }
  ];
  function freeze(value) { Object.values(value).forEach((item) => { if (item && typeof item === "object") freeze(item); }); return Object.freeze(value); }
  root.ElectronData = freeze({
    version: "electron-configurations-v1", subshells, cores, atoms, species, groups, representations,
    capacities: [2,2,6,2,6,10,2,6], orbitals: [1,1,3,1,3,5,1,3],
    metadata: {
      curriculum: "OCR A Level Chemistry A H432", accessed: "2026-09-04",
      specification: "https://www.ocr.org.uk/Images/171720-specification-accredited-a-level-gce-chemistry-a-h432.pdf",
      specificationVersion: "3.0 (2025), verified indexed OCR extract for 5.3.1; 2.2.1 also checked against the indexed 2.9 extract",
      points: ["2.2.1(b–d)", "5.3.1(a)"],
      sources: [
        "https://www.nist.gov/pml/atomic-reference-data-electronic-structure-calculations/atomic-reference-data-electronic-8",
        "https://www.ocr.org.uk/Images/704036-mark-scheme-periodic-table-elements-and-physical-chemistry.pdf",
        "https://ocw.mit.edu/courses/5-112-principles-of-chemical-science-fall-2005/84c77b5139905b7b8156288d0dd31219_KUVB9S0QX-I.pdf"
      ]
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
