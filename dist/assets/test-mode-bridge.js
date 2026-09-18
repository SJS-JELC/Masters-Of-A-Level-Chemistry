(function (root) {
  'use strict';
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('testSession'), attemptId = params.get('testAttempt');
  const enabled = Boolean(sessionId && attemptId && root.parent !== root);
  let connection;
  function send(type, payload) {
    if (enabled) root.parent.postMessage({channel:'masters-test-mode', type, sessionId, attemptId, payload}, location.origin === 'null' ? '*' : location.origin);
  }
  if (enabled) {
    document.documentElement.classList.add('test-mode-embedded');
    const style = document.createElement('style');
    style.textContent = '.test-mode-embedded body,.test-mode-embedded .workspace-panel{min-height:0!important}.test-mode-embedded .site-back-link,.test-mode-embedded [data-mode-toggle],.test-mode-embedded .review-id,.test-mode-embedded .review-tools,.test-mode-embedded .print-button,.test-mode-embedded footer{display:none!important}';
    style.textContent += '.test-mode-embedded .test-transferred-title,.test-mode-embedded .question-top,.test-mode-embedded .question-topline,.test-mode-embedded .practice-heading,.test-mode-embedded .question-meta{display:none!important}.test-mode-embedded .page{padding-top:0!important}.test-mode-embedded .question-panel{margin-top:0!important}.test-mode-embedded .question-header{margin:0!important;padding:0!important}';
    document.head.append(style);
    root.addEventListener('error', () => send('error', {message:'This question could not be loaded. Retry or return to your gem selection.'}));
    root.addEventListener('unhandledrejection', () => send('error', {message:'This question could not be restored. Retry or return to your gem selection.'}));
  }
  function connect() {
    if (!enabled) return Promise.resolve(null);
    if (!connection) connection = new Promise(resolve => {
      function receive(event) {
        const data = event.data;
        if (event.origin !== location.origin || event.source !== root.parent || !data || data.channel !== 'masters-test-mode' ||
          data.sessionId !== sessionId || data.attemptId !== attemptId || data.type !== 'init') return;
        root.removeEventListener('message', receive);
        if (root.ResizeObserver) {
          let lastHeight = 0;
          const observer = new ResizeObserver(() => {
            const height = Math.ceil(document.body.getBoundingClientRect().height) + 4;
            if (height !== lastHeight) { lastHeight = height; send('resize', {height}); }
          });
          observer.observe(document.body);
        }
        const reportTitle = () => {
          const title = document.querySelector('#questionTitle, [data-question-title], #questionPanel .question-header h3');
          const text = title?.textContent?.trim() || 'Question';
          const questionId = document.querySelector('.review-id, .question-review-id, #printedReviewId')?.textContent?.trim() || '';
          const signature = text + '\\n' + questionId;
          if (signature !== reportTitle.previous) { reportTitle.previous = signature; send('title',{title:text,questionId}); }
          if (title) title.classList.add('test-transferred-title');
        };
        if (root.MutationObserver) new MutationObserver(reportTitle).observe(document.body,{childList:true,subtree:true,characterData:true});
        reportTitle();
        resolve({...data.payload, sessionId, attemptId,
          save: state => send('state', state), result: result => send('result', result), next: () => send('next')});
      }
      root.addEventListener('message', receive);
      send('ready');
    });
    return connection;
  }
  root.TestModeBridge = Object.freeze({connect, save: state => send('state', state), result: result => send('result', result), next: () => send('next')});
})(globalThis);
