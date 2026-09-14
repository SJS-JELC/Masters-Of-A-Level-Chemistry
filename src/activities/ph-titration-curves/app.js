(function(root){
  'use strict';
  const $=id=>document.getElementById(id), ns='http://www.w3.org/2000/svg';
  const core=()=>root.TitrationCore||{};
  const data=()=>root.TitrationData||{questions:[]};
  const X0=76,X1=780,YTOP=32,YBOT=370;
  let questions=data().questions||[], questionIndex=0, question=null, state=null, history=[], drag=null, readySent=false;
  let reviewing=false;
  const reviewBank=globalThis.QuestionReview?.bank?.('TC',questions)||null;
  const clone=value=>value===undefined||value===null?value:JSON.parse(JSON.stringify(value));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
  const snap=(value,step)=>Math.round(value/step)*step;
  const svgNode=(tag,attrs={})=>{const node=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));return node;};
  function reviewId(q=question){try{return reviewBank?.id(q)||'';}catch(_){return '';}}
  function renderReviewId(){
    const host=$('review-id');if(!host)return;host.replaceChildren();const id=reviewId();if(!id)return;
    if(reviewing){host.textContent=id;return;}
    if(state?.checked){const link=document.createElement('a');const url=new URL('index.html',root.location.href);url.searchParams.set('review',id);link.href=url.href;link.target='_blank';link.rel='noopener';link.textContent=id;link.setAttribute('aria-label',`Review question ${id} in a new tab`);host.append(link);}
    else host.textContent=id;
  }
  function dispatch(name,detail={},cancelable=false){
    return root.dispatchEvent(new CustomEvent(name,{detail,cancelable}));
  }
  function defaults(q){
    const base=typeof core().initial==='function'?core().initial(q):{before:null,after:null,initialPH:4,equivalenceVolume:q.maxVolume/2,finalPH:10,indicator:null};
    return {...base,checked:false,assisted:false,attempted:false,revealed:false,result:null};
  }
  function eqFor(next){
    try{return finite(core().curve(question,next).equivalencePH,8.7);}catch(_){return 8.7;}
  }
  function isBase(id){return /base/.test(id||'');}
  function isAcid(id){return /acid/.test(id||'');}
  function constrain(next){
    const out={...next};
    out.initialPH=clamp(finite(out.initialPH,4),0,14);
    out.finalPH=clamp(finite(out.finalPH,10),0,14);
    out.equivalenceVolume=clamp(snap(finite(out.equivalenceVolume,question.maxVolume/2),.5),.5,Math.max(.5,question.maxVolume-.5));
    const eq=eqFor(out);
    if(out.before&&isBase(out.before))out.initialPH=Math.max(out.initialPH,Math.min(13.9,eq+.1));
    if(out.before&&isAcid(out.before))out.initialPH=Math.min(out.initialPH,Math.max(.1,eq-.1));
    if(out.after&&isBase(out.after))out.finalPH=Math.max(out.finalPH,Math.min(13.9,eq+.1));
    if(out.after&&isAcid(out.after))out.finalPH=Math.min(out.finalPH,Math.max(.1,eq-.1));
    out.initialPH=snap(clamp(out.initialPH,0,14),.1);out.finalPH=snap(clamp(out.finalPH,0,14),.1);
    return out;
  }
  function sensible(next,side,id){
    const out={...next};const eq=eqFor(out);
    if(side==='before'){
      if(isBase(id)&&out.initialPH<=eq+.1)out.initialPH=Math.max(11,eq+1);
      if(isAcid(id)&&out.initialPH>=eq-.1)out.initialPH=Math.min(3,eq-1);
    }else{
      if(isBase(id)&&out.finalPH<=eq+.1)out.finalPH=Math.max(12,eq+1);
      if(isAcid(id)&&out.finalPH>=eq-.1)out.finalPH=Math.min(2,eq-1);
    }
    return constrain(out);
  }
  function commit(patch,{record=true,preserveChecked=false}={}){
    if(reviewing)return;
    if(record)history.push(clone(state));
    const next=constrain({...state,...patch});
    state={...next,checked:preserveChecked?Boolean(next.checked):false,revealed:preserveChecked?Boolean(next.revealed):false,result:preserveChecked?next.result:null};
    render();dispatch('titration:change',{questionId:question.id,state:clone(state)});
  }
  function questionMarkup(){
    $('question-title').textContent=question.title||'Build the titration curve';
    renderReviewId();
    $('question-prompt').textContent=question.prompt||'';
    const host=$('indicator-options');
    host.replaceChildren(...core().indicators.map(item=>{
      const button=document.createElement('button');button.type='button';button.className='indicator-choice';button.dataset.indicator=item.id;
      const name=document.createElement('strong');name.textContent=item.name;button.append(name);
      if(item.range){
        button.style.setProperty('--acid-colour',item.acidSwatch);button.style.setProperty('--alkali-colour',item.alkaliSwatch);
        const range=document.createElement('span');range.textContent=`pH ${item.range[0].toFixed(1)}–${item.range[1].toFixed(1)}`;button.append(range);
        const colours=document.createElement('small');colours.className='indicator-colours';
        const acid=document.createElement('span'),alkali=document.createElement('span');acid.textContent=item.acidColour;alkali.textContent=item.alkaliColour;colours.append(acid,alkali);button.append(colours);
        button.setAttribute('aria-label',`${item.name}, pH ${item.range.join(' to ')}, ${item.acidColour.toLowerCase()} in acid, ${item.alkaliColour.toLowerCase()} in alkali`);
      }else button.classList.add('no-indicator');
       button.disabled=reviewing;button.addEventListener('click',()=>{if(!reviewing)commit({indicator:item.id});});return button;
    }));
  }
  function piecePath(points,w=120,h=100){
    if(!points||!points.length)return '';
    const low=Math.min(...points.map(p=>p[1])),high=Math.max(...points.map(p=>p[1]));
    const padding=9,range=high-low||1;
    // Give each half the whole thumbnail height so its curvature is readable.
    return points.map((point,index)=>`${index?'L':'M'} ${(padding+point[0]*(w-2*padding)).toFixed(1)} ${(h-padding-(point[1]-low)/range*(h-2*padding)).toFixed(1)}`).join(' ');
  }
  function renderPieces(){
    const pieces=core().pieces||[];
    for(const side of ['before','after']){
      const host=$(side==='before'?'before-pieces':'after-pieces');host.replaceChildren();
      pieces.filter(item=>item.side===side).forEach(item=>{
         const button=document.createElement('button');button.type='button';button.className='piece-choice';button.dataset.piece=item.id;button.disabled=reviewing;button.setAttribute('aria-pressed',String(state[side]===item.id));button.setAttribute('aria-label',`${item.label}. Select as ${side} equivalence section`);
        // Schematic selector icons emphasise the strong titrant's sharp turn;
        // the pupil's main graph continues to use equilibrium samples.
        const strongAfterIcons={
          'after-strong-base':'M9 91 V17 Q9 9 17 9 H111',
          'after-strong-acid':'M9 9 V83 Q9 91 17 91 H111'
        };
        const preview=svgNode('svg',{viewBox:'0 0 120 100','aria-hidden':'true'});preview.append(svgNode('path',{d:strongAfterIcons[item.id]||piecePath(item.points),class:'piece-path'}));button.append(preview);
         button.addEventListener('click',()=>{if(reviewing)return;const next={...state,[side]:item.id};commit(sensible(next,side,item.id));});host.append(button);
      });
    }
  }
  function volumeX(v){return X0+(clamp(v,0,question.maxVolume)/question.maxVolume)*(X1-X0);}
  function phY(ph){return YBOT-(clamp(ph,0,14)/14)*(YBOT-YTOP);}
  function pathFor(points){return points&&points.length?points.map((point,index)=>`${index?'L':'M'} ${volumeX(point.v).toFixed(1)} ${phY(point.pH).toFixed(1)}`).join(' '):'';}
  function text(x,y,value,klass,anchor='middle'){const el=svgNode('text',{x,y,class:klass,'text-anchor':anchor});el.textContent=value;return el;}
  function handle(type,x,y,value,label){
    const group=svgNode('g');group.append(svgNode('circle',{cx:x,cy:y,r:10,class:'handle-ring'}));const node=svgNode('circle',{cx:x,cy:y,r:6,class:'chart-handle','data-handle':type,tabindex:reviewing?-1:0,role:'slider','aria-disabled':String(reviewing),'aria-label':label,'aria-valuemin':type==='eq'?'0.5':'0','aria-valuemax':type==='eq'?question.maxVolume:'14','aria-valuenow':value,'aria-valuetext':type==='eq'?`${value.toFixed(1)} cubic centimetres`:`pH ${value.toFixed(1)}`});group.append(node);node.addEventListener('pointerdown',event=>{if(reviewing)return;event.preventDefault();$('curve-chart').setPointerCapture?.(event.pointerId);drag={type,pointer:event.pointerId,before:clone(state)};});node.addEventListener('keydown',event=>{if(reviewing)return;let delta=0;if(type==='eq'&&(event.key==='ArrowLeft'||event.key==='ArrowRight'))delta=event.key==='ArrowRight'?.5:-.5;if(type!=='eq'&&(event.key==='ArrowUp'||event.key==='ArrowDown'))delta=event.key==='ArrowUp'?.1:-.1;if(!delta)return;event.preventDefault();const field=type==='initial'?'initialPH':'finalPH';const patch=type==='eq'?{equivalenceVolume:state.equivalenceVolume+delta}:{[field]:state[field]+delta};commit(patch);document.querySelector(`[data-handle="${type}"]`)?.focus();});return group;
  }
  function renderChart(){
    const grid=$('chart-grid'),labels=$('chart-labels'),guides=$('chart-guides'),handles=$('chart-handles');grid.replaceChildren();labels.replaceChildren();guides.replaceChildren();handles.replaceChildren();
    for(let p=0;p<=14;p+=2){const y=phY(p);grid.append(svgNode('line',{x1:X0,y1:y,x2:X1,y2:y,class:'grid-line'}));labels.append(text(X0-12,y+4,String(p),'tick-label','end'));}
    for(let i=0;i<=5;i++){const v=question.maxVolume*i/5,x=volumeX(v);grid.append(svgNode('line',{x1:x,y1:YTOP,x2:x,y2:YBOT,class:'grid-line'}));labels.append(text(x,YBOT+22,v.toFixed(1),'tick-label'));}
    grid.append(svgNode('line',{x1:X0,y1:YBOT,x2:X1,y2:YBOT,class:'axis-line'}),svgNode('line',{x1:X0,y1:YTOP,x2:X0,y2:YBOT,class:'axis-line'}));labels.append(text((X0+X1)/2,430,'Volume of NaOH added / cm³','axis-label'),text(18,(YTOP+YBOT)/2,'pH','axis-label'));labels.lastChild.setAttribute('transform',`rotate(-90 18 ${(YTOP+YBOT)/2})`);
    let plotted;try{plotted=core().curve(question,state)||{};}catch(_){plotted={before:[],after:[],equivalencePH:8.7};}
    $('before-curve').setAttribute('d',pathFor(plotted.before));$('after-curve').setAttribute('d',pathFor(plotted.after));
    const eq=finite(plotted.equivalencePH,8.7),eqV=finite(state.equivalenceVolume,question.maxVolume/2),eqX=volumeX(eqV),eqY=phY(eq),eqLabelX=eqX<205?Math.min(470,eqX+7):eqX-7,eqLabelAnchor=eqX<205?'start':'end';
    if(state.before||state.after){const join=svgNode('circle',{cx:eqX,cy:eqY,r:5,class:'curve-join'});guides.append(join);}
    // The initial point already lies on the pH axis; give it an axis tick.
    guides.append(svgNode('line',{x1:X0-8,y1:phY(state.initialPH),x2:X0,y2:phY(state.initialPH),class:'guide'}),text(X0+9,phY(state.initialPH)-9,`initial pH ${state.initialPH.toFixed(1)}`,'guide-label','start'));
    guides.append(svgNode('line',{x1:eqX,y1:eqY,x2:eqX,y2:YBOT,class:'guide-eq'}),text(eqX-7,eqY-9,`equivalence ${eqV.toFixed(1)} cm³ · pH ${eq.toFixed(1)}`,'guide-label','end'));
    const eqLabel=guides.querySelectorAll('.guide-label')[1];if(eqLabel){eqLabel.setAttribute('x',eqLabelX);eqLabel.setAttribute('text-anchor',eqLabelAnchor);}
    guides.append(svgNode('line',{x1:X1,y1:phY(state.finalPH),x2:X0,y2:phY(state.finalPH),class:'guide'}),text(X1-9,phY(state.finalPH)-9,`final pH ${state.finalPH.toFixed(1)}`,'guide-label','end'));
    handles.append(handle('initial',X0,phY(state.initialPH),state.initialPH,'Initial pH anchor'),handle('eq',eqX,eqY,eqV,'Equivalence volume anchor'),handle('final',X1,phY(state.finalPH),state.finalPH,'Final pH anchor'));
  }
  function renderFeedback(){
    const feedback=$('feedback');const status=$('question-status');const next=$('next');
    if(reviewing){feedback.textContent='Read-only review: the model answer is shown. No practice progress is recorded.';feedback.className='good';status.textContent='Read-only review';next.hidden=true;return;}
    if(!state.checked){feedback.textContent=state.revealed?'Answer revealed. Try the next question when ready.':state.assisted?'Keep practising. This assisted attempt will not earn mastery credit.':'Make your selections, set the anchors, then check your answer.';feedback.className=state.assisted?'warn':'';status.textContent=state.revealed?'Answer shown':state.assisted?'Assisted practice':'In progress';next.hidden=!state.attempted;return;}
    const result=state.result||{};const perfect=result.score===1;feedback.className=perfect?'good':'warn';feedback.textContent=perfect?`Excellent — ${result.earned}/${result.total} checks match the chemistry.`:`${result.earned||0}/${result.total||6} checks match. ${((result.items||[]).find(item=>!item.correct)||{}).feedback||'Use the feedback to adjust your model.'}`;status.textContent=perfect?'Checked · correct':'Checked · review';next.hidden=false;
  }
  function renderFeedbackDetailed(){
    if(!state.checked)return;
    const feedback=$('feedback'),result=state.result||{},items=Array.isArray(result.items)?result.items:[];
    feedback.replaceChildren();
    if(reviewing){const note=document.createElement('p');note.className='review-note';note.textContent='Read-only review: model answer shown. No practice progress recorded.';feedback.append(note);}
    const summary=document.createElement('strong');summary.textContent=result.score===1?`Excellent — ${result.earned}/${result.total} checks match the chemistry.`:`${result.earned||0}/${result.total||6} checks match. Review each part:`;feedback.append(summary);
    if(items.length){const list=document.createElement('ul');list.className='feedback-list';items.forEach(item=>{const row=document.createElement('li');row.className=item.correct?'correct':'incorrect';row.textContent=`${item.correct?'✓':'○'} ${item.label}${item.correct?'':item.feedback?` — ${item.feedback}`:''}`;list.append(row);});feedback.append(list);}
  }
  function render(){if(!question||!state)return;renderPieces();renderChart();renderReviewId();document.querySelectorAll('[data-indicator]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.indicator===state.indicator)));$('undo').disabled=reviewing||!history.length;$('question-counter').textContent=`Question ${questionIndex+1} of ${questions.length}`;$('curve-status').textContent=reviewing?'Model answer':state.before&&state.after?'Curve ready to check':'Choose both curve halves';$('curve-status').classList.toggle('ready',Boolean(state.before&&state.after));renderFeedback();renderFeedbackDetailed();}
  function handlePointer(event){if(reviewing||!drag||event.pointerId!==drag.pointer)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform($('curve-chart').getScreenCTM().inverse());let patch;if(drag.type==='eq'){const v=snap((point.x-X0)/(X1-X0)*question.maxVolume,.5);patch={equivalenceVolume:v};}else{const field=drag.type==='initial'?'initialPH':'finalPH';const ph=snap((YBOT-point.y)/(YBOT-YTOP)*14,.1);patch={[field]:ph};}const next=constrain({...state,...patch});state={...next,checked:false,revealed:false,result:null};render();dispatch('titration:change',{questionId:question.id,state:clone(state)});}
  function endPointer(event){if(drag&&drag.pointer===event.pointerId){history.push(drag.before);drag=null;$('undo').disabled=false;}}
  function check(){if(reviewing)return;const first=!state.attempted;const result=typeof core().grade==='function'?core().grade(question,state):{score:0,earned:0,total:0,items:[]};history.push(clone(state));state={...state,attempted:true,checked:true,result,revealed:false};render();dispatch('titration:score',{questionId:question.id,state:clone(state),result,assisted:Boolean(state.assisted),firstAttempt:first});}
  function reveal(){if(reviewing||typeof core().answer!=='function')return;history.push(clone(state));const answer=core().answer(question);state={...state,...answer,attempted:true,checked:false,assisted:true,revealed:true,result:null};state=constrain(state);const result=typeof core().grade==='function'?core().grade(question,state):null;state.result=result;render();dispatch('titration:change',{questionId:question.id,state:clone(state)});dispatch('titration:score',{questionId:question.id,state:clone(state),result,assisted:true,firstAttempt:false});}
  function reset(){if(reviewing)return;history.push(clone(state));const previous=state;state=defaults(question);state.attempted=Boolean(previous.attempted);state.assisted=Boolean(previous.assisted);render();dispatch('titration:change',{questionId:question.id,state:clone(state)});}
  function undo(){if(reviewing||!history.length)return;const previous=state;const restored=history.pop();state={...restored,attempted:Boolean(previous.attempted||restored.attempted),assisted:Boolean(previous.assisted||restored.assisted)};render();dispatch('titration:change',{questionId:question.id,state:clone(state)});}
  function next(){if(reviewing)return;const detail={questionId:question.id,state:clone(state)};const allowed=dispatch('titration:next',detail,true);if(!allowed)return;loadQuestion(questions[(questionIndex+1)%questions.length].id);}
  function loadQuestion(id,restore,asReview=false){const index=questions.findIndex(item=>item.id===id);if(index<0)return false;reviewing=Boolean(asReview);document.body.classList.toggle('review-mode',reviewing);questionIndex=index;question=questions[index];history=[];questionMarkup();const supplied=restore&&typeof restore==='object'?restore:defaults(question);state=constrain({...defaults(question),...supplied});if(reviewing){const answer=core().answer(question);state=constrain({...state,...answer,attempted:true,checked:true,assisted:true,revealed:true,result:core().grade(question,{...state,...answer})});}render();if(!readySent){readySent=true;dispatch('titration:ready',{questionId:question.id,state:clone(state)});}else dispatch('titration:change',{questionId:question.id,state:clone(state)});return true;}
  function loadReview(id){
    if(!reviewBank)throw new Error('Question review is unavailable.');
    const normalized=String(id||'').trim().toUpperCase(), entry=reviewBank.get(normalized);
    loadQuestion(entry.id,null,true);
  }
  function showReviewError(error){
    document.querySelector('.builder-layout')?.setAttribute('hidden','');document.querySelector('.answer-panel')?.setAttribute('hidden','');
    $('question-title').textContent='Review question unavailable';$('question-prompt').textContent=error?.message||'This review ID is not available.';
    $('review-id').textContent='';$('question-status').textContent='Review unavailable';
  }
  function bind(){
    $('check').addEventListener('click',check);$('reveal').addEventListener('click',reveal);$('reset').addEventListener('click',reset);$('undo').addEventListener('click',undo);$('next').addEventListener('click',next);document.addEventListener('pointermove',handlePointer);document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',endPointer);
  }
  root.TitrationActivity={getQuestion:()=>clone(question),getState:()=>clone(state),getReviewId:()=>reviewId(),isReviewing:()=>reviewing,restore:(qid,nextState)=>loadQuestion(qid,nextState),loadQuestion:(qid,nextState)=>loadQuestion(qid,nextState)};
  document.addEventListener('DOMContentLoaded',()=>{bind();const requested=new URLSearchParams(root.location?.search||'').get('review');if(requested){try{loadReview(requested);}catch(error){showReviewError(error);}}else if(questions.length)loadQuestion(questions[0].id);});
})(globalThis);
