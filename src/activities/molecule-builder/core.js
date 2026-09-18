/* Small, deliberately bounded molecular graph model. No coordinates enter marking. */
(function (root) {
  'use strict';
  const LIMIT = 20;
  const valences = { C: 4, O: 2, N: 3, Cl: 1, F: 1, H: 1 };
  const chargedValences = { C: {'-1':3, '1':3}, O: {'-1':1, '1':3}, N: {'-1':2, '1':4}, Cl:{'-1':0}, F:{'-1':0}, H:{'-1':0,'1':0} };
  const valence = atom => atom.charge ? chargedValences[atom.element]?.[atom.charge] : valences[atom.element];
  const heavyCount = graph => graph.atoms.filter(a => a.element !== 'H').length;
  const names = { C: 'Carbon', O: 'Oxygen', N: 'Nitrogen', Cl: 'Chlorine', F: 'Fluorine', H: 'Hydrogen' };
  const empty = () => ({ atoms: [], bonds: [] });
  const clone = graph => JSON.parse(JSON.stringify(graph));
  const neighbours = (graph, id) => graph.bonds.filter(b => b.a === id || b.b === id)
    .map(b => ({ id: b.a === id ? b.b : b.a, order: b.order }));
  const hydrogens = (graph, atom) => atom.h !== undefined ? atom.h : atom.element === 'H' ? 0 : valence(atom) - neighbours(graph, atom.id).reduce((n, b) => n + b.order, 0);
  function assertGraph(graph) {
    if (!graph || !Array.isArray(graph.atoms) || !Array.isArray(graph.bonds) || (heavyCount(graph) > LIMIT || graph.atoms.length > 100)) throw Error('Unsupported graph.');
    const ids = new Set();
    for (const a of graph.atoms) {
      if (!Number.isInteger(a.id) || ids.has(a.id) || !Object.hasOwn(valences, a.element) || !Number.isFinite(a.x) || !Number.isFinite(a.y)) throw Error('Unsupported atom.');
      for (const field of ['chargeAngle','dipoleAngle']) if (a[field] !== undefined && !Number.isFinite(a[field])) throw Error('Unsupported annotation position.');
      if (a.charge !== undefined && (!Number.isInteger(a.charge) || ![-1,0,1].includes(a.charge))) throw Error('Unsupported charge.');
      if (a.h !== undefined && (!Number.isInteger(a.h) || a.h < 0 || a.h > 4 || a.element === 'H' && a.h !== 0)) throw Error('Unsupported hydrogen count.');
      ids.add(a.id);
    }
    const pairs = new Set();
    for (const b of graph.bonds) {
      const key = [b.a, b.b].sort((a, c) => a - c).join(':');
      if (!ids.has(b.a) || !ids.has(b.b) || b.a === b.b || ![1, 2, 3].includes(b.order) || pairs.has(key)) throw Error('Unsupported bond.');
      pairs.add(key);
    }
    return graph;
  }
  function addAtom(graph, element, x, y, parentId = null, order = 1) {
    if ((element !== 'H' && heavyCount(graph) >= LIMIT || graph.atoms.length >= 100)) return graph;
    const next = clone(graph), id = Math.max(0, ...next.atoms.map(a => a.id)) + 1;
    next.atoms.push({ id, element, x, y });
    if (parentId !== null) next.bonds.push({ a: parentId, b: id, order });
    return assertGraph(next);
  }
  function setElement(graph, id, element) {
    const next = clone(graph), atom = next.atoms.find(a => a.id === id);
    if (atom) { atom.element = element; delete atom.charge; delete atom.h; delete atom.pairs; delete atom.dipole; delete atom.chargeAngle; delete atom.dipoleAngle; }
    return assertGraph(next);
  }
  function setBond(graph, a, b, order) {
    const next = clone(graph), bond = next.bonds.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (bond) bond.order = order;
    return assertGraph(next);
  }
  function addBond(graph, a, b, order = 1) {
    if (a === b || graph.bonds.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return graph;
    const next = clone(graph);
    next.bonds.push({ a, b, order });
    return assertGraph(next);
  }
  function toggleBond(graph, a, b) {
    const bond = graph.bonds.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    return bond ? setBond(graph, a, b, bond.order % 3 + 1) : graph;
  }
  function remove(graph, target) {
    const next = clone(graph);
    if (target.kind === 'atom') {
      next.atoms = next.atoms.filter(a => a.id !== target.id);
      next.bonds = next.bonds.filter(b => b.a !== target.id && b.b !== target.id);
    } else next.bonds = next.bonds.filter(b => !((b.a === target.a && b.b === target.b) || (b.a === target.b && b.b === target.a)));
    if (next.arrows) next.arrows = next.arrows.filter(ar => [ar.from, ar.to].every(anchor => anchor.kind === 'bond' ? next.bonds.some(b => (b.a===anchor.a && b.b===anchor.b)||(b.b===anchor.a && b.a===anchor.b)) : next.atoms.some(a => a.id === anchor.id)));
    return next;
  }
  function validate(graph, allowDisconnected = false) {
    try { assertGraph(graph); } catch { return { kind: 'unsupported', message: 'This drawing contains an unsupported structure.' }; }
    if (!graph.atoms.length) return { kind: 'empty', message: 'Place an atom to start your molecule.' };
    const invalid = graph.atoms.filter(a => valence(a) === undefined || hydrogens(graph, a) < 0 || neighbours(graph,a.id).reduce((sum,b)=>sum+b.order,0) + hydrogens(graph,a) !== valence(a)).map(a => a.id);
    if (invalid.length) {
      const rules = [...new Set(graph.atoms.filter(a => invalid.includes(a.id)).map(a => a.element))]
        .map(e => `${names[e].toLowerCase()} forms ${valences[e]} bond${valences[e] === 1 ? '' : 's'}`).join('; ');
      if (graph.atoms.some(a => a.charge || a.h !== undefined || a.element==='H')) return {kind:'valence',atoms:invalid,message:'Check the highlighted atoms: their charge, hydrogen count and bonds do not fit a supported closed-shell species.'};
      return { kind: 'valence', atoms: invalid, message: `Check the highlighted atoms: ${rules} in these neutral structures. A double bond counts as two.` };
    }
    const visited = new Set(), visit = id => { visited.add(id); neighbours(graph, id).forEach(n => { if (!visited.has(n.id)) visit(n.id); }); };
    visit(graph.atoms[0].id);
    if (!allowDisconnected && visited.size !== graph.atoms.length) return { kind: 'disconnected', message: 'Join your answer into one molecule. Drag from one atom onto another to connect separate pieces.' };
    return { kind: 'valid' };
  }
  // Exact labelled-graph isomorphism, including cycles. Candidate pruning keeps the
  // search small for the 20-atom limit; every edge AND non-edge is checked.
  // Bond orders are literal: this is not aromatic/resonance normalisation.
  function equivalent(left, right) {
    if (validate(left).kind !== 'valid' || validate(right).kind !== 'valid') return false;
    if (left.atoms.length !== right.atoms.length || left.bonds.length !== right.bonds.length) return false;
    function indexed(g) {
      const indices = new Map(g.atoms.map((a, i) => [a.id, i]));
      const edges = g.atoms.map(() => g.atoms.map(() => 0));
      g.bonds.forEach(b => { const a = indices.get(b.a), c = indices.get(b.b); edges[a][c] = edges[c][a] = b.order; });
      const labels = g.atoms.map((a, i) => a.element + ':' + (a.charge || 0) + ':' + hydrogens(g,a) + ':' + edges[i].filter(Boolean).sort().join(','));
      return { edges, labels };
    }
    const a = indexed(left), b = indexed(right), count = left.atoms.length;
    if ([...a.labels].sort().join('|') !== [...b.labels].sort().join('|')) return false;
    const mapping = new Map(), used = new Set();
    function search() {
      if (mapping.size === count) return true;
      let selected, candidates;
      for (let i = 0; i < count; i++) {
        if (mapping.has(i)) continue;
        const choices = [];
        for (let j = 0; j < count; j++) {
          if (!used.has(j) && a.labels[i] === b.labels[j] && [...mapping].every(([x, y]) => a.edges[i][x] === b.edges[j][y])) choices.push(j);
        }
        if (!choices.length) return false;
        if (!candidates || choices.length < candidates.length) { selected = i; candidates = choices; }
      }
      for (const j of candidates) {
        mapping.set(selected, j); used.add(j);
        if (search()) return true;
        mapping.delete(selected); used.delete(j);
      }
      return false;
    }
    return search();
  }
  function check(graph, reference) {
    const result = validate(graph);
    if (result.kind !== 'valid') return result;
    if (validate(reference).kind !== 'valid') throw Error('Invalid reference answer.');
    // For molecule answers, attached neutral H atoms and implicit H counts
    // represent the same structure. Validate the original drawing first.
    function implicitHydrogens(g) {
      const removed = new Set(g.atoms.filter(a => a.element === 'H' && !a.charge &&
        neighbours(g,a.id).length === 1 && neighbours(g,a.id).every(b => b.order === 1 && g.atoms.find(a => a.id === b.id).element !== 'H')).map(a => a.id));
      return { atoms: g.atoms.filter(a => !removed.has(a.id)).map(a => ({...a,
        h: hydrogens(g,a) + neighbours(g,a.id).filter(b => removed.has(b.id)).length})),
        bonds: g.bonds.filter(b => !removed.has(b.a) && !removed.has(b.b)) };
    }
    return equivalent(implicitHydrogens(graph), implicitHydrogens(reference))
      ? { kind: 'correct', message: 'That’s right. Your atoms and bonds match.' }
      : { kind: 'incorrect', message: 'Not quite. Check the atoms and how they’re joined, then try again.' };
  }
  function formula(graph) {
    if (validate(graph).kind !== 'valid') return null;
    const counts = { C: 0, H: 0, Cl: 0, F: 0, N: 0, O: 0 };
    graph.atoms.forEach(a => { counts[a.element]++; counts.H += hydrogens(graph, a); });
    // Match RDKit's organic formula convention, including HF and HCl.
    const symbols = Object.keys(counts);
    return symbols.filter(s => counts[s]).map(s => s + (counts[s] === 1 ? '' : counts[s])).join('');
  }
  const api = { LIMIT, valence, heavyCount, names, empty, clone, neighbours, hydrogens, assertGraph, addAtom, addBond, setElement, setBond, toggleBond, remove, validate, equivalent, check, formula };
  root.MoleculeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
