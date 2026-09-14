(function(root){
  'use strict';
  const inputs = [
    ['TC01',25,0.180,0.200,50],
    ['TC02',25,0.120,0.100,50],
    ['TC03',20,0.075,0.100,40],
    ['TC04',25,0.320,0.200,60]
  ];
  root.TitrationData = Object.freeze({version:1, questions:inputs.map(([id,acidVolume,acidConcentration,baseConcentration,maxVolume])=>({
    id, title:'Build the titration curve', level:1, acidVolume,acidConcentration,baseConcentration,maxVolume,pKa:4.76,
    prompt:`${baseConcentration.toFixed(3)} mol dm⁻³ sodium hydroxide is gradually added to ${acidVolume.toFixed(1)} cm³ of ${acidConcentration.toFixed(3)} mol dm⁻³ ethanoic acid (pKₐ = 4.76), until ${maxVolume.toFixed(1)} cm³ has been added. Complete the pH curve and select a suitable indicator. Assume 25 °C.`,
    before:'before-weak-acid',after:'after-strong-base',indicator:'phenolphthalein'
  }))});
  if(typeof module==='object'&&module.exports) module.exports=root.TitrationData;
})(globalThis);
