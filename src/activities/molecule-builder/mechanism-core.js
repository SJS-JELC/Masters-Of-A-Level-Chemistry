/* Mechanism marking uses chemical attachments, never screen coordinates. */
(function(root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MoleculeCore;
  const electrons = {C:4,N:5,O:6,Cl:7,F:7,H:1};
  function pairCount(graph, atom) {
    const used = core.neighbours(graph,atom.id).reduce((n,b)=>n+b.order,0) + core.hydrogens(graph,atom);
    return (electrons[atom.element] - (atom.charge || 0) - used) / 2;
  }
  function anchorExists(graph, anchor) {
    if (!anchor) return false;
    if (anchor.kind === 'bond') return graph.bonds.some(b => b.a===anchor.a && b.b===anchor.b || b.a===anchor.b && b.b===anchor.a);
    return ['atom','pair','charge'].includes(anchor.kind) && graph.atoms.some(a=>a.id===anchor.id);
  }
  function sourceValid(graph, anchor) {
    if (!anchorExists(graph,anchor)) return false;
    if (anchor.kind==='bond') return true;
    const a=graph.atoms.find(a=>a.id===anchor.id);
    if (anchor.kind==='charge') return a.charge < 0 && pairCount(graph,a)>=1;
    return anchor.kind==='pair' && a.pairs?.length > 0 && Number.isInteger(pairCount(graph,a)) && pairCount(graph,a)>=a.pairs.length;
  }
  function expanded(graph) {
    const next=core.clone(graph); let id=Math.min(0,...graph.atoms.map(a=>a.id))-1;
    for (const a of graph.atoms) for(let i=0;i<core.hydrogens(graph,a);i++) {
      next.atoms.push({id,element:'H',h:0,charge:0,x:0,y:0});
      next.bonds.push({a:a.id,b:id,order:1}); id--;
    }
    return next;
  }
  function arrowKey(ar, mapping, source=false) {
    const id=n=>mapping ? mapping.get(n) : n;
    if(ar.kind==='bond') return 'bond:'+ [id(ar.a),id(ar.b)].sort((a,b)=>a-b).join(':');
    return (source && ['pair','charge'].includes(ar.kind) ? 'electron' : ar.kind)+':'+id(ar.id);
  }
  function structureMappings(candidate,reference,visit) {
    const a=expanded(candidate), b=expanded(reference);
    if(a.atoms.length!==b.atoms.length || a.bonds.length!==b.bonds.length) return;
    const edge=g=>{const m=new Map();g.bonds.forEach(e=>{m.set(e.a+':'+e.b,e.order);m.set(e.b+':'+e.a,e.order);});return m;};
    const ea=edge(a),eb=edge(b), label=(g,x)=>x.element+':'+core.neighbours(g,x.id).map(n=>n.order).sort().join(',');
    const la=new Map(a.atoms.map(x=>[x.id,label(a,x)])),lb=new Map(b.atoms.map(x=>[x.id,label(b,x)]));
    if([...la.values()].sort().join('|')!==[...lb.values()].sort().join('|')) return;
    const featured=(g,id)=>g.arrows?.some(ar=>[ar.from,ar.to].some(p=>p.id===id || p.a===id || p.b===id)) || g.atoms.find(a=>a.id===id)?.dipole;
    const order=[...a.atoms].sort((x,y)=>(x.element==='H')-(y.element==='H') || Number(!!featured(a,y.id))-Number(!!featured(a,x.id)) || core.neighbours(a,y.id).length-core.neighbours(a,x.id).length);
    const map=new Map(),used=new Set(); let stopped=false, steps=0;
    function search(i) {
      if(stopped) return;
      if(++steps>100000) { stopped=true; return; }
      if(i===order.length) { stopped=visit(map)===true; return; }
      const x=order[i], candidates=b.atoms.filter(y=>!used.has(y.id) && la.get(x.id)===lb.get(y.id) && [...map].every(([u,v])=>(ea.get(x.id+':'+u)||0)===(eb.get(y.id+':'+v)||0)));
      const seenHydrogenGroups=new Set();
      for(const y of candidates) {
        // Unannotated equivalent H atoms on one parent have interchangeable mappings.
        if(x.element==='H' && !featured(a,x.id) && !featured(b,y.id)) {
          const key=core.neighbours(b,y.id).map(n=>n.id).join(':')+':'+(y.charge||0);
          if(seenHydrogenGroups.has(key)) continue; seenHydrogenGroups.add(key);
        }
        map.set(x.id,y.id);used.add(y.id);search(i+1);used.delete(y.id);map.delete(x.id);
        if(stopped) return;
      }
    }
    search(0);
  }
  function gradePhase(graph, phase) {
    const ref=phase.graph, expected=ref.arrows || [], dipoles=ref.atoms.filter(a=>a.dipole), charges=ref.atoms.some(a=>a.charge), expandedRef=expanded(ref);
    // Optional dipoles on the neutral polar bonds present in this question bank.
    // Each pair lists the delta-positive then delta-negative element.
    const polarPairs=[['H','O'],['H','Cl'],['C','O'],['C','Cl'],['C','N']];
    const optionalDipole=(id,sign)=>{const a=expandedRef.atoms.find(a=>a.id===id);return a && !a.charge && core.neighbours(expandedRef,id).some(n=>{const b=expandedRef.atoms.find(b=>b.id===n.id);return !b.charge && polarPairs.some(([positive,negative])=>sign===1?a.element===positive&&b.element===negative:a.element===negative&&b.element===positive);});};
    const descriptors=['Structures and hydrogen counts',...(charges?['Formal charges']:[]),...(dipoles.length?['Relevant dipoles']:[]),...expected.map((_,i)=>`Electron-pair arrow ${i+1}`),'No extra or invalid annotations'];
    let best=descriptors.map(()=>false), found=false;
    try {core.assertGraph(graph);} catch {return {score:0,total:descriptors.length,items:descriptors.map(label=>({label,correct:false})),message:'This stage contains unsupported drawing data.'};}
    const wellFormed=(graph.arrows||[]).every(ar=>anchorExists(graph,ar.from)&&anchorExists(graph,ar.to));
    const annotationsValid=graph.atoms.every(a=>(!a.pairs?.length || Number.isInteger(pairCount(graph,a)) && a.pairs.length<=pairCount(graph,a)) && (!a.dipole || [-1,1].includes(a.dipole)));
    structureMappings(graph,ref,map=>{
      found=true;
      const chargesCorrect=graph.atoms.every(a=>(a.charge||0)===(ref.atoms.find(b=>b.id===map.get(a.id))?.charge||0)) && core.validate(graph,true).kind==='valid';
      const bits=[true];
      if(charges)bits.push(chargesCorrect);
      if(dipoles.length) bits.push(dipoles.every(b=>graph.atoms.some(a=>map.get(a.id)===b.id && a.dipole===b.dipole)));
      const used=new Set();
      for(const wanted of expected) {
        const index=(graph.arrows||[]).findIndex((ar,i)=>!used.has(i) && sourceValid(graph,ar.from) && anchorExists(graph,ar.to) && arrowKey(ar.from,map,true)===arrowKey(wanted.from,null,true) && arrowKey(ar.to,map)===arrowKey(wanted.to,null));
        bits.push(index>=0);if(index>=0)used.add(index);
      }
      const noWrongDipoles=graph.atoms.every(a=>!a.dipole || (ref.atoms.find(b=>b.id===map.get(a.id))?.dipole ? ref.atoms.find(b=>b.id===map.get(a.id)).dipole===a.dipole : optionalDipole(map.get(a.id),a.dipole)));
      bits.push((charges||chargesCorrect)&&wellFormed&&annotationsValid&&noWrongDipoles && used.size===(graph.arrows||[]).length);
      if(bits.filter(Boolean).length>best.filter(Boolean).length)best=bits;
      return best.every(Boolean);
    });
    const score=best.filter(Boolean).length;
    return {score,total:descriptors.length,items:descriptors.map((label,i)=>({label,correct:best[i]})),message:!found?'Check the species, bonds and hydrogen counts in this stage.':score===descriptors.length?'This stage is correct.':'Check the points listed below.'};
  }
  function grade(graphs,question) {
    const phases=question.phases.map((phase,i)=>gradePhase(graphs[i]||core.empty(),phase));
    const score=phases.reduce((n,p)=>n+p.score,0), total=phases.reduce((n,p)=>n+p.total,0);
    return {score,total,correct:score===total,phases};
  }
  root.MechanismCore={pairCount,anchorExists,sourceValid,gradePhase,grade,structureMappings};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MechanismCore;
})(globalThis);
