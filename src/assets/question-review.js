(function (root) {
  'use strict';
  const capacity = 36 ** 6;
  const initialId = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('review') : null;
  function isTeacher() { return typeof root.ChemistryMode !== 'undefined' ? root.ChemistryMode.get()==='teacher' : new URLSearchParams(location.search).get('mode')==='teacher'; }
  function format(prefix, value) {
    if (!Number.isSafeInteger(value) || value < 0 || value >= capacity) throw new Error('Invalid review ID.');
    return `${prefix}-${value.toString(36).toUpperCase().padStart(6, '0')}`;
  }
  function parse(prefix, text) {
    const match = String(text).trim().toUpperCase().match(new RegExp(`^${prefix}-([0-9A-Z]{6})$`));
    if (!match) throw new Error(`Enter a review ID such as ${prefix}-2PAZNL.`);
    return parseInt(match[1], 36);
  }
  // Source keys, rather than array positions or wording, keep bank IDs stable during edits.
  function bank(prefix, entries, key = q => q.id) {
    const byId = new Map(), byKey = new Map();
    for (const entry of entries) {
      const source = String(key(entry));
      let hash = 2166136261;
      for (const c of source) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
      const id = format(prefix, hash % capacity);
      if (byId.has(id)) throw new Error(`Duplicate review ID ${id}; assign a distinct permanent source key.`);
      byId.set(id, entry); byKey.set(source, id);
    }
    return { id: entry => byKey.get(String(key(entry))), get: text => {
      const id = format(prefix, parse(prefix, text));
      if (!byId.has(id)) throw new Error('That review ID is not in this question bank.');
      return byId.get(id);
    }, entries: byId };
  }
  // Fixed radix per field leaves room to append choices without changing existing IDs.
  function codec(prefix, fields) {
    const modulus = fields.reduce((n, f) => n * f.radix, 1);
    const seeds = Math.floor(capacity / modulus);
    if (seeds < 1) throw new Error('Review configuration exceeds ID capacity.');
    return {
      encode(config, random) {
        let code = 0, place = 1;
        for (const f of fields) {
          const index = f.values.indexOf(config[f.key]);
          if (index < 0 || index >= f.radix) throw new Error(`Unsupported review setting: ${f.key}`);
          code += index * place; place *= f.radix;
        }
        return format(prefix, ((Number(random) >>> 0) % seeds) * modulus + code);
      },
      decode(id) {
        const seed = parse(prefix, id); let code = seed % modulus; const config = {};
        for (const f of fields) {
          const index = code % f.radix; code = Math.floor(code / f.radix);
          if (index >= f.values.length) throw new Error('That review ID contains an unavailable question setting.');
          config[f.key] = f.values[index];
        }
        return { seed, config };
      }
    };
  }
  function sidebar(target) {
    const path=location.pathname;
    if(!isTeacher() && (path.includes('calorimetry') || path.includes('bond-enthalpy'))) return document.querySelector('.practice-progress') || target;
    if(path.includes('calorimetry')) {
      let side=document.getElementById('calReviewSidebar');
      if(!side){side=document.createElement('aside');side.id='calReviewSidebar';side.className='review-sidebar';const layout=document.getElementById('lessonLayout');layout.prepend(side);side.append(document.querySelector('.control-column'));}
      return side;
    }
    if(path.includes('acid-base-calculations')||path.includes('bond-enthalpy'))return document.querySelector('.control-column');
    if(path.includes('structure-and-bonding'))return document.querySelector('.controls');
    if(path.includes('energy-enthalpy')) {
      const teacher=target.closest('.teacher-bank');
      if(!teacher)return document.querySelector('.mastery');
      let side=teacher.querySelector('.review-sidebar');
      if(!side){side=document.createElement('aside');side.className='review-sidebar';teacher.prepend(side);teacher.classList.add('review-teacher-layout');}
      return side;
    }
    if(path.includes('electron-configurations')&&target.id==='questionPanel')return document.querySelector('.progress-panel');
    let anchor=path.includes('molecule-builder')?document.querySelector('.exercise'):path.includes('rocket-recall')?document.querySelector('.flight-deck'):target;
    if(anchor.parentElement.classList.contains('review-side-layout'))return anchor.parentElement.querySelector('.review-sidebar');
    const layout=document.createElement('div'),side=document.createElement('aside');layout.className='review-side-layout';side.className='review-sidebar';anchor.before(layout);layout.append(side,anchor);return side;
  }
  function mount(target, id, load) {
    if (!target || !id) return;
    if (/^[A-Z]+-[0-9A-Z]{6}$/.test(id)) {
      let printId = document.getElementById('printedReviewId');
      if (!printId) {
        printId = document.createElement('div');
        printId.id = 'printedReviewId';
        printId.className = 'printed-review-id';
        document.body.append(printId);
      }
      printId.textContent = `Review ID // ${id}`;
    }
    target=sidebar(target);
    let bar = target.querySelector(':scope > .question-review');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'question-review';
      const label = document.createElement('strong'); label.className = 'question-review-id';
      const form = document.createElement('form'); form.className = 'question-review-loader';
      const input = document.createElement('input'); input.type = 'text'; input.setAttribute('aria-label', 'Review ID to load'); input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'Enter review ID';
      const button = document.createElement('button'); button.type = 'submit'; button.textContent = 'Load question';
      const status = document.createElement('span'); status.className = 'question-review-status'; status.setAttribute('role', 'status');
      form.append(input, button); bar.append(label, form, status); target.prepend(bar);
      form.addEventListener('submit', event => { event.preventDefault(); if(!isTeacher())return; try { bar.load(input.value); } catch (error) { status.textContent = error.message; } });
    }
    bar.load = load;
    bar.querySelector('strong').textContent = `Review ID // ${id}`;
    bar.querySelector('input').value = id;
    bar.querySelector('form').hidden = !load || !isTeacher();
    bar.querySelector('[role="status"]').textContent = '';
    bar.dataset.reviewId = id;
    // Keep mode switches and copied page links on the same question.
    if (load && /^[A-Z]+-[0-9A-Z]{6}$/.test(id)) { const url = new URL(location.href); url.searchParams.set('review', id); try { history.replaceState(null, '', url); } catch (_) {} }
  }
  function requested(load) {
    if(!isTeacher())return;
    const id = initialId;
    if (id) try { load(id); } catch (error) {
      const status = document.querySelector('.question-review-status');
      if (status) status.textContent = error.message;
    }
  }
  function launcher(target, load) {
    if(!isTeacher())return;
    const side=sidebar(target);
    if(side.querySelector('.question-review'))return;
    mount(target, 'Load a question by review ID', load);
    side.querySelector('strong').textContent = 'Load a question by review ID';
    side.querySelector('input').value = '';
  }
  root.QuestionReview = { capacity, format, parse, bank, codec, mount, requested, launcher, isTeacher };
  if (typeof module !== 'undefined') module.exports = root.QuestionReview;
})(globalThis);
