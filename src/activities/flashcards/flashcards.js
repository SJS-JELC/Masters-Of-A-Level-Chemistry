(() => {
  'use strict';
  const cards = Array.isArray(globalThis.FLASHCARDS) ? globalThis.FLASHCARDS : [], $ = id => document.getElementById(id);
  const bankRevision = String(globalThis.FLASHCARD_BANK_REVISION || 'sample-v1');
  const key = `masters-flashcard-draft-v1:${bankRevision}`, decay = 2 ** (-.5);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normal = s => s.toLowerCase().replace(/[.,;:!?]/g,'').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
  const chem = s => s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)([⁺⁻])$/g,(_,n,q)=>'^'+[...n].map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')+(q==='⁺'?'+':'-')).replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).replace(/⁺/g,'+').replace(/[⁻−]/g,'-').replace(/\s+/g,'');
  const formulaHTML = s => /[1-4][spd]/.test(s) ? esc(s).replace(/([spd])(\d+)/g,'$1<sup>$2</sup>') : esc(s).replace(/([+-])$/, '<sup>$1</sup>').replace(/([A-Za-z)])(\d+)/g,'$1<sub>$2</sub>');
  const rich = s => esc(s).replace(/\b([1-4][spd])(\d+)\b/g,'$1<sup>$2</sup>').replace(/\b(Al|S|O)([23])([+−-])/g,'$1<sup>$2$3</sup>').replace(/\b(NH)([34])/g,'$1<sub>$2</sub>').replace(/\bAl2O3\b/g,'Al<sub>2</sub>O<sub>3</sub>').replace(/\b(Na|Cl|H)([+−-])/g,'$1<sup>$2</sup>').replace(/(<\/sub>)([+−-])/g,'$1<sup>$2</sup>');
  let scores = {};
  try { const stored=JSON.parse(localStorage.getItem(key)||'{}'); for(const c of cards) if(Number.isFinite(stored[c.id])&&stored[c.id]>=0&&stored[c.id]<=1) scores[c.id]=stored[c.id]; } catch { $('storage-note').textContent='Progress is available for this visit only.'; }
  let mode='study', queue=[], index=0, piles={again:[],known:[]}, history=[], flipped=false, checked=false, revealed=false, currentQuestion=null;
  const current = () => cards.find(c=>c.id===queue[index]);
  const legacyTermPrompts={
    'ionic-bond-definition':'Strong electrostatic attraction between oppositely charged ions.',
    'covalent-bond':'Strong electrostatic attraction between a shared pair of electrons and the nuclei of the bonded atoms.',
    'coordinate-bond':'A covalent bond in which both electrons in the shared pair are supplied by one atom.',
    'atomic-orbital':'A region around the nucleus that can contain up to two electrons with opposite spins.'
  };
  function save(){try{localStorage.setItem(key,JSON.stringify(scores));}catch{$('storage-note').textContent='Progress is available for this visit only.';}}
  function filtered(){return cards.filter(c=>$('topic').value==='all'||c.spec.startsWith($('topic').value));}
  function gem(c){const score=scores[c.id]||0;return `<span class="gem" aria-hidden="true">◆</span><span>${Math.round(score*100)}% ${score>=.8?'· Mastered':'· Building'}</span><span class="mini-bar"><i style="width:${score*100}%"></i></span>`;}
  function question(c){
    const level=+$('level').value;
    if(level===1)return {prompt:c.prompt,answer:c.answer,accepted:c.accepted,kind:'choice',level,strictAccepted:true};
    if(level===2){
      if(c.type==='long'&&c.termPrompt){
        const termPrompt=typeof c.termPrompt==='string'?{prompt:`Which term does this describe? ${c.termPrompt}`}:c.termPrompt;
        const answer=termPrompt.answer||termPrompt.term||c.term;
        return {prompt:termPrompt.prompt||termPrompt.question||`Which term does this describe?`,answer,accepted:termPrompt.accepted||[answer,...(c.termAccepted||[])],kind:c.type==='formula'?'formula':'text',level,strictAccepted:true};
      }
      if(c.type==='long'&&c.termPrompt===undefined&&legacyTermPrompts[c.id])return {prompt:`Which term does this describe? ${legacyTermPrompts[c.id]}`,answer:c.term,accepted:[c.term],kind:'text',level,strictAccepted:true};
      if(c.type==='long'&&c.cloze)return {...c.cloze,kind:'text',level,strictAccepted:true};
    }
    return {prompt:c.prompt,answer:c.answer,accepted:c.accepted,kind:c.type==='formula'?'formula':c.type==='long'?'long':'text',level};
  }
  function markingFor(c){if(c.type==='formula'||c.marking==='formula')return 'formula';if(c.marking==='keyIdeas')return 'keyIdeas';if(c.marking==='exact')return 'exact';return c.type==='long'?'keyIdeas':'exact';}
  function markingLabel(c,q){if(c.type==='formula')return 'formula notation';if(q.strictAccepted)return 'accepted answers';const marking=markingFor(c);return marking==='keyIdeas'?'key ideas':'exact wording';}
  function updateCounts(){ $('again-count').textContent=piles.again.length;$('known-count').textContent=piles.known.length;$('mastered').textContent=cards.filter(c=>(scores[c.id]||0)>=.8).length;$('remaining').textContent=`${Math.min(index+1,queue.length)} / ${queue.length} cards`;$('undo').disabled=!history.length;$('retry').disabled=!piles.again.length;$('card-count').textContent=`${cards.length} ${bankRevision==='sample-v1'?'sample cards':cards.length===1?'reviewed card':'reviewed cards'}`; }
  function render(){
    const c=current(); flipped=false;checked=false;revealed=false;
    $('card').classList.remove('flipped');$('card').style.height='';$('front').inert=false;$('back').inert=true;$('card').setAttribute('aria-pressed','false');$('feedback').textContent='';$('test-input').textContent='';$('next').hidden=true;
    $('study').setAttribute('aria-pressed',mode==='study');$('test').setAttribute('aria-pressed',mode==='test');$('level-wrap').hidden=mode==='study';$('exact-wrap').hidden=mode==='study';
    $('again-label').textContent=mode==='study'?'Don’t know yet':'Incorrect';$('known-label').textContent=mode==='study'?'Know it':'Correct';
    $('session-label').textContent=mode==='study'?'Make yourself familiar':`Level ${$('level').value} · ${['','Choose the answer','Recall the essentials','Put it into words'][+$('level').value]}`;
    $('gesture').textContent=mode==='study'?'Tap to flip · Swipe to sort · Take your time':'Answer first, then check your thinking.';
    $('card').classList.toggle('test-card',mode==='test');$('card').setAttribute('role',mode==='study'?'button':'group');$('card').tabIndex=mode==='study'?0:-1;$('card').setAttribute('aria-label',mode==='study'?'Flip flashcard':'Question');
    $('study-actions').hidden=mode!=='study'||!c;$('test-input').hidden=mode!=='test'||!c;
    updateCounts();
    if(!c&&!cards.length){$('front').innerHTML='<div class="complete"><span class="gem">◆</span><h2>No reviewed cards yet.</h2><p>Your teacher’s reviewed cards will appear here when this deck is ready.</p></div>';$('back').textContent='';$('gesture').textContent='Check back after your teacher reviews some cards.';return;}
    if(!c){$('front').innerHTML=`<div class="complete"><span class="gem">◆</span><h2>Round complete.</h2><p>${piles.known.length} in the right pile · ${piles.again.length} to revisit</p><p>Practise your left pile or restart for another recall.</p></div>`;$('back').textContent='';$('gesture').textContent='Each return is another chance to remember.';return;}
    currentQuestion=question(c);
    if(c)$('teacher-rule').textContent=markingLabel(c,currentQuestion);
    $('front').innerHTML=`<div class="card-top"><span>${esc(c.spec)} · ${mode==='study'?'FLASHCARD':esc(currentQuestion.kind==='choice'?'CHOOSE ONE':currentQuestion.kind==='long'?'FULL DEFINITION':'RECALL')}</span><b>${esc(c.type==='formula'?'NOTATION':c.type==='long'?'KEY IDEA':'QUICK RECALL')}</b></div><div class="question">${rich(mode==='study'?c.prompt:currentQuestion.prompt)}</div><div class="card-foot">${gem(c)}</div>`;
    $('back').innerHTML=`<div class="card-top"><span>THE ANSWER</span><b>${esc(c.spec)}</b></div><div class="answer">${c.type==='formula'?formulaHTML(c.answer):rich(c.answer)}</div>${c.diagram?`<div class="diagram">${c.diagram}</div>`:''}<div class="card-foot">Think it through. Then choose your pile.</div>`;
    if(mode==='test'){
      if(currentQuestion.kind==='choice'){
        // Stable rotation avoids a fixed correct-option position.
        const shift=cards.indexOf(c)%4, choices=c.options.slice(shift).concat(c.options.slice(0,shift));
        $('test-input').innerHTML=`<div class="choices">${choices.map((s,i)=>`<button data-choice="${i}">${rich(s)}</button>`).join('')}</div>`;
        $('test-input').querySelectorAll('[data-choice]').forEach((b,i)=>b.onclick=()=>submit(choices[i],b));
      }else{
        if(c.answerFields?.length){
          $('test-input').innerHTML=`<form id="answer-form"><div class="numeric-fields">${c.answerFields.map((f,i)=>`<label for="numeric-${i}">${esc(f.label)}<input id="numeric-${i}" type="number" inputmode="numeric" min="0" step="1" required></label>`).join('')}</div><button class="primary">Check answer</button></form><button class="text-button" id="reveal">Reveal answer · half credit at most</button>`;
          $('answer-form').onsubmit=e=>{e.preventDefault();if(!$('answer-form').reportValidity())return;submit(c.answerFields.map((f,i)=>`${f.label} = ${Number($('numeric-'+i).value)}`).join('; '));};$('reveal').onclick=reveal;
          return;
        }
        const area=currentQuestion.kind==='long';
        $('test-input').innerHTML=`<form id="answer-form"><label for="typed-answer" class="eyebrow">Your answer</label><div class="entry">${area?'<textarea':'<input'} id="typed-answer" autocomplete="off" spellcheck="false" ${area?'rows="3"></textarea>':'type="text">'}<button class="primary">Check answer</button></div></form><button class="text-button" id="reveal">Reveal answer · half credit at most</button>`;
        $('answer-form').onsubmit=e=>{e.preventDefault();maybeSubmit();};$('reveal').onclick=reveal;
      }
    }
  }
  function restart(ids){queue=ids||filtered().map(c=>c.id);index=0;piles={again:[],known:[]};history=[];render();}
  function sizeCard(){ $('card').style.height='';if(flipped)$('card').style.height=Math.max($('front').scrollHeight,$('back').scrollHeight+12)+'px'; }
  function flip(){if(mode!=='study'||!current())return;flipped=!flipped;sizeCard();$('card').classList.toggle('flipped',flipped);$('front').inert=flipped;$('back').inert=!flipped;$('card').setAttribute('aria-pressed',String(flipped));}
  window.addEventListener('resize',sizeCard);
  function record(credit,pass){const c=current();if(!c||checked)return;history.push({id:c.id,index,old:scores[c.id],pile:pass?'known':'again'});scores[c.id]=(scores[c.id]||0)*decay+credit*(1-decay);piles[pass?'known':'again'].push(c.id);checked=true;save();updateCounts();}
  function sort(know){if(mode!=='study'||!current())return;record(know?.5:0,know);index++;render();}
  function mark(value){
    const q=currentQuestion,c=current();
    if(!q||!c)return {pass:false,missing:[]};
    const values=[q.answer,...q.accepted||[]].filter(a=>a!==undefined&&a!==null&&String(a).trim()!=='');
    if(q.kind==='formula')return {pass:values.some(a=>chem(a)===chem(value)),missing:[]};
    if(q.strictAccepted||markingFor(c)==='exact')return {pass:values.some(a=>normal(a)===normal(value)),missing:[]};
    if(markingFor(c)!=='keyIdeas'||!Array.isArray(c.keyIdeas)||!c.keyIdeas.length)return {pass:values.some(a=>normal(a)===normal(value)),missing:[]};
    const text=` ${normal(value)} `;const missing=c.keyIdeas.filter(group=>Array.isArray(group)&&!group.some(s=>text.includes(` ${normal(s)} `)));const negative=/\b(no|not|never|isn't|aren't|without)\b/i.test(value);return {pass:values.some(a=>normal(a)===normal(value))||(!missing.length&&!negative),missing:missing.map(g=>g[0]),negative};
  }
  function submit(value,button){if(checked||!current())return;const result=mark(value);record(result.pass?1:0,result.pass);if(button){$('test-input').querySelectorAll('button').forEach(b=>{b.disabled=true;if(normal(b.textContent)===normal(currentQuestion.answer))b.classList.add('correct');});button.classList.add(result.pass?'correct':'incorrect');}else $('test-input').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);
    $('feedback').innerHTML=`<strong class="${result.pass?'good':'bad'}">${result.pass?'Correct · full credit':'Not quite · revisit this card'}</strong><p>Answer: ${rich(currentQuestion.answer)}</p>${result.missing.length?`<p>Missing key ideas: ${result.missing.map(esc).join('; ')}.</p>`:''}${result.negative&&!result.pass?'<p>Check the negation in your answer. This demo uses authored rules.</p>':''}${current().diagram?`<div class="diagram">${current().diagram}</div>`:''}`;$('next').hidden=false;
  }
  function maybeSubmit(){const value=$('typed-answer').value.trim();if(!value){$('typed-answer').focus();return;}if(currentQuestion.kind==='formula'&&/[A-Za-z]\d+[+-]$/.test(value)&&!/[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻^]/.test(value)){
    const match=value.match(/^(.*?)(\d+)([+-])$/);$('formula-options').innerHTML=`<button id="sub-choice">${formulaHTML(value)}<small>${esc(match[2])} atoms at this position; charge ${esc(match[3])}1</small></button><button id="super-choice">${esc(match[1])}<sup>${esc(match[2]+match[3])}</sup><small>No subscript here; charge ${esc(match[2]+match[3])}</small></button>`;
    $('sub-choice').onclick=()=>{$('formula-dialog').close();submit(value);};$('super-choice').onclick=()=>{$('formula-dialog').close();submit(`${match[1]}^${match[2]}${match[3]}`);};$('formula-dialog').showModal();
  }else submit(value);}
  function reveal(){if(checked)return;revealed=true;$('test-input').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);$('feedback').innerHTML=`<strong>Compare your recall</strong><p>${rich(currentQuestion.answer)}</p><button id="self-no">Don’t know · 0 credit</button> <button id="self-yes">Know · half credit</button>`;const self=pass=>{if(checked)return;record(pass?.5:0,pass);$('feedback').innerHTML=`<strong>${pass?'Half credit recorded':'Added to the left pile'}</strong><p>${rich(currentQuestion.answer)}</p>`;$('next').hidden=false;};$('self-no').onclick=()=>self(false);$('self-yes').onclick=()=>self(true);}
  $('study').onclick=()=>{mode='study';restart();};$('test').onclick=()=>{mode='test';restart();};$('topic').onchange=()=>restart();$('level').onchange=()=>restart();
  $('flip').onclick=flip;$('card').onclick=flip;$('no').onclick=()=>sort(false);$('yes').onclick=()=>sort(true);$('next').onclick=()=>{index++;render();if(current()&&$('typed-answer'))$('typed-answer').focus();};
  $('restart').onclick=()=>restart();$('retry').onclick=()=>restart([...piles.again]);$('reset').onclick=()=>{scores={};save();restart();};
  $('undo').onclick=()=>{const last=history.pop();if(!last)return;if(last.old===undefined)delete scores[last.id];else scores[last.id]=last.old;piles[last.pile].pop();index=last.index;save();render();};
  for(const name of ['again','known'])$('pile-'+name).onclick=()=>{$('pile-title').textContent=name==='again'?'Cards to revisit':'Cards you know';$('pile-list').innerHTML=piles[name].length?piles[name].map(id=>{const c=cards.find(c=>c.id===id);return `<details class="pile-row"><summary>${esc(c.prompt)}</summary><p>${rich(c.answer)}</p><small>${esc(c.spec)} · ${Math.round((scores[id]||0)*100)}% mastery</small></details>`;}).join(''):'<p>No cards here yet. Try a card to start your pile.</p>';$('pile-dialog').showModal();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||mode!=='study')return;if(e.code==='Space'||e.code==='Enter'){e.preventDefault();flip();}if(e.code==='ArrowLeft'){e.preventDefault();sort(false);}if(e.code==='ArrowRight'){e.preventDefault();sort(true);}});
  let pointer=null,suppressClick=false;
  $('stage').addEventListener('pointerdown',e=>{if(mode==='study'&&current())pointer={x:e.clientX,y:e.clientY,id:e.pointerId};});
  $('stage').addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4){suppressClick=true;sort(dx>0);setTimeout(()=>suppressClick=false,0);}});
  $('stage').addEventListener('pointercancel',()=>pointer=null);
  $('stage').addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}},true);
  globalThis.FlashcardDemo={getState:()=>({mode,queue:[...queue],index,piles:structuredClone(piles),scores:{...scores},checked}),mark,chem};
  restart();
})();
