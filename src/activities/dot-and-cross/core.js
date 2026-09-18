/* Pure dot-and-cross state validation and marking.  The browser build loads
 * this file as a UMD module; the CommonJS export is useful to the checks. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DotCrossCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYMBOLS = ['dot', 'cross', 'triangle'];
  var ELEMENTS = new Set(['H', 'B', 'C', 'Si', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I', 'Li', 'K', 'Na', 'Mg', 'Ca', 'Al']);
  var VALENCE = { H: 1, B: 3, C: 4, Si: 4, N: 5, O: 6, P: 5, S: 6, F: 7, Cl: 7, Br: 7, I: 7, Li: 1, K: 1, Na: 1, Mg: 2, Ca: 2, Al: 3 };
  var RETAINED_CATION_SHELLS = { Li: 2, K: 8, Na: 8, Mg: 8, Ca: 8, Al: 8 };

  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function integer(x) { return typeof x === 'number' && Number.isInteger(x); }
  function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
  function arr(x) { return Array.isArray(x); }
  function sorted(a) { return a.slice().sort(); }
  function key(a) { return sorted(a).join('|'); }
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function fail(id, label, message, objectIds) {
    return { id: id, label: label, passed: false, message: message, objectIds: objectIds || [] };
  }
  function pass(id, label, message, objectIds) {
    return { id: id, label: label, passed: true, message: message, objectIds: objectIds || [] };
  }
  function countBy(items, fn) {
    var result = Object.create(null);
    items.forEach(function (item) { var k = fn(item); result[k] = (result[k] || 0) + 1; });
    return result;
  }
  function sameCounts(a, b) {
    var keys = new Set(Object.keys(a).concat(Object.keys(b)));
    for (var k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
    return true;
  }
  function invertSymbol(s) { return s === 'dot' ? 'cross' : s === 'cross' ? 'dot' : 'triangle'; }
  function symbolCounts(electrons, invert) {
    var result = { dot: 0, cross: 0, triangle: 0 };
    electrons.forEach(function (e) { var s = invert ? invertSymbol(e.symbol) : e.symbol; result[s]++; });
    return result;
  }

  /* Formula parsing is deliberately small, but supports the parenthesised
   * hydroxide formula used by the extension question. */
  function formulaCounts(formula) {
    if (typeof formula !== 'string' || !formula) return null;
    var stack = [Object.create(null)], i = 0;
    while (i < formula.length) {
      if (formula[i] === '(') { stack.push(Object.create(null)); i++; continue; }
      if (formula[i] === ')') {
        if (stack.length === 1) return null;
        i++; var m = formula.slice(i).match(/^([0-9]+)/); var mult = m ? Number(m[1]) : 1;
        if (!Number.isInteger(mult) || mult < 1) return null;
        if (m) i += m[1].length;
        var group = stack.pop();
        Object.keys(group).forEach(function (el) { stack[stack.length - 1][el] = (stack[stack.length - 1][el] || 0) + group[el] * mult; });
        continue;
      }
      var token = formula.slice(i).match(/^([A-Z][a-z]?)([0-9]*)/);
      if (!token) return null;
      var element = token[1], n = token[2] ? Number(token[2]) : 1;
      if (!ELEMENTS.has(element) || !Number.isInteger(n) || n < 1) return null;
      stack[stack.length - 1][element] = (stack[stack.length - 1][element] || 0) + n;
      i += token[0].length;
    }
    if (stack.length !== 1) return null;
    return stack[0];
  }
  function validateState(state) {
    var errors = [];
    if (!state || typeof state !== 'object' || arr(state)) return ['state must be an object'];
    ['atoms', 'electrons', 'groups'].forEach(function (field) { if (!arr(state[field])) errors.push(field + ' must be an array'); });
    if (errors.length) return errors;
    var atomIds = new Set();
    state.atoms.forEach(function (a, index) {
      if (!a || typeof a !== 'object') { errors.push('atom ' + index + ' must be an object'); return; }
      if (typeof a.id !== 'string' || !a.id) errors.push('atom ' + index + ' has an invalid id');
      else if (atomIds.has(a.id)) errors.push('duplicate atom id ' + a.id); else atomIds.add(a.id);
      if (!ELEMENTS.has(a.element)) errors.push('atom ' + (a.id || index) + ' has an unsupported element');
      if (!finite(a.x) || !finite(a.y)) errors.push('atom ' + (a.id || index) + ' has invalid coordinates');
    });
    var electronIds = new Set(), atomSlots = new Set(), bondSlots = Object.create(null);
    state.electrons.forEach(function (e, index) {
      if (!e || typeof e !== 'object') { errors.push('electron ' + index + ' must be an object'); return; }
      if (typeof e.id !== 'string' || !e.id) errors.push('electron ' + index + ' has an invalid id');
      else if (electronIds.has(e.id)) errors.push('duplicate electron id ' + e.id); else electronIds.add(e.id);
      if (!SYMBOLS.includes(e.symbol)) errors.push('electron ' + (e.id || index) + ' has an invalid symbol');
      var a = e.anchor;
      if (!a || typeof a !== 'object') { errors.push('electron ' + (e.id || index) + ' has no anchor'); return; }
      if (a.kind === 'atom') {
        if (typeof a.atomId !== 'string' || !atomIds.has(a.atomId)) errors.push('electron ' + (e.id || index) + ' has a dangling atom anchor');
        if (!integer(a.slot) || a.slot < 0 || a.slot > 7) errors.push('electron ' + (e.id || index) + ' has an invalid atom slot');
        var ak = String(a.atomId) + ':' + a.slot;
        if (atomSlots.has(ak)) errors.push('duplicate atom slot ' + ak); else atomSlots.add(ak);
      } else if (a.kind === 'bond') {
        if (typeof a.a !== 'string' || typeof a.b !== 'string' || a.a === a.b || !atomIds.has(a.a) || !atomIds.has(a.b)) errors.push('electron ' + (e.id || index) + ' has a dangling bond anchor');
        if (!integer(a.slot) || a.slot < 0 || a.slot > 5) errors.push('electron ' + (e.id || index) + ' has an invalid bond slot');
        var bk = key([a.a, a.b]) + ':' + a.slot;
        bondSlots[bk] = (bondSlots[bk] || 0) + 1;
        if (bondSlots[bk] > 1) errors.push('duplicate bond slot ' + bk);
      } else errors.push('electron ' + (e.id || index) + ' has an invalid anchor kind');
    });
    var groupIds = new Set();
    state.groups.forEach(function (g, index) {
      if (!g || typeof g !== 'object') { errors.push('group ' + index + ' must be an object'); return; }
      if (typeof g.id !== 'string' || !g.id) errors.push('group ' + index + ' has an invalid id');
      else if (groupIds.has(g.id)) errors.push('duplicate group id ' + g.id); else groupIds.add(g.id);
      if (!arr(g.atomIds) || !g.atomIds.length) errors.push('group ' + (g.id || index) + ' must contain atoms');
      else {
        var seen = new Set();
        g.atomIds.forEach(function (id) { if (typeof id !== 'string' || !atomIds.has(id)) errors.push('group ' + (g.id || index) + ' has a dangling atom'); else if (seen.has(id)) errors.push('group ' + (g.id || index) + ' repeats an atom'); else seen.add(id); });
      }
      if (!integer(g.charge)) errors.push('group ' + (g.id || index) + ' has a non-integer charge');
      if (typeof g.bracket !== 'boolean') errors.push('group ' + (g.id || index) + ' bracket must be boolean');
    });
    return errors;
  }

  function graph(state) {
    var atom = Object.create(null), edges = Object.create(null), bondElectrons = Object.create(null), lone = Object.create(null);
    state.atoms.forEach(function (a) { atom[a.id] = a; edges[a.id] = Object.create(null); lone[a.id] = []; });
    state.electrons.forEach(function (e) {
      if (e.anchor.kind === 'atom') lone[e.anchor.atomId].push(e);
      else {
      var a = e.anchor.a, b = e.anchor.b, k = key([a, b]);
        if (!bondElectrons[k]) bondElectrons[k] = [];
        bondElectrons[k].push(e);
      }
    });
    Object.keys(bondElectrons).forEach(function (k) {
      var ids = k.split('|'), order = Object.create(null), pair = Object.create(null);
      bondElectrons[k].forEach(function (e) { var p = Math.floor(e.anchor.slot / 2); if (!pair[p]) pair[p] = Object.create(null); pair[p][e.anchor.slot] = (pair[p][e.anchor.slot] || 0) + 1; });
      var slots = Object.keys(pair).sort(function (x, y) { return Number(x) - Number(y); });
      var validPairs = 0;
      slots.forEach(function (p) { if (Object.keys(pair[p]).length === 2 && pair[p][String(Number(p) * 2)] === 1 && pair[p][String(Number(p) * 2 + 1)] === 1) validPairs++; });
      order.count = validPairs;
      edges[ids[0]][ids[1]] = order.count;
      edges[ids[1]][ids[0]] = order.count;
    });
    return { atom: atom, edges: edges, bondElectrons: bondElectrons, lone: lone, groups: state.groups };
  }
  function groupsSignature(state, mapping) {
    return state.groups.map(function (g) { return { atoms: key(g.atomIds.map(function (id) { return mapping ? mapping[id] : id; })), charge: g.charge, bracket: g.bracket }; }).sort(function (a, b) { return (a.atoms + a.charge + a.bracket).localeCompare(b.atoms + b.charge + b.bracket); });
  }
  function sameGroupSets(expected, actual, mapping) {
    /* mapping is expected atom id -> submitted atom id; map the expected
     * groups into submitted IDs before comparing with the submitted groups. */
    var a = groupsSignature(expected, mapping), b = groupsSignature(actual, null);
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i].atoms !== b[i].atoms || a[i].charge !== b[i].charge || a[i].bracket !== b[i].bracket) return false;
    return true;
  }
  function findIsomorphism(expected, actual, accept) {
    var ea = expected.atom, aa = actual.atom, eids = Object.keys(ea), aids = Object.keys(aa), candidates = Object.create(null);
    if (eids.length !== aids.length) return null;
    eids.forEach(function (id) {
      candidates[id] = aids.filter(function (x) { return aa[x].element === ea[id].element && Object.keys(actual.edges[x]).length === Object.keys(expected.edges[id]).length; });
    });
    var order = eids.slice().sort(function (x, y) { return candidates[x].length - candidates[y].length; });
    var used = new Set(), mapping = Object.create(null), reverse = Object.create(null), answer = null;
    function recurse(n) {
      if (answer) return;
      if (n === order.length) { if (!accept || accept(mapping)) answer = clone(mapping); return; }
      var eid = order[n];
      for (var ci = 0; ci < candidates[eid].length; ci++) {
        var aid = candidates[eid][ci]; if (used.has(aid)) continue;
        var ok = true;
        Object.keys(mapping).forEach(function (other) {
          if (!ok) return;
          var expOrder = expected.edges[eid][other] || 0;
          var actOrder = actual.edges[aid][mapping[other]] || 0;
          if (expOrder !== actOrder) ok = false;
        });
        if (!ok) continue;
        mapping[eid] = aid; reverse[aid] = eid; used.add(aid); recurse(n + 1); used.delete(aid); delete mapping[eid]; delete reverse[aid];
        if (answer) return;
      }
    }
    recurse(0);
    return answer;
  }
  function expectedComponentMap(g, mapping) {
    var seen = new Set(), result = [];
    Object.keys(g.atom).forEach(function (start) {
      if (seen.has(start)) return;
      var todo = [start], component = []; seen.add(start);
      while (todo.length) {
        var id = todo.pop(); component.push(id);
        Object.keys(g.edges[id]).forEach(function (n) { if (!seen.has(n)) { seen.add(n); todo.push(n); } });
      }
      result.push({ expected: component, actual: component.map(function (id) { return mapping[id]; }) });
    });
    return result;
  }
  function bondProfile(g, a, b, invert) {
    var es = g.bondElectrons[key([a, b])] || [], bySlot = Object.create(null), profile = [];
    es.forEach(function (e) { var s = Math.floor(e.anchor.slot / 2); if (!bySlot[s]) bySlot[s] = []; bySlot[s].push(e); });
    Object.keys(bySlot).sort(function (x, y) { return Number(x) - Number(y); }).forEach(function (s) { profile.push({ n: bySlot[s].length, symbols: symbolCounts(bySlot[s], invert) }); });
    return profile;
  }
  function sameBondProfiles(exp, act, mapping, invertByActual, countsOnly) {
    var ekeys = Object.keys(exp.bondElectrons).sort(), akeys = Object.keys(act.bondElectrons).sort();
    if (ekeys.length !== akeys.length) return false;
    for (var i = 0; i < ekeys.length; i++) {
      var ep = ekeys[i].split('|'), ap = [mapping[ep[0]], mapping[ep[1]]], eprof = bondProfile(exp, ep[0], ep[1], false), aprof = bondProfile(act, ap[0], ap[1], invertByActual);
      if (eprof.length !== aprof.length) return false;
      for (var j = 0; j < eprof.length; j++) if (eprof[j].n !== 2 || aprof[j].n !== 2 || (!countsOnly && !sameCounts(eprof[j].symbols, aprof[j].symbols))) return false;
    }
    return true;
  }
  function loneProfiles(exp, act, mapping, invertByActual) {
    return Object.keys(exp.atom).every(function (eid) {
      if (qualifyingCationShell(exp, act, mapping, eid)) return true;
      var expected = symbolCounts(exp.lone[eid], false), actual = symbolCounts(act.lone[mapping[eid]], invertByActual);
      return sameCounts(expected, actual);
    });
  }
  /* The reference deliberately omits the former outer shell of a metal
   * cation.  Some valid student diagrams show the newly exposed full
   * outer shell. Treat two electrons for Li+ or eight for the other supported metals on a monatomic
   * Li+/K+/Na+/Mg2+/Ca2+/Al3+ cation as that retained shell for marking.  This helper is
   * intentionally tied to the expected ion group and the submitted inventory
   * so partial or mixed-origin shells are never normalised. */
  function qualifyingCationShell(exp, act, mapping, eid) {
    if (!exp || !act || !mapping || !own(exp.atom, eid) || !own(act.atom, mapping[eid])) return false;
    var element = exp.atom[eid].element;
    if (!own(RETAINED_CATION_SHELLS, element)) return false;
    var group = null, actualGroup = null, aid = mapping[eid];
    /* Both reference and submitted groups must identify the atom as a
     * monatomic, bracketed cation with its element's expected charge.  These
     * checks prevent the marking exception being applied to a malformed or
     * repurposed group. */
    for (var i = 0; i < exp.groups.length; i++) {
      var candidate = exp.groups[i];
      if (candidate.atomIds.length === 1 && candidate.atomIds[0] === eid) { group = candidate; break; }
    }
    if (!group || group.charge !== VALENCE[element] || group.charge <= 0) return false;
    for (var j = 0; j < act.groups.length; j++) {
      var actualCandidate = act.groups[j];
      if (actualCandidate.atomIds.length === 1 && actualCandidate.atomIds[0] === aid) { actualGroup = actualCandidate; break; }
    }
    if (!actualGroup || actualGroup.charge !== VALENCE[element] || !actualGroup.bracket) return false;
    var lone = act.lone[aid] || [], profile = symbolCounts(lone, false);
    var size=RETAINED_CATION_SHELLS[element];
    return lone.length === size && (profile.dot === size || profile.cross === size || profile.triangle === size);
  }
  function loneProfilesForComponent(exp, act, mapping, component, invertByActual) {
    return component.expected.every(function (eid) {
      if (qualifyingCationShell(exp, act, mapping, eid)) return true;
      var expected = symbolCounts(exp.lone[eid], false), actual = symbolCounts(act.lone[mapping[eid]], invertByActual);
      return sameCounts(expected, actual);
    });
  }
  function loneCountsForComponent(exp, act, mapping, component) {
    return component.expected.every(function (eid) {
      return qualifyingCationShell(exp, act, mapping, eid) || exp.lone[eid].length === act.lone[mapping[eid]].length;
    });
  }
  function bondProfilesForComponent(exp, act, mapping, component, invertByActual) {
    var members = new Set(component.expected);
    return Object.keys(exp.bondElectrons).every(function (k) {
      var ids = k.split('|');
      if (!members.has(ids[0]) || !members.has(ids[1])) return true;
      var mapped = [mapping[ids[0]], mapping[ids[1]]], eprof = bondProfile(exp, ids[0], ids[1], false), aprof = bondProfile(act, mapped[0], mapped[1], invertByActual);
      if (eprof.length !== aprof.length) return false;
      for (var i = 0; i < eprof.length; i++) if (eprof[i].n !== 2 || aprof[i].n !== 2 || !sameCounts(eprof[i].symbols, aprof[i].symbols)) return false;
      return true;
    });
  }
  function shellProfiles(g) {
    var shells = Object.create(null);
    Object.keys(g.atom).forEach(function (id) { var n = g.lone[id].length; Object.keys(g.edges[id]).forEach(function (other) { n += 2 * g.edges[id][other]; }); shells[id] = n; });
    return shells;
  }
  function allBondSlotsPaired(g) {
    return Object.keys(g.bondElectrons).every(function (k) {
      var slots = Object.create(null); g.bondElectrons[k].forEach(function (e) { slots[e.anchor.slot] = (slots[e.anchor.slot] || 0) + 1; });
      return Object.keys(slots).every(function (s) { return slots[s] === 1; }) && Object.keys(slots).every(function (s) { return own(slots, String(Number(s) ^ 1)); }) && Object.keys(slots).length % 2 === 0;
    });
  }

  function expectedElectrons(question) {
    var base = expectedFormula(question.formula);
    return base < 0 ? -1 : base - (integer(question.totalCharge) ? question.totalCharge : 0);
  }
  function shellTarget(question, id, element) {
    var targets = question.marking && question.marking.shellTargets;
    if (targets && integer(targets[id])) return targets[id];
    if (question.reference && question.reference.groups.some(function (group) { return group.charge > 0 && group.atomIds.length === 1 && group.atomIds[0] === id; })) return 0;
    return element === 'H' ? 2 : 8;
  }
  function permutations(values) {
    if (values.length < 2) return [values.slice()];
    var result = [];
    values.forEach(function (value, i) {
      permutations(values.slice(0, i).concat(values.slice(i + 1))).forEach(function (tail) { result.push([value].concat(tail)); });
    });
    return result;
  }
  function shellSymbolCounts(g, id, remap) {
    var result = { dot: 0, cross: 0, triangle: 0 };
    function add(e) { var symbol = remap && remap[e.symbol] ? remap[e.symbol] : e.symbol; result[symbol]++; }
    g.lone[id].forEach(add);
    Object.keys(g.bondElectrons).forEach(function (k) { if (k.split('|').includes(id)) g.bondElectrons[k].forEach(add); });
    return result;
  }
  function bondPairShapes(g, a, b) {
    return bondProfile(g, a, b, false).map(function (pair) {
      var counts = Object.values(pair.symbols).filter(function (n) { return n; }).sort();
      return counts.join('+');
    }).sort();
  }
  /* Origin glyph names are arbitrary, so compare every bijection used in a
   * connected component.  Lone profiles and bond-pair profiles remain tied to
   * their atoms. Explicit finite reference variants handle the few accepted
   * gained-electron moves; origins cannot otherwise be laundered between atoms. */
  function namedOriginsMatch(exp, act, mapping, onComponentMatch) {
    return expectedComponentMap(exp, mapping).every(function (component) {
      var used = new Set();
      component.expected.forEach(function (id) {
        exp.lone[id].forEach(function (e) { used.add(e.symbol); });
        Object.keys(exp.bondElectrons).forEach(function (k) { if (k.split('|').includes(id)) exp.bondElectrons[k].forEach(function (e) { used.add(e.symbol); }); });
      });
      var expectedSymbols = Array.from(used), actualSymbols = SYMBOLS.filter(function (symbol) {
        return component.actual.some(function (id) {
          return act.lone[id].some(function (e) { return e.symbol === symbol; }) || Object.keys(act.bondElectrons).some(function (k) { return k.split('|').includes(id) && act.bondElectrons[k].some(function (e) { return e.symbol === symbol; }); });
        });
      });
      if (expectedSymbols.length !== actualSymbols.length) return false;
      return permutations(actualSymbols).some(function (candidate) {
        var remap = Object.create(null); expectedSymbols.forEach(function (s, i) { remap[s] = candidate[i]; });
        if (!component.expected.every(function (eid) {
          var expected = symbolCounts(exp.lone[eid], false), remapped = {dot:0,cross:0,triangle:0};
          SYMBOLS.forEach(function (symbol) { remapped[remap[symbol] || symbol] += expected[symbol]; });
          return sameCounts(remapped, symbolCounts(act.lone[mapping[eid]], false));
        })) return false;
        var bondsMatch = Object.keys(exp.bondElectrons).every(function (k) {
          var ids = k.split('|'); if (!component.expected.includes(ids[0])) return true;
          var expectedProfiles=bondProfile(exp,ids[0],ids[1],false),actualProfiles=bondProfile(act,mapping[ids[0]],mapping[ids[1]],false);
          if(expectedProfiles.length!==actualProfiles.length)return false;
          return expectedProfiles.every(function(profile,i){var remapped={dot:0,cross:0,triangle:0};SYMBOLS.forEach(function(symbol){remapped[remap[symbol]||symbol]+=profile.symbols[symbol];});return sameCounts(remapped,actualProfiles[i].symbols);});
        });
        if (bondsMatch && onComponentMatch) onComponentMatch(component, remap);
        return bondsMatch;
      });
    });
  }

  function validateNamedReference(question, counts, g, errors) {
    if (!['ionic', 'covalent'].includes(question.practiceCategory)) errors.push('named species has an invalid practiceCategory');
    if (!Array.isArray(question.grades) || !question.grades.length || question.grades.some(function (grade) { return ![1, 2, 3].includes(grade); })) errors.push('named species has invalid grades');
    if (typeof question.displayFormula !== 'string' || !question.displayFormula) errors.push('named species has no displayFormula');
    if (!integer(question.totalCharge)) errors.push('named species has no integer totalCharge');
    if (!question.marking || question.marking.speciesSpecific !== true) errors.push('named species is missing species-specific marking metadata');
    if (question.reference.electrons.length !== expectedElectrons(question)) errors.push('reference electron inventory does not match formula and charge');
    var shells = shellProfiles(g);
    Object.keys(g.atom).forEach(function (id) { var target = shellTarget(question, id, g.atom[id].element); if (shells[id] !== target) errors.push('reference shell count for ' + id + ' is ' + shells[id] + ', expected ' + target); });
    var groupCharge = question.reference.groups.reduce(function (sum, group) { return sum + group.charge; }, 0);
    if (groupCharge !== question.totalCharge) errors.push('reference group charges do not match totalCharge');
    if (question.totalCharge !== 0 && question.reference.groups.length !== 1) errors.push('an isolated ion must use one whole-ion bracket group');
    if (question.totalCharge !== 0 && question.reference.groups[0] && question.reference.groups[0].atomIds.length !== question.reference.atoms.length) errors.push('the whole isolated ion must be bracketed');
    if (question.totalCharge === 0 && question.practiceCategory === 'covalent' && question.reference.groups.length) errors.push('neutral covalent species must not have ionic groups');
    question.reference.groups.forEach(function (group) { if (!group.bracket) errors.push('ion groups must be bracketed'); });
    Object.keys(g.bondElectrons).forEach(function (k) {
      var profiles = bondProfile(g, k.split('|')[0], k.split('|')[1], false);
      profiles.forEach(function (profile) { if (profile.n !== 2) errors.push('reference has an incomplete shared pair'); });
    });
  }

  function validateReference(question) {
    var errors = [];
    if (!question || typeof question !== 'object') return ['question must be an object'];
    if (typeof question.id !== 'string' || !question.id) errors.push('question has no id');
    if (typeof question.formula !== 'string' || !question.formula) errors.push('question has no formula');
    var counts = formulaCounts(question.formula);
    if (!counts) errors.push('formula is invalid');
    if (!question.reference) errors.push('question has no reference state');
    var stateErrors = question.reference ? validateState(question.reference) : [];
    stateErrors.forEach(function (e) { errors.push('reference: ' + e); });
    if (stateErrors.length || !counts || !question.reference) return errors;
    var g = graph(question.reference), actualCounts = countBy(question.reference.atoms, function (a) { return a.element; });
    if (!sameCounts(counts, actualCounts)) errors.push('reference atoms do not match formula');
    if (!allBondSlotsPaired(g)) errors.push('reference has an unpaired shared electron');
    if (question.namedSpecies) {
      validateNamedReference(question, counts, g, errors);
      return errors;
    }
    Object.keys(g.bondElectrons).forEach(function (bondKey) {
      var byPair = Object.create(null);
      g.bondElectrons[bondKey].forEach(function (e) { var pair = Math.floor(e.anchor.slot / 2); if (!byPair[pair]) byPair[pair] = []; byPair[pair].push(e); });
      Object.keys(byPair).forEach(function (pair) {
        var symbols = symbolCounts(byPair[pair], false);
        if (byPair[pair].length !== 2 || symbols.dot !== 1 || symbols.cross !== 1) errors.push('reference shared pair ' + bondKey + '/' + pair + ' must contain one dot and one cross');
      });
    });
    var total = question.reference.electrons.length, expectedTotal = 0;
    Object.keys(counts).forEach(function (el) { expectedTotal += counts[el] * VALENCE[el]; });
    if (total !== expectedTotal) errors.push('reference has ' + total + ' electrons; formula requires ' + expectedTotal);
    var shells = shellProfiles(g);
    Object.keys(g.atom).forEach(function (id) {
      var a = g.atom[id], target = a.element === 'H' ? 2 : 8;
      if (shells[id] !== target && !own(RETAINED_CATION_SHELLS,a.element)) errors.push('reference shell count for ' + id + ' is ' + shells[id] + ', expected ' + target);
    });
    // Independently verify source symbols in neutral covalent references.
    // Atom colours alternate across every normal covalent bond; all lone
    // electrons on a neutral atom must have that atom's colour.
    if (question.category === 'covalent') {
      var colours = Object.create(null), components = [];
      Object.keys(g.atom).forEach(function (start) {
        if (own(colours,start)) return;
        colours[start] = 0; var todo = [start], members = [];
        while (todo.length) {
          var current = todo.pop(); members.push(current);
          Object.keys(g.edges[current]).forEach(function (other) {
            if (!own(colours,other)) { colours[other] = 1-colours[current]; todo.push(other); }
            else if (colours[other] === colours[current]) errors.push('reference cannot distinguish adjacent atom origins');
          });
        }
        components.push(members);
      });
      components.forEach(function (members) {
        if (![0,1].some(function (flip) { return members.every(function (id) { return g.lone[id].every(function (e) { return e.symbol === SYMBOLS[colours[id]^flip]; }); }); })) errors.push('reference lone-electron origins are inconsistent across bonds');
      });
      if (question.reference.groups.length) errors.push('neutral covalent references must not have charged bracket groups');
    }
    if (question.category === 'ionic' || question.category === 'mixed') {
      question.reference.groups.forEach(function (group) { if (!group.bracket) errors.push('ionic reference groups must be bracketed'); });
      var chargeTotal = question.reference.groups.reduce(function (sum, group) { return sum + group.charge; }, 0);
      if (chargeTotal !== 0) errors.push('reference group charges do not sum to zero');
      var membership = Object.create(null);
      question.reference.groups.forEach(function (group) {
        var members = new Set(group.atomIds), original = group.atomIds.reduce(function (sum,id) { return sum+VALENCE[g.atom[id].element]; },0);
        var count = question.reference.electrons.filter(function (e) { return e.anchor.kind === 'atom' ? members.has(e.anchor.atomId) : members.has(e.anchor.a) && members.has(e.anchor.b); }).length;
        if (original-count !== group.charge) errors.push('reference group '+group.id+' charge does not match its electron inventory');
        group.atomIds.forEach(function (id) { if (membership[id]) errors.push('reference atom belongs to overlapping ion groups'); membership[id] = group.id; });
      });
      Object.keys(g.atom).forEach(function (id) { if (!membership[id]) errors.push('reference ion atom is not bracketed'); });
      Object.keys(g.bondElectrons).forEach(function (k) { var ids=k.split('|'); if (membership[ids[0]]!==membership[ids[1]]) errors.push('reference shares electrons between separate ions'); });
      var refGraph = graph(question.reference), refShells = shellProfiles(refGraph);
      question.reference.groups.filter(function (group) { return group.charge > 0; }).forEach(function (group) {
        if (group.atomIds.length !== 1) errors.push('positive ion groups must contain one atom');
        group.atomIds.forEach(function (id) { if (question.reference.atoms.find(function (a) { return a.id === id; }).element !== 'H' && refGraph.lone[id].length !== 0) errors.push('cation ' + id + ' must show an empty former outer shell'); });
      });
      question.reference.groups.filter(function (group) { return group.charge < 0; }).forEach(function (group) {
        var members = group.atomIds;
        if (members.length === 1) {
          var id = members[0], element = refGraph.atom[id].element, lone = refGraph.lone[id];
          if (lone.length !== 8) errors.push('negative monatomic ion ' + id + ' must show an octet');
          var profile = symbolCounts(lone, false), ownElectrons = VALENCE[element];
          if (ownElectrons != null && !((profile.dot === ownElectrons && profile.cross === 8 - ownElectrons) || (profile.cross === ownElectrons && profile.dot === 8 - ownElectrons))) errors.push('negative ion ' + id + ' has the wrong own/transferred electron ratio');
        } else if (members.length === 2 && members.every(function (id) { return refGraph.atom[id].element === 'O' || refGraph.atom[id].element === 'H'; })) {
          var oxygen = members.find(function (id) { return refGraph.atom[id].element === 'O'; }), hydrogen = members.find(function (id) { return refGraph.atom[id].element === 'H'; });
          if (!oxygen || !hydrogen || refGraph.edges[oxygen][hydrogen] !== 1 || refGraph.lone[oxygen].length !== 6 || refGraph.lone[hydrogen].length !== 0) errors.push('hydroxide reference must contain O-H and six O lone electrons');
          var ohProfile = symbolCounts(refGraph.lone[oxygen] || [], false);
          if (!((ohProfile.dot === 5 && ohProfile.cross === 1) || (ohProfile.cross === 5 && ohProfile.dot === 1))) errors.push('hydroxide oxygen has the wrong transferred-electron origin');
        }
      });
    }
    return errors;
  }

  // Formula-only covalent practice accepts any connected, neutral closed-shell
  // constitutional isomer in the duet/octet model, not only our sample graph.
  function checkCovalent(state, question) {
    var g=graph(state),ids=Object.keys(g.atom),shells=shellProfiles(g),seen=new Set(),todo=ids.length?[ids[0]]:[];
    while(todo.length){var id=todo.pop();if(seen.has(id))continue;seen.add(id);Object.keys(g.edges[id]).forEach(function(other){if(g.edges[id][other]>0)todo.push(other);});}
    var countsOk=sameCounts(formulaCounts(question.formula),countBy(state.atoms,function(a){return a.element;}));
    var bondOrders=Object.fromEntries(ids.map(function(id){return [id,Object.values(g.edges[id]).reduce(function(sum,n){return sum+n;},0)];}));
    var badValence=ids.filter(function(id){var el=g.atom[id].element;return bondOrders[id]!==((el==='H'?2:8)-VALENCE[el]);});
    var badLone=ids.filter(function(id){return g.lone[id].length!==VALENCE[g.atom[id].element]-bondOrders[id];});
    var paired=allBondSlotsPaired(g),origins=paired&&Object.keys(g.bondElectrons).every(function(k){var pair=k.split('|');return bondProfile(g,pair[0],pair[1],false).every(function(p){return p.symbols.dot===1&&p.symbols.cross===1;});})&&ids.every(function(id){return new Set(g.lone[id].map(function(e){return e.symbol;})).size<=1;});
    // Dots/crosses distinguish the two donors within each bond. Requiring a
    // global two-colouring would wrongly reject odd rings such as cyclopropane.
    var connected=ids.length>0&&seen.size===ids.length,atomsOk=countsOk&&connected&&!badValence.length;
    var octets=ids.length>0&&ids.every(function(id){return shells[id]===(g.atom[id].element==='H'?2:8);})&&state.electrons.length===expectedFormula(question.formula);
    var criteria=[pass('state-valid','State is valid','The diagram can be checked.',ids)];
    function add(ok,id,label,yes,no,objects){criteria.push((ok?pass:fail)(id,label,ok?yes:no,objects||[]));}
    add(atomsOk,'atoms-and-connectivity','Formula and connectivity','The formula matches one connected molecule with valid neutral valencies.','Use the given atom counts in one connected molecule; check each atom’s valency.',badValence);
    add(paired,'shared-electrons','Shared electrons','Every bond contains complete shared pairs.','Complete each shared electron pair.');
    add(!badLone.length,'lone-electrons','Lone electrons','Each atom has the correct non-bonding electron count.','Check each atom’s non-bonding electrons.',badLone);
    add(origins,'electron-origins','Electron origins','Each shared pair contains a dot and a cross; non-bonding electrons on each atom use one symbol.','Use a dot and a cross in each shared pair, and one symbol for each atom’s non-bonding electrons.');
    add(state.groups.length===0,'groups-and-charges','Neutral molecule','The molecule has no ionic brackets or charges.','Draw a neutral molecule without ionic brackets or charges.',state.groups.map(function(g){return g.id;}));
    add(octets,'octets-and-duets','Duets and octets','Duets, octets and the total outer-electron inventory balance.','Check shell counts and the total number of outer electrons.');
    return {correct:criteria.every(function(c){return c.passed;}),criteria:criteria};
  }

  function checkNamed(state, question) {
    var exp = graph(question.reference), act = graph(state);
    var mapping = findIsomorphism(exp, act, function (candidate) { return sameGroupSets(question.reference, state, candidate); });
    var originStates = [question.reference].concat(question.marking && question.marking.originAlternatives || []);
    var originMapping = null, originExpected = null;
    originStates.some(function (candidateState) {
      var candidateGraph = graph(candidateState);
      var found = findIsomorphism(candidateGraph, act, function (candidate) { return sameGroupSets(candidateState, state, candidate) && namedOriginsMatch(candidateGraph, act, candidate); });
      if (found) { originMapping = found; originExpected = candidateGraph; return true; }
      return false;
    });
    var mappedIds = mapping ? Object.keys(mapping).map(function (id) { return mapping[id]; }) : [];
    var retainedIds = new Set(), retained = 0, retainedSymbols = [];
    if (mapping) Object.keys(exp.atom).forEach(function (eid) {
      if (!qualifyingCationShell(exp, act, mapping, eid)) return;
      var aid = mapping[eid], lone = act.lone[aid]; retained += lone.length; retainedSymbols.push(lone[0].symbol);
      lone.forEach(function (electron) { retainedIds.add(electron.id); });
    });
    var chemicalState = clone(state);
    chemicalState.electrons = chemicalState.electrons.filter(function (electron) { return !retainedIds.has(electron.id); });
    var chem = graph(chemicalState);
    var criteria = [pass('state-valid', 'State is valid', 'The diagram can be checked.', mappedIds)];
    function add(ok, id, label, yes, no, objects) { criteria.push((ok ? pass : fail)(id, label, ok ? yes : no, objects || [])); }
    var atomsOk = !!mapping && sameCounts(countBy(question.reference.atoms, function (a) { return a.element; }), countBy(state.atoms, function (a) { return a.element; }));
    add(atomsOk, 'atoms-and-connectivity', 'Atoms and connectivity', 'The named species has the correct atoms and connectivity.', 'Use the connectivity of the named species.', mappedIds);
    var sharedOk = !!mapping && allBondSlotsPaired(chem) && sameBondProfiles(exp, chem, mapping, false, true);
    add(sharedOk, 'shared-electrons', 'Shared electrons', 'Every bond has the correct number of complete shared pairs.', 'Check the number of shared pairs in each bond.');
    var shellsExp = shellProfiles(exp), shellsAct = shellProfiles(chem);
    var loneOk = !!mapping && Object.keys(exp.atom).every(function (eid) { return exp.lone[eid].length === chem.lone[mapping[eid]].length; });
    add(loneOk, 'lone-electrons', 'Lone electrons', 'Each atom has the correct number of non-bonding electrons.', 'Check the lone electrons on each atom.');
    if (retainedIds.size) {
      originMapping = null; originExpected = null;
      originStates.some(function (candidateState) {
        var candidateGraph=graph(candidateState),found=findIsomorphism(candidateGraph,chem,function(candidate){return sameGroupSets(candidateState,chemicalState,candidate)&&namedOriginsMatch(candidateGraph,chem,candidate);});
        if(found){originMapping=found;originExpected=candidateGraph;return true;}return false;
      });
    }
    var originOk = !!originMapping;
    add(originOk, 'electron-origins', 'Electron origins', 'The origin symbols are consistent, including any coordinate or transferred pair.', 'Keep each origin symbol consistent; a coordinate pair uses two matching symbols.');
    var groupsOk = !!mapping && sameGroupSets(question.reference, state, mapping) && state.groups.reduce(function (sum, group) { return sum + group.charge; }, 0) === question.totalCharge;
    add(groupsOk, 'groups-and-charges', 'Ions and charges', question.totalCharge ? 'The whole ion is bracketed with the correct charge.' : question.practiceCategory === 'ionic' ? 'Each ion is bracketed with the correct charge.' : 'The neutral molecule has no ionic brackets.', 'Check brackets, grouping and charges.', state.groups.map(function (g) { return g.id; }));
    var shellsOk = !!mapping && Object.keys(exp.atom).every(function (eid) { return shellsExp[eid] === shellsAct[mapping[eid]] && shellsAct[mapping[eid]] === shellTarget(question, eid, exp.atom[eid].element); });
    if (originMapping && question.marking.transferredSymbol && retainedSymbols.length) {
      var transferredActual = null, expectedTransferred = question.marking.transferredSymbol;
      namedOriginsMatch(originExpected, chem, originMapping, function (component, remap) {
        var containsTransferred = component.expected.some(function (id) {
          return originExpected.lone[id].some(function (e) { return e.symbol === expectedTransferred; }) || Object.keys(originExpected.bondElectrons).some(function (k) { return k.split('|').includes(id) && originExpected.bondElectrons[k].some(function (e) { return e.symbol === expectedTransferred; }); });
        });
        if (containsTransferred) transferredActual = remap[expectedTransferred];
      });
      if (!retainedSymbols.every(function (symbol) { return symbol === transferredActual; })) originOk = false;
    }
    var totalOk = state.electrons.length === expectedElectrons(question) + retained;
    add(shellsOk && totalOk, 'octets-and-duets', 'Shell inventories', 'All duet, octet and permitted expanded-shell inventories balance.', 'Check every shell and the total outer-electron inventory.', mappedIds);
    if (!originOk) criteria.find(function (c) { return c.id === 'electron-origins'; }).passed = false;
    return { correct: criteria.every(function (c) { return c.passed; }), criteria: criteria };
  }

  function check(state, question) {
    var criteria = [], referenceErrors = validateReference(question);
    var stateErrors = validateState(state);
    if (referenceErrors.length) {
      criteria.push(fail('reference-valid', 'Reference', 'Reference is invalid: ' + referenceErrors[0], []));
      while (criteria.length < 7) criteria.push(fail('criterion-' + criteria.length, 'Criterion', 'Reference is invalid.', []));
      return { correct: false, criteria: criteria, errors: referenceErrors };
    }
    if (stateErrors.length) {
      criteria.push(fail('state-valid', 'State is valid', stateErrors[0], []));
      ['atoms-and-connectivity', 'shared-electrons', 'lone-electrons', 'electron-origins', 'groups-and-charges', 'octets-and-duets'].forEach(function (id) { criteria.push(fail(id, id, 'The state cannot be marked until its structure is valid.', [])); });
      return { correct: false, criteria: criteria, errors: stateErrors };
    }
    if (question.namedSpecies) return checkNamed(state, question);
    if(question.category==='covalent')return checkCovalent(state,question);
    var exp = graph(question.reference), act = graph(state), mapping = findIsomorphism(exp, act);
    function originsMatch(candidate) { return expectedComponentMap(exp,candidate).every(function (component) { return [false,true].some(function (invert) { return loneProfilesForComponent(exp,act,candidate,component,invert) && bondProfilesForComponent(exp,act,candidate,component,invert); }); }); }
    if (mapping) {
      // Equivalent atoms can have different neighbourhood roles. Continue the
      // search when the first structural mapping does not match annotations.
      mapping = findIsomorphism(exp,act,function (candidate) { return sameGroupSets(question.reference,state,candidate) && originsMatch(candidate); }) || mapping;
    }
    var mappedIds = mapping ? Object.keys(mapping).map(function (id) { return mapping[id]; }) : [];
    criteria.push(pass('state-valid', 'State is valid', 'The diagram can be checked.', mappedIds));
    var atomsOk = !!mapping && sameCounts(countBy(question.reference.atoms, function (a) { return a.element; }), countBy(state.atoms, function (a) { return a.element; }));
    criteria.push(atomsOk ? pass('atoms-and-connectivity', 'Atoms and connectivity', 'The element identities and shared-electron connectivity match.', mappedIds) : fail('atoms-and-connectivity', 'Atoms and connectivity', 'The atoms or connectivity do not match the formula.', mappedIds));
    var sharedOk = !!mapping && allBondSlotsPaired(act) && sameBondProfiles(exp, act, mapping, false, true);
    criteria.push(sharedOk ? pass('shared-electrons', 'Shared electrons', 'Every bond has the correct number of complete shared pairs.', []) : fail('shared-electrons', 'Shared electrons', 'One or more shared pairs are missing, extra, or incomplete.', []));
    var components = mapping ? expectedComponentMap(exp, mapping) : [], originOk = false, loneOk = false;
    if (mapping) {
      originOk = components.every(function (component) {
        return [false, true].some(function (invert) {
          return loneProfilesForComponent(exp, act, mapping, component, invert) && bondProfilesForComponent(exp, act, mapping, component, invert);
        });
      });
      loneOk = components.every(function (component) { return loneCountsForComponent(exp, act, mapping, component); });
    }
    var loneErrors = mapping ? Object.keys(mapping).filter(function (id) { return exp.lone[id].length !== act.lone[mapping[id]].length; }).map(function (id) { return mapping[id]; }) : [];
    criteria.push(loneOk ? pass('lone-electrons', 'Lone electrons', 'Each atom has the correct number of non-bonding electrons.', []) : fail('lone-electrons', 'Lone electrons', 'Check the number of non-bonding electrons on each atom.', loneErrors));
    criteria.push(originOk ? pass('electron-origins', 'Electron origins', 'Dots and crosses consistently distinguish electron origins.', []) : fail('electron-origins', 'Electron origins', 'Check which atom supplied each electron: shared pairs need one of each symbol, and transferred electrons must be distinguished.', state.electrons.map(function(e){return e.id;})));
    var groupsOk = !!mapping && sameGroupSets(question.reference, state, mapping);
    criteria.push(groupsOk ? pass('groups-and-charges', 'Ions and charges', question.category === 'covalent' ? 'The molecule is neutral, with no ionic brackets.' : 'Each ion is bracketed with its correct charge and ratio.', []) : fail('groups-and-charges', 'Ions and charges', 'Check each ion’s brackets and charge; bracket a whole hydroxide ion together.', state.groups.map(function(g){return g.id;})));
    var shellsExp = shellProfiles(exp), shellsAct = shellProfiles(act), shellsOk = !!mapping && Object.keys(shellsExp).every(function (eid) {
      var actualShell = shellsAct[mapping[eid]];
      if (qualifyingCationShell(exp, act, mapping, eid)) actualShell -= RETAINED_CATION_SHELLS[exp.atom[eid].element];
      return shellsExp[eid] === actualShell;
    });
    var retainedCationElectrons = mapping ? Object.keys(exp.atom).reduce(function (total,eid) { return total+(qualifyingCationShell(exp, act, mapping, eid)?RETAINED_CATION_SHELLS[exp.atom[eid].element]:0); },0) : 0;
    var totalOk = !!mapping && state.electrons.length === expectedFormula(question.formula) + retainedCationElectrons;
    var octetOk = shellsOk && totalOk;
    criteria.push(octetOk ? pass('octets-and-duets', 'Duets and octets', question.category === 'covalent' ? 'Hydrogen has two electrons around it; every other atom has eight.' : 'Shell counts and transferred electrons balance; metal ions may show an empty former outer shell or a retained full shell (two for Li+, eight for the others).', []) : fail('octets-and-duets', 'Duets and octets', 'Check shell counts and the total number of original outer electrons.', mappedIds));
    return { correct: criteria.every(function (c) { return c.passed; }), criteria: criteria };
  }
  function expectedFormula(formula) {
    var counts = formulaCounts(formula), total = 0;
    if (!counts) return -1;
    Object.keys(counts).forEach(function (el) { total += (VALENCE[el] || 0) * counts[el]; });
    return total;
  }
  function reference(question) { return question && question.reference ? clone(question.reference) : null; }

  return { check: check, validateReference: validateReference, clone: clone, reference: reference, validateState: validateState, formulaCounts: formulaCounts };
}));
