(async function () {
  'use strict';
  const B=globalThis.TestModeBridge;
  const T=globalThis.ActiveQuestionTime;
  // The bridge handshake must complete before the question is chosen.  In a
  // normal standalone visit this resolves immediately with null.
  const test=(await B?.connect())||null;
  const teacher=!test&&globalThis.QuestionReview?.isTeacher?.();
  const $=id=>document.getElementById(id),R=DotCrossRenderer,C=DotCrossCore,questions=DotCrossData.questions;
  const progressModel=globalThis.ALevelMastery;
  const reviewBank=QuestionReview.bank('DAC',questions);
  const copy=x=>JSON.parse(JSON.stringify(x)),empty=()=>({atoms:[],electrons:[],groups:[]});
  const svg=$('canvas'),drafts=new Map();
  // Keep the palette in step with the bank without introducing per-question
  // atom-count hints (particularly in names-only ionic practice).
  const elementNames={Li:'Lithium',K:'Potassium',Al:'Aluminium',Br:'Bromine',I:'Iodine',S:'Sulfur',Si:'Silicon',P:'Phosphorus'};
  for(const element of new Set(questions.flatMap(q=>q.reference.atoms.map(a=>a.element))))if(!document.querySelector(`[data-element="${element}"]`)){
    const button=document.createElement('button');button.type='button';button.className='element-tool';button.dataset.element=element;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`${element} atom`);button.title=`${elementNames[element]||element} (${element})`;button.textContent=element;document.querySelector('.element-palette').append(button);
  }
  let state=empty(),selected=[],history=[],future=[],question=null,tool='atom',selectedElement='H',pendingCharge=1,serial=0,checked=false;
  let assessment=null,feedbackResult=null,assessmentEmitted=false;
  let timing;
  let attemptId=progressModel?.attemptId?.()||crypto.randomUUID();
  let cursor={x:400,y:325},showCursor=false,drag=null,hover=null,chargePreview=null,circles=true,suppressClick=false;
  function id(prefix){return prefix+(++serial);}
  function say(message){$('status').textContent=message;}
  function bounds(n,min,max){return Math.max(min,Math.min(max,n));}
  // Match the entire SVG to its visible box: no letterboxing or hidden inset limits.
  function view(){const box=svg.getBoundingClientRect(),w=Math.max(560,box.width*.95),h=w*box.height/Math.max(1,box.width);svg.setAttribute('viewBox',`${500-w/2} ${325-h/2} ${w} ${h}`);}
  function limits(){const b=svg.viewBox.baseVal;return{left:b.x,right:b.x+b.width,top:b.y,bottom:b.y+b.height};}
  function clamp(p){const b=limits();return{x:bounds(p.x,b.left,b.right),y:bounds(p.y,b.top,b.bottom)};}
  function snapshot(){return copy(state);}
  function clearFeedback(){hover=null;chargePreview=null;checked=false;feedbackResult=null;$('showAnswer').disabled=!teacher;$('showAnswer').textContent='Show answer';$('feedback').replaceChildren();$('answer').close();syncTestControls();}
  function scoreFor(result){
    if(!state.atoms.length&&!state.electrons.length&&!state.groups.length)return 0;
    if(result.correct)return 1;
    // A passing criterion is only partial credit when it represents work the
    // learner could actually have shown.  In particular, empty shared-bond,
    // neutral-group and electron-origin checks must not award credit merely
    // because those collections are absent.
    const substantive=result.criteria.filter(c=>{
      if(!c.passed||c.id==='state-valid'||c.id==='shared-electrons')return false;
      if((c.id==='lone-electrons'||c.id==='electron-origins')&&!state.electrons.length)return false;
      if(c.id==='groups-and-charges'&&question.category==='covalent'&&!state.groups.length)return false;
      return true;
    });
    return substantive.some(c=>c.passed)?0.5:0;
  }
  function feedbackFor(result){
    const heading=document.createElement('h3');heading.className=`feedback-title ${result.correct?'pass':'fail'}`;heading.textContent=result.correct?'Correct diagram':'Keep building';
    const list=document.createElement('ul');list.className='feedback-list';result.criteria.filter(c=>!(c.id==='state-valid'&&c.passed)).forEach(c=>{const li=document.createElement('li');li.className=c.passed?'pass':'fail';li.textContent=`${c.passed?'✓':'○'} ${c.message||c.label}`;list.appendChild(li);});$('feedback').replaceChildren(heading,list);
  }
  function syncTestControls(){if($('next'))$('next').disabled=!teacher&&!assessment;}
  function snapshotForBridge(){return question?{version:2,questionId:question.id,category,grade,diagram:snapshot(),serial,history:copy(history),future:copy(future),circles,checked,assessment:copy(assessment),feedback:copy(feedbackResult),remaining:copy(remaining),timing}:null;}
  function saveTest(){if(test&&question)return B.save(snapshotForBridge());}
  function refreshMastery(){if(test||teacher||!progressModel)return;try{progressModel.refresh();}catch(_){}}
  function recordMastery(){
    if(test||teacher||!assessment||assessment.recorded||!progressModel||!standaloneLeaf||!masteryGrades.includes(grade))return;
    const leafId=standaloneLeaf;
    const result={id:attemptId,leafId,level:grade,score:assessment.score,completedAt:assessment.completedAt,timing:T.result(timing)};
    try{progressModel.record(result);assessment.recorded=true;refreshMastery();}
    catch(_){assessment.recorded=true;}
  }
  async function emitAssessment(){if(!test||!assessment||assessmentEmitted)return;assessmentEmitted=true;await B.result({score:assessment.score,independent:true,completedAt:assessment.completedAt,evidence:{questionId:question.id,category:question.category,grade,score:assessment.score,criteria:copy(assessment.criteria),completedAt:assessment.completedAt,timing:T.result(timing)}});}
  function organise(){const regions=new Map();for(const e of state.electrons){const a=e.anchor,k=a.kind==='atom'?`a:${a.atomId}`:`b:${[a.a,a.b].sort().join(':')}`;if(!regions.has(k))regions.set(k,[]);regions.get(k).push(e);}for(const es of regions.values()){
      es.sort((a,b)=>a.anchor.slot-b.anchor.slot);
      let ordered=es;
      if(es[0].anchor.kind==='bond'){
        const queues=new Map();for(const e of es){if(!queues.has(e.symbol))queues.set(e.symbol,[]);queues.get(e.symbol).push(e);}
        const symbols=[...queues.keys()];ordered=[];
        while(ordered.length<es.length)for(const symbol of symbols){const next=queues.get(symbol).shift();if(next)ordered.push(next);}
      }
      ordered.forEach((e,i)=>e.anchor.slot=i);
    }}
  function commit(before){organise();if(JSON.stringify(before)===JSON.stringify(state))return;history.push(before);if(history.length>100)history.shift();future=[];clearFeedback();render();saveTest();save();}
  function edit(fn){const before=snapshot();fn();commit(before);}
  function render(){
    selected=selected.filter(id=>state.atoms.some(a=>a.id===id));
    view();R.draw(svg,state,{circles,selected,tool:drag?.kind==='electron'?drag.symbol:tool,drag,hover,chargePreview,cursor:showCursor?cursor:null});
    $('undo').disabled=!history.length;$('redo').disabled=!future.length;$('clear').disabled=!state.atoms.length;
    $('circles').setAttribute('aria-pressed',String(circles));
    $('circles').textContent=circles?'Hide circles':'Show circles';
    $('circles').title=$('circles').textContent;
  }
  function setTool(next){tool=next;selected=[];hover=null;chargePreview=null;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));document.querySelectorAll('[data-element]').forEach(b=>b.setAttribute('aria-pressed',String(tool==='atom'&&b.dataset.element===selectedElement)));document.querySelectorAll('[data-charge]').forEach(b=>b.setAttribute('aria-pressed',String(tool==='charge'&&Number(b.dataset.charge)===pendingCharge)));
    const help={atom:`Drag ${selectedElement} here, or tap to place it. Drag diagram objects to move them.`,dot:'Tap or drop a dot on a shell or shared region. Electrons arrange automatically.',cross:'Tap or drop a cross on a shell or shared region. Electrons arrange automatically.',triangle:'Tap or drop a triangle on a shell or shared region. Use it to distinguish a third electron source.',charge:`Apply ${R.chargeText(pendingCharge)}: an ion gains brackets; a covalent atom symbol gets a local charge. Drop on the outer shell to bracket a connected ion.`,erase:'Tap an object to erase it; dragging still moves it.'};say(help[tool]);render();}
  function at(event){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());return{x:p.x,y:p.y};}
  function snap(p,exclude=[],element=selectedElement){
    p=clamp(p);
    const box=limits(),movingGroup=state.groups.find(g=>g.bracket&&g.atomIds.some(id=>exclude.includes(id)));
    const others=state.atoms.filter(a=>!exclude.includes(a.id));
    const candidates=others.flatMap(a=>{
      const group=state.groups.find(g=>g.bracket&&g.atomIds.includes(a.id));
      if(movingGroup&&group&&movingGroup.id!==group.id)return [];
      const d=Math.hypot(p.x-a.x,p.y-a.y),bondLength=DotCrossData.bondDistance(element,a),snapRange=bondLength+60;
      if(d<35||d>snapRange)return [];
      const angle=Math.round(Math.atan2(p.y-a.y,p.x-a.x)/(Math.PI/6))*Math.PI/6;
      const target={x:a.x+bondLength*Math.cos(angle),y:a.y+bondLength*Math.sin(angle)};
      if(target.x<box.left||target.x>box.right||target.y<box.top||target.y>box.bottom)return [];
      if(others.some(other=>Math.hypot(target.x-other.x,target.y-other.y)<45))return [];
      return [{...target,d:Math.hypot(target.x-p.x,target.y-p.y)}];
    }).sort((a,b)=>a.d-b.d);
    return candidates.length?{x:candidates[0].x,y:candidates[0].y}:p;
  }
  function addAtom(p,element=selectedElement){if(state.atoms.length>=30)return say('This canvas holds up to 30 atoms.');p=snap(p,[],element);if(state.atoms.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<45))return say('Leave space between atom labels.');edit(()=>state.atoms.push({id:id('a'),element,...p}));say(`${element} added.`);}
  function deleteAtoms(ids){edit(()=>{state.atoms=state.atoms.filter(a=>!ids.includes(a.id));state.electrons=state.electrons.filter(e=>e.anchor.kind==='atom'?!ids.includes(e.anchor.atomId):!ids.includes(e.anchor.a)&&!ids.includes(e.anchor.b));state.groups=state.groups.filter(g=>!g.atomIds.some(id=>ids.includes(id)));selected=[];});say('Atom and its attached electrons removed.');}
  const electronSymbols=['dot','cross','triangle'];
  const symbolName=symbol=>symbol[0].toUpperCase()+symbol.slice(1);
  function addElectron(anchor,symbol){if(!anchor)return say('Choose a shell or an overlapping shared region with room for another electron.');edit(()=>state.electrons.push({id:id('e'),symbol,anchor:copy(anchor)}));say(`${symbolName(symbol)} added to the ${anchor.kind==='bond'?'shared':'outer-shell'} region.`);}
  function freeIn(anchor,exclude){return R.freeAnchor(state,anchor,exclude);}
  function component(atomId){const ids=new Set([atomId]);let changed=true;while(changed){changed=false;for(const e of state.electrons){const a=e.anchor;if(a.kind==='bond'&&(ids.has(a.a)||ids.has(a.b))){for(const id of [a.a,a.b])if(!ids.has(id)){ids.add(id);changed=true;}}}}return [...ids];}
  function chargeDestination(p,target){
    const existing=state.groups.find(g=>g.id===target?.closest('[data-group]')?.dataset.group);
    if(existing)return{atomIds:[...existing.atomIds],bracket:existing.bracket!==false||component(existing.atomIds[0]).length===1};
    const explicit=target?.closest('[data-atom]')?.dataset.atom;
    const atom=state.atoms.find(a=>a.id===explicit)||state.atoms.map(a=>({...a,d:Math.hypot(p.x-a.x,p.y-a.y)})).sort((a,b)=>a.d-b.d).find(a=>a.d<=R.shellRadius(a)+12);
    if(atom){
      const ids=component(atom.id),local=ids.length>1&&Math.hypot(p.x-atom.x,p.y-atom.y)<=25;
      if(local)return{atomIds:[atom.id],bracket:false};
      return{atomIds:ids,bracket:true};
    }
    const group=state.groups.find(g=>{const box=R.groupBounds(state,g.atomIds);return box&&p.x>=box.x&&p.x<=box.right+28&&p.y>=box.y&&p.y<=box.bottom;});
    if(group)return{atomIds:[...group.atomIds],bracket:group.bracket};
    return null;
  }
  function chargeAt(p,charge,target){const destination=chargeDestination(p,target);chargePreview=null;if(!destination)return say('Drop on an ion, a covalent atom symbol, or the outer shell of a connected ion.');
    const same=g=>g.bracket===destination.bracket&&g.atomIds.length===destination.atomIds.length&&g.atomIds.every(id=>destination.atomIds.includes(id));
    edit(()=>{
      const existing=state.groups.find(same);
      if(existing)existing.charge=charge;
      else{
        // A whole-ion charge replaces earlier charge annotations on its members.
        if(destination.bracket)state.groups=state.groups.filter(g=>!g.atomIds.some(id=>destination.atomIds.includes(id)));
        state.groups.push({id:id('g'),atomIds:destination.atomIds,charge,bracket:destination.bracket});
      }
    });say(destination.bracket?'Ion charge and square brackets applied.':'Charge localised on the atom.');
  }
  function activate(event){
    const p=at(event),aid=event.target.closest('[data-atom]')?.dataset.atom,eid=event.target.closest('[data-electron]')?.dataset.electron,gid=event.target.closest('[data-group]')?.dataset.group;
    if(tool==='charge')return chargeAt(p,pendingCharge,event.target);
    if(tool==='erase'){if(eid)edit(()=>state.electrons=state.electrons.filter(e=>e.id!==eid));else if(aid)deleteAtoms([aid]);else if(gid)edit(()=>state.groups=state.groups.filter(g=>g.id!==gid));return;}
    if(electronSymbols.includes(tool)){
      // Repeated taps on a region keep adding, even where its electrons are drawn.
      const region=event.target.closest('[data-region]')?.dataset.region;
      const anchor=region?freeIn(JSON.parse(region)):eid?freeIn(state.electrons.find(e=>e.id===eid).anchor):R.regionAt(state,p);
      return addElectron(anchor,tool);
    }
    if(eid){edit(()=>{const e=state.electrons.find(e=>e.id===eid);e.symbol=electronSymbols[(electronSymbols.indexOf(e.symbol)+1)%electronSymbols.length];});return;}
    if(!aid&&!gid)addAtom(p);
  }
  function insideCanvas(event){const box=svg.getBoundingClientRect();return event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;}
  function release(d){if(d.capture.hasPointerCapture(d.pointerId))d.capture.releasePointerCapture(d.pointerId);}
  function startDrag(event,details,capture){if(event.button!==0||drag)return;suppressClick=false;drag={...details,pointerId:event.pointerId,start:at(event),client:{x:event.clientX,y:event.clientY},before:snapshot(),selection:[...selected],capture,moved:false,point:null,anchor:null};capture.setPointerCapture(event.pointerId);event.preventDefault();}
  function objectAt(target){const eid=target.closest('[data-electron]')?.dataset.electron;if(eid)return{kind:'electron',electronId:eid,symbol:state.electrons.find(e=>e.id===eid).symbol};const aid=target.closest('[data-atom]')?.dataset.atom;if(aid)return{kind:'atoms',atomId:aid,ids:[aid]};const gid=target.closest('[data-group]')?.dataset.group;if(gid){const g=state.groups.find(g=>g.id===gid);return{kind:'atoms',atomId:g.atomIds[0],ids:[...g.atomIds],groupId:gid};}return null;}
  svg.addEventListener('pointerdown',event=>{const details=objectAt(event.target)||{kind:'blank'};startDrag(event,{...details,clickTarget:event.target},svg);});
  document.addEventListener('pointermove',event=>{
    if(drag){if(event.pointerId!==drag.pointerId)return;if(Math.hypot(event.clientX-drag.client.x,event.clientY-drag.client.y)>4)drag.moved=true;if(!drag.moved)return;const p=at(event);drag.point=p;
      if(drag.kind==='blank')return;
      if(drag.kind==='electron'||drag.kind==='paletteSymbol'){drag.anchor=insideCanvas(event)?R.regionAt(drag.before,p,drag.electronId):null;render();return;}
      if(drag.kind==='palette'){if(insideCanvas(event))drag.point=snap(p,[],drag.element);render();return;}
      if(drag.kind==='paletteCharge'){chargePreview=insideCanvas(event)?chargeDestination(p,document.elementFromPoint(event.clientX,event.clientY)):null;if(chargePreview)chargePreview.charge=drag.charge;render();return;}
      const initial=drag.before.atoms.find(a=>a.id===drag.atomId),raw={x:initial.x+p.x-drag.start.x,y:initial.y+p.y-drag.start.y},dest=drag.groupId?clamp(raw):snap(raw,drag.ids,initial.element),b=limits(),moving=drag.before.atoms.filter(a=>drag.ids.includes(a.id));
      const dx=bounds(dest.x-initial.x,b.left-Math.min(...moving.map(a=>a.x)),b.right-Math.max(...moving.map(a=>a.x))),dy=bounds(dest.y-initial.y,b.top-Math.min(...moving.map(a=>a.y)),b.bottom-Math.max(...moving.map(a=>a.y)));
      state=copy(drag.before);state.atoms.forEach(a=>{if(drag.ids.includes(a.id)){a.x+=dx;a.y+=dy;}});render();return;
    }
    if(!svg.contains(event.target))return;
    if(tool==='charge'){const next=chargeDestination(at(event),event.target);if(next)next.charge=pendingCharge;if(JSON.stringify(next)!==JSON.stringify(chargePreview)){chargePreview=next;render();}return;}
    if(!electronSymbols.includes(tool))return;
    const next=R.regionAt(state,at(event));if(JSON.stringify(hover)!==JSON.stringify(next)){hover=next;render();}
  });
  document.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;const d=drag;drag=null;chargePreview=null;release(d);suppressClick=true;
    if(d.kind.startsWith('palette')){d.capture.dataset.dragged=d.moved?'true':'false';if(d.moved&&insideCanvas(event)){if(d.kind==='palette')addAtom(at(event),d.element);else if(d.kind==='paletteSymbol')addElectron(d.anchor,d.symbol);else chargeAt(at(event),d.charge,document.elementFromPoint(event.clientX,event.clientY));}render();return;}
    if(!d.moved){activate({target:d.clickTarget,clientX:event.clientX,clientY:event.clientY});render();return;}
    if(d.kind==='blank'){render();return;}
    if(!insideCanvas(event)){state=d.before;selected=d.selection;render();say('Move cancelled outside the canvas.');return;}
    if(d.kind==='electron'){if(!d.anchor){state=d.before;render();say('Electron returned: drop on a shell or shared region.');return;}state.electrons.find(e=>e.id===d.electronId).anchor=copy(d.anchor);}
    commit(d.before);render();say('Moved. Attached electrons and brackets follow their atoms.');
  });
  function cancelDrag(){if(drag){const d=drag;drag=null;chargePreview=null;release(d);state=d.before;selected=d.selection;suppressClick=true;if(d.kind.startsWith('palette'))d.capture.dataset.dragged='true';render();say('Move cancelled.');}}
  document.addEventListener('pointercancel',cancelDrag);
  svg.addEventListener('pointerleave',()=>{if(!drag&&(hover||chargePreview)){hover=null;chargePreview=null;render();}});
  svg.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}activate(event);});
  svg.addEventListener('keydown',event=>{
    const aid=event.target.closest('[data-atom]')?.dataset.atom,eid=event.target.closest('[data-electron]')?.dataset.electron,gid=event.target.closest('[data-group]')?.dataset.group;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(aid)deleteAtoms([aid]);else if(eid)edit(()=>state.electrons=state.electrons.filter(e=>e.id!==eid));else if(gid)edit(()=>state.groups=state.groups.filter(g=>g.id!==gid));return;}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();
      const atom=state.atoms.find(a=>a.id===aid),region=event.target.closest('[data-region]')?.dataset.region;
      if(electronSymbols.includes(tool)){addElectron(region?freeIn(JSON.parse(region)):atom?freeIn({kind:'atom',atomId:aid}):R.regionAt(state,cursor),tool);return;}
      if(tool==='charge'){chargeAt(atom||cursor,pendingCharge,event.target);return;}
      if(eid){edit(()=>{const e=state.electrons.find(e=>e.id===eid);e.symbol=electronSymbols[(electronSymbols.indexOf(e.symbol)+1)%electronSymbols.length];});return;}
      if(tool==='atom'&&!aid&&!gid){addAtom(cursor);cursor=clamp({x:cursor.x+DotCrossData.bondDistance(selectedElement,selectedElement),y:cursor.y});showCursor=true;render();}return;
    }
    const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];if(delta){event.preventDefault();if(aid){edit(()=>{const a=state.atoms.find(a=>a.id===aid);Object.assign(a,clamp({x:a.x+delta[0],y:a.y+delta[1]}));});}else{cursor=clamp({x:cursor.x+delta[0],y:cursor.y+delta[1]});showCursor=true;hover=electronSymbols.includes(tool)?R.regionAt(state,cursor):null;render();}}
  });
  function undo(){if(!history.length)return;future.push(snapshot());state=history.pop();selected=[];clearFeedback();render();saveTest();save();say('Last edit undone.');}
  function redo(){if(!future.length)return;history.push(snapshot());state=future.pop();selected=[];clearFeedback();render();saveTest();save();say('Edit restored.');}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelDrag();selected=[];render();}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();event.shiftKey?redo():undo();}});
  document.querySelectorAll('[data-tool]').forEach(button=>{button.addEventListener('click',()=>{if(button.dataset.dragged==='true'){button.dataset.dragged='false';return;}setTool(button.dataset.tool);});if(electronSymbols.includes(button.dataset.tool))button.addEventListener('pointerdown',event=>{button.dataset.dragged='false';setTool(button.dataset.tool);startDrag(event,{kind:'paletteSymbol',symbol:button.dataset.tool},button);});});
  document.querySelectorAll('[data-element]').forEach(button=>{button.addEventListener('pointerdown',event=>{button.dataset.dragged='false';selectedElement=button.dataset.element;setTool('atom');startDrag(event,{kind:'palette',element:selectedElement},button);});button.addEventListener('click',()=>{if(button.dataset.dragged==='true'){button.dataset.dragged='false';return;}selectedElement=button.dataset.element;setTool('atom');});});
  document.querySelectorAll('[data-charge]').forEach(button=>{button.addEventListener('pointerdown',event=>{button.dataset.dragged='false';pendingCharge=Number(button.dataset.charge);setTool('charge');startDrag(event,{kind:'paletteCharge',charge:pendingCharge},button);});button.addEventListener('click',()=>{if(button.dataset.dragged==='true'){button.dataset.dragged='false';return;}pendingCharge=Number(button.dataset.charge);setTool('charge');});});
  // Some touch browsers omit the next compatibility click after a captured
  // palette drag. Activate ordinary buttons from a genuine touch tap too,
  // suppressing only the duplicate native click (keyboard clicks still work).
  let buttonTouch=null;const touchClicks=new WeakMap();
  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button');
    if(event.pointerType==='touch'&&button&&!button.disabled&&!button.matches('[data-element],[data-charge],[data-tool="dot"],[data-tool="cross"],[data-tool="triangle"]'))buttonTouch={button,id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  document.addEventListener('pointerup',event=>{
    const touch=buttonTouch;if(!touch||event.pointerId!==touch.id)return;buttonTouch=null;
    const box=touch.button.getBoundingClientRect();
    if(!touch.button.disabled&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)<=8&&event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom){touchClicks.set(touch.button,performance.now());touch.button.click();}
  });
  document.addEventListener('pointercancel',()=>{buttonTouch=null;});
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(event.isTrusted&&event.detail>0&&button&&performance.now()-(touchClicks.get(button)??-Infinity)<700){event.preventDefault();event.stopImmediatePropagation();}},true);
  $('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
  $('clear').addEventListener('click',()=>{edit(()=>{state=empty();selected=[];});say('Canvas cleared. Undo restores your diagram.');});
  $('circles').addEventListener('click',()=>{circles=!circles;render();if($('answer').open)drawAnswer();save();saveTest();});
  new ResizeObserver(()=>render()).observe(svg);
  const params=new URLSearchParams(location.search);
  // Both historical leaf URLs now open the merged activity.  Category remains
  // an optional compatibility filter for direct links into the old banks.
  let category=['ionic','covalent'].includes(params.get('category'))?params.get('category'):'all';
  const requestedPractice=params.get('practice');
  let practice=requestedPractice==='mastery'?'mastery':'level';
  const allowedGrades=[1,2,3];
  let requestedGrade=Number(params.get('level')??params.get('grade')??1);
  let unsupportedGrade=!allowedGrades.includes(requestedGrade);
  let grade=unsupportedGrade?1:requestedGrade;
  if(test){
    category='all';
    requestedGrade=Number(test.level);
    grade=allowedGrades.includes(requestedGrade)?requestedGrade:1;
    unsupportedGrade=!allowedGrades.includes(requestedGrade);
  }
  let questionKey='',remaining=[],legacySaved=null;
  function scope(){return `${category}:${grade}`;}
  const standaloneLeaf='l6-t2-1-3';
  const masteryGrades=allowedGrades;
  function selectMasteryGrade(){
    if(!progressModel||!masteryGrades.length)return grade||1;
    try{progressModel.refresh();}catch(_){}
    const next=progressModel.nextLevel(standaloneLeaf);
    return masteryGrades.includes(next)?next:masteryGrades[masteryGrades.length-1];
  }
  if(!test&&practice==='mastery'){grade=selectMasteryGrade();}
  function hideFormula(){return false;}
  function displayFormula(q){const formula=q.displayFormula||q.formula;return formula.replace(/\d/g,digit=>'₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);}
  const questionCategory=q=>q.practiceCategory||q.category;
  function pool(){if(teacher)return questions.slice();const seen=new Set();return questions.filter(q=>{const practiceCategory=questionCategory(q),key=practiceCategory==='covalent'&&!q.namedSpecies?`covalent:${q.formula}`:q.id;if((category!=='all'&&practiceCategory!==category)||!q.grades?.includes(grade)||seen.has(key))return false;seen.add(key);return true;});}
  const stateKey=`dot-and-cross-${standaloneLeaf}-${practice}-v2${category==='all'?'':`-${category}`}`;
  function readState(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
  function savedQuestionId(saved){const match=/^(?:all|ionic|covalent):([123]):(.+)$/.exec(saved?.questionKey||'');return match&&Number(match[1])===grade?match[2]:null;}
  function legacyState(items){
    if(test||teacher)return null;
    const candidates=[];
    for(const leaf of ['l6-t2-1-3','l6-t2-1-4']){
      const saved=readState(`dot-and-cross-${leaf}-${practice}-v1`),questionId=savedQuestionId(saved);
      const question=items.find(q=>q.id===questionId);
      const expectedCategory=leaf==='l6-t2-1-3'?'ionic':'covalent';
      if(question&&questionCategory(question)===expectedCategory)candidates.push({leaf,saved,question});
    }
    const timestamp=value=>{const raw=value?.savedAt??value?.updatedAt;const parsed=typeof raw==='number'?raw:Date.parse(raw||'');return Number.isFinite(parsed)?parsed:0;};
    candidates.sort((a,b)=>timestamp(b.saved)-timestamp(a.saved)||(['l6-t2-1-3','l6-t2-1-4'].indexOf(a.leaf)-['l6-t2-1-3','l6-t2-1-4'].indexOf(b.leaf)));
    return candidates[0]||null;
  }
  function save(){if(!questionKey)return;const saved={state:snapshot(),history:copy(history),future:copy(future),checked,assessment:copy(assessment),feedback:copy(feedbackResult),serial,circles,attemptId,timing,savedAt:Date.now()};drafts.set(questionKey,saved);if(!test&&!teacher&&stateKey){try{localStorage.setItem(stateKey,JSON.stringify({questionKey,...saved}));}catch(_){}}}
  function testQuestion(restore){
    const candidates=pool();
    const byId=id=>candidates.find(q=>q.id===id);
    if(byId(restore?.questionId))return byId(restore.questionId);
    const savedQueue=Array.isArray(restore?.remaining)?restore.remaining:Array.isArray(test.previous?.remaining)?test.previous.remaining:[];
    let queue=savedQueue.map(byId).filter(Boolean);
    if(!queue.length)queue=candidates.slice();
    const previousId=test.previous?.questionId;
    if(queue.length>1&&previousId)queue=queue.filter(q=>q.id!==previousId);
    const hash=Array.from(String(test.attemptId||'')).reduce((n,ch)=>(Math.imul(n^ch.charCodeAt(0),16777619)>>>0),2166136261)>>>0;
    return queue[hash%queue.length]||candidates[0];
  }
  function load(id,restore=null,fresh=false){
    T.stop();
    save();question=questions.find(q=>q.id===id);questionKey=`${scope()}:${id}`;
    if(test)remaining=(Array.isArray(restore?.remaining)?restore.remaining:pool().map(q=>q.id)).filter(next=>next!==id);
    else remaining=remaining.filter(next=>next!==id);
    let stored=null;if(!test&&!teacher&&!drafts.has(questionKey)&&stateKey){const candidate=readState(stateKey);if(candidate?.questionKey===questionKey)stored=candidate;if(!stored&&legacySaved?.question.id===id)stored=legacySaved.saved;}
    const prior=test?restore:(fresh?null:drafts.get(questionKey)||stored);state=prior?.diagram?copy(prior.diagram):prior?.state?copy(prior.state):empty();history=Array.isArray(prior?.history)?copy(prior.history):[];future=Array.isArray(prior?.future)?copy(prior.future):[];serial=Number.isInteger(prior?.serial)?prior.serial:Math.max(0,...state.atoms.map(a=>Number(String(a.id).replace(/^\D+/,'')||0)),...state.electrons.map(e=>Number(String(e.id).replace(/^\D+/,'')||0)),...state.groups.map(g=>Number(String(g.id).replace(/^\D+/,'')||0)));selected=[];assessment=prior?.assessment?copy(prior.assessment):null;feedbackResult=prior?.feedback?copy(prior.feedback):null;assessmentEmitted=false;attemptId=prior?.attemptId||(progressModel?.attemptId?.()||crypto.randomUUID());if(prior&&Object.prototype.hasOwnProperty.call(prior,'circles'))circles=prior.circles!==false;checked=!!prior?.checked;
    // A restored test snapshot is external state.  Reject malformed diagrams
    // safely while preserving the normal editor's ability to hold an
    // intentionally incomplete student drawing during the current attempt.
    if(C.validateState(state).length){state=empty();history=[];future=[];serial=0;assessment=null;feedbackResult=null;checked=false;}
    attemptId=test?.attemptId||attemptId;
    timing=prior?.timing;
    if(!teacher){
      const timingId=attemptId;
      timing=T.start({id:timingId,idleLimitMs:T.allowance('dot-and-cross',{level:grade}),saved:timing,completed:Boolean(assessment),onCheckpoint:value=>{
        if(attemptId!==timingId)return;
        timing=value;save();saveTest();
      }});
    }
    const fixed=question.namedSpecies||question.category!=='covalent';
    $('prompt').textContent='Draw a dot-and-cross diagram for '+(fixed?question.name.toLowerCase()+(hideFormula(question)?'':`, ${displayFormula(question)}`):displayFormula(question));
    if($('levelBadge'))$('levelBadge').textContent=teacher?'TEACHER VIEW':`LEVEL ${grade}`;
    $('questionId').textContent=reviewBank.id(question);$('questionId').dataset.question=id;if(teacher)$('teacherQuestion').value=id;cursor={x:400,y:325};showCursor=false;setTool('atom');
    $('showAnswer').disabled=!teacher&&!checked;$('showAnswer').textContent='Show answer';if(feedbackResult)feedbackFor(feedbackResult);else $('feedback').replaceChildren();syncTestControls();save();saveTest();if(test&&assessment)emitAssessment();
  }
  function selectFreshQuestion(ids,previousCategory=null){
    const eligible=ids.map(id=>questions.find(q=>q.id===id)).filter(q=>q&&pool().some(item=>item.id===q.id));
    if(!eligible.length)return null;
    const selection=eligible;
    return selection[Math.floor(Math.random()*selection.length)];
  }
  $('next').addEventListener('click',()=>{if(!teacher&&!assessment){say('Check this diagram before continuing.');return;}if(test){B.next();return;}if(practice==='mastery'){refreshMastery();const nextGrade=selectMasteryGrade();if(nextGrade!==grade){grade=nextGrade;remaining=[];} }if(!remaining.length)remaining=pool().map(q=>q.id).filter(id=>id!==question.id);const next=selectFreshQuestion(remaining,questionCategory(question));load(next?.id||question.id,null,true);});
  $('check').addEventListener('click',async()=>{
    if(!teacher&&!state.atoms.length){say('Build a diagram before checking your answer.');return;}
    const result=C.check(state,question);checked=true;feedbackResult=copy(result);$('showAnswer').disabled=false;feedbackFor(result);
    // The scheduler receives only the first assessment.  Later edits, undo,
    // rechecks and answer reveals may update local feedback but never improve
    // the result already recorded for this attempt.
    const firstAssessment=!assessment;if(firstAssessment){T.finish();const score=scoreFor(result),completedAt=Date.now();assessment={score,correct:result.correct,criteria:copy(result.criteria),completedAt,independent:true,recorded:false};recordMastery();}
    render();syncTestControls();saveTest();save();
    if(test&&firstAssessment)await emitAssessment();
  });
  function drawAnswer(){const reference=C.reference(question);R.draw($('answerCanvas'),reference,{circles,answer:true});const isomer=question.category==='covalent'&&!question.namedSpecies;$('answer').querySelector('h3').textContent=isomer?`One valid example: ${question.name}`:'Checked answer';$('explanation').textContent=(isomer?'Other valid neutral isomers of this formula are accepted. ':'')+question.explanation;$('answerCanvas').setAttribute('aria-label',`${question.name}: ${question.explanation}`);}
  $('showAnswer').addEventListener('click',()=>{if(!checked&&!teacher)return;drawAnswer();$('answer').showModal();});
  $('closeAnswer').addEventListener('click',()=>$('answer').close());
  const items=pool();
  if(teacher){
    $('teacherControls').hidden=false;
    $('teacherQuestion').replaceChildren(...items.map(q=>{const option=document.createElement('option');option.value=q.id;option.textContent=reviewBank.id(q)+' · '+q.name+' · '+displayFormula(q);return option;}));
    $('teacherQuestion').addEventListener('change',()=>{$('answer').close();load($('teacherQuestion').value);});
  }
  if(test){
    const saved=test.state;
    const savedCategory=saved?.category;
    const mergedLegacyCategory=category==='all'&&['ionic','covalent'].includes(savedCategory);
    const restore=saved?.version===2&&(savedCategory===category||mergedLegacyCategory)&&Number(saved.grade)===grade&&items.some(q=>q.id===saved.questionId)&&saved.diagram&&!C.validateState(saved.diagram).length?saved:{};
    const eligible=new Set(items.map(q=>q.id));
    let queueSeed=(Array.isArray(restore.remaining)?restore.remaining:Array.isArray(test.previous?.remaining)?test.previous.remaining:[]).filter(id=>eligible.has(id));
    if(restore.questionId&&category==='all'&&['ionic','covalent'].includes(restore.category)){
      const otherCategory=restore.category==='ionic'?'covalent':'ionic';
      const missingOtherCategory=items.filter(q=>questionCategory(q)===otherCategory&&q.id!==restore.questionId).map(q=>q.id);
      for(const id of missingOtherCategory)if(!queueSeed.includes(id))queueSeed.push(id);
    }
    if(!restore.questionId&&!queueSeed.length)queueSeed=items.map(q=>q.id);
    const initial=testQuestion({...restore,remaining:queueSeed});if(initial){load(initial.id,{...restore,remaining:queueSeed});}
  }else{
    remaining=items.map(q=>q.id);
    const stored=(!teacher&&stateKey)?readState(stateKey):null;
    const storedId=items.find(q=>q.id===savedQuestionId(stored))?.id;
    legacySaved=legacyState(items);
    const initial=items.find(q=>q.id===params.get('question'))?.id||storedId||legacySaved?.question.id||selectFreshQuestion(items.map(q=>q.id))?.id;
    if(initial)load(initial);else say('No questions are available at this level.');
    refreshMastery();
    if(unsupportedGrade)say(`Level ${requestedGrade} is not supported. Showing Level ${grade}.`);
  }
})();
