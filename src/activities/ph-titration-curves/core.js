(function(root){
  'use strict';
  const KW=1e-14;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const snap=(x,step)=>Math.round(x/step)*step;
  function quantities(q){
    return {volume:q.initialVolume??q.acidVolume,initial:q.initialConcentration??q.acidConcentration,titrant:q.titrantConcentration??q.baseConcentration};
  }
  function equivalenceVolume(q){const n=quantities(q);return n.volume*n.initial*(q.initialFactor||1)/(n.titrant*(q.titrantFactor||1));}
  function options(q){return {acidWeak:Boolean(q.acidWeak),baseWeak:Boolean(q.baseWeak),reverse:Boolean(q.reverse)};}
  // Charge balance with additive volumes, ideal concentrations and Kw at 25 C.
  // Diprotic questions explicitly stipulate complete dissociation of both H+.
  // The multiplier models acid equivalents, not a realistic second Ka curve.
  function chargeResidual(q,v,pH,opts=options(q)){
    const {acidWeak,baseWeak,reverse}=opts,n=quantities(q),total=(n.volume+v)/1000;
    const initial=n.volume*n.initial*(q.initialFactor||1)/1000;
    const added=v*n.titrant*(q.titrantFactor||1)/1000;
    const ca=(reverse?added:initial)/total,cb=(reverse?initial:added)/total;
    const ka=10**-(q.pKa??4.76),kbh=10**-(q.basePKa??9.25),h=10**-pH;
    return h+(baseWeak?cb*h/(h+kbh):cb)-KW/h-(acidWeak?ca*ka/(h+ka):ca);
  }
  function equilibriumPH(q,v,opts=options(q)){
    let lo=-2,hi=16;
    for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(chargeResidual(q,v,mid,opts)>0)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function suitableIndicators(q){
    // Require the entire supplied transition range to lie within 2% of the
    // equivalence volume. This accepts valid alternatives for strong/strong.
    const ve=equivalenceVolume(q),ends=[equilibriumPH(q,ve*.98),equilibriumPH(q,ve*1.02)].sort((a,b)=>a-b);
    return indicators.filter(i=>i.range&&i.range[0]>=ends[0]&&i.range[1]<=ends[1]).map(i=>i.id);
  }
  function answer(q){
    const ve=equivalenceVolume(q),acceptedIndicators=suitableIndicators(q);
    return {before:q.before,after:q.after,initialPH:snap(equilibriumPH(q,0),.1),equivalenceVolume:snap(ve,.5),finalPH:snap(equilibriumPH(q,q.maxVolume),.1),equivalencePH:snap(equilibriumPH(q,ve),.1),acceptedIndicators,indicator:acceptedIndicators[0]||'none'};
  }
  function initial(q){return {before:null,after:null,initialPH:q.reverse?11:4,equivalenceVolume:snap(q.maxVolume/2,.5),finalPH:q.reverse?3:10,indicator:null};}
  const specs=[
    ['before-strong-acid','before','Strong acid · rising',false,false,false],
    ['before-weak-acid','before','Weak acid · rising',true,false,false],
    ['before-strong-base','before','Strong base · falling',false,false,true],
    ['before-weak-base','before','Weak base · falling',false,true,true],
    ['after-strong-base','after','Strong base · rising',true,false,false],
    ['after-weak-base','after','Weak base · rising',true,true,false],
    ['after-strong-acid','after','Strong acid · falling',false,true,true],
    ['after-weak-acid','after','Weak acid · falling',true,true,true]
  ];
  // Extra samples next to the join capture the narrow steep interval. The
  // display remains a continuous curve, not a line across a skipped pH jump.
  const fractions=[...Array.from({length:101},(_,i)=>i/100),.00001,.0001,.001,.002,.005,.995,.998,.999,.9999,.99999].sort((a,b)=>a-b);
  const templateQ={acidVolume:25,acidConcentration:.18,baseConcentration:.2,pKa:4.76,maxVolume:50};
  // Compare after-equivalence titrants against the same weak starting reagent:
  // weak acid for rising curves and weak base for falling curves. This makes
  // the weak/weak gradual turn visible without inventing illustrative curves.
  const pieces=specs.map(([id,side,label,acidWeak,baseWeak,reverse])=>{
    const opts={acidWeak,baseWeak,reverse},ve=22.5;
    const points=fractions.map(t=>[t,equilibriumPH(templateQ,side==='before'?t*ve:ve+t*(50-ve),opts)/14]);
    return {id,side,label,points,acidWeak,baseWeak,reverse};
  });
  const indicators=[
    {id:'phenolphthalein',name:'Phenolphthalein',range:[8.3,10.0],acidColour:'Colourless',alkaliColour:'Pink',acidSwatch:'transparent',alkaliSwatch:'#ef76bc'},
    {id:'methyl-orange',name:'Methyl orange',range:[3.1,4.4],acidColour:'Red',alkaliColour:'Yellow',acidSwatch:'#ef6370',alkaliSwatch:'#ffe578'},
    {id:'methyl-red',name:'Methyl red',range:[4.4,6.2],acidColour:'Red',alkaliColour:'Yellow',acidSwatch:'#ef6370',alkaliSwatch:'#ffe578'},
    {id:'none',name:'No suitable indicator',range:null}
  ];
  function curve(q,state){
    const before=pieces.find(p=>p.id===state.before&&p.side==='before');
    const after=pieces.find(p=>p.id===state.after&&p.side==='after');
    const ve=equivalenceVolume(q);
    const targetV=clamp(Number(state.equivalenceVolume)||q.maxVolume/2,.5,q.maxVolume-.5);
    // Determine joining height from the chosen combination, without asking
    // pupils to calculate salt hydrolysis. Mixed directions remain an
    // intentionally incorrect construction but still share one joining point.
    const reverse=before?before.reverse:after?after.reverse:false;
    const acidWeak=reverse?(after?after.acidWeak:false):(before?before.acidWeak:false);
    const baseWeak=reverse?(before?before.baseWeak:false):(after?after.baseWeak:false);
    const opts={acidWeak,baseWeak,reverse};
    const eq=snap(equilibriumPH(q,ve,opts),.1);
    function half(piece,side){
      if(!piece)return [];
      const compatible=piece.reverse===reverse;
      const model=compatible?opts:piece;
      const startV=side==='before'?0:ve,endV=side==='before'?ve:q.maxVolume;
      const a=equilibriumPH(q,startV,model),b=equilibriumPH(q,endV,model);
      const y0=side==='before'?Number(state.initialPH):eq;
      const y1=side==='before'?eq:Number(state.finalPH);
      return fractions.map(t=>{
        const raw=equilibriumPH(q,startV+t*(endV-startV),model);
        const progress=Math.abs(b-a)<1e-10?t:(raw-a)/(b-a);
        return {v:side==='before'?targetV*t:targetV+(q.maxVolume-targetV)*t,pH:clamp(y0+(y1-y0)*progress,0,14)};
      });
    }
    return {before:half(before,'before'),after:half(after,'after'),equivalencePH:eq};
  }
  function grade(q,s){
    const a=answer(q),n=quantities(q);
    const near=(x,y)=>Number.isFinite(x)&&Math.abs(x-y)<.01;
    const initialRule=q.reverse?'Use the initial [OH⁻] and pH = 14 + log₁₀[OH⁻].':q.acidWeak?'Use [H⁺] ≈ √(Kₐ × c).':`Use [H⁺] = ${q.initialFactor||1} × the acid concentration under the stated model.`;
    const finalRule=q.acidWeak&&q.reverse?'Use the acid/conjugate-base buffer ratio after neutralisation.':q.baseWeak?'Use the ammonia/ammonium buffer ratio after neutralisation.':`Divide the excess ${(q.reverse?'H⁺':'OH⁻')} equivalents by the total volume (${(n.volume+q.maxVolume).toFixed(1)} cm³), then calculate pH.`;
    const names=a.acceptedIndicators.map(id=>indicators.find(i=>i.id===id).name).join(' or ');
    const items=[
      {label:'Before-equivalence shape',correct:s.before===a.before,feedback:`${q.initialName} requires the ${a.before.replace('before-','').replaceAll('-',' ')} section, ${q.reverse?'falling':'rising'}.`},
      {label:'After-equivalence shape',correct:s.after===a.after,feedback:`The added ${q.titrantName} requires the ${a.after.replace('after-','').replaceAll('-',' ')} section.`},
      {label:'Initial pH',correct:near(s.initialPH,a.initialPH),feedback:`${initialRule} Rounded initial pH = ${a.initialPH.toFixed(1)}.`},
      {label:'Equivalence volume',correct:near(s.equivalenceVolume,a.equivalenceVolume),feedback:`Match H⁺ and OH⁻ equivalents: V = (${n.volume} × ${n.initial} × ${q.initialFactor||1}) ÷ (${n.titrant} × ${q.titrantFactor||1}) = ${a.equivalenceVolume.toFixed(1)} cm³.`},
      {label:'Final pH',correct:near(s.finalPH,a.finalPH),feedback:`${finalRule} Rounded final pH = ${a.finalPH.toFixed(1)}.`},
      {label:'Indicator',correct:a.acceptedIndicators.length?a.acceptedIndicators.includes(s.indicator):s.indicator==='none',feedback:`${names||'No listed indicator'}: the transition range must lie within the steep region around equivalence.`}
    ];
    const earned=items.filter(i=>i.correct).length;
    return {score:earned/items.length,earned,total:items.length,items};
  }
  root.TitrationCore=Object.freeze({KW,snap,clamp,quantities,equivalenceVolume,chargeResidual,equilibriumPH,answer,initial,pieces,indicators,suitableIndicators,curve,grade});
  if(typeof module==='object'&&module.exports)module.exports=root.TitrationCore;
})(globalThis);
