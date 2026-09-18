(function () {
  'use strict';
  const $=id=>document.getElementById(id), ns='http://www.w3.org/2000/svg', core=MoleculeCore, marking=MechanismCore, editor=MoleculeBuilder;
  const questions=MechanismData.questions, canvas=$('canvas');
  let active=false, qi=0, pi=0, tool=null, gesture=null, source=null, moleculeState=null, moleculeView='skeletal', reviewed=false;
  const blank=()=>({graph:core.empty(),history:[]});
  const drafts=questions.map(q=>q.phases.map(blank));
  const reviewBank=QuestionReview.bank('ME',questions);
  function loadReview(id){if(id.trim().toUpperCase().startsWith('MB-')){editor.loadReview(id);return;}const entry=reviewBank.get(id);switchMode(true);switchQuestion(questions.indexOf(entry));}
  const q=()=>questions[qi], phase=()=>q().phases[pi];
  function svg(tag,attrs={},text) {const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
  function say(text) {$('announcement').textContent=text;}
  function local(e) {return new DOMPoint(e.clientX,e.clientY).matrixTransform(canvas.getScreenCTM().inverse());}
  function target(node) {
    const annotation=node?.closest?.('[data-anchor]');if(annotation)return JSON.parse(annotation.dataset.anchor);
    const arrow=node?.closest?.('[data-arrow]');if(arrow)return {kind:'arrow',id:Number(arrow.dataset.arrow)};
    const atom=node?.closest?.('[data-atom]');if(atom)return {kind:'atom',id:Number(atom.dataset.atom)};
    const bond=node?.closest?.('[data-bond]');if(bond){const[a,b]=bond.dataset.bond.split(':').map(Number);return {kind:'bond',a,b};}
    return null;
  }
  const annotationScale=2/3, pairRadius=32*annotationScale;
  function decorationPosition(graph,a,kind,forceLabels=false) {
    const p=decorationPositionRaw(graph,a,kind,forceLabels);
    if(forceLabels)return p;
    const angle=a[`${kind}Angle`],radius=Math.hypot(p.x-a.x,p.y-a.y)*annotationScale;
    return Number.isFinite(angle)?{x:a.x+radius*Math.cos(angle*Math.PI/180),y:a.y+radius*Math.sin(angle*Math.PI/180)}:{x:a.x+(p.x-a.x)*annotationScale,y:a.y+(p.y-a.y)*annotationScale};
  }
  function decorationPositionRaw(graph,a,kind,forceLabels=false) {
    if(kind==='charge') {
      if(!forceLabels&&!editor.hasAtomLabel(graph,a))return {x:a.x+14,y:a.y-20};
      const m=document.createElement('canvas').getContext('2d');m.font='700 23px Comfortaa';
      const ew=m.measureText(a.element).width, h=core.hydrogens(graph,a);
      const left=core.neighbours(graph,a.id).reduce((sum,n)=>sum+graph.atoms.find(b=>b.id===n.id).x-a.x,0)>8 || ['O','Cl','F'].includes(a.element)&&!core.neighbours(graph,a.id).length;
      const extra=left||!h?0:m.measureText('H').width+(h>1?10:0);
      return {x:a.x+ew/2+extra+12,y:a.y-23};
    }
    const occupied=core.neighbours(graph,a.id).map(n=>{const b=graph.atoms.find(b=>b.id===n.id);return Math.atan2(b.y-a.y,b.x-a.x);});
    occupied.push(...(a.pairs||[]).map(angle=>angle*Math.PI/180));
    if(kind==='dipole'&&a.charge){const c=decorationPosition(graph,a,'charge',forceLabels);occupied.push(Math.atan2(c.y-a.y,c.x-a.x));}
    const options=[-90,90,0,180,-45,45,135,-135].map(d=>d*Math.PI/180);
    const gap=angle=>{const angular=occupied.length?Math.min(...occupied.map(b=>Math.abs(Math.atan2(Math.sin(angle-b),Math.cos(angle-b))))):Math.PI;const x=a.x+39*Math.cos(angle),y=a.y+39*Math.sin(angle);const clearance=Math.min(80,...graph.atoms.filter(b=>b.id!==a.id).map(b=>Math.hypot(x-b.x,y-b.y)));return angular+Math.min(2,clearance/40);};
    const angle=options.sort((x,y)=>gap(y)-gap(x))[0];
    return {x:a.x+39*Math.cos(angle),y:a.y+39*Math.sin(angle)};
  }
  // Bisect the largest unoccupied angular gap; existing pairs keep their positions.
  function lonePairAngle(graph,a) {
    const full=2*Math.PI, normal=angle=>(angle%full+full)%full;
    const occupied=core.neighbours(graph,a.id).map(n=>{const b=graph.atoms.find(b=>b.id===n.id);return normal(Math.atan2(b.y-a.y,b.x-a.x));});
    occupied.push(...(a.pairs||[]).map(angle=>normal(angle*Math.PI/180)));
    for(const kind of ['charge','dipole'])if(a[kind]){const p=decorationPosition(graph,a,kind);occupied.push(normal(Math.atan2(p.y-a.y,p.x-a.x)));}
    if(!occupied.length)return -90;
    occupied.sort((a,b)=>a-b);
    let best=-Math.PI/2, widest=-1;
    occupied.forEach((start,i)=>{
      const end=i+1<occupied.length?occupied[i+1]:occupied[0]+full,gap=end-start,mid=normal((start+end)/2);
      const topDistance=angle=>Math.abs(Math.atan2(Math.sin(angle+Math.PI/2),Math.cos(angle+Math.PI/2)));
      if(gap>widest+1e-8||Math.abs(gap-widest)<1e-8&&topDistance(mid)<topDistance(best)){widest=gap;best=mid;}
    });
    return best*180/Math.PI;
  }
  function pairAtPointer(graph,hit,end,create=false) {
    const a=graph.atoms.find(a=>a.id===hit?.id);if(!a)return;
    if(create){a.pairs=a.pairs||[];if(a.pairs.length>=4)return;a.pairs.push(lonePairAngle(graph,a));}
    const index=create?a.pairs.length-1:hit.index||0;
    if(Math.hypot(end.x-a.x,end.y-a.y)>=8)a.pairs[index]=Math.atan2(end.y-a.y,end.x-a.x)*180/Math.PI;
  }
  const chargeTools={positive:['charge',1],negative:['charge',-1],deltaPlus:['dipole',1],deltaMinus:['dipole',-1]};
  function applyCharge(graph,id,action,end) {
    const settings=chargeTools[action],a=graph.atoms.find(a=>a.id===id);if(!settings||!a)return;
    const [kind,sign]=settings;
    a[kind]=a[kind]===-sign?0:sign;
    if(!a[kind])delete a[`${kind}Angle`];
    if(kind==='charge'){
      delete a.h;
      if(a.charge>=0)graph.arrows=(graph.arrows||[]).filter(ar=>!(ar.from.kind==='charge'&&ar.from.id===a.id));
    }
    if(end&&a[kind])chargeAtPointer(graph,{kind,id},end);
  }
  function chargeAtPointer(graph,hit,end) {
    const a=graph.atoms.find(a=>a.id===hit?.id);if(!a||Math.hypot(end.x-a.x,end.y-a.y)<8)return;
    a[`${hit.kind}Angle`]=Math.atan2(end.y-a.y,end.x-a.x)*180/Math.PI;
  }
  function position(graph, anchor, forceLabels=false) {
    if(anchor.kind==='bond') {
      const a=graph.atoms.find(a=>a.id===anchor.a),b=graph.atoms.find(a=>a.id===anchor.b);
      if(!a||!b)return null;
      const order=graph.bonds.find(e=>e.a===a.id&&e.b===b.id||e.a===b.id&&e.b===a.id)?.order||1;
      const len=Math.hypot(b.x-a.x,b.y-a.y)||1, offset=order===2?3.2:0;
      return {x:(a.x+b.x)/2-(b.y-a.y)*offset/len,y:(a.y+b.y)/2+(b.x-a.x)*offset/len};
    }
    const a=graph.atoms.find(a=>a.id===anchor.id);if(!a)return null;
    if(anchor.kind==='charge'||anchor.kind==='dipole')return decorationPosition(graph,a,anchor.kind,forceLabels);
    if(anchor.kind==='pair') {const angle=(a.pairs?.[anchor.index||0]??-90)*Math.PI/180,radius=forceLabels?32:pairRadius;return{x:a.x+radius*Math.cos(angle),y:a.y+radius*Math.sin(angle)};}
    return {x:a.x,y:a.y};
  }
  function curve(graph,ar,rawEnd) {
    const a=position(graph,ar.from),b=rawEnd||position(graph,ar.to);if(!a||!b)return null;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1, bend=ar.bend??50;
    const control={x:(a.x+b.x)/2-dy/len*bend,y:(a.y+b.y)/2+dx/len*bend};
    const trim=rawEnd?0:ar.to.kind==='atom'?18:0;
    const tangent=Math.hypot(b.x-control.x,b.y-control.y)||1;
    const end={x:b.x-(b.x-control.x)*trim/tangent,y:b.y-(b.y-control.y)*trim/tangent};
    return {path:`M${a.x} ${a.y} Q${control.x} ${control.y} ${end.x} ${end.y}`,mid:{x:(a.x+2*control.x+end.x)/4,y:(a.y+2*control.y+end.y)/4},a,b};
  }
  function dragArrow(graph,hit,start,end) {
    const ar=graph.arrows.find(ar=>ar.id===hit.id),c=curve(graph,ar);
    const dx=c.b.x-c.a.x,dy=c.b.y-c.a.y,len=Math.hypot(dx,dy)||1;
    ar.bend=Math.max(-180,Math.min(180,(ar.bend??50)+2*((end.x-start.x)*-dy+(end.y-start.y)*dx)/len));
  }
  function render(graph, destination) {
    const group=destination||$('mechanismAnnotations');group.replaceChildren();
    if(!active)return;
    for(const a of graph.atoms) {
      if(a.charge) {
        const p=position(graph,{kind:'charge',id:a.id});
        group.append(svg('text',{x:p.x,y:p.y,class:'formal-charge','text-anchor':'middle','dominant-baseline':'central','data-anchor':JSON.stringify({kind:'charge',id:a.id}),tabindex:0,role:'button','aria-label':`${a.charge>0?'Positive':'Negative'} charge on atom ${a.id}`},a.charge>0?'+':'−'));
      }
      if(a.dipole){const dp=position(graph,{kind:'dipole',id:a.id});group.append(svg('text',{x:dp.x,y:dp.y,class:'dipole','text-anchor':'middle','dominant-baseline':'central','data-anchor':JSON.stringify({kind:'dipole',id:a.id}),tabindex:0,role:'button','aria-label':`Partial ${a.dipole>0?'positive':'negative'} charge on atom ${a.id}`},a.dipole>0?'δ+':'δ−'));}
      (a.pairs||[]).forEach((angle,index)=>{
        const anchor={kind:'pair',id:a.id,index},p=position(graph,anchor),r=angle*Math.PI/180;
        const g=svg('g',{'data-anchor':JSON.stringify(anchor),class:'lone-pair',tabindex:0,role:'button','aria-label':`Lone pair ${index+1} on atom ${a.id}`});
        g.append(svg('circle',{cx:p.x,cy:p.y,r:12,fill:'transparent'}));
        [-1,1].forEach(sign=>g.append(svg('circle',{cx:p.x-sign*4*Math.sin(r),cy:p.y+sign*4*Math.cos(r),r:2.5,fill:'#55f6ff','pointer-events':'none'})));group.append(g);
      });
    }
    for(const ar of graph.arrows||[]) {
      const c=curve(graph,ar);if(!c)continue;
      const g=svg('g',{'data-arrow':ar.id,class:'electron-arrow','pointer-events':'auto',tabindex:0,role:'button','aria-label':`Curly arrow ${ar.id}. Drag to bend; use Erase or Delete to remove.`});
      g.append(svg('path',{d:c.path,stroke:'transparent','stroke-width':18,fill:'none'}));
      g.append(svg('path',{d:c.path,stroke:'#ffde59','stroke-width':2.3,fill:'none','marker-end':'url(#electronHead)','pointer-events':'none'}));
      group.prepend(g);
    }
    if(!destination)refreshPreviews();
  }
  const canvasWrap=canvas.parentElement, drawingCard=canvasWrap.parentElement;
  const board=document.createElement('div');board.id='mechanismBoard';board.hidden=true;drawingCard.insertBefore(board,canvasWrap);
  function updateBoard() {
    if(!active){drawingCard.append(canvasWrap);board.hidden=true;board.replaceChildren();return;}
    board.hidden=false;
    const parts=[];
    q().phases.forEach((p,i)=>{
      if(i){const arrow=document.createElement('div');arrow.className='stage-transition';arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 64 40"><path d="M2 13H38V2L62 20 38 38V27H2Z"/></svg>';parts.push(arrow);}
      const box=document.createElement('section');box.className='stage-box';box.dataset.stage=i;box.classList.toggle('active-stage',i===pi);
      const heading=document.createElement('button');heading.className='stage-heading';heading.setAttribute('aria-pressed',String(i===pi));heading.textContent=`${i+1}. ${p.label}`;heading.addEventListener('click',()=>{switchPhase(i);canvas.focus();});box.append(heading);
      if(i===pi){box.append(canvasWrap);canvas.setAttribute('aria-label',`${p.label} drawing area`);}
      else {const preview=document.createElement('button');preview.className='stage-select';preview.setAttribute('aria-label',`Edit ${p.label}`);preview.append(editor.depiction(drafts[qi][i].graph));preview.addEventListener('click',()=>{switchPhase(i);canvas.focus();});box.append(preview);}
      parts.push(box);
    });
    board.replaceChildren(...parts);editor.redraw();
  }
  function refreshPreviews() {
    if(!active)return;
    board.querySelectorAll('.stage-select').forEach(button=>{const i=Number(button.closest('[data-stage]').dataset.stage);if(drafts[qi][i])button.replaceChildren(editor.depiction(drafts[qi][i].graph));});
  }
  function resetTool() {tool=null;source=null;document.querySelectorAll('[data-annotation]').forEach(b=>b.setAttribute('aria-pressed','false'));}
  function cancel() {
    if(gesture && canvas.hasPointerCapture(gesture.pointerId))canvas.releasePointerCapture(gesture.pointerId);
    gesture=null;source=null;$('preview').replaceChildren();if(active)render(editor.getGraph());
  }
  function setTool(next) {
    cancel();editor.annotationsMode();tool=next;
    document.querySelectorAll('[data-annotation]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.annotation===tool)));
    say(tool==='arrow'?'Drag from a lone pair, negative charge or bond to an atom. Or select the source and destination with two taps / Enter.':tool==='pair'?'Tap an atom for automatic lone-pair placement, or drag from it to choose a position. Drag existing dots to reposition them.':'Choose the atom or annotation to edit.');
    render(editor.getGraph());
  }
  function save() {if(active)drafts[qi][pi]=editor.exportState();}
  function updateQuestion() {
    document.querySelector('.question-row .eyebrow').textContent='DRAW THE MECHANISM';
    QuestionReview.mount($('question').closest('.question-row').parentElement,reviewBank.id(q()),loadReview);
    $('question').textContent=q().name;
    $('questionNumber').innerHTML=`${String(qi+1).padStart(2,'0')} <span>/ 05</span>`;
    $('questionNumber').setAttribute('aria-label',`Mechanism ${qi+1} of 5`);
    document.querySelector('.instruction').textContent=`${q().prompt} ${q().conditions} OCR ${q().spec}.`;
    $('mechanismConditions').textContent=`${q().conditions} OCR ${q().spec}.`;
    $('phaseInstruction').textContent=phase().instruction;
    $('phaseTabs').replaceChildren(...q().phases.map((p,i)=>{const b=document.createElement('button');b.textContent=`${i+1}. ${p.label}`;b.setAttribute('aria-pressed',String(i===pi));b.addEventListener('click',()=>switchPhase(i));return b;}));
    $('check').textContent='Check whole mechanism';
    $('next').textContent=qi===4?'Start again →':'Next mechanism →';
    $('showAnswer').textContent='Show worked mechanism';
    $('afterCheck').hidden=!reviewed;
    updateBoard();
  }
  function switchPhase(i) {cancel();save();pi=i;editor.importState(drafts[qi][pi]);updateQuestion();}
  function switchQuestion(i) {cancel();save();qi=i;pi=0;reviewed=false;editor.importState(drafts[qi][pi]);updateQuestion();}
  function switchMode(enabled) {
    if(enabled===active)return;
    cancel();resetTool();
    if(enabled){moleculeState=editor.exportState();moleculeView=document.querySelector('[data-view][aria-pressed="true"]').dataset.view;}else save();
    active=enabled;
    $('moleculesMode').setAttribute('aria-pressed',String(!active));$('mechanismsMode').setAttribute('aria-pressed',String(active));
    $('mechanismSetup').hidden=!active;$('mechanismTools').hidden=!active;
    document.querySelectorAll('.mechanism-only').forEach(el=>el.hidden=!active);
    $('mechanismResults').hidden=true;$('mechanismAnswer').hidden=true;
    document.body.classList.toggle('mechanism-mode',active);
    // Return to the carbon drawing tool.
    document.querySelector('[data-element="C"]').click();
    editor.importState(active?drafts[qi][pi]:moleculeState||blank());
    document.querySelector(`[data-view="${active?'skeletal':moleculeView}"]`).click();
    if(active)updateQuestion();else {updateBoard();editor.refreshQuestion();document.querySelector('.question-row .eyebrow').textContent='NAME TO STRUCTURE';document.querySelector('.instruction').textContent='Tap to place an atom, or drag to draw a bond. Choose Chain to draw several carbons.';$('check').textContent='Check answer';$('showAnswer').textContent='Show answer';}
  }
  function edit(target,point,action=tool) {
    if(!target)return;
    const graph=editor.getGraph(),a=graph.atoms.find(a=>a.id===target.id);
    if(action==='remove') {
      if(target.kind==='arrow')graph.arrows=(graph.arrows||[]).filter(ar=>ar.id!==target.id);
      else if(target.kind==='pair'&&a) {a.pairs.splice(target.index||0,1);graph.arrows=(graph.arrows||[]).filter(ar=>!(ar.from.kind==='pair'&&ar.from.id===a.id));}
      else if(target.kind==='charge'&&a){delete a.charge;delete a.chargeAngle;delete a.h;graph.arrows=(graph.arrows||[]).filter(ar=>!(ar.from.kind==='charge'&&ar.from.id===a.id));}
      else if(target.kind==='dipole'&&a){delete a.dipole;delete a.dipoleAngle;}
      else say('Choose a charge, lone pair, dipole or curly arrow to remove.');
    } else if(a) {
      if(chargeTools[action])applyCharge(graph,a.id,action);
      if(action==='pair') {
        a.pairs=a.pairs||[];
        if(a.pairs.length>=4){say('Up to four lone pairs can be displayed on an atom.');return;}
        a.pairs.push(lonePairAngle(graph,a));
      }
    }
    editor.setGraph(graph);
  }
  function addArrow(from,to) {
    const graph=editor.getGraph();
    if(!['bond','pair','charge'].includes(from?.kind)||!['atom','bond'].includes(to?.kind)) {say('Start at an electron pair or bond, and finish at an atom or bond.');return;}
    if(!marking.anchorExists(graph,from)||!marking.anchorExists(graph,to))return;
    graph.arrows=graph.arrows||[];
    if(graph.arrows.length>=12){say('This stage holds up to twelve curly arrows.');return;}
    const id=Math.max(0,...graph.arrows.map(ar=>ar.id))+1;
    graph.arrows.push({id,from,to,bend:55});editor.setGraph(graph);say('Curly arrow added. Drag the curve to adjust its bend.');
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active||!e.isPrimary||e.button!==0)return;
    const hit=target(e.target),start=local(e);
    const annotation=hit&&['pair','arrow','charge','dipole'].includes(hit.kind);
    const chargeDrag=['charge','dipole'].includes(hit?.kind)&&tool!=='arrow'&&$('erase').getAttribute('aria-pressed')!=='true';
    const action=hit?.kind==='arrow'?($('erase').getAttribute('aria-pressed')==='true'?'remove':'move'):chargeDrag?'move':tool==='pair'&&hit?.kind==='pair'?'move':tool||(annotation&&$('erase').getAttribute('aria-pressed')==='true'?'remove':(!tool&&['pair','arrow'].includes(hit?.kind)||e.altKey&&hit?.kind==='atom'?'move':null));
    if(!action)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(tool==='arrow' && source && hit && action!=='move') {addArrow(source,hit);source=null;return;}
    gesture={action,clickAction:chargeDrag?tool:null,pointerId:e.pointerId,hit,start,end:start,graph:editor.getGraph()};
    canvas.setPointerCapture(e.pointerId);
    if(chargeTools[action]&&hit?.kind==='atom'){const draft=core.clone(gesture.graph);applyCharge(draft,hit.id,action);render(draft);}
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!active||!gesture||gesture.pointerId!==e.pointerId)return;
    e.preventDefault();e.stopImmediatePropagation();gesture.end=local(e);
    const preview=$('preview');preview.replaceChildren();
    if(gesture.action==='arrow' && ['pair','charge','bond'].includes(gesture.hit?.kind)) {
      const c=curve(gesture.graph,{from:gesture.hit,bend:55},gesture.end);
      if(c)preview.append(svg('path',{d:c.path,stroke:'#ffde59','stroke-width':2,fill:'none','marker-end':'url(#electronHead)'}));
    } else if(chargeTools[gesture.action]&&gesture.hit?.kind==='atom'){
      const draft=core.clone(gesture.graph),moved=Math.hypot(gesture.end.x-gesture.start.x,gesture.end.y-gesture.start.y)>=8;
      applyCharge(draft,gesture.hit.id,gesture.action,moved?gesture.end:undefined);render(draft);
    } else if(gesture.action==='move'&&gesture.hit?.kind==='arrow'){
      const draft=core.clone(gesture.graph);dragArrow(draft,gesture.hit,gesture.start,gesture.end);render(draft);
    } else if(gesture.action==='move'&&['charge','dipole'].includes(gesture.hit?.kind)&&Math.hypot(gesture.end.x-gesture.start.x,gesture.end.y-gesture.start.y)>=8){
      const draft=core.clone(gesture.graph);chargeAtPointer(draft,gesture.hit,gesture.end);render(draft);
    } else if((gesture.action==='move'&&gesture.hit?.kind==='pair'||gesture.action==='pair'&&gesture.hit?.kind==='atom')&&Math.hypot(gesture.end.x-gesture.start.x,gesture.end.y-gesture.start.y)>=8){
      const draft=core.clone(gesture.graph);pairAtPointer(draft,gesture.hit,gesture.end,gesture.action==='pair');render(draft);
    } else if(gesture.action==='move')preview.append(svg('circle',{cx:gesture.end.x,cy:gesture.end.y,r:12,fill:'none',stroke:'#55f6ff','stroke-dasharray':'3 3'}));
  },true);
  canvas.addEventListener('pointerup',e=>{
    if(!active||!gesture||gesture.pointerId!==e.pointerId)return;
    e.preventDefault();e.stopImmediatePropagation();
    const g=gesture,end=local(e),hit=target(document.elementFromPoint(e.clientX,e.clientY));
    const rect=canvas.getBoundingClientRect();cancel();
    if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
    if(g.action==='arrow') {
      if(Math.hypot(end.x-g.start.x,end.y-g.start.y)<8 && ['pair','charge','bond'].includes(g.hit?.kind)){source=g.hit;say('Electron source selected. Tap the receiving atom or bond.');}
      else if(g.hit&&hit)addArrow(g.hit,hit);
    } else if(chargeTools[g.action]&&g.hit?.kind==='atom'){
      const draft=g.graph,moved=Math.hypot(end.x-g.start.x,end.y-g.start.y)>=8;
      applyCharge(draft,g.hit.id,g.action,moved?end:undefined);editor.setGraph(draft);
    } else if(g.action==='pair'&&g.hit?.kind==='atom'&&Math.hypot(end.x-g.start.x,end.y-g.start.y)>=8){
      const draft=g.graph;pairAtPointer(draft,g.hit,end,true);editor.setGraph(draft);say('Lone pair placed. Drag the dots to adjust its position.');
    } else if(g.action==='move'&&g.hit) {
      if(Math.hypot(end.x-g.start.x,end.y-g.start.y)<8){if(g.clickAction)edit(g.hit,end,g.clickAction);return;}
      const draft=g.graph,a=draft.atoms.find(a=>a.id===g.hit.id);
      if(g.hit.kind==='atom'&&a){a.x=end.x;a.y=end.y;}
      else if(g.hit.kind==='pair'&&a)pairAtPointer(draft,g.hit,end);
      else if(['charge','dipole'].includes(g.hit.kind)&&a)chargeAtPointer(draft,g.hit,end);
      else if(g.hit.kind==='arrow') {
        dragArrow(draft,g.hit,g.start,end);
      }
      editor.setGraph(draft);
    } else edit(g.hit,end,g.action);
  },true);
  canvas.addEventListener('pointercancel',cancel,true);
  document.addEventListener('keydown',e=>{if(active&&gesture&&e.key==='Escape'){cancel();e.preventDefault();e.stopImmediatePropagation();}},true);
  canvas.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Escape'){cancel();e.preventDefault();e.stopImmediatePropagation();return;}
    const hit=target(e.target);
    if(['Delete','Backspace'].includes(e.key)&&hit&&['pair','arrow','charge','dipole'].includes(hit.kind)){e.preventDefault();e.stopImmediatePropagation();edit(hit,null,'remove');return;}
    if(tool&&['Enter',' '].includes(e.key)&&hit) {
      e.preventDefault();e.stopImmediatePropagation();
      if(tool==='arrow') {if(source){addArrow(source,hit);source=null;}else if(['bond','pair','charge'].includes(hit.kind)){source=hit;say('Source selected. Tab to the destination and press Enter.');}}
      else if(!(tool==='pair'&&hit.kind==='pair'))edit(hit);
    }
    if(hit&&(tool!=='arrow'&&['charge','dipole'].includes(hit.kind)||(!tool||tool==='pair')&&hit.kind==='pair'||!tool&&(hit.kind==='arrow'||e.altKey&&hit.kind==='atom'))&&e.key.startsWith('Arrow')) {
      e.preventDefault();e.stopImmediatePropagation();const g=editor.getGraph(),a=g.atoms.find(a=>a.id===hit.id),delta=['ArrowLeft','ArrowUp'].includes(e.key)?-15:15;
      if(hit.kind==='atom'&&a)a[e.key==='ArrowLeft'||e.key==='ArrowRight'?'x':'y']+=delta;
      if(hit.kind==='pair'&&a)a.pairs[hit.index||0]+=delta;
      if(['charge','dipole'].includes(hit.kind)&&a){const p=position(g,hit);a[`${hit.kind}Angle`]=Math.atan2(p.y-a.y,p.x-a.x)*180/Math.PI+delta;}
      if(hit.kind==='arrow')g.arrows.find(ar=>ar.id===hit.id).bend+=delta;
      editor.setGraph(g);
      const el=hit.kind==='atom'?canvas.querySelector(`[data-atom="${hit.id}"]`):hit.kind==='arrow'?canvas.querySelector(`[data-arrow="${hit.id}"]`):[...canvas.querySelectorAll('[data-anchor]')].find(el=>el.dataset.anchor===JSON.stringify(hit));el?.focus();
    }
  },true);
  function check() {
    cancel();save();reviewed=true;
    const result=marking.grade(drafts[qi].map(s=>s.graph),q());
    $('feedback').textContent=`${result.correct?'Correct mechanism.':'Keep refining your mechanism.'} ${result.score} / ${result.total} practice marks.`;
    $('feedback').dataset.kind=result.correct?'correct':'incorrect';
    const panel=$('mechanismResults');panel.replaceChildren();panel.hidden=false;
    result.phases.forEach((p,i)=>{
      const section=document.createElement('section'),title=document.createElement('h3');title.textContent=`${q().phases[i].label}: ${p.score}/${p.total}`;section.append(title);
      const message=document.createElement('p');message.textContent=p.message;section.append(message);
      const ul=document.createElement('ul');p.items.filter(item=>item.label!=='No extra or invalid annotations'||!item.correct).forEach(item=>{const li=document.createElement('li');li.textContent=`${item.correct?'✓':'✗'} ${item.label}`;li.className=item.correct?'mark-earned':'mark-missing';ul.append(li);});section.append(ul);panel.append(section);
    });
    $('afterCheck').hidden=false;$('showAnswer').textContent='Show worked mechanism';$('showAnswer').setAttribute('aria-expanded','false');$('mechanismAnswer').hidden=true;
  }
  function teacherDiagram(phase,index) {
    const graph=phase.graph, pad=85;
    const left=Math.min(...graph.atoms.map(a=>a.x))-pad, top=Math.min(...graph.atoms.map(a=>a.y))-pad;
    const width=Math.max(...graph.atoms.map(a=>a.x))-left+pad, height=Math.max(...graph.atoms.map(a=>a.y))-top+pad;
    const picture=svg('svg',{class:'teacher-mechanism',viewBox:`${left} ${top} ${width} ${height}`,role:'img','aria-label':`${phase.label}: complete reference diagram with formal charges, relevant dipoles and curly arrows.`});
    const defs=svg('defs'),marker=svg('marker',{id:`teacherHead${index}`,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'});
    marker.append(svg('path',{d:'M0 0 10 5 0 10 3 5Z',fill:'#745113'}));defs.append(marker);picture.append(defs);
    const labels=new Map(), measure=document.createElement('canvas').getContext('2d');
    for(const a of graph.atoms) {
      const h=core.hydrogens(graph,a), neighbours=core.neighbours(graph,a.id);
      const left=neighbours.reduce((sum,n)=>sum+graph.atoms.find(b=>b.id===n.id).x-a.x,0)>8 || ['O','Cl','F'].includes(a.element)&&!neighbours.length;
      const chunks=left?[{text:h?'H':''},{text:h>1?String(h):'',sub:true},{text:a.element}]:[{text:a.element+(h?'H':'')},{text:h>1?String(h):'',sub:true}];
      let width=0;chunks.forEach(c=>{measure.font=`700 ${c.sub?14:23}px Comfortaa`;width+=measure.measureText(c.text).width;});
      measure.font='700 23px Comfortaa';const ew=measure.measureText(a.element).width;
      labels.set(a.id,{h,chunks,width,x:left?a.x+ew/2-width:a.x-ew/2});
    }
    for(const b of graph.bonds) {
      const a=graph.atoms.find(a=>a.id===b.a),z=graph.atoms.find(a=>a.id===b.b),dx=z.x-a.x,dy=z.y-a.y,len=Math.hypot(dx,dy)||1;
      const offsets=b.order===3?[-5,0,5]:b.order===2?[-3,3]:[0];
      offsets.forEach(offset=>picture.append(svg('line',{x1:a.x-dy/len*offset,y1:a.y+dx/len*offset,x2:z.x-dy/len*offset,y2:z.y+dx/len*offset,stroke:'#202536','stroke-width':2.2})));
    }
    for(const a of graph.atoms) {
      const label=labels.get(a.id);
      picture.append(svg('rect',{x:label.x-3,y:a.y-15,width:label.width+6,height:31,fill:'white'}));
      const text=svg('text',{x:label.x,y:a.y,'text-anchor':'start','dominant-baseline':'central',fill:'#202536','font-family':'Comfortaa','font-size':23,'font-weight':700});
      label.chunks.filter(c=>c.text).forEach(c=>text.append(svg('tspan',c.sub?{'font-size':14,'baseline-shift':'sub'}:{},c.text)));picture.append(text);
      if(a.charge){const p=position(graph,{kind:'charge',id:a.id},true);picture.append(svg('text',{x:p.x,y:p.y,'text-anchor':'middle','dominant-baseline':'central',class:'formal-charge'},a.charge>0?'+':'−'));}
      if(a.dipole){const p=position(graph,{kind:'dipole',id:a.id},true);picture.append(svg('text',{x:p.x,y:p.y,'text-anchor':'middle','dominant-baseline':'central',class:'dipole'},a.dipole>0?'δ+':'δ−'));}
      (a.pairs||[]).forEach((angle,index)=>{const p=position(graph,{kind:'pair',id:a.id,index},true),r=angle*Math.PI/180;[-1,1].forEach(sign=>picture.append(svg('circle',{cx:p.x-sign*4*Math.sin(r),cy:p.y+sign*4*Math.cos(r),r:2.5,fill:'#202536'})));});
    }
    for(const ar of graph.arrows||[]) {const c=curve(graph,ar);if(c)picture.append(svg('path',{d:c.path,fill:'none',stroke:'#745113','stroke-width':2.3,'marker-end':`url(#teacherHead${index})`}));}
    return picture;
  }
  function showAnswer() {
    const panel=$('mechanismAnswer');panel.hidden=!panel.hidden;$('showAnswer').textContent=panel.hidden?'Show worked mechanism':'Hide worked mechanism';$('showAnswer').setAttribute('aria-expanded',String(!panel.hidden));
    if(panel.hidden)return;
    panel.replaceChildren();
    const intro=document.createElement('p');intro.textContent='Worked mechanism. Each stage shows the electron-flow arrows and required charges. Unused lone pairs may be omitted. These are practice marks, not an official OCR mark scheme.';panel.append(intro);
    q().phases.forEach((p,i)=>{
      const section=document.createElement('section'),h=document.createElement('h3');h.textContent=`${i+1}. ${p.label}`;section.append(h);
      section.append(teacherDiagram(p,i));
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Independently checked structures (RDKit)';details.append(summary);
      const img=document.createElement('img');img.src=p.structureImage;img.alt=`${p.label} reference structures. ${p.explanation}`;details.append(img);section.append(details);
      const ol=document.createElement('ol');p.arrows.forEach(ar=>{const li=document.createElement('li');li.textContent=ar.description;ol.append(li);});section.append(ol);
      if(Object.keys(p.dipoles).length){const note=document.createElement('p');note.textContent='Include the dipoles specified in this stage’s instruction (δ+ on the electron-poor end and δ− on the electron-rich end).';section.append(note);}
      const explanation=document.createElement('p');explanation.textContent=p.explanation;section.append(explanation);panel.append(section);
    });
  }
  document.querySelectorAll('[data-annotation]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.annotation)));
  $('previousQuestion').addEventListener('click',()=>switchQuestion((qi+questions.length-1)%questions.length));
  $('nextQuestion').addEventListener('click',()=>switchQuestion((qi+1)%questions.length));
  $('moleculesMode').addEventListener('click',()=>switchMode(false));$('mechanismsMode').addEventListener('click',()=>switchMode(true));
  editor.onChange(()=>{$('mechanismResults').hidden=true;$('mechanismAnswer').hidden=true;});
  rootExpose();
  function rootExpose(){window.MechanismUI={get active(){return active;},render,resetTool,check,showAnswer,loadReview,next:()=>switchQuestion((qi+1)%questions.length),switchMode,switchQuestion,switchPhase,getDrafts:()=>{save();return core.clone(drafts[qi].map(s=>s.graph));},getState:()=>({question:qi,phase:pi,tool})};}
QuestionReview.requested(loadReview);
})();
