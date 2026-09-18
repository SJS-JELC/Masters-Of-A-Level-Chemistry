/* The question bank for the IGCSE dot-and-cross activity.  References are
 * plain data and are cloned by DotCrossCore.reference before editing. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DotCrossData = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SOURCE = 'Edexcel International GCSE Chemistry specification Issue 3 (September 2024), sections 1.40 and 1.46; accessed 2026-09-12';
  var SOURCE_URL = 'https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Chemistry/2017/specification-and-sample-assessments/international-gcse-chemistry-2017-specification.pdf';
  // Observed source bands are separate from our authored practice progression.
  var atlasAnchors = {
    hcl:[['2025-june-1r-q8bi','5-6']],nh3:[['2022-june-1-q10a','5-6'],['2021-june-1-q8biii','7-8']],
    n2:[['2024-june-1-q7(b)','7-8'],['2022-jan-1-q10ai','9']],co2:[['2020-jan-1r-q10ai','5-6']],
    ch3cl:[['2020-nov-1-q5biv','5-6']],chloroethene:[['2025-june-1-q9ai','7-8']],c2h4:[['2023-june-1-q4aii','7-8']],
    h2o2:[['2023-nov-1-q6b','7-8']],n2h4:[['2023-jan-2-q7a','7-8']],sih4:[['2022-june-1r-q6b','5-6']],
    'methanoic-acid':[['2023-jan-1r-q5bii','7-8']],propane:[['2025-nov-1-q9b','7-8']],propene:[['2023-june-1r-q10ai','7-8']],
    mgo:[['2025-june-2-q3c','5-6']],mgcl2:[['2024-june-1r-q9bii','5-6']],na2o:[['2020-jan-1-q4bii','5-6']],
    'potassium-oxide':[['2021-nov-2-q4b','7-8']],'potassium-bromide':[['2019-june-2r-q4c','7-8']],
    'lithium-oxide':[['2023-jan-1-q8bi','5-6']]
  };
  var ATLAS_EVIDENCE=Object.fromEntries(Object.entries(atlasAnchors).map(function(entry){return [entry[0],entry[1].map(function(anchor){return {questionId:anchor[0],observedBand:anchor[1],basis:'resources/past-paper-atlas/data/atlas.json classification.band',relationship:entry[0]==='lithium-oxide'?'electron-configuration explanation; original practice prompt':'diagram motif; original practice prompt'};})];}));
  var viewBox = { width: 1000, height: 650, atomRadius: 64, hydrogenRadius: 40, bondLength: 104, shellOverlap: 24 };
  function shellRadius(atomOrElement) { return (typeof atomOrElement === 'string' ? atomOrElement : atomOrElement.element) === 'H' ? 40 : 64; }
  function bondDistance(a, b) { return shellRadius(a) + shellRadius(b) - viewBox.shellOverlap; }
  var electronSlots = {
    atom: { directions: [-100, -80, -10, 10, 80, 100, 170, 190], radius: 64, hydrogenRadius: 40 },
    bond: { maxPairs: 3, centredInOverlap: true, perpendicularOffsets: [-5, 5], pairSpacing: 22 }
  };
  var nextElectron = 1;
  function atom(id, element, x, y) { return { id: id, element: element, x: x, y: y }; }
  function state(atoms, bondList, loneList, groups) {
    var electrons = [];
    var atomSlot = Object.create(null);
    function add(symbol, anchor) { electrons.push({ id: 'e' + nextElectron++, symbol: symbol, anchor: anchor }); }
    bondList.forEach(function (b) {
      for (var pair = 0; pair < b.order; pair++) {
        var symbols = b.pairs && b.pairs[pair] ? b.pairs[pair] : ['dot', 'cross'];
        add(symbols[0], { kind: 'bond', a: b.a, b: b.b, slot: pair * 2 });
        add(symbols[1], { kind: 'bond', a: b.a, b: b.b, slot: pair * 2 + 1 });
      }
    });
    loneList.forEach(function (l) {
      var start = atomSlot[l.atomId] || 0;
      var slots = l.slots || Array.from({ length: l.count }, function (_, i) { return start + i; });
      slots.forEach(function (slot) { add(l.symbol || 'dot', { kind: 'atom', atomId: l.atomId, slot: slot }); });
      atomSlot[l.atomId] = Math.max(start + l.count, ...slots.map(function (slot) { return slot + 1; }));
    });
    return { atoms: atoms, electrons: electrons, groups: groups || [] };
  }
  function bond(a, b, order) { return { a: a, b: b, order: order || 1 }; }
  function lone(atomId, count, symbol, slots) { return { atomId: atomId, count: count, symbol: symbol || 'dot', slots: slots || null }; }
  function group(id, atomIds, charge) { return { id: id, atomIds: atomIds, charge: charge, bracket: true }; }
  function defaultGrades(id, formula, category, extension) {
    if (extension) return [];
    if (category === 'ionic') return [1, 2];
    if (id === 'n2') return [2];
    if (/^C2/.test(formula)) return [3];
    return formula.replace(/[0-9]/g, '').length === 2 ? [1] : [2];
  }
  function q(id, name, formula, category, extension, prompt, explanation, atoms, bonds, loneElectrons, groups, grades, smiles) {
    var drawn = state(atoms, bonds, loneElectrons, groups), bondCounts = Object.create(null), loneCounts = Object.create(null);
    bonds.forEach(function(b){var label=[atoms.find(function(a){return a.id===b.a;}).element,atoms.find(function(a){return a.id===b.b;}).element].sort().join('–')+' ('+b.order+' shared pair'+(b.order===1?'':'s')+')';bondCounts[label]=(bondCounts[label]||0)+1;});
    atoms.forEach(function(a){var count=drawn.electrons.filter(function(e){return e.anchor.kind==='atom'&&e.anchor.atomId===a.id;}).length;if(count){var label=a.element+': '+count+' non-bonding electrons';loneCounts[label]=(loneCounts[label]||0)+1;}});
    var detail=Object.keys(bondCounts).map(function(k){return bondCounts[k]+' × '+k;}).join('; ');
    var loneDetail=Object.keys(loneCounts).map(function(k){return loneCounts[k]+' × '+k;}).join('; ');
    return {
      id: id, name: name, formula: formula, displayFormula: formula, totalCharge: 0, namedSpecies: false,
      category: category, practiceCategory: category === 'mixed' ? 'ionic' : category, extension: !!extension,
      grades: grades || defaultGrades(id, formula, category, extension), scope: extension ? 'extension' : 'specification', atlasEvidence: ATLAS_EVIDENCE[id] || null,
      smiles: smiles || null,
      prompt: prompt, explanation: explanation+' '+(detail?'Bonds: '+detail+'. ':'No covalent shared pairs. ')+(loneDetail?'Non-bonding inventory: '+loneDetail+'.':'No non-bonding electrons.'), sourceRefs: [SOURCE, SOURCE_URL].concat((ATLAS_EVIDENCE[id]||[]).map(function(e){return 'resources/past-paper-atlas/data/atlas.json#'+e.questionId;})),
      reference: drawn, viewBox: viewBox, electronSlots: electronSlots,
      marking: { cationShells: 'empty-or-retained-full-shell', geometryChecked: false }
    };
  }
  var covalentPrompt = 'Draw any valid neutral isomer with this molecular formula, as one connected molecule. Show outer-shell electrons only. Each shared pair needs one dot and one cross; use one symbol for the non-bonding electrons on each atom. Inner shells and molecular shape are not assessed.';
  var ionicPrompt = 'Draw the dot-and-cross diagram for the ions. Metal ions may show an empty former outer shell or a full retained shell: two electrons for Li⁺, eight for the other metals here. Distinguish gained electrons from the anion\'s own electrons. Use brackets and charges.';
  var mixedPrompt = 'Extension: draw the dot-and-cross diagram, including the hydroxide ion as a bracketed ion. Show outer-shell and transferred electrons, brackets and charges. Metal ions may show an empty shell or a full retained octet.';
  var covalentExplain = 'Shared pairs contain one electron from each atom. Hydrogen has two electrons around it; shared and non-bonding electrons give every other atom eight.';
  var ionicExplain = 'The metal loses its outer electron(s); those electrons are shown on the non-metal ion, whose brackets and charge identify the ion.';
  var mixedExplain = 'In hydroxide, oxygen supplies six original outer electrons, hydrogen supplies one for the O–H pair, and the metal supplies the transferred electron shown on oxygen.';
  /* Generate atom shells from a small graph description.  The helper keeps
   * source data compact while making every reference explicit and deterministic. */
  var COVALENT_VALENCE = { H: 1, C: 4, N: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7 };
  function covalentQuestion(id, name, formula, atoms, bonds, grades, smiles, loneSlots) {
    var adjacency = Object.create(null), colours = Object.create(null);
    atoms.forEach(function (a) { adjacency[a.id] = []; });
    bonds.forEach(function (b) { adjacency[b.a].push({ id: b.b, order: b.order }); adjacency[b.b].push({ id: b.a, order: b.order }); });
    // Authored directions describe a tree, not bond lengths. Use the editor's
    // exact overlap spacing; move descendants together before H-shell reflow.
    var originals = Object.fromEntries(atoms.map(function(a){return [a.id,Object.assign({},a)];})), positioned = new Set();
    function position(current){positioned.add(current.id);adjacency[current.id].forEach(function(edge){
      if(positioned.has(edge.id))return;
      var child=atoms.find(function(a){return a.id===edge.id;}),from=originals[current.id],to=originals[child.id],dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
      var distance=current.element==='H'||child.element==='H'?length:bondDistance(current,child);
      child.x=current.x+dx/length*distance;child.y=current.y+dy/length*distance;position(child);
    });}
    position(atoms[0]);
    atoms.forEach(function (a) {
      if (colours[a.id] != null) return;
      colours[a.id] = 0; var todo = [a.id];
      while (todo.length) { var current = todo.pop(); adjacency[current].forEach(function (edge) { if (colours[edge.id] == null) { colours[edge.id] = 1 - colours[current]; todo.push(edge.id); } }); }
    });
    var loneElectrons = atoms.map(function (a) {
      var bondOrder = adjacency[a.id].reduce(function (sum, edge) { return sum + edge.order; }, 0);
      var target = a.element === 'H' ? 2 : 8, count = target - 2 * bondOrder;
      if (count < 0 || count % 2) throw new Error(id + ': invalid shell inventory for ' + a.id);
      var slots = (loneSlots && loneSlots[a.id]) || Array.from({ length: count }, function (_, i) { return i; });
      return count ? lone(a.id, count, colours[a.id] ? 'cross' : 'dot', slots) : null;
    }).filter(Boolean);
    return q(id, name, formula, 'covalent', false, covalentPrompt, covalentExplain, atoms, bonds, loneElectrons, [], grades, smiles);
  }
  var IONIC_VALENCE = { Li: 1, K: 1, Na: 1, Mg: 2, Ca: 2, Al: 3, F: 7, Cl: 7, Br: 7, I: 7, O: 6, S: 6, N: 5 };
  var ionicPositions = [[180, 220], [500, 220], [820, 220], [180, 430], [500, 430], [820, 430]];
  function ionicQuestion(id, name, formula, cation, cationCount, anion, anionCount, grades) {
    var atoms = [], loneElectrons = [], groups = [], position = 0, i;
    for (i = 1; i <= cationCount; i++) { var cationId = cation + i; atoms.push(atom(cationId, cation, ionicPositions[position][0], ionicPositions[position][1])); position++; groups.push(group(cationId + '+', [cationId], IONIC_VALENCE[cation])); }
    for (i = 1; i <= anionCount; i++) {
      var anionId = anion + i, own = IONIC_VALENCE[anion], gained = 8 - own;
      atoms.push(atom(anionId, anion, ionicPositions[position][0], ionicPositions[position][1])); position++;
      loneElectrons.push(lone(anionId, own, 'dot', Array.from({ length: own }, function (_, j) { return j; })));
      loneElectrons.push(lone(anionId, gained, 'cross', Array.from({ length: gained }, function (_, j) { return own + j; })));
      groups.push(group(anionId + '-', [anionId], -gained));
    }
    return q(id, name, formula, 'ionic', false, ionicPrompt, ionicExplain, atoms, [], loneElectrons, groups, grades || [1, 2]);
  }
  function radialAtoms(centre, terminals, radius, startDegrees) {
    var atoms = [centre], start = (startDegrees || 0) * Math.PI / 180;
    terminals.forEach(function (terminal, i) {
      var angle = start + i * 2 * Math.PI / terminals.length;
      terminal.x = centre.x + radius * Math.cos(angle); terminal.y = centre.y + radius * Math.sin(angle); atoms.push(terminal);
    });
    return atoms;
  }
  function namedQuestion(spec) {
    var grouping = spec.practiceCategory === 'ionic' && !spec.totalCharge ? ', brackets around each ion, and their charges' : spec.totalCharge ? ', a bracket around the whole ion, and its charge' : '';
    var third = spec.requiresThirdSymbol ? ' Use a third symbol to distinguish the additional electron source.' : '';
    var question = q(spec.id, spec.name, spec.formula, spec.practiceCategory, false,
      'Draw the dot-and-cross diagram for ' + spec.name + '. Show all outer-shell electrons' + grouping + '.' + third,
      spec.explanation, spec.atoms, spec.bonds, spec.lone, spec.groups || [], spec.grades, spec.smiles);
    question.namedSpecies = true; question.displayFormula = spec.displayFormula; question.totalCharge = spec.totalCharge || 0;
    question.practiceCategory = spec.practiceCategory; question.category = spec.practiceCategory;
    question.marking = { speciesSpecific: true, shellTargets: spec.shellTargets || {}, transferredSymbol: spec.transferredSymbol || null, geometryChecked: false };
    question.sourceRefs = ['resources/a-level-past-paper-atlas/run2/specification-evidence/sections.json#2.2.2(a,e)'].concat(spec.evidence || []);
    question.scope = spec.scope || 'OCR A Level Chemistry A 2.2.2(a,e)';
    return question;
  }
  function terminalLone(ids, count, symbol) { return ids.map(function (id) { return lone(id, count, symbol); }); }
  function centredSpec(id, name, formula, displayFormula, centreElement, terminalElement, terminalCount, centreLone, grades, evidence, shellTarget) {
    var centre = atom(centreElement + '1', centreElement, 500, 325), terminals = Array.from({ length: terminalCount }, function (_, i) { return atom(terminalElement + (i + 1), terminalElement, 0, 0); });
    var atoms = radialAtoms(centre, terminals, bondDistance(centreElement, terminalElement), terminalCount === 3 ? -90 : 0);
    return namedQuestion({ id:id, name:name, formula:formula, displayFormula:displayFormula, totalCharge:0, practiceCategory:'covalent', grades:grades,
      atoms:atoms, bonds:terminals.map(function (a) { return bond(centre.id, a.id, 1); }),
      lone:(centreLone ? [lone(centre.id, centreLone, 'dot')] : []).concat(terminalLone(terminals.map(function (a) { return a.id; }), 6, 'cross')),
      groups:[], shellTargets:shellTarget ? Object.fromEntries([[centre.id, shellTarget]]) : {}, evidence:evidence || [],
      explanation:id==='boron-trifluoride'?'Boron has three shared pairs, no lone pair and six electrons around it.':shellTarget?'The central '+centreElement+' atom has '+shellTarget+' electrons around it. The arrangement shown is schematic; molecular shape is not assessed in this task.':'This named species has ' + terminalCount + ' single shared pair' + (terminalCount === 1 ? '' : 's') + (centreLone ? ' and ' + centreLone + ' non-bonding electron' + (centreLone === 1 ? '' : 's') + ' on the central atom.' : '.') });
  }

  var questions = [
    covalentQuestion('h2', 'Hydrogen', 'H2', [atom('H1', 'H', 448, 325), atom('H2', 'H', 552, 325)], [bond('H1', 'H2', 1)], [1], '[H][H]'),
    covalentQuestion('cl2', 'Chlorine', 'Cl2', [atom('Cl1', 'Cl', 448, 325), atom('Cl2', 'Cl', 552, 325)], [bond('Cl1', 'Cl2', 1)], [1], 'ClCl', { Cl1: [0, 1, 4, 5, 6, 7], Cl2: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('hcl', 'Hydrogen chloride', 'HCl', [atom('H1', 'H', 448, 325), atom('Cl1', 'Cl', 552, 325)], [bond('H1', 'Cl1', 1)], [1], '[H]Cl', { Cl1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('h2o', 'Water', 'H2O', [atom('O1', 'O', 500, 325), atom('H1', 'H', 396, 325), atom('H2', 'H', 604, 325)], [bond('O1', 'H1', 1), bond('O1', 'H2', 1)], [2], 'O', { O1: [0, 1, 4, 5] }),
    covalentQuestion('nh3', 'Ammonia', 'NH3', [atom('N1', 'N', 500, 325), atom('H1', 'H', 396, 325), atom('H2', 'H', 500, 429), atom('H3', 'H', 604, 325)], [bond('N1', 'H1', 1), bond('N1', 'H2', 1), bond('N1', 'H3', 1)], [2], 'N'),
    covalentQuestion('ch4', 'Methane', 'CH4', [atom('C1', 'C', 500, 325), atom('H1', 'H', 396, 325), atom('H2', 'H', 500, 221), atom('H3', 'H', 500, 429), atom('H4', 'H', 604, 325)], [bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C1', 'H4', 1)], [2], 'C'),
    covalentQuestion('o2', 'Oxygen', 'O2', [atom('O1', 'O', 448, 325), atom('O2', 'O', 552, 325)], [bond('O1', 'O2', 2)], [1], 'O=O', { O1: [0, 1, 4, 5], O2: [0, 1, 2, 3] }),
    covalentQuestion('n2', 'Nitrogen', 'N2', [atom('N1', 'N', 448, 325), atom('N2', 'N', 552, 325)], [bond('N1', 'N2', 3)], [2, 3], 'N#N'),
    covalentQuestion('co2', 'Carbon dioxide', 'CO2', [atom('C1', 'C', 500, 325), atom('O1', 'O', 396, 325), atom('O2', 'O', 604, 325)], [bond('C1', 'O1', 2), bond('C1', 'O2', 2)], [2], 'O=C=O', { O1: [0, 1, 4, 5], O2: [0, 1, 2, 3] }),
    covalentQuestion('c2h6', 'Ethane', 'C2H6', [atom('C1', 'C', 448, 325), atom('C2', 'C', 552, 325), atom('H1', 'H', 344, 325), atom('H2', 'H', 448, 221), atom('H3', 'H', 448, 429), atom('H4', 'H', 656, 325), atom('H5', 'H', 552, 221), atom('H6', 'H', 552, 429)], [bond('C1', 'C2', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1), bond('C2', 'H6', 1)], [2, 3], 'CC'),
    covalentQuestion('c2h4', 'Ethene', 'C2H4', [atom('C1', 'C', 448, 325), atom('C2', 'C', 552, 325), atom('H1', 'H', 358, 273), atom('H2', 'H', 358, 377), atom('H3', 'H', 642, 273), atom('H4', 'H', 642, 377)], [bond('C1', 'C2', 2), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C2', 'H3', 1), bond('C2', 'H4', 1)], [2, 3], 'C=C'),
    covalentQuestion('ch3cl', 'Chloromethane', 'CH3Cl', [atom('C1', 'C', 448, 325), atom('Cl1', 'Cl', 552, 325), atom('H1', 'H', 344, 325), atom('H2', 'H', 400, 235), atom('H3', 'H', 400, 415)], [bond('C1', 'Cl1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1)], [2], 'CCl', { Cl1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('chloroethene', 'Chloroethene', 'C2H3Cl', [atom('C1', 'C', 448, 325), atom('C2', 'C', 552, 325), atom('Cl1', 'Cl', 656, 325), atom('H1', 'H', 358, 273), atom('H2', 'H', 358, 377), atom('H3', 'H', 552, 429)], [bond('C1', 'C2', 2), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C2', 'Cl1', 1), bond('C2', 'H3', 1)], [2, 3], 'C=CCl', { Cl1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('f2', 'Fluorine', 'F2', [atom('F1', 'F', 448, 325), atom('F2', 'F', 552, 325)], [bond('F1', 'F2', 1)], [1], 'FF'),
    covalentQuestion('br2', 'Bromine', 'Br2', [atom('Br1', 'Br', 448, 325), atom('Br2', 'Br', 552, 325)], [bond('Br1', 'Br2', 1)], [1], 'BrBr'),
    covalentQuestion('i2', 'Iodine', 'I2', [atom('I1', 'I', 448, 325), atom('I2', 'I', 552, 325)], [bond('I1', 'I2', 1)], [1], 'II'),
    covalentQuestion('hf', 'Hydrogen fluoride', 'HF', [atom('H1', 'H', 448, 325), atom('F1', 'F', 552, 325)], [bond('H1', 'F1', 1)], [1], '[H]F'),
    covalentQuestion('hbr', 'Hydrogen bromide', 'HBr', [atom('H1', 'H', 448, 325), atom('Br1', 'Br', 552, 325)], [bond('H1', 'Br1', 1)], [1], '[H]Br'),
    covalentQuestion('hi', 'Hydrogen iodide', 'HI', [atom('H1', 'H', 448, 325), atom('I1', 'I', 552, 325)], [bond('H1', 'I1', 1)], [1], '[H]I'),
    covalentQuestion('h2s', 'Hydrogen sulfide', 'H2S', [atom('S1', 'S', 500, 325), atom('H1', 'H', 396, 325), atom('H2', 'H', 604, 325)], [bond('S1', 'H1', 1), bond('S1', 'H2', 1)], [2], 'S', { S1: [0, 1, 4, 5] }),
    covalentQuestion('h2o2', 'Hydrogen peroxide', 'H2O2', [atom('O1', 'O', 448, 325), atom('O2', 'O', 552, 325), atom('H1', 'H', 344, 325), atom('H2', 'H', 656, 325)], [bond('O1', 'O2', 1), bond('O1', 'H1', 1), bond('O2', 'H2', 1)], [2], 'OO'),
    covalentQuestion('n2h4', 'Hydrazine', 'N2H4', [atom('N1', 'N', 448, 325), atom('N2', 'N', 552, 325), atom('H1', 'H', 344, 265), atom('H2', 'H', 344, 385), atom('H3', 'H', 656, 265), atom('H4', 'H', 656, 385)], [bond('N1', 'N2', 1), bond('N1', 'H1', 1), bond('N1', 'H2', 1), bond('N2', 'H3', 1), bond('N2', 'H4', 1)], [2], 'NN'),
    covalentQuestion('c2h5cl', 'Chloroethane', 'C2H5Cl', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('Cl1', 'Cl', 608, 325), atom('H1', 'H', 296, 325), atom('H2', 'H', 400, 429), atom('H3', 'H', 400, 205), atom('H4', 'H', 504, 205), atom('H5', 'H', 504, 445)], [bond('C1', 'C2', 1), bond('C2', 'Cl1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1)], [3], 'CCCl', { Cl1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h5br', 'Bromoethane', 'C2H5Br', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('Br1', 'Br', 608, 325), atom('H1', 'H', 296, 325), atom('H2', 'H', 400, 429), atom('H3', 'H', 400, 205), atom('H4', 'H', 504, 205), atom('H5', 'H', 504, 445)], [bond('C1', 'C2', 1), bond('C2', 'Br1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1)], [3], 'CCBr', { Br1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h5i', 'Iodoethane', 'C2H5I', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('I1', 'I', 608, 325), atom('H1', 'H', 296, 325), atom('H2', 'H', 400, 429), atom('H3', 'H', 400, 205), atom('H4', 'H', 504, 205), atom('H5', 'H', 504, 445)], [bond('C1', 'C2', 1), bond('C2', 'I1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1)], [3], 'CCI', { I1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h5f', 'Fluoroethane', 'C2H5F', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('F1', 'F', 608, 325), atom('H1', 'H', 296, 325), atom('H2', 'H', 400, 429), atom('H3', 'H', 400, 205), atom('H4', 'H', 504, 205), atom('H5', 'H', 504, 445)], [bond('C1', 'C2', 1), bond('C2', 'F1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1)], [3], 'CCF', { F1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h3br', 'Bromoethene', 'C2H3Br', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('Br1', 'Br', 608, 325), atom('H1', 'H', 310, 255), atom('H2', 'H', 310, 395), atom('H3', 'H', 504, 445)], [bond('C1', 'C2', 2), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C2', 'Br1', 1), bond('C2', 'H3', 1)], [3], 'C=CBr', { Br1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h3f', 'Fluoroethene', 'C2H3F', [atom('C1', 'C', 400, 325), atom('C2', 'C', 504, 325), atom('F1', 'F', 608, 325), atom('H1', 'H', 310, 255), atom('H2', 'H', 310, 395), atom('H3', 'H', 504, 445)], [bond('C1', 'C2', 2), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C2', 'F1', 1), bond('C2', 'H3', 1)], [3], 'C=CF', { F1: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h4cl2-11', '1,1-Dichloroethane', 'C2H4Cl2', [atom('C1', 'C', 400, 325), atom('C2', 'C', 520, 325), atom('Cl1', 'Cl', 400, 205), atom('Cl2', 'Cl', 400, 445), atom('H1', 'H', 280, 325), atom('H2', 'H', 580, 221), atom('H3', 'H', 640, 325), atom('H4', 'H', 580, 429)], [bond('C1', 'C2', 1), bond('C1', 'Cl1', 1), bond('C1', 'Cl2', 1), bond('C1', 'H1', 1), bond('C2', 'H2', 1), bond('C2', 'H3', 1), bond('C2', 'H4', 1)], [3], 'CC(Cl)Cl', { Cl1: [0, 1, 2, 3, 4, 5], Cl2: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h4cl2-12', '1,2-Dichloroethane', 'C2H4Cl2', [atom('C1', 'C', 400, 325), atom('C2', 'C', 520, 325), atom('Cl1', 'Cl', 400, 205), atom('Cl2', 'Cl', 520, 445), atom('H1', 'H', 280, 325), atom('H2', 'H', 400, 445), atom('H3', 'H', 520, 205), atom('H4', 'H', 640, 325)], [bond('C1', 'C2', 1), bond('C1', 'Cl1', 1), bond('C2', 'Cl2', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C2', 'H3', 1), bond('C2', 'H4', 1)], [3], 'ClCCCl', { Cl1: [0, 1, 2, 3, 4, 5], Cl2: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h2cl2-11', '1,1-Dichloroethene', 'C2H2Cl2', [atom('C1', 'C', 400, 325), atom('C2', 'C', 520, 325), atom('Cl1', 'Cl', 400, 205), atom('Cl2', 'Cl', 400, 445), atom('H1', 'H', 520, 205), atom('H2', 'H', 520, 445)], [bond('C1', 'C2', 2), bond('C1', 'Cl1', 1), bond('C1', 'Cl2', 1), bond('C2', 'H1', 1), bond('C2', 'H2', 1)], [3], 'C=C(Cl)Cl', { Cl1: [0, 1, 2, 3, 4, 5], Cl2: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('c2h2cl2-12', '1,2-Dichloroethene', 'C2H2Cl2', [atom('C1', 'C', 400, 325), atom('C2', 'C', 520, 325), atom('Cl1', 'Cl', 400, 205), atom('Cl2', 'Cl', 520, 445), atom('H1', 'H', 400, 445), atom('H2', 'H', 520, 205)], [bond('C1', 'C2', 2), bond('C1', 'Cl1', 1), bond('C2', 'Cl2', 1), bond('C1', 'H1', 1), bond('C2', 'H2', 1)], [3], 'ClC=CCl', { Cl1: [0, 1, 2, 3, 4, 5], Cl2: [0, 1, 2, 3, 4, 5] }),
    covalentQuestion('ethanol', 'Ethanol', 'C2H6O', [atom('C1', 'C', 350, 325), atom('C2', 'C', 470, 325), atom('O1', 'O', 590, 325), atom('H1', 'H', 246, 325), atom('H2', 'H', 350, 429), atom('H3', 'H', 350, 205), atom('H4', 'H', 470, 205), atom('H5', 'H', 470, 445), atom('H6', 'H', 690, 325)], [bond('C1', 'C2', 1), bond('C2', 'O1', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1), bond('O1', 'H6', 1)], [3], 'CCO', { O1: [0, 1, 4, 5] }),
    covalentQuestion('dimethylether', 'Dimethyl ether', 'C2H6O', [atom('C1', 'C', 350, 325), atom('O1', 'O', 500, 325), atom('C2', 'C', 650, 325), atom('H1', 'H', 246, 325), atom('H2', 'H', 350, 429), atom('H3', 'H', 350, 205), atom('H4', 'H', 754, 325), atom('H5', 'H', 650, 429), atom('H6', 'H', 650, 205)], [bond('C1', 'O1', 1), bond('O1', 'C2', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1), bond('C2', 'H5', 1), bond('C2', 'H6', 1)], [3], 'COC', { O1: [0, 1, 4, 5] }),
    covalentQuestion('ethanal', 'Ethanal', 'C2H4O', [atom('C1', 'C', 350, 325), atom('C2', 'C', 500, 325), atom('O1', 'O', 650, 325), atom('H1', 'H', 246, 325), atom('H2', 'H', 350, 429), atom('H3', 'H', 350, 205), atom('H4', 'H', 500, 445)], [bond('C1', 'C2', 1), bond('C2', 'O1', 2), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1), bond('C2', 'H4', 1)], [3], 'CC=O', { O1: [0, 1, 4, 5] }),
    covalentQuestion('ethanoic-acid', 'Ethanoic acid', 'C2H4O2', [atom('C1', 'C', 350, 325), atom('C2', 'C', 500, 325), atom('O1', 'O', 650, 325), atom('O2', 'O', 500, 445), atom('H1', 'H', 246, 325), atom('H2', 'H', 350, 429), atom('H3', 'H', 350, 205), atom('H4', 'H', 500, 565)], [bond('C1', 'C2', 1), bond('C2', 'O1', 2), bond('C2', 'O2', 1), bond('O2', 'H4', 1), bond('C1', 'H1', 1), bond('C1', 'H2', 1), bond('C1', 'H3', 1)], [3], 'CC(=O)O', { O1: [0, 1, 4, 5], O2: [0, 1, 4, 5] }),
    covalentQuestion('sih4', 'Silane', 'SiH4', [atom('Si1','Si',500,325),atom('H1','H',396,325),atom('H2','H',604,325),atom('H3','H',500,221),atom('H4','H',500,429)], [bond('Si1','H1',1),bond('Si1','H2',1),bond('Si1','H3',1),bond('Si1','H4',1)], [2], '[SiH4]'),
    covalentQuestion('methanoic-acid', 'Methanoic acid', 'CH2O2', [atom('C1','C',500,325),atom('O1','O',396,325),atom('O2','O',604,325),atom('H1','H',500,429),atom('H2','H',708,325)], [bond('C1','O1',2),bond('C1','O2',1),bond('C1','H1',1),bond('O2','H2',1)], [2,3], 'O=CO'),
    covalentQuestion('propane', 'Propane', 'C3H8', [atom('C1','C',396,325),atom('C2','C',500,325),atom('C3','C',604,325),atom('H1','H',292,325),atom('H2','H',396,221),atom('H3','H',396,429),atom('H4','H',500,221),atom('H5','H',500,429),atom('H6','H',708,325),atom('H7','H',604,221),atom('H8','H',604,429)], [bond('C1','C2',1),bond('C2','C3',1),bond('C1','H1',1),bond('C1','H2',1),bond('C1','H3',1),bond('C2','H4',1),bond('C2','H5',1),bond('C3','H6',1),bond('C3','H7',1),bond('C3','H8',1)], [2,3], 'CCC'),
    covalentQuestion('propene', 'Propene', 'C3H6', [atom('C1','C',396,325),atom('C2','C',500,325),atom('C3','C',604,325),atom('H1','H',306,273),atom('H2','H',306,377),atom('H3','H',500,429),atom('H4','H',708,325),atom('H5','H',604,221),atom('H6','H',604,429)], [bond('C1','C2',2),bond('C2','C3',1),bond('C1','H1',1),bond('C1','H2',1),bond('C2','H3',1),bond('C3','H4',1),bond('C3','H5',1),bond('C3','H6',1)], [2,3], 'C=CC'),
    ionicQuestion('nacl', 'Sodium chloride', 'NaCl', 'Na', 1, 'Cl', 1, [1, 2]),
    ionicQuestion('mgo', 'Magnesium oxide', 'MgO', 'Mg', 1, 'O', 1, [1, 2]),
    ionicQuestion('mgcl2', 'Magnesium chloride', 'MgCl2', 'Mg', 1, 'Cl', 1 + 1, [1, 2]),
    ionicQuestion('na2o', 'Sodium oxide', 'Na2O', 'Na', 2, 'O', 1, [1, 2]),
    ionicQuestion('cacl2', 'Calcium chloride', 'CaCl2', 'Ca', 1, 'Cl', 2, [1, 2]),
    ionicQuestion('potassium-chloride', 'Potassium chloride', 'KCl', 'K', 1, 'Cl', 1, [1, 2]),
    ionicQuestion('potassium-fluoride', 'Potassium fluoride', 'KF', 'K', 1, 'F', 1, [1, 2]),
    ionicQuestion('lithium-fluoride', 'Lithium fluoride', 'LiF', 'Li', 1, 'F', 1, [1, 2]),
    ionicQuestion('lithium-chloride', 'Lithium chloride', 'LiCl', 'Li', 1, 'Cl', 1, [1, 2]),
    ionicQuestion('lithium-oxide', 'Lithium oxide', 'Li2O', 'Li', 2, 'O', 1, [1, 2]),
    ionicQuestion('potassium-bromide', 'Potassium bromide', 'KBr', 'K', 1, 'Br', 1, [1, 2]),
    ionicQuestion('potassium-iodide', 'Potassium iodide', 'KI', 'K', 1, 'I', 1, [1, 2]),
    ionicQuestion('sodium-fluoride', 'Sodium fluoride', 'NaF', 'Na', 1, 'F', 1, [1, 2]),
    ionicQuestion('sodium-bromide', 'Sodium bromide', 'NaBr', 'Na', 1, 'Br', 1, [1, 2]),
    ionicQuestion('magnesium-sulfide', 'Magnesium sulfide', 'MgS', 'Mg', 1, 'S', 1, [1, 2]),
    ionicQuestion('magnesium-fluoride', 'Magnesium fluoride', 'MgF2', 'Mg', 1, 'F', 2, [1, 2]),
    ionicQuestion('magnesium-bromide', 'Magnesium bromide', 'MgBr2', 'Mg', 1, 'Br', 2, [1, 2]),
    ionicQuestion('calcium-sulfide', 'Calcium sulfide', 'CaS', 'Ca', 1, 'S', 1, [1, 2]),
    ionicQuestion('calcium-fluoride', 'Calcium fluoride', 'CaF2', 'Ca', 1, 'F', 2, [1, 2]),
    ionicQuestion('calcium-bromide', 'Calcium bromide', 'CaBr2', 'Ca', 1, 'Br', 2, [1, 2]),
    ionicQuestion('calcium-oxide', 'Calcium oxide', 'CaO', 'Ca', 1, 'O', 1, [1, 2]),
    ionicQuestion('aluminium-oxide', 'Aluminium oxide', 'Al2O3', 'Al', 2, 'O', 3, [2]),
    ionicQuestion('aluminium-sulfide', 'Aluminium sulfide', 'Al2S3', 'Al', 2, 'S', 3, [2]),
    ionicQuestion('aluminium-fluoride', 'Aluminium fluoride', 'AlF3', 'Al', 1, 'F', 3, [2]),
    ionicQuestion('sodium-iodide', 'Sodium iodide', 'NaI', 'Na', 1, 'I', 1, [1, 2]),
    ionicQuestion('magnesium-nitride', 'Magnesium nitride', 'Mg3N2', 'Mg', 3, 'N', 2, [2]),
    ionicQuestion('calcium-nitride', 'Calcium nitride', 'Ca3N2', 'Ca', 3, 'N', 2, [2]),
    ionicQuestion('sodium-sulfide', 'Sodium sulfide', 'Na2S', 'Na', 2, 'S', 1, [1, 2]),
    ionicQuestion('potassium-oxide', 'Potassium oxide', 'K2O', 'K', 2, 'O', 1, [1, 2]),
    ionicQuestion('potassium-sulfide', 'Potassium sulfide', 'K2S', 'K', 2, 'S', 1, [1, 2]),
    q('naoh', 'Sodium hydroxide', 'NaOH', 'mixed', true, mixedPrompt, mixedExplain, [atom('Na1', 'Na', 300, 325), atom('O1', 'O', 500, 325), atom('H1', 'H', 604, 325)], [bond('O1', 'H1', 1)], [lone('O1', 5, 'dot', [0, 1, 4, 5, 6]), lone('O1', 1, 'cross', [7])], [group('Na+', ['Na1'], 1), group('OH-', ['O1', 'H1'], -1)]),
    q('caoh2', 'Calcium hydroxide', 'Ca(OH)2', 'mixed', true, mixedPrompt, mixedExplain, [atom('Ca1', 'Ca', 200, 325), atom('O1', 'O', 500, 235), atom('H1', 'H', 604, 235), atom('O2', 'O', 500, 415), atom('H2', 'H', 604, 415)], [bond('O1', 'H1', 1), bond('O2', 'H2', 1)], [lone('O1', 5, 'dot', [0, 1, 4, 5, 6]), lone('O1', 1, 'cross', [7]), lone('O2', 5, 'dot', [0, 1, 4, 5, 6]), lone('O2', 1, 'cross', [7])], [group('Ca2+', ['Ca1'], 2), group('OH1-', ['O1', 'H1'], -1), group('OH2-', ['O2', 'H2'], -1)])
  ];
  var OCR = 'resources/a-level-past-paper-atlas/data/review-bundle.json#';
  function peroxide(id, name, cation) {
    var atoms = [], groups = [], startX = cation === 'Na' ? 448 : 300;
    if (cation === 'Na') { atoms.push(atom('Na1','Na',180,325), atom('Na2','Na',820,325)); groups.push(group('Na1+',['Na1'],1),group('Na2+',['Na2'],1)); }
    if (cation === 'Mg') { atoms.push(atom('Mg1','Mg',180,325)); groups.push(group('Mg2+',['Mg1'],2)); startX=500; }
    atoms.push(atom('O1','O',startX,325),atom('O2','O',startX+bondDistance('O','O'),325)); groups.push(group('O2^2-',['O1','O2'],-2));
    return namedQuestion({id:id,name:name,formula:(cation==='Na'?'Na2':cation==='Mg'?'Mg':'')+'O2',displayFormula:(cation==='Na'?'Na₂':cation==='Mg'?'Mg':'')+'O₂'+(!cation?'²⁻':''),totalCharge:cation?0:-2,practiceCategory:cation?'ionic':'covalent',grades:[3],atoms:atoms,bonds:[bond('O1','O2',1)],requiresThirdSymbol:true,transferredSymbol:'triangle',
      lone:[lone('O1',5,'dot'),lone('O1',1,'triangle',[5]),lone('O2',5,'cross'),lone('O2',1,'triangle',[5])],groups:groups,
      explanation:'The peroxide ion contains an O–O single bond. Each oxygen has three lone pairs and one gained electron; salts show the peroxide ion separately from its metal ion(s).',scope:'OCR A Level Chemistry A 2.2.2(a,e); authored peroxide transfer'});
  }
  var peroxideIon = peroxide('peroxide-ion','peroxide ion',null); peroxideIon.displayFormula='O₂²⁻'; peroxideIon.category=peroxideIon.practiceCategory='covalent';
  questions.push(peroxideIon, peroxide('sodium-peroxide','sodium peroxide','Na'), peroxide('magnesium-peroxide','magnesium peroxide','Mg'));
  questions.push(
    centredSpec('nitrogen-trichloride','nitrogen trichloride','NCl3','NCl₃','N','Cl',3,2,[2],[OCR+'OCR_2016_JUN_H032-01_Q07']),
    centredSpec('nitrogen-trifluoride','nitrogen trifluoride','NF3','NF₃','N','F',3,2,[2],[OCR+'OCR_2023_JUN_H032-01_Q21_P_A_II']),
    centredSpec('sulfur-difluoride','sulfur difluoride','SF2','SF₂','S','F',2,4,[2],[OCR+'OCR_2021_OCT_H032-02_Q01_P_B'])
  );
  questions.push(namedQuestion({id:'nitrosyl-chloride',name:'nitrosyl chloride',formula:'NOCl',displayFormula:'NOCl',totalCharge:0,practiceCategory:'covalent',grades:[2],
    atoms:[atom('N1','N',500,325),atom('O1','O',604,325),atom('Cl1','Cl',396,325)],bonds:[bond('N1','O1',2),bond('N1','Cl1',1)],lone:[lone('N1',2,'dot'),lone('O1',4,'cross'),lone('Cl1',6,'cross')],groups:[],
    explanation:'Nitrogen is central, with an N=O double bond, an N–Cl single bond and one lone pair on nitrogen.',evidence:[OCR+'OCR_2020_OCT_H032-02_Q04_P_A']}));
  questions.push(namedQuestion({id:'phosgene',name:'carbonyl dichloride (phosgene)',formula:'COCl2',displayFormula:'COCl₂',totalCharge:0,practiceCategory:'covalent',grades:[2],
    atoms:[atom('C1','C',500,325),atom('O1','O',604,325),atom('Cl1','Cl',448,235),atom('Cl2','Cl',448,415)],bonds:[bond('C1','O1',2),bond('C1','Cl1',1),bond('C1','Cl2',1)],lone:[lone('O1',4,'cross'),lone('Cl1',6,'cross'),lone('Cl2',6,'cross')],groups:[],
    explanation:'Carbon is central, with a C=O double bond and two C–Cl single bonds.',evidence:[OCR+'OCR_2018_JUN_H032-01_Q21_P_B_I']}));
  questions.push(namedQuestion({id:'hydrogen-cyanide',name:'hydrogen cyanide',formula:'HCN',displayFormula:'HCN',totalCharge:0,practiceCategory:'covalent',grades:[2],
    atoms:[atom('H1','H',420,325),atom('C1','C',500,325),atom('N1','N',604,325)],bonds:[bond('H1','C1',1),bond('C1','N1',3)],lone:[lone('N1',2,'cross')],groups:[],
    explanation:'The named structure is H–C≡N, with one lone pair on nitrogen.',evidence:[OCR+'OCR_2024_JUN_H032-01_Q23_P_C']}));
  questions.push(centredSpec('boron-trifluoride','boron trifluoride','BF3','BF₃','B','F',3,0,[3],[OCR+'OCR_2023_JUN_H032-01_Q21_P_A_II'],6));

  var nhAtoms=radialAtoms(atom('N1','N',500,325),[1,2,3,4].map(function(i){return atom('H'+i,'H',0,0);}),bondDistance('N','H'),0);
  questions.push(namedQuestion({id:'ammonium-ion',name:'ammonium ion',formula:'NH4',displayFormula:'NH₄⁺',totalCharge:1,practiceCategory:'covalent',grades:[3],atoms:nhAtoms,
    bonds:[bond('N1','H1',1),bond('N1','H2',1),bond('N1','H3',1),{a:'N1',b:'H4',order:1,pairs:[['dot','dot']]}],lone:[],groups:[group('NH4+',['N1','H1','H2','H3','H4'],1)],
    explanation:'Three N–H pairs contain one electron from each atom; the fourth is a coordinate pair supplied by nitrogen. After formation, all four N–H bonds are equivalent.',evidence:[OCR+'OCR_2024_JUN_H032-02_Q01_P_C_II']}));

  function trigonalO(id,name,formula,displayFormula,charge,element,doubleO,evidence) {
    var centre=atom(element+'1',element,500,325),os=radialAtoms(centre,[atom('O1','O',0,0),atom('O2','O',0,0),atom('O3','O',0,0)],bondDistance(element,'O'),-90).slice(1);
    var bonds=[bond(centre.id,'O1',2),bond(centre.id,'O2',1),bond(centre.id,'O3',1)], loneList=[lone('O1',4,'cross'),lone('O2',5,'cross'),lone('O2',1,'triangle',[5]),lone('O3',5,'cross'),lone('O3',1,'triangle',[5])];
    if (id==='nitrate-ion') { bonds[2]={a:centre.id,b:'O3',order:1,pairs:[['dot','dot']]}; loneList=[lone('O1',4,'cross'),lone('O2',5,'cross'),lone('O2',1,'triangle',[5]),lone('O3',6,'cross')]; }
    return namedQuestion({id:id,name:name,formula:formula,displayFormula:displayFormula,totalCharge:charge,practiceCategory:'covalent',grades:[3],atoms:[centre].concat(os),bonds:bonds,lone:loneList,groups:[group(id,[centre.id,'O1','O2','O3'],charge)],requiresThirdSymbol:true,
      explanation:id==='nitrate-ion'?'One valid resonance contributor has N=O, one ordinary N–O pair and one N→O coordinate pair; oxygen lone-electron counts are 4, 6 and 6. The three N–O bonds are equivalent in the resonance hybrid.':'One valid resonance contributor has one C=O double bond and two C–O single bonds; the two gained electrons may be shown in a lone pair or C–O pair. The three C–O bonds are equivalent in the resonance hybrid.',evidence:[evidence]});
  }
  questions.push(trigonalO('carbonate-ion','carbonate ion','CO3','CO₃²⁻',-2,'C','O',OCR+'OCR_2018_JUN_H432-01_Q19_P_C'));
  questions.push(trigonalO('nitrate-ion','nitrate ion','NO3','NO₃⁻',-1,'N','O',OCR+'OCR_2016_JUN_H032-01_Q21_P_C_II'));

  function tetrahydride(id,name,element,withSodium,evidence) {
    var centre=atom(element+'1',element,500,325),hs=[1,2,3,4].map(function(i){return atom('H'+i,'H',0,0);}),atoms=radialAtoms(centre,hs,bondDistance(element,'H'),0),groups=[];
    if(withSodium){atoms.unshift(atom('Na1','Na',180,325));groups.push(group('Na+',['Na1'],1),group('BH4-',['B1','H1','H2','H3','H4'],-1));}else groups.push(group('AlH4-',['Al1','H1','H2','H3','H4'],-1));
    return namedQuestion({id:id,name:name,formula:(withSodium?'Na':'')+element+'H4',displayFormula:(withSodium?'Na':'')+element+'H₄'+(withSodium?'':'⁻'),totalCharge:withSodium?0:-1,practiceCategory:withSodium?'ionic':'covalent',grades:[3],atoms:atoms,requiresThirdSymbol:true,
      bonds:[bond(centre.id,'H1',1),bond(centre.id,'H2',1),bond(centre.id,'H3',1),{a:centre.id,b:'H4',order:1,pairs:[['triangle','cross']]}],lone:[],groups:groups,transferredSymbol:'triangle',
      explanation:'Three '+element+'–H pairs use an electron from each bonded atom; the fourth pair includes the additional electron'+(withSodium?' transferred from sodium':'')+', shown with a third symbol.',evidence:[evidence]});
  }
  questions.push(tetrahydride('tetrahydridoaluminate-ion','tetrahydridoaluminate(1−) ion','Al',false,OCR+'OCR_2017_JUN_H432-01_Q16_P_A'));
  questions.push(tetrahydride('sodium-borohydride','sodium tetrahydridoborate (sodium borohydride)','B',true,'resources/a-level-past-paper-atlas/enrichment/corrections.json#OCR_2025_JUN_H432-03_Q05_P_B'));
  questions.find(function(q){return q.id==='sodium-borohydride';}).sourceRefs.push(OCR+'OCR_2025_JUN_H432-03_Q05_P_B');
  questions.push(
    centredSpec('phosphorus-pentachloride','phosphorus pentachloride molecule (gas)','PCl5','PCl₅','P','Cl',5,0,[3],[],10),
    centredSpec('sulfur-hexafluoride','sulfur hexafluoride','SF6','SF₆','S','F',6,0,[3],[],12),
    centredSpec('sulfur-tetrafluoride','sulfur tetrafluoride','SF4','SF₄','S','F',4,2,[3],[],10),
    centredSpec('chlorine-trifluoride','chlorine trifluoride','ClF3','ClF₃','Cl','F',3,4,[3],[],10)
  );
  (function reflowExpandedCentres() {
    var sf4 = questions.find(function (question) { return question.id === 'sulfur-tetrafluoride'; });
    [0,60,180,300].forEach(function (degrees, i) { var a=sf4.reference.atoms.find(function(atom){return atom.id==='F'+(i+1);}),r=bondDistance('S','F'),t=degrees*Math.PI/180;a.x=500+r*Math.cos(t);a.y=325+r*Math.sin(t); });
    var clf3 = questions.find(function (question) { return question.id === 'chlorine-trifluoride'; });
    [-90,0,180].forEach(function (degrees, i) { var a=clf3.reference.atoms.find(function(atom){return atom.id==='F'+(i+1);}),r=bondDistance('Cl','F'),t=degrees*Math.PI/180;a.x=500+r*Math.cos(t);a.y=325+r*Math.sin(t); });
    var pcl5=questions.find(function(question){return question.id==='phosphorus-pentachloride';});
    [-90,-30,30,90,180].forEach(function(degrees,i){var a=pcl5.reference.atoms.find(function(atom){return atom.id==='Cl'+(i+1);}),r=bondDistance('P','Cl'),t=degrees*Math.PI/180;a.x=500+r*Math.cos(t);a.y=325+r*Math.sin(t);});
  }());
  function attachGainedElectronVariants(question, moves) {
    var variants=[];
    for(var mask=1;mask<(1<<moves.length);mask++){
      var variant=JSON.parse(JSON.stringify(question.reference));
      moves.forEach(function(move,index){if(!(mask&(1<<index)))return;
        var gained=variant.electrons.find(function(e){return e.symbol==='triangle'&&e.anchor.kind==='atom'&&e.anchor.atomId===move.atomId;});
        var ownBond=variant.electrons.find(function(e){return e.symbol===move.ownSymbol&&e.anchor.kind==='bond'&&(e.anchor.a===move.atomId||e.anchor.b===move.atomId);});
        if(!gained||!ownBond)throw new Error(question.id+': cannot construct gained-electron origin variant for '+move.atomId);
        gained.symbol=move.ownSymbol;ownBond.symbol='triangle';
      });
      variants.push(variant);
    }
    question.marking.originAlternatives=variants;
  }
  ['peroxide-ion','sodium-peroxide','magnesium-peroxide'].forEach(function(id){attachGainedElectronVariants(questions.find(function(q){return q.id===id;}),[{atomId:'O1',ownSymbol:'dot'},{atomId:'O2',ownSymbol:'cross'}]);});
  attachGainedElectronVariants(questions.find(function(q){return q.id==='carbonate-ion';}),[{atomId:'O2',ownSymbol:'cross'},{atomId:'O3',ownSymbol:'cross'}]);
  attachGainedElectronVariants(questions.find(function(q){return q.id==='nitrate-ion';}),[{atomId:'O2',ownSymbol:'cross'}]);
  questions.filter(function(q){return q.id==='propane'||q.id==='propene';}).forEach(function(q){q.scope='past-paper-transfer';});
  questions.forEach(function (question, index) {
    question.practiceCategory = question.practiceCategory === 'covalent' ? 'covalent' : 'ionic';
    if (!question.namedSpecies) {
      question.namedSpecies = false; question.totalCharge = 0; question.displayFormula = question.displayFormula || question.formula;
      if (question.practiceCategory === 'ionic') question.grades = question.category === 'ionic' && question.reference.atoms.length <= 3 ? [1, 2] : [2];
      question.marking.speciesSpecific = false;
      question.prerequisiteOrder = index;
    }
  });
  // Hydrogen shells are smaller. Reflow their reference coordinates around
  // their bonded neighbour, preserving the authored directions and topology.
  questions.forEach(function (question) {
    var original = question.reference.atoms.map(function (a) { return Object.assign({}, a); });
    question.reference.atoms.filter(function (a) { return a.element === 'H'; }).forEach(function (a) {
      var shared = question.reference.electrons.find(function (e) { return e.anchor.kind === 'bond' && (e.anchor.a === a.id || e.anchor.b === a.id); });
      if (!shared) return;
      var otherId = shared.anchor.a === a.id ? shared.anchor.b : shared.anchor.a;
      var from = original.find(function (n) { return n.id === a.id; }), other = original.find(function (n) { return n.id === otherId; });
      var dx=from.x-other.x, dy=from.y-other.y, length=Math.hypot(dx,dy)||1, target=bondDistance(from,other);
      if (other.element === 'H') { a.x=(from.x+other.x)/2+dx/length*target/2; a.y=(from.y+other.y)/2+dy/length*target/2; }
      else { a.x=other.x+dx/length*target; a.y=other.y+dy/length*target; }
    });
  });
  /* Avoid shared mutable references if a caller modifies the bank metadata. */
  questions.forEach(function (question) { question.viewBox = Object.assign({}, viewBox); question.electronSlots = JSON.parse(JSON.stringify(electronSlots)); });
  return { shellRadius: shellRadius, bondDistance: bondDistance, questions: questions, source: SOURCE, sourceUrl: SOURCE_URL, viewBox: viewBox, electronSlots: electronSlots };
}));
