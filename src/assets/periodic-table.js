(function (root) {
  'use strict';
  let nextId = 0;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function icon() {
    const cells = [];
    for (let row=0; row<7; row++) for (let col=0; col<18; col++) {
      if (row===0 ? col===0 || col===17 : row<3 ? col<2 || col>11 : true) cells.push(`<rect x="${col*3.2+1}" y="${row*3.8+1}" width="2.3" height="2.8" rx=".4"/>`);
    }
    for (let row=0; row<2; row++) for (let col=2; col<17; col++) cells.push(`<rect x="${col*3.2+1}" y="${row*3.8+29}" width="2.3" height="2.8" rx=".4"/>`);
    return `<svg class="ocr-periodic-icon" viewBox="0 0 59 37" aria-hidden="true" focusable="false" fill="currentColor">${cells.join('')}</svg>`;
  }
  function table(data) {
    const oldGroups = {1:1,2:2,13:3,14:4,15:5,16:6,17:7,18:0};
    const parts = Object.entries(oldGroups).map(([column,group]) => `<span class="ocr-periodic-old-group" style="grid-column:${column};grid-row:1" aria-label="Traditional group ${group}">(${group})</span>`);
    parts.push('<div class="ocr-periodic-key" style="grid-column:4 / span 4;grid-row:2 / span 2"><strong>Key</strong><span>atomic number</span><b>Symbol</b><small>name</small><span>relative atomic mass</span></div>');
    for (const e of data.elements) {
      const firstInGroup = e.z===1 || e.z===2 || e.z===4 || (e.z>=5 && e.z<=9) || (e.z>=21 && e.z<=30);
      const group = firstInGroup ? `<span class="ocr-periodic-group" aria-label="Group ${e.column}">${e.column}</span>` : '';
      const label = `${e.name}, ${e.symbol}, atomic number ${e.z}${e.mass ? ', relative atomic mass '+e.mass : ', relative atomic mass not supplied'}`;
      parts.push(`<div class="ocr-periodic-element" data-atomic-number="${e.z}" style="grid-column:${e.column};grid-row:${e.row+1}" role="img" aria-label="${escape(label)}">${group}<span class="ocr-periodic-number">${e.z}</span><strong class="ocr-periodic-symbol">${e.symbol}</strong><span class="ocr-periodic-name">${e.name}</span><span class="ocr-periodic-mass">${e.mass || ''}</span></div>`);
    }
    for (const [row,range,name] of [[7,'57–71','lanthanoids'],[8,'89–103','actinoids']]) parts.push(`<div class="ocr-periodic-series" style="grid-column:3;grid-row:${row}"><span>${range}</span><small>${name}</small></div>`);
    for (const column of [13,15,17,18]) parts.push(`<div class="ocr-periodic-blank" style="grid-column:${column};grid-row:8" aria-hidden="true"></div>`);
    for (const [row,name] of [[10,'Lanthanoids'],[11,'Actinoids']]) parts.push(`<span class="ocr-periodic-series-label" style="grid-column:1 / span 2;grid-row:${row}">${name}</span>`);
    return parts.join('');
  }
  function mount(button, options={}) {
    if (!button) throw new Error('PeriodicTable.mount requires a launch button.');
    if (button.periodicTable) return button.periodicTable;
    const data = root.PeriodicTableData;
    if (!data || data.elements.length!==114) throw new Error('Load periodic-table-data.js before mounting the reference.');
    const id = options.id || `ocr-periodic-dialog-${++nextId}`;
    const dialog = document.createElement('dialog');
    dialog.id = id; dialog.className = 'ocr-periodic-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.innerHTML = `<header class="ocr-periodic-heading"><div><p>CHEMISTRY REFERENCE</p><h2 id="${id}-title">Periodic table of the elements</h2></div><button type="button" class="ocr-periodic-close" aria-label="Close periodic table" autofocus><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></header><div class="ocr-periodic-paper"><div class="ocr-periodic-scroll" tabindex="0" role="region" aria-label="Periodic table; scroll horizontally to see all groups"><div class="ocr-periodic-grid">${table(data)}</div></div></div><footer class="ocr-periodic-footer"><span>OCR Chemistry A · 2020 data sheet</span><span>Values and blank entries follow the supplied edition. Scroll across on smaller screens.</span></footer>`;
    document.body.append(dialog);
    button.classList.add('ocr-periodic-trigger');
    button.innerHTML = icon() + '<span class="ocr-periodic-trigger-label">Periodic table</span>';
    button.setAttribute('aria-label','Periodic table');
    button.setAttribute('title','Open periodic table');
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls',id);
    const open = () => dialog.showModal();
    const close = () => dialog.close();
    button.addEventListener('click',open);
    dialog.querySelector('.ocr-periodic-close').addEventListener('click',close);
    // Native dialog handles Escape, focus trapping and restoration to the trigger.
    const api = {dialog,open,close};
    button.periodicTable = api;
    return api;
  }
  root.PeriodicTable = {mount};
})(globalThis);
