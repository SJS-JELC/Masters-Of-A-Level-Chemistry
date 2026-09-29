/* Marking and persistence rules for the C3L6 draft activity. */
(function(root){
'use strict';
const KEYS=['a','b','c'],B_UNITS=[
 {id:'b-i',slots:['A','B']},{id:'b-ii',slots:['C']},{id:'b-iii',slots:['D','E','F']},
 {id:'b-iv-1',slots:['G']},{id:'b-iv-2',slots:['H','J']},{id:'b-iv-3',slots:['K']},{id:'b-iv-4',slots:['L','M']}
],LEGACY_V1_SIGNATURES=['2e364447'],ANSWER_VERSION='c3l6-answer-bank-1';
function fingerprint(value){let h=2166136261;for(const ch of JSON.stringify(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function semanticBank(content){return {version:ANSWER_VERSION,stages:Object.fromEntries(KEYS.map(key=>[key,content.stages[key].answers.map(a=>({id:a.id,answer:a.answer??null,alternatives:a.alternatives?.map(x=>[x.smiles,x.formula]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)))||[]}))]))};}
function create(content,molecule){
 const signature=fingerprint(semanticBank(content)),blank=()=>({version:3,signature,stage:'intro',selected:{b:'A',c:'R'},responses:{a:{},b:{},c:{}},complete:{a:false,b:false,c:false},submitted:{},unitChecks:{},slotChecks:{}});
 const answers=key=>content.stages[key].answers,answer=(key,id)=>answers(key).find(a=>a.id===id);
 function attemptedSlot(state,key,id){return key==='a'?['oxidation','reduction','hydrolysis'].includes(state.responses.a[id]):Boolean(state.responses[key][id]?.graph?.atoms?.length);}
 function attempted(state,key){return answers(key).every(a=>attemptedSlot(state,key,a.id));}
 function matches(draft,answerData){return !!draft?.graph&&answerData.alternatives.some(a=>molecule.check(draft.graph,a.graph).kind==='correct');}
 function slotCorrect(state,key,id){return key==='a'?state.responses.a[id]===answer(key,id)?.answer:matches(state.responses[key][id],answer(key,id));}
 function bUnit(unitId){return B_UNITS.find(unit=>unit.id===unitId);}
 function attemptedUnit(state,unitId){const unit=bUnit(unitId);return !!unit&&unit.slots.every(id=>attemptedSlot(state,'b',id));}
 function bUnitCount(state,unitId){const unit=bUnit(unitId);if(!unit)return 0;
  if(unitId==='b-iii'){
   const [d,e,f]=unit.slots.map(id=>state.responses.b[id]),answersById=Object.fromEntries(unit.slots.map(id=>[id,answer('b',id)]));
   const direct=Number(matches(d,answersById.D))+Number(matches(e,answersById.E))+Number(matches(f,answersById.F));
   const swapped=Number(matches(d,answersById.D))+Number(matches(e,answersById.F))+Number(matches(f,answersById.E));return Math.max(direct,swapped);
  }
  return unit.slots.reduce((sum,id)=>sum+Number(slotCorrect(state,'b',id)),0);
 }
 function bUnitSnapshot(state,unitId){const unit=bUnit(unitId);return fingerprint(Object.fromEntries(unit.slots.map(id=>[id,state.responses.b[id]?.graph||null])));}
 function cSnapshot(state,id){return fingerprint(state.responses.c[id]?.graph||null);}
 function checked(state,key){return state.submitted[key]||null;}
 function stale(state,check,snapshot){return !!check&&check.snapshot!==snapshot;}
 function bComplete(state){return state.complete.a===true&&B_UNITS.every(unit=>{const check=state.unitChecks[unit.id];return check?.passed===true&&check.snapshot===bUnitSnapshot(state,unit.id)&&bUnitCount(state,unit.id)===unit.slots.length;});}
 function cComplete(state){return bComplete(state)&&answers('c').every(a=>{const check=state.slotChecks[a.id];return check?.correct===true&&check.snapshot===cSnapshot(state,a.id)&&slotCorrect(state,'c',a.id);});}
 function unlocked(state,key){return key==='intro'||key==='a'||key==='b'&&state.complete.a||key==='c'&&state.complete.a&&bComplete(state);}
 function submit(state,key){if(key!=='a'||state.complete.a||!unlocked(state,key)||!attempted(state,'a'))return null;const correct=answers('a').filter(a=>slotCorrect(state,'a',a.id)).length,total=answers('a').length,snapshot=fingerprint(state.responses.a);state.submitted.a={correct,total,snapshot};state.complete.a=correct===total;return {correct,total};}
 function checkUnit(state,unitId){const unit=bUnit(unitId);if(!unit||!unlocked(state,'b')||state.unitChecks[unitId]?.passed||!attemptedUnit(state,unitId))return null;const correct=bUnitCount(state,unitId),total=unit.slots.length;state.unitChecks[unitId]={correct,total,snapshot:bUnitSnapshot(state,unitId),passed:correct===total};return {correct,total,passed:correct===total};}
 function checkCSlot(state,id){const item=answer('c',id),old=state.slotChecks[id],current=cSnapshot(state,id);if(!item||!unlocked(state,'c')||old?.correct&&old.snapshot===current&&slotCorrect(state,'c',id)||!attemptedSlot(state,'c',id))return null;const correct=matches(state.responses.c[id],item);state.slotChecks[id]={correct,snapshot:current};return {correct,id};}
 function validOldCheck(old,total){return !!old&&Number.isInteger(old.correct)&&old.correct>=0&&old.correct<=total&&old.total===total&&typeof old.snapshot==='string'&&/^[0-9a-f]{1,8}$/i.test(old.snapshot);}
 function restore(raw){
  const state=blank();if(!raw)return state;
  const legacy=raw.version===1&&LEGACY_V1_SIGNATURES.includes(raw.signature),current=(raw.version===2||raw.version===3)&&raw.signature===signature;
  if(!legacy&&!current)return state;
  for(const key of KEYS)for(const item of answers(key)){
   const value=raw.responses?.[key]?.[item.id];
   if(key==='a'){if(['oxidation','reduction','hydrolysis'].includes(value))state.responses.a[item.id]=value;}
   else if(value?.graph){try{molecule.assertGraph(value.graph);const history=Array.isArray(value.history)?value.history.slice(-100).filter(g=>{try{molecule.assertGraph(g);return true;}catch{return false;}}):[];state.responses[key][item.id]=molecule.clone({graph:value.graph,history});}catch{}}
  }
  // Historical aggregate checks are preserved verbatim. Only an explicitly completed,
  // fully correct check for the exact validated saved answers can seed granular progress.
  for(const key of KEYS){const old=raw.submitted?.[key],total=answers(key).length;if(validOldCheck(old,total))state.submitted[key]={correct:old.correct,total:old.total,snapshot:old.snapshot};}
  const oldASub=state.submitted.a,oldAComplete=raw.complete?.a===true&&attempted(state,'a')&&answers('a').every(a=>slotCorrect(state,'a',a.id))&&oldASub?.correct===answers('a').length&&oldASub.snapshot===fingerprint(state.responses.a);
  state.complete.a=oldAComplete;
  if((raw.version===1||raw.version===2)&&raw.complete?.b===true&&state.complete.a&&attempted(state,'b')&&B_UNITS.every(unit=>bUnitCount(state,unit.id)===unit.slots.length)){
   const old=state.submitted.b,fullSnapshot=fingerprint(Object.fromEntries(answers('b').map(a=>[a.id,state.responses.b[a.id]?.graph||null])));
   if(old?.correct===answers('b').length&&old.snapshot===fullSnapshot)for(const unit of B_UNITS)state.unitChecks[unit.id]={correct:unit.slots.length,total:unit.slots.length,snapshot:bUnitSnapshot(state,unit.id),passed:true};
  }
  if((raw.version===1||raw.version===2)&&raw.complete?.c===true&&state.complete.a&&bComplete(state)&&attempted(state,'c')&&answers('c').every(a=>slotCorrect(state,'c',a.id))){
   const old=state.submitted.c,fullSnapshot=fingerprint(Object.fromEntries(answers('c').map(a=>[a.id,state.responses.c[a.id]?.graph||null])));
   if(old?.correct===answers('c').length&&old.snapshot===fullSnapshot)for(const item of answers('c'))state.slotChecks[item.id]={correct:true,snapshot:cSnapshot(state,item.id)};
  }
  // Preserve valid v3 per-unit/per-slot checks only when they still match saved graphs.
  if(raw.version===3){
   for(const unit of B_UNITS){const saved=raw.unitChecks?.[unit.id];if(saved&&Number.isInteger(saved.correct)&&saved.correct>=0&&saved.correct<=unit.slots.length&&saved.total===unit.slots.length&&typeof saved.snapshot==='string'&&/^[0-9a-f]{1,8}$/i.test(saved.snapshot)){const current=saved.snapshot===bUnitSnapshot(state,unit.id),pass=current&&saved.correct===unit.slots.length&&bUnitCount(state,unit.id)===unit.slots.length;state.unitChecks[unit.id]={correct:saved.correct,total:saved.total,snapshot:saved.snapshot,passed:pass};}}
   for(const item of answers('c')){const saved=raw.slotChecks?.[item.id];if(saved&&typeof saved.correct==='boolean'&&typeof saved.snapshot==='string'&&/^[0-9a-f]{1,8}$/i.test(saved.snapshot))state.slotChecks[item.id]={correct:saved.correct,snapshot:saved.snapshot};}
  }
  state.complete.b=bComplete(state);state.complete.c=state.complete.b&&cComplete(state);
  for(const key of ['b','c'])if(answers(key).some(item=>item.id===raw.selected?.[key]))state.selected[key]=raw.selected[key];
  const stage=raw.stage==='intro'?'intro':raw.stage;if((stage==='intro'||KEYS.includes(stage))&&unlocked(state,stage))state.stage=stage;
  return state;
 }
 function saveable(state){state.complete.b=bComplete(state);state.complete.c=state.complete.b&&cComplete(state);}
 return {blank,restore,submit,checkUnit,checkCSlot,attempted,attemptedSlot,attemptedUnit,slotCorrect,bUnitCount,bUnitSnapshot,cSnapshot,bComplete,cComplete,checked,stale,unlocked,signature,answerVersion:ANSWER_VERSION,bUnits:B_UNITS.map(unit=>({id:unit.id,slots:[...unit.slots]})),saveable};
}
const api={create,fingerprint};root.C3L6Assessment=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
