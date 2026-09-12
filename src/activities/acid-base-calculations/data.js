(function (root) {
  "use strict";

  const metadata = Object.freeze({
    specification: "OCR Level 3 Advanced GCE Chemistry A H432",
    specificationVersion: "3.0 (2025)",
    specificationPoint: "5.1.3 Acids, bases and buffers",
    researchRange: "Public H432/01 and H432/03 materials, 2017–2025",
    specificationAccessed: "4 September 2026"
  });

  const strongAcids = Object.freeze([
    Object.freeze({ id: "hcl", name: "hydrochloric acid", formula: "HCl", mr: 36.5, protons: 1 }),
    Object.freeze({ id: "hno3", name: "nitric acid", formula: "HNO₃", mr: 63.0, protons: 1 }),
    Object.freeze({ id: "h2so4", name: "sulfuric acid", formula: "H₂SO₄", mr: 98.1, protons: 2 })
  ]);

  const weakAcids = Object.freeze([
    Object.freeze({ id: "ethanoic", name: "ethanoic acid", formula: "CH₃COOH", conjugate: "CH₃COO⁻", sodiumSalt: "sodium ethanoate", sodiumSaltFormula: "CH₃COONa", ka: 1.75e-5, mr: 60.0, saltMr: 82.0 }),
    Object.freeze({ id: "propanoic", name: "propanoic acid", formula: "CH₃CH₂COOH", conjugate: "CH₃CH₂COO⁻", sodiumSalt: "sodium propanoate", sodiumSaltFormula: "CH₃CH₂COONa", ka: 1.32e-5, mr: 74.0, saltMr: 96.0 }),
    Object.freeze({ id: "butanoic", name: "butanoic acid", formula: "CH₃CH₂CH₂COOH", conjugate: "CH₃CH₂CH₂COO⁻", sodiumSalt: "sodium butanoate", sodiumSaltFormula: "CH₃CH₂CH₂COONa", ka: 1.50e-5, mr: 88.0, saltMr: 110.0 }),
    Object.freeze({ id: "glycolic", name: "glycolic acid", formula: "HOCH₂COOH", conjugate: "HOCH₂COO⁻", sodiumSalt: "sodium glycolate", sodiumSaltFormula: "HOCH₂COONa", ka: 1.48e-4, mr: 76.0, saltMr: 98.0 })
  ]);

  const strongBases = Object.freeze([
    Object.freeze({ id: "naoh", name: "sodium hydroxide", formula: "NaOH", mr: 40.0, hydroxides: 1 }),
    Object.freeze({ id: "koh", name: "potassium hydroxide", formula: "KOH", mr: 56.1, hydroxides: 1 }),
    Object.freeze({ id: "baoh2", name: "barium hydroxide", formula: "Ba(OH)₂", mr: 171.3, hydroxides: 2 }),
    Object.freeze({ id: "sroh2", name: "strontium hydroxide", formula: "Sr(OH)₂", mr: 121.6, hydroxides: 2 })
  ]);

  const kwValues = Object.freeze([
    Object.freeze({ temperature: 25, kw: 1.00e-14 }),
    Object.freeze({ temperature: 40, kw: 2.92e-14 })
  ]);

  const families = Object.freeze([
    Object.freeze({ id: "foundations", label: "pH and [H⁺]" }),
    Object.freeze({ id: "strong-acid", label: "Strong acids" }),
    Object.freeze({ id: "strong-base", label: "Strong bases and ionic product of water" }),
    Object.freeze({ id: "water-kw", label: "Pure water and temperature" }),
    Object.freeze({ id: "weak-acid", label: "Weak monobasic acids" }),
    Object.freeze({ id: "buffer", label: "Acid buffers" }),
    Object.freeze({ id: "neutralisation", label: "Neutralisation and titration" }),
    Object.freeze({ id: "synoptic", label: "Synoptic calculations" })
  ]);

  const templates = Object.freeze([
    { id: "h-to-ph", family: "foundations", levels: [1], label: "[H⁺] → pH", target: "pH" },
    { id: "ph-to-h", family: "foundations", levels: [1], label: "pH → [H⁺]", target: "[H⁺]" },
    { id: "strong-acid-direct", family: "strong-acid", levels: [1], label: "Direct strong-acid pH", target: "pH" },
    { id: "strong-base-direct", family: "strong-base", levels: [1], label: "Direct NaOH/KOH pH", target: "pH" },
    { id: "water-ph-from-kw", family: "water-kw", levels: [1], label: "Pure-water pH from supplied constant", target: "pH" },
    { id: "weak-acid-direct", family: "weak-acid", levels: [1], label: "Direct weak-acid pH", target: "pH" },
    { id: "buffer-direct", family: "buffer", levels: [1], label: "Direct acid/salt buffer pH", target: "pH" },
    { id: "neutralisation-direct", family: "neutralisation", levels: [1], label: "Direct neutralisation volume", target: "Volume" },

    { id: "strong-acid-dilution", family: "strong-acid", levels: [2], label: "Diluted strong-acid pH", target: "pH" },
    { id: "strong-base-mass", family: "strong-base", levels: [2], label: "Base mass and volume → pH", target: "pH" },
    { id: "dihydroxide-direct", family: "strong-base", levels: [2], label: "Ba(OH)₂/Sr(OH)₂ pH", target: "pH" },
    { id: "temperature-base", family: "water-kw", levels: [2], label: "Base pH at non-standard temperature", target: "pH" },
    { id: "weak-acid-amount", family: "weak-acid", levels: [2], label: "Weak-acid amount and volume → pH", target: "pH" },
    { id: "weak-acid-reverse-concentration", family: "weak-acid", levels: [2], label: "Weak-acid pH → concentration", target: "Concentration" },
    { id: "weak-acid-pka", family: "weak-acid", levels: [2], label: "Weak-acid pH → pK_a", target: "pK_a" },
    { id: "weak-acid-percent", family: "weak-acid", levels: [2], label: "Percentage dissociation", target: "Percentage" },
    { id: "buffer-mixed-volumes", family: "buffer", levels: [2], label: "Mixed acid/salt solutions → pH", target: "pH" },
    { id: "buffer-reverse-ka", family: "buffer", levels: [2], label: "Buffer pH → K_a", target: "K_a" },
    { id: "partial-buffer-moles", family: "buffer", levels: [2], label: "Partial neutralisation from moles", target: "pH" },
    { id: "titration-concentration", family: "neutralisation", levels: [2], label: "Titre → unknown concentration", target: "Concentration" },
    { id: "titration-endpoint-data", family: "neutralisation", levels: [2, 3], label: "pH data → endpoint and concentration", target: "Endpoint and concentration" },

    { id: "base-mass-concentration-dilution", family: "strong-base", levels: [3], label: "Mass concentration + dilution → pH", target: "pH" },
    { id: "base-purity", family: "strong-base", levels: [3], label: "Measured pH → base purity", target: "Percentage" },
    { id: "excess-strong-base", family: "neutralisation", levels: [3], label: "Excess strong base after neutralisation", target: "pH" },
    { id: "weak-acid-target-mass", family: "weak-acid", levels: [3], label: "Target pH → weak-acid mass", target: "Mass" },
    { id: "weak-acid-purity", family: "weak-acid", levels: [3], label: "Measured pH → weak-acid purity", target: "Percentage" },
    { id: "partial-buffer-volumes", family: "buffer", levels: [3], label: "Partial neutralisation from solutions", target: "pH" },
    { id: "partial-buffer-ka", family: "buffer", levels: [3], label: "Partial-neutralisation buffer → K_a", target: "K_a" },
    { id: "target-buffer-salt-mass", family: "buffer", levels: [3], label: "Target buffer pH → salt mass", target: "Mass" },
    { id: "buffer-recipe-deviation", family: "buffer", levels: [3], label: "Buffer recipe → pH deviation", target: "pH difference" },
    { id: "blood-buffer-ph", family: "buffer", levels: [3], label: "Blood-buffer ratio → pH", target: "pH" },
    { id: "buffer-after-addition", family: "buffer", levels: [3], label: "Buffer after strong acid/alkali addition", target: "pH" },
    { id: "titre-sample-mass", family: "neutralisation", levels: [3], label: "Titre set → tablet mass", target: "Mass" }
  ].map(Object.freeze));

  const labels = Object.freeze({
    structures: Object.freeze({ auto: "Automatic for level", staged: "Staged numerical parts", single: "Single unstructured calculation" }),
    levels: Object.freeze({ 1: "Level 1 · Direct", 2: "Level 2 · Linked", 3: "Level 3 · Unstructured" })
  });

  root.AcidBaseData = { metadata, strongAcids, weakAcids, strongBases, kwValues, families, templates, labels };
})(typeof globalThis !== "undefined" ? globalThis : window);
