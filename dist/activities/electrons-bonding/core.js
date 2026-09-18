(function (root) {
  'use strict';

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.,;:!?]+$/, '')
      .trim();
  }

  function knownAnswers(data) {
    return (data?.questions || []).flatMap(question => (question.fields || [])
      .flatMap(field => field.accept || []).map(normalize).filter(Boolean));
  }

  // Short responses are deliberately exact after light typography cleanup.
  // This keeps marking inspectable and prevents free-prose fuzzy matches.
  function markField(field, value, data) {
    const response = normalize(value);
    if (!response) return 'empty';
    if ((field?.accept || []).some(answer => normalize(answer) === response)) return 'correct';
    if ((field?.reject || []).some(answer => normalize(answer) === response)) return 'incorrect';
    if (/\b(?:not|or|neither|both)\b/.test(response)) return 'incorrect';
    const numeric = /^[+-]?\d+(?:\.\d+)?(?:\s+[a-z][a-z-]*)?$/;
    if (numeric.test(response) && (field?.accept || []).some(answer => numeric.test(normalize(answer)))) return 'incorrect';
    if (knownAnswers(data).includes(response)) return 'incorrect';
    return 'unknown';
  }

  function mark(question, answers, data) {
    if (question.responseFormat === 'full-answer') {
      const response = normalize(answers?.[0]);
      if (!response) return {states:['empty'], marks:question.points.map(() => false), ready:false};
      const model = (question.fields[0].accept || []).some(value => normalize(value) === response);
      // Conservative, inspectable concept matching; contradictory negations do not earn marks.
      const negated = /\b(not|never|no|neither|isn't|aren't|cannot)\b/.test(response);
      const marks = question.rules
        ? question.rules.map(patterns => !negated && (model || patterns.every(pattern => new RegExp(pattern, 'i').test(response))))
        : [model];
      return {states:[marks.every(Boolean) ? 'correct' : 'incorrect'], marks, ready:true};
    }
    const fields = question?.fields || [];
    const states = fields.map((field, index) => markField(field, answers?.[index], data));
    return {
      states,
      marks: states.map(state => state === 'correct'),
      ready: states.every(state => state !== 'empty' && state !== 'unknown')
    };
  }

  function score(marks) {
    if (!Array.isArray(marks) || !marks.length) return 0;
    if (marks.every(Boolean)) return 1;
    return marks.some(Boolean) ? 0.5 : 0;
  }

  const api = Object.freeze({ normalize, markField, mark, score });
  root.BondingCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
