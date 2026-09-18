(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const Data = root.DotCrossData || (typeof require === 'function' ? require('./data.js') : null);
  // Keep this exported array stable: references and callers use slot numbers,
  // while the renderer chooses exposed visual lone-pair positions.
  const angles = [-100, -80, -10, 10, 80, 100, 170, 190];
  const EPSILON = 1e-7;
  const PAIR_HALF_ANGLE = 9 * Math.PI / 180;

  function elementOf(atomOrElement) {
    return typeof atomOrElement === 'string' ? atomOrElement : atomOrElement?.element;
  }
  function shellRadius(atomOrElement) {
    if (Data && typeof Data.shellRadius === 'function') return Data.shellRadius(atomOrElement);
    return elementOf(atomOrElement) === 'H' ? 40 : 64;
  }
  function bondDistance(a, b) {
    if (Data && typeof Data.bondDistance === 'function') return Data.bondDistance(a, b);
    return shellRadius(a) + shellRadius(b) - 24;
  }

  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, String(v)));
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawElectronMark(parent, symbol, p) {
    if (symbol === 'dot') return el('circle', {cx:p.x, cy:p.y, r:3, 'class':'electron-mark'}, parent);
    if (symbol === 'triangle') return el('path', {
      d:`M${p.x} ${p.y-5}L${p.x+5} ${p.y+4}L${p.x-5} ${p.y+4}Z`, 'class':'electron-mark triangle-mark'
    }, parent);
    return el('path', {d:`M${p.x-4} ${p.y-4}l8 8m-8 0l8 -8`, 'class':'electron-mark'}, parent);
  }

  function atomById(state, id) { return state.atoms.find(a => a.id === id) || null; }
  function pairIds(a, b) { return [a, b].sort(); }
  function pairKey(a, b) { return pairIds(a, b).join(':'); }
  function angleDifference(a, b) {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  }
  function vectorAngle(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function key(a) {
    return a.kind === 'atom'
      ? `a:${a.atomId}:${a.slot}`
      : `b:${pairIds(a.a, a.b).join(':')}:${a.slot}`;
  }
  function regionKey(a) {
    if (!a) return '';
    return a.kind === 'atom' ? `a:${a.atomId}` : `b:${pairKey(a.a, a.b)}`;
  }
  function regionData(anchor) {
    return anchor.kind === 'atom'
      ? { kind: 'atom', atomId: anchor.atomId }
      : { kind: 'bond', a: pairIds(anchor.a, anchor.b)[0], b: pairIds(anchor.a, anchor.b)[1] };
  }

  function bondPairs(state) {
    const pairs = new Map();
    state.electrons.filter(e => e.anchor && e.anchor.kind === 'bond').forEach(e => {
      const ids = pairIds(e.anchor.a, e.anchor.b);
      pairs.set(ids.join(':'), ids);
    });
    return [...pairs.values()];
  }

  function nearbyPairs(state) {
    const pairs = bondPairs(state);
    const known = new Set(pairs.map(p => pairKey(p[0], p[1])));
    state.atoms.forEach((a, i) => state.atoms.slice(i + 1).forEach(b => {
      const d = distance(a, b);
      const k = pairKey(a.id, b.id);
      if (d > EPSILON && d <= shellRadius(a) + shellRadius(b) + EPSILON && !known.has(k)) {
        known.add(k);
        pairs.push(pairIds(a.id, b.id));
      }
    }));
    return pairs;
  }

  function occupiedKeys(state, excludeElectron) {
    return new Set(state.electrons
      .filter(e => e.id !== excludeElectron && e.anchor)
      .map(e => key(e.anchor)));
  }

  function firstFreeAnchor(kind, ids, occupied) {
    const max = kind === 'atom' ? 8 : 6;
    for (let slot = 0; slot < max; slot++) {
      const anchor = kind === 'atom'
        ? { kind: 'atom', atomId: ids[0], slot }
        : { kind: 'bond', a: ids[0], b: ids[1], slot };
      if (!occupied.has(key(anchor))) return anchor;
    }
    return null;
  }

  function inOverlap(p, a, b) {
    return distance(p, a) <= shellRadius(a) + EPSILON &&
      distance(p, b) <= shellRadius(b) + EPSILON;
  }

  function freeAnchor(state, region, excludeElectron) {
    const ids = region.kind === 'atom' ? [region.atomId] : [region.a, region.b];
    const anchor = firstFreeAnchor(region.kind, ids, occupiedKeys(state, excludeElectron));
    if (!anchor || anchor.kind !== 'atom') return anchor;
    const proposed = {...state, electrons:state.electrons.filter(e => e.id !== excludeElectron)};
    proposed.electrons.push({id:'__candidate__', symbol:'dot', anchor});
    return atomPoint(proposed,anchor) ? anchor : null;
  }

  /*
   * Resolve a pointer position to a region and then to its first free slot.
   * The lens between two atom shells has priority over either atom. This is
   * deliberately geometry-based, so a caller does not need to know about
   * visual slot markers or the current insertion order.
   */
  function regionAt(state, p, excludeElectron) {
    if (!state || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const occupied = occupiedKeys(state, excludeElectron);
    const shared = nearbyPairs(state).map(ids => {
      const a = atomById(state, ids[0]), b = atomById(state, ids[1]);
      return a && b && inOverlap(p, a, b)
        ? { ids, d: distance(p, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) }
        : null;
    }).filter(Boolean).sort((a, b) => a.d - b.d);
    for (const candidate of shared) {
      const anchor = firstFreeAnchor('bond', candidate.ids, occupied);
      if (anchor) return anchor;
      // An occupied shared region must not silently become a lone-electron
      // insertion target while the pointer is still in the lens.
      return null;
    }

    const atoms = state.atoms.map(a => ({
      a,
      d: Math.hypot(p.x - a.x, p.y - a.y)
    })).filter(item => item.d <= shellRadius(item.a) + 12 + EPSILON)
      .sort((x, y) => x.d - y.d);
    for (const item of atoms) {
      // Stay on the targeted atom; a full shell must not redirect to a neighbour.
      return freeAnchor(state, {kind:'atom', atomId:item.a.id}, excludeElectron);
    }
    return null;
  }

  /* Twelve 30-degree bonding directions, plus their gap midpoints. Reserve
   * both marks of each pair, with enough clearance for the electron glyph. */
  function atomSectorAngles(state, atom) {
    const neighbours = state.atoms.filter(other => other.id !== atom.id);
    const radius = shellRadius(atom), clearance = 6;
    return Array.from({length:24}, (_, index) => {
      const angle = -Math.PI/2 + index*Math.PI/12;
      const marks = [-PAIR_HALF_ANGLE,PAIR_HALF_ANGLE].map(offset => ({x:atom.x+radius*Math.cos(angle+offset),
        y:atom.y+radius*Math.sin(angle+offset)}));
      const space = Math.min(...marks.flatMap(p => neighbours.map(other => distance(p,other)-shellRadius(other))));
      return {angle, index, space};
    }).filter(candidate => candidate.space >= clearance-EPSILON);
  }

  function atomSectorForSlot(state, atom, slot) {
    const candidates = atomSectorAngles(state, atom);
    const group = Math.floor(slot / 2);
    const occupiedGroups = new Set(state.electrons
      .filter(e => e.anchor && e.anchor.kind === 'atom' && e.anchor.atomId === atom.id)
      .map(e => Math.floor(e.anchor.slot / 2)));
    occupiedGroups.add(group);
    const ordered = [...occupiedGroups].sort((a,b) => a-b);
    // Search combinations rather than greedily consuming a gap another pair needs.
    function fit(chosen) {
      if (chosen.length === ordered.length) return chosen;
      const available = candidates.filter(c => chosen.every(p => angleDifference(c.angle,p.angle) >= 40*Math.PI/180-EPSILON));
      available.sort((a,b) => {
        const separation = c => Math.min(...chosen.map(p => angleDifference(c.angle,p.angle)));
        return (chosen.length ? separation(b)-separation(a) : 0) ||
          (Number.isFinite(a.space) && Number.isFinite(b.space) ? b.space-a.space : 0) || a.index-b.index;
      });
      for (const candidate of available) { const result=fit([...chosen,candidate]); if(result)return result; }
      return null;
    }
    return fit([])?.[ordered.indexOf(group)] || null;
  }

  function atomPoint(state, anchor) {
    const atom = atomById(state, anchor.atomId);
    if (!atom) return null;
    const sector = atomSectorForSlot(state, atom, anchor.slot);
    if (!sector) return null;
    const theta = sector.angle + (anchor.slot % 2 ? PAIR_HALF_ANGLE : -PAIR_HALF_ANGLE);
    const radius = shellRadius(atom);
    return {
      x: atom.x + radius * Math.cos(theta),
      y: atom.y + radius * Math.sin(theta)
    };
  }

  function overlapCenter(state, aId, bId) {
    const a = typeof aId === 'object' ? aId : atomById(state, aId);
    const b = typeof bId === 'object' ? bId : atomById(state, bId);
    if (!a || !b) return null;
    const d = distance(a, b);
    if (d < EPSILON) return { x: a.x, y: a.y };
    const t = (d + shellRadius(a) - shellRadius(b)) / 2;
    return { x: a.x + (b.x - a.x) * t / d, y: a.y + (b.y - a.y) * t / d };
  }

  function bondPoint(state, anchor) {
    const ids = pairIds(anchor.a, anchor.b);
    const a = atomById(state, ids[0]), b = atomById(state, ids[1]);
    if (!a || !b) return null;
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ra = shellRadius(a), rb = shellRadius(b);
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const center = overlapCenter(state, a, b);
    const t = (d + ra - rb) / 2;
    const roomA = Math.sqrt(Math.max(0, ra * ra - t * t));
    const roomB = Math.sqrt(Math.max(0, rb * rb - (d - t) * (d - t)));
    const room = Math.min(roomA, roomB);
    // Shared pairs stack across the bond through the actual overlap centre.
    // The stack is kept within 75% of the narrower lens height for legibility.
    const electrons = state.electrons.filter(e => e.anchor && e.anchor.kind === 'bond' &&
      pairKey(e.anchor.a, e.anchor.b) === pairKey(anchor.a, anchor.b));
    const maxSlot = Math.max(anchor.slot, ...electrons.map(e => e.anchor.slot));
    const pairCount = Math.max(1, Math.ceil((maxSlot + 1) / 2));
    const extent = (pairCount - 1) * 11 + 5;
    const scale = d < ra + rb && extent ? Math.min(1, room * .75 / extent) : 1;
    const across = ((Math.floor(anchor.slot / 2) - (pairCount - 1) / 2) * 22 + (anchor.slot % 2 ? 5 : -5)) * scale;
    return { x: center.x - uy * across, y: center.y + ux * across };
  }

  function point(state, anchor) {
    if (!anchor) return null;
    return anchor.kind === 'atom' ? atomPoint(state, anchor) : bondPoint(state, anchor);
  }

  function targets(state, selected = [], pair = [], excludeElectron) {
    const occupied = occupiedKeys(state, excludeElectron), anchors = [];
    const atoms = selected.length === 1 ? state.atoms.filter(a => selected.includes(a.id)) : state.atoms;
    atoms.forEach(a => { for (let slot = 0; slot < 8; slot++) anchors.push({ kind: 'atom', atomId: a.id, slot }); });
    const pairs = nearbyPairs(state);
    const chosen = pair?.length === 2 ? pair : selected.length === 2 ? selected : null;
    if (chosen && !pairs.some(p => p.includes(chosen[0]) && p.includes(chosen[1]))) pairs.push(pairIds(chosen[0], chosen[1]));
    pairs.forEach(ids => { for (let slot = 0; slot < 6; slot++) anchors.push({ kind: 'bond', a: ids[0], b: ids[1], slot }); });
    return anchors.filter(anchor => !occupied.has(key(anchor)))
      .map(anchor => ({ ...point(state, anchor), anchor }))
      .filter(item => item.x != null && item.y != null);
  }

  function chargeText(n) {
    return n === 0 ? '' : `${Math.abs(n) === 1 ? '' : Math.abs(n)}${n > 0 ? '+' : '\u2212'}`;
  }

  function viewBox(svg) {
    const raw = (svg.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
    return raw.length === 4 && raw.every(Number.isFinite)
      ? { x: raw[0], y: raw[1], width: raw[2], height: raw[3] }
      : { x: 0, y: 0, width: 1000, height: 650 };
  }

  function lensPath(a, b) {
    const d = distance(a, b);
    const ra = shellRadius(a), rb = shellRadius(b);
    if (d > ra + rb + EPSILON) return '';
    if (d < EPSILON || d <= Math.abs(ra - rb) + EPSILON) {
      const center = ra <= rb ? a : b, radius = Math.min(ra, rb);
      return `M${center.x - radius} ${center.y}A${radius} ${radius} 0 1 0 ${center.x + radius} ${center.y}A${radius} ${radius} 0 1 0 ${center.x - radius} ${center.y}Z`;
    }
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const t = (d * d + ra * ra - rb * rb) / (2 * d);
    const h = Math.sqrt(Math.max(0, ra * ra - t * t));
    const base = { x: a.x + ux * t, y: a.y + uy * t };
    const p1 = { x: base.x - uy * h, y: base.y + ux * h }, p2 = { x: base.x + uy * h, y: base.y - ux * h };
    // Follow the facing arc of each actual circle, not its mirrored centre.
    return `M${p1.x} ${p1.y}A${ra} ${ra} 0 ${t<0?1:0} 0 ${p2.x} ${p2.y}A${rb} ${rb} 0 ${d-t<0?1:0} 0 ${p1.x} ${p1.y}Z`;
  }

  function groupBounds(state, atomIds) {
    const atoms=state.atoms.filter(a=>atomIds.includes(a.id));if(!atoms.length)return null;
    return {x:Math.min(...atoms.map(a=>a.x-shellRadius(a)-11)),y:Math.min(...atoms.map(a=>a.y-shellRadius(a)-11)),
      right:Math.max(...atoms.map(a=>a.x+shellRadius(a)+11)),bottom:Math.max(...atoms.map(a=>a.y+shellRadius(a)+11))};
  }

  function sameRegion(a, b) { return regionKey(a) === regionKey(b); }

  function draw(svg, state, opts = {}) {
    if (opts.answer && state.atoms.length) {
      const xs = state.atoms.map(a => a.x), ys = state.atoms.map(a => a.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const width = Math.max(360, Math.max(...xs) - Math.min(...xs) + 220), height = Math.max(260, Math.max(...ys) - Math.min(...ys) + 220);
      svg.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);
    }
    const focused = svg.contains(document.activeElement) ? document.activeElement?.dataset : null;
    const restore = focused ? ['atom', 'electron', 'group', 'region'].map(k => focused[k] ? [k, focused[k]] : null).find(Boolean) : null;
    svg.replaceChildren();
    const title = el('title', {}, svg, opts.answer ? 'Checked reference diagram' : 'Your dot-and-cross diagram');
    el('desc', {}, svg, `${state.atoms.length} atoms, ${state.electrons.length} electrons, ${state.groups.length} bracket groups. ${opts.circles ? 'Outer-shell circles shown.' : 'Outer-shell circles hidden.'}`);
    const selected = opts.selected || [];

    function drawCharge(group, preview=false) {
      const atoms=state.atoms.filter(a=>group.atomIds.includes(a.id));if(!atoms.length)return;
      const box=groupBounds(state,group.atomIds),{x,y,right,bottom}=box,local=group.bracket===false&&atoms.length===1;
      const g=el('g',{'class':`${preview?'charge-preview':'ion-group'}${local?' local-charge':''}`,
        ...(!preview?{'data-group':group.id,...(local?{'data-local-atom':atoms[0].id}:{}),...(!opts.answer?{tabindex:0,role:'button','aria-label':`${local?'Local charge on':'Ion group'} ${atoms.map(a=>a.element).join(', ')}, charge ${chargeText(group.charge)||'zero'}.`}:{})}:{'pointer-events':'none'})},svg);
      if(group.bracket!==false){
        const d=`M${x+10} ${y}H${x}V${bottom}H${x+10} M${right-10} ${y}H${right}V${bottom}H${right-10}`;
        if(!opts.answer&&!preview)el('path',{d,fill:'none',stroke:'transparent','stroke-width':16,'class':'bracket-hit'},g);
        el('path',{'class':'bracket-path',d},g);
      }
      el('text',{x:local?atoms[0].x+20:right+6,y:local?atoms[0].y-15:y+8,'class':'charge-label'},g,chargeText(group.charge));
    }
    state.groups.forEach(group=>drawCharge(group));

    const regionPairs = nearbyPairs(state);
    const hover = opts.drag ? opts.drag.anchor : opts.hover;
    const electronTool = opts.drag?.symbol || opts.tool;
    const previewState = hover ? {...state, electrons: [
      ...state.electrons.filter(e => e.id !== opts.drag?.electronId),
      {id: '__preview__', symbol: electronTool, anchor: hover}
    ]} : state;
    const electronSymbols = ['dot', 'cross', 'triangle'];
    const ghostPoint = !opts.answer && electronSymbols.includes(electronTool) && hover ? point(previewState, hover) : null;
    if (!opts.answer && electronSymbols.includes(opts.tool)) {
      state.atoms.forEach(atom => {
        const anchor = { kind: 'atom', atomId: atom.id, slot: 0 }, hovered = sameRegion(hover, anchor);
        el('circle', {
          cx: atom.x, cy: atom.y, r: shellRadius(atom) + 12,
          'class': 'region-hit atom-region',
          'data-region': JSON.stringify(regionData(anchor)), tabindex: 0, role: 'button',
          'aria-label': `Non-bonding electron region around ${atom.element} atom ${atom.id}`,
          fill: 'transparent', stroke: 'transparent', 'stroke-width': 1
        }, svg);
      });
      regionPairs.forEach(ids => {
        const a = atomById(state, ids[0]), b = atomById(state, ids[1]);
        if (!a || !b) return;
        const anchor = { kind: 'bond', a: ids[0], b: ids[1], slot: 0 }, hovered = sameRegion(hover, anchor);
        const d = lensPath(a, b);
        if (!d) return;
        el('path', {
          d, 'class': 'region-hit bond-region',
          'data-region': JSON.stringify(regionData(anchor)), tabindex: 0, role: 'button',
          'aria-label': `Shared-electron region between atoms ${ids[0]} and ${ids[1]}`,
          fill: 'transparent', stroke: 'transparent', 'stroke-width': 0
        }, svg);
      });
    }

    state.atoms.forEach(a => {
      const g = el('g', { 'class': 'atom', 'data-atom': a.id, ...(!opts.answer ? { tabindex: 0, role: 'button', 'aria-label': `${a.element} atom ${a.id}${selected.includes(a.id) ? ', selected' : ''}` } : {}) }, svg);
      if (opts.circles) el('circle', { cx: a.x, cy: a.y, r: shellRadius(a), 'class': 'shell' }, g);
      el('circle', { cx: a.x, cy: a.y, r: 25, 'class': 'atom-hit' }, g);
      el('text', { x: a.x, y: a.y + 9, 'text-anchor': 'middle', 'class': `atom-label element-${a.element}` }, g, a.element);
    });

    state.electrons.forEach(e => {
      if (ghostPoint && opts.drag?.electronId === e.id) return;
      const p = opts.drag?.electronId === e.id && opts.drag.point ? opts.drag.point : point(state, e.anchor);
      if (!p) return;
      const g = el('g', { 'class': 'electron', 'data-electron': e.id, ...(!opts.answer ? { tabindex: 0, role: 'button', 'aria-label': `${e.symbol} electron, ${e.anchor.kind === 'atom' ? 'non-bonding on ' + e.anchor.atomId : 'shared by ' + e.anchor.a + ' and ' + e.anchor.b}`} : {}) }, svg);
      el('circle', { cx: p.x, cy: p.y, r: 8, 'class': 'electron-hit' }, g);
      drawElectronMark(g, e.symbol, p);
    });

    if (ghostPoint) {
      const p = ghostPoint, g = el('g', {'class': 'electron-preview', 'pointer-events': 'none', 'aria-hidden': 'true'}, svg);
      drawElectronMark(g, electronTool, p);
    }
    if (!state.atoms.length && !opts.answer) {
      const vb = viewBox(svg), cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2;
      el('text', { x: cx, y: cy - 10, 'text-anchor': 'middle', 'class': 'empty-hint' }, svg, 'Build your diagram here');
      el('text', { x: cx, y: cy + 20, 'text-anchor': 'middle', 'class': 'empty-hint', style: 'font-size:14px' }, svg, 'Drag an element here, or choose one and tap.');
    }
    if (opts.drag?.kind === 'palette' && opts.drag.point) {
      const p = opts.drag.point, g = el('g', { 'class': 'drag-ghost', style: 'pointer-events:none;opacity:.7' }, svg);
      if (opts.circles) {
        const radius = shellRadius(opts.drag.element);
        el('circle', { cx: p.x, cy: p.y, r: radius, 'class': 'shell' }, g);
      }
      el('text', { x: p.x, y: p.y + 9, 'text-anchor': 'middle', 'class': `atom-label element-${opts.drag.element}` }, g, opts.drag.element);
    }
    if (((opts.drag?.kind === 'paletteSymbol' && !ghostPoint) || (opts.drag?.kind === 'paletteCharge' && !opts.chargePreview)) && opts.drag.point) {
      const p = opts.drag.point, g = el('g', { 'class': 'drag-ghost', style: 'pointer-events:none;opacity:.7' }, svg);
      if (opts.drag.kind === 'paletteSymbol') {
        const symbol = opts.drag.symbol || opts.drag.paletteSymbol;
        drawElectronMark(g, symbol, p);
      } else {
        const charge = opts.drag.charge ?? opts.drag.paletteCharge;
        el('text', { x: p.x, y: p.y + 8, 'text-anchor': 'middle', 'class': 'charge-label' }, g, chargeText(Number(charge)));
      }
    }
    if(opts.chargePreview)drawCharge(opts.chargePreview,true);
    if (opts.cursor) el('path', { d: `M${opts.cursor.x - 10} ${opts.cursor.y}h20m-10 -10v20`, 'class': 'cursor-mark' }, svg);
    if (restore) Array.from(svg.querySelectorAll(`[data-${restore[0]}]`)).find(n => n.dataset[restore[0]] === restore[1])?.focus({ preventScroll: true });
    return title;
  }

  root.DotCrossRenderer = { draw, point, targets, key, bondPairs, nearbyPairs, chargeText, angles, regionAt, freeAnchor, overlapCenter, shellRadius, bondDistance, groupBounds };
})(globalThis);
