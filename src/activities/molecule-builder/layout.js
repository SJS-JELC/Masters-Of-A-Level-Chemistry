/* Deterministic 2D editor layout. Coordinates only; no chemical graph rewriting. */
(function (root) {
  'use strict';
  const LENGTH = 74, TURN = Math.PI / 3;
  function clean(graph) {
    const next = JSON.parse(JSON.stringify(graph));
    const atoms = new Map(next.atoms.map(a => [a.id, a]));
    const edges = new Map(next.atoms.map(a => [a.id, []]));
    next.bonds.forEach(b => { edges.get(b.a).push(b.b); edges.get(b.b).push(b.a); });
    const linear = new Set(next.bonds.filter(b => b.order === 3).flatMap(b => [b.a, b.b])
      .filter(id => atoms.get(id).element === 'C' && edges.get(id).length === 2));
    edges.forEach(ids => ids.sort((a, b) => a - b));
    const pending = new Set([...atoms.keys()].sort((a, b) => a - b));
    let offset = 0;
    while (pending.size) {
      const ids = [], queue = [pending.values().next().value];
      pending.delete(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i]; ids.push(id);
        for (const n of edges.get(id)) if (pending.delete(n)) queue.push(n);
      }
      // Leaf peeling isolates a simple ring, if this component has one.
      const ring = new Set(ids), degrees = new Map(ids.map(id => [id, edges.get(id).length]));
      const leaves = ids.filter(id => degrees.get(id) < 2);
      for (let i = 0; i < leaves.length; i++) {
        const id = leaves[i]; ring.delete(id);
        for (const n of edges.get(id)) if (ring.has(n)) {
          degrees.set(n, degrees.get(n) - 1);
          if (degrees.get(n) === 1) leaves.push(n);
        }
      }
      const placed = new Set();
      function place(id, x, y) { Object.assign(atoms.get(id), { x, y }); placed.add(id); }
      function grow(id, heading, depth) {
        const children = edges.get(id).filter(n => !placed.has(n));
        const parent = atoms.get(id);
        let angles;
        if (children.length === 1) angles = [heading + (linear.has(id) ? 0 : depth % 2 ? TURN : -TURN)];
        else if (children.length === 2) angles = [heading - TURN, heading + TURN];
        else angles = children.map((_, i) => heading - Math.PI / 2 + i * Math.PI / Math.max(1, children.length - 1));
        // Reserve all immediate branches before growing their subtrees.
        children.forEach((child, i) => place(child, parent.x + LENGTH * Math.cos(angles[i]), parent.y + LENGTH * Math.sin(angles[i])));
        children.forEach((child, i) => grow(child, angles[i], depth + 1));
      }
      if (!ring.size) {
        const start = ids.find(id => edges.get(id).length <= 1) ?? ids[0];
        place(start, 0, 0); grow(start, Math.PI / 6, 0);
      } else if ([...ring].every(id => edges.get(id).filter(n => ring.has(n)).length === 2)) {
        const ordered = [], first = Math.min(...ring);
        let previous = null, id = first;
        do {
          ordered.push(id);
          const following = edges.get(id).find(n => ring.has(n) && n !== previous);
          previous = id; id = following;
        } while (id !== first);
        const radius = LENGTH / (2 * Math.sin(Math.PI / ordered.length));
        ordered.forEach((id, i) => {
          const angle = -Math.PI / 2 + 2 * Math.PI * i / ordered.length;
          place(id, radius * Math.cos(angle), radius * Math.sin(angle));
        });
        ordered.forEach(id => {
          const parent = atoms.get(id), children = edges.get(id).filter(n => !placed.has(n));
          const outward = Math.atan2(parent.y, parent.x);
          children.forEach((child, i) => {
            const angle = outward + (i - (children.length - 1) / 2) * TURN;
            place(child, parent.x + LENGTH * Math.cos(angle), parent.y + LENGTH * Math.sin(angle));
          });
          children.forEach(child => {
            const atom = atoms.get(child);
            grow(child, Math.atan2(atom.y - parent.y, atom.x - parent.x), 0);
          });
        });
      } else {
        // Multiple rings: start from a deterministic circle and relax springs.
        const radius = Math.max(LENGTH, LENGTH * ids.length / (2 * Math.PI));
        ids.forEach((id, i) => place(id, radius * Math.cos(i * 2 * Math.PI / ids.length), radius * Math.sin(i * 2 * Math.PI / ids.length)));
      }
      const localBonds = next.bonds.filter(b => ids.includes(b.a));
      const crowded = ids.some((id, i) => ids.slice(i + 1).some(other => Math.hypot(atoms.get(id).x - atoms.get(other).x, atoms.get(id).y - atoms.get(other).y) < LENGTH * .65));
      const multiRing = ring.size && [...ring].some(id => degrees.get(id) !== 2);
      if (crowded || multiRing) {
        // A bounded fallback separates crowded branches; simple layouts stay exact.
        for (let step = 0; step < 400; step++) {
          const force = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
          function push(a, b, amount, dx, dy, distance) {
            const x = amount * dx / distance, y = amount * dy / distance;
            force.get(a).x += x; force.get(a).y += y;
            force.get(b).x -= x; force.get(b).y -= y;
          }
          for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
            const a = atoms.get(ids[i]), b = atoms.get(ids[j]);
            let dx = a.x - b.x, dy = a.y - b.y;
            if (Math.hypot(dx, dy) < .01) { dx = Math.cos(i + j); dy = Math.sin(i + j); }
            const d = Math.hypot(dx, dy);
            if (d < LENGTH * 1.25) push(a.id, b.id, (LENGTH * 1.25 - d) * .08, dx, dy, d);
          }
          localBonds.forEach(b => {
            const a = atoms.get(b.a), z = atoms.get(b.b), dx = a.x - z.x, dy = a.y - z.y, d = Math.hypot(dx, dy) || 1;
            push(b.a, b.b, (LENGTH - d) * .35, dx, dy, d);
          });
          ids.forEach(id => { const a = atoms.get(id), f = force.get(id); a.x += Math.max(-5, Math.min(5, f.x)); a.y += Math.max(-5, Math.min(5, f.y)); });
        }
      }
      // Spring relaxation must not bend a terminal nitrile (or terminal alkyne).
      // Move only its terminal atom, preserving the rest of the relaxed layout.
      for (const id of ids.filter(id => linear.has(id))) {
        const terminalBond = localBonds.find(b => b.order === 3 && (b.a === id || b.b === id)
          && edges.get(b.a === id ? b.b : b.a).length === 1);
        if (!terminalBond) continue;
        const terminalId = terminalBond.a === id ? terminalBond.b : terminalBond.a;
        const centre = atoms.get(id), neighbour = atoms.get(edges.get(id).find(n => n !== terminalId));
        const dx = centre.x - neighbour.x, dy = centre.y - neighbour.y, distance = Math.hypot(dx, dy);
        if (distance) Object.assign(atoms.get(terminalId), { x: centre.x + LENGTH * dx / distance, y: centre.y + LENGTH * dy / distance });
      }
      const left = Math.min(...ids.map(id => atoms.get(id).x)), right = Math.max(...ids.map(id => atoms.get(id).x));
      const cy = (Math.min(...ids.map(id => atoms.get(id).y)) + Math.max(...ids.map(id => atoms.get(id).y))) / 2;
      ids.forEach(id => { const a = atoms.get(id); a.x += offset - left; a.y -= cy; });
      offset += right - left + LENGTH * 2;
    }
    const centre = next.atoms.length ? (offset - LENGTH * 2) / 2 : 0;
    next.atoms.forEach(a => { a.x = Math.round((a.x - centre) * 1000) / 1000; a.y = Math.round(a.y * 1000) / 1000; });
    return next;
  }
  root.MoleculeLayout = { clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = { clean };
})(globalThis);
