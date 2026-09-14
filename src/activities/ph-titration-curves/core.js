(function(root){
  'use strict';
  const KW=1e-14;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const snap=(x,step)=>Math.round(x/step)*step;
  // Positive residual is excess positive charge; solve in pH space to retain
  // precision through equivalence. Concentrations use total mixed volume.
  function equilibriumPH(q,v,{acidWeak=true,baseWeak=false,reverse=false}={}) {
    const total=(q.acidVolume+v)/1000;
    const initial=q.acidVolume*q.acidConcentration/1000;
    const added=v*q.baseConcentration/1000;
    const ca=(reverse?added:initial)/total, cb=(reverse?initial:added)/total;
    const ka=10**-q.pKa,kbh=10**-9.25;
    function charge(pH){const h=10**-pH;
      return h+(baseWeak?cb*h/(h+kbh):cb)-KW/h-(acidWeak?ca*ka/(h+ka):ca);
    }
    let lo=-2,hi=16;
    for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(charge(mid)>0)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function answer(q){
    const equivalenceVolume=q.acidVolume*q.acidConcentration/q.baseConcentration;
    return {before:q.before,after:q.after,initialPH:snap(equilibriumPH(q,0),.1),equivalenceVolume:snap(equivalenceVolume,.5),finalPH:snap(equilibriumPH(q,q.maxVolume),.1),equivalencePH:equilibriumPH(q,equivalenceVolume),indicator:q.indicator};
  }
  function initial(q){return {before:null,after:null,initialPH:4,equivalenceVolume:snap(q.maxVolume/2,.5),finalPH:10,indicator:null};}
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
    const ve=q.acidVolume*q.acidConcentration/q.baseConcentration;
    const targetV=clamp(Number(state.equivalenceVolume)||q.maxVolume/2,.5,q.maxVolume-.5);
    // Determine joining height from the chosen combination, without asking
    // pupils to calculate salt hydrolysis. Mixed directions remain an
    // intentionally incorrect construction but still share one joining point.
    const reverse=before?before.reverse:after?after.reverse:false;
    const acidWeak=reverse?(after?after.acidWeak:false):(before?before.acidWeak:false);
    const baseWeak=reverse?(before?before.baseWeak:false):(after?after.baseWeak:false);
    const opts={acidWeak,baseWeak,reverse};
    const eq=equilibriumPH(q,ve,opts);
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
    const a=answer(q);
    const near=(x,y,t)=>Number.isFinite(x)&&Math.abs(x-y)<=t+1e-9;
    const items=[
      {label:'Before-equivalence shape',correct:s.before===a.before,feedback:'Ethanoic acid is weak: choose the rising weak-acid section with a buffer region.'},
      {label:'After-equivalence shape',correct:s.after===a.after,feedback:'Excess sodium hydroxide gives the rising strong-base section.'},
      {label:'Initial pH',correct:near(s.initialPH,a.initialPH,.1),feedback:`Use [H⁺] ≈ √(Kₐ × c): initial pH = ${a.initialPH.toFixed(1)}.`},
      {label:'Equivalence volume',correct:near(s.equivalenceVolume,a.equivalenceVolume,.01),feedback:`At equivalence n(NaOH) = n(CH₃COOH). Volume = ${a.equivalenceVolume.toFixed(1)} cm³.`},
      {label:'Final pH',correct:near(s.finalPH,a.finalPH,.1),feedback:`Divide excess moles of OH⁻ by the total volume (${(q.acidVolume+q.maxVolume).toFixed(1)} cm³), then use pH = 14 − pOH: ${a.finalPH.toFixed(1)}.`},
      {label:'Indicator',correct:s.indicator===a.indicator,feedback:'Phenolphthalein changes over pH 8.3–10.0, within the sharp rise. Methyl orange and methyl red change too early.'}
    ];
    const earned=items.filter(i=>i.correct).length;
    return {score:earned/items.length,earned,total:items.length,items};
  }
  root.TitrationCore=Object.freeze({KW,snap,clamp,equilibriumPH,answer,initial,pieces,indicators,curve,grade});
  if(typeof module==='object'&&module.exports)module.exports=root.TitrationCore;
})(globalThis);
