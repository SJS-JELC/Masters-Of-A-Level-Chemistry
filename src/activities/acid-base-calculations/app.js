(function () {
  "use strict";

  const core = window.AcidBaseCore;
  const scaffoldCore = window.AcidBaseScaffold;
  const elements = {
    level: document.getElementById("difficulty"), family: document.getElementById("family"),
    template: document.getElementById("template"), structure: document.getElementById("structure"),
    generate: document.getElementById("generate"), meta: document.getElementById("questionMeta"),
    question: document.getElementById("questionPanel"), answerPanel: document.getElementById("answerPanel"),
    answer: document.getElementById("answerContent"), seedInput: document.getElementById("seedInput"),
    loadSeed: document.getElementById("loadSeed"), seedFeedback: document.getElementById("seedFeedback")
  };
  let currentQuestion = null;
  let currentQuestionId = null;
  let seedCounter = 0;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
  }

  function notationHtml(value) {
    const ratio = String(value).match(/^(.+) : (.+)\n(\d+) : (\d+)$/);
    if (ratio) {
      return `<span class="mole-ratio" aria-label="Mole ratio"><span>${escapeHtml(ratio[1])}</span><span>:</span><span>${escapeHtml(ratio[2])}</span><span>${ratio[3]}</span><span>:</span><span>${ratio[4]}</span></span>`;
    }
    return escapeHtml(value)
      .replace(/10⁻([0-9]+(?:\.[0-9]+)?)/g, "10<sup>−$1</sup>")
      .replace(/pK_a/g, "pK<sub>a</sub>")
      .replace(/K_w/g, "K<sub>w</sub>")
      .replace(/K_a/g, "K<sub>a</sub>")
      .replace(/M_r/g, "M<sub>r</sub>")
      .replace(/V\(((?:[^()]|\([^)]*\))+?)\)/g, "Volume of $1")
      .replace(/c₂\(((?:[^()]|\([^)]*\))+?)\)/g, "[$1]₂")
      .replace(/c\(((?:[^()]|\([^)]*\))+?)\)/g, "[$1]")
      .replace(/\bc₁\b/g, "initial concentration")
      .replace(/\bc₂\b/g, "diluted concentration");
  }

  function isWrappedInParentheses(text) {
    if (!(text.startsWith("(") && text.endsWith(")"))) return false;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "(") depth += 1;
      if (text[index] === ")") depth -= 1;
      if (depth === 0 && index < text.length - 1) return false;
    }
    return depth === 0;
  }

  function topLevelSlash(text) {
    let roundDepth = 0;
    let squareDepth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "(") roundDepth += 1;
      else if (text[index] === ")") roundDepth -= 1;
      else if (text[index] === "[") squareDepth += 1;
      else if (text[index] === "]") squareDepth -= 1;
      else if (text[index] === "/" && roundDepth === 0 && squareDepth === 0) return index;
    }
    return -1;
  }

  function denominatorEnd(text) {
    let roundDepth = 0;
    let squareDepth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "(") roundDepth += 1;
      else if (text[index] === ")") roundDepth -= 1;
      else if (text[index] === "[") squareDepth += 1;
      else if (text[index] === "]") squareDepth -= 1;
      if (roundDepth === 0 && squareDepth === 0) {
        const scientificPower = text.startsWith(" × 10", index) && /[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(text[index + 5] || "");
        if ((text.startsWith(" × ", index) && !scientificPower) || text.startsWith(" + ", index) || text.startsWith(" − ", index)) return index;
      }
    }
    return text.length;
  }

  function renderMathExpression(source) {
    const text = String(source).trim();
    if (isWrappedInParentheses(text)) return `(${renderMathExpression(text.slice(1, -1))})`;
    const slash = topLevelSlash(text);
    if (slash < 0) return notationHtml(text);
    const numerator = text.slice(0, slash).trim();
    const remainder = text.slice(slash + 1);
    const end = denominatorEnd(remainder);
    const denominator = remainder.slice(0, end).trim();
    const suffix = remainder.slice(end);
    return `<span class="fraction"><span>${renderMathExpression(numerator)}</span><span>${renderMathExpression(denominator)}</span></span>${suffix ? ` ${renderMathExpression(suffix)}` : ""}`;
  }

  function workingRows(lines) {
    return lines.flatMap((line) => String(line).split(";")).flatMap((line) => {
      const clean = line.trim();
      if (!clean) return [];
      const parts = clean.split(" = ");
      if (parts.length < 2) return [{ type: "note", text: clean }];
      return parts.slice(1).map((right, index) => ({ type: "equation", left: index === 0 ? parts[0] : "", right }));
    });
  }

  function scaffoldNumericMatches(value) {
    return scaffoldCore.numericTokens(value);
  }

  function workingEditorMarkup(expected, tolerance, partIndex, fieldNumber) {
    const label = `Working number ${fieldNumber} for part ${String.fromCharCode(97 + partIndex)}`;
    const standardControl = scaffoldCore.prefersStandardForm(expected)
      ? `<span class="working-standard-entry" hidden><input class="working-mantissa-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${label}, standard-form mantissa"><span aria-hidden="true">× 10</span><input class="working-exponent-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${label}, standard-form exponent"></span><button class="working-notation-toggle" type="button" data-working-notation-toggle aria-pressed="false" title="Enter this number in standard form">×10ⁿ</button>`
      : "";
    return `<span class="working-entry"><span class="working-value-entry" data-working-editor data-mode="decimal" data-expected="${expected}" data-tolerance="${tolerance}"><input class="working-input" id="working-${partIndex}-${fieldNumber}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${label}">${standardControl}</span><span class="working-marker" aria-hidden="true"></span></span>`;
  }

  function scaffoldText(value, partIndex, fieldState) {
    const source = String(value);
    let cursor = 0;
    let html = "";
    for (const match of scaffoldNumericMatches(source)) {
      html += notationHtml(source.slice(cursor, match.index));
      const token = match.raw;
      const expected = match.expected;
      const fieldNumber = ++fieldState.count;
      if (fieldNumber === fieldState.total) {
        html += `<span class="scaffold-final-slot" data-final-slot="${partIndex}" data-expected="${fieldState.finalExpected}" data-tolerance="${fieldState.finalTolerance}"><span class="working-marker" aria-hidden="true"></span></span>`;
      } else {
        html += workingEditorMarkup(expected, match.tolerance, partIndex, fieldNumber);
      }
      cursor = match.index + token.length;
    }
    return html + notationHtml(source.slice(cursor));
  }

  function scaffoldMathExpression(source, partIndex, fieldState) {
    const text = String(source).trim();
    if (isWrappedInParentheses(text)) return `(${scaffoldMathExpression(text.slice(1, -1), partIndex, fieldState)})`;
    const slash = topLevelSlash(text);
    if (slash < 0) return scaffoldText(text, partIndex, fieldState);
    const numerator = text.slice(0, slash).trim();
    const remainder = text.slice(slash + 1);
    const end = denominatorEnd(remainder);
    const denominator = remainder.slice(0, end).trim();
    const suffix = remainder.slice(end);
    return `<span class="fraction"><span>${scaffoldMathExpression(numerator, partIndex, fieldState)}</span><span>${scaffoldMathExpression(denominator, partIndex, fieldState)}</span></span>${suffix ? ` ${scaffoldMathExpression(suffix, partIndex, fieldState)}` : ""}`;
  }

  function renderScaffold(lines, partIndex, response) {
    const rows = workingRows(lines);
    const total = rows.reduce((sum, row) => sum + (row.type === "equation" ? scaffoldNumericMatches(row.right).length : 0), 0);
    if (!total) return { html: "", count: 0 };
    const fieldState = { count: 0, total, finalExpected: response.expected, finalTolerance: response.tolerance };
    const content = rows.map((row) => row.type === "note"
      ? `<p class="math-note scaffold-note">${notationHtml(row.text)}</p>`
      : `<div class="scaffold-math-row"><span class="math-lhs">${notationHtml(row.left)}</span><span class="math-equals">=</span><span class="math-rhs">${scaffoldMathExpression(row.right, partIndex, fieldState)}</span></div>`).join("");
    return { html: content, count: fieldState.count };
  }

  function refill(select, options, previous) {
    select.innerHTML = options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join("");
    if (options.some((option) => option.id === previous)) select.value = previous;
  }

  function syncFamilies() {
    const oldFamily = elements.family.value;
    refill(elements.family, core.familyOptions(elements.level.value), oldFamily);
    syncTemplates();
  }

  function syncTemplates() {
    const oldTemplate = elements.template.value;
    refill(elements.template, core.templateOptions(elements.family.value, elements.level.value), oldTemplate);
  }

  function randomUint32() {
    seedCounter += 1;
    if (window.crypto && window.crypto.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0];
    }
    return ((Date.now() & 0x7FFFFFFF) ^ Math.imul(seedCounter, 2654435761)) >>> 0;
  }

  function responseMarkup(item, index, working, unstructured) {
    const printWorkingSpace = core.printWorkingSpace(working, unstructured ? 200 : 58);
    const scaffold = renderScaffold(working, index, item);
    return `<div class="response-row" data-response="${escapeHtml(item.key)}" style="--print-working-space: ${printWorkingSpace}mm">
      <div class="response-prompt"><label for="response-${index}"><span class="part-label">${String.fromCharCode(97 + index)}</span>${notationHtml(item.prompt)}</label>${scaffold.count ? `<button class="scaffold-toggle" type="button" data-scaffold-toggle="${index}" aria-expanded="false" aria-controls="scaffold-${index}" aria-label="Show working framework for part ${String.fromCharCode(97 + index)}" title="Show working framework">?</button>` : ""}</div>
      ${scaffold.count ? `<div class="working-scaffold" id="scaffold-${index}" hidden>${scaffold.html}<div class="scaffold-actions"><button type="button" data-check-scaffold="${index}">Check working</button><p class="scaffold-feedback" id="scaffold-feedback-${index}" aria-live="polite"></p></div></div>` : ""}
      <div class="answer-line">
        <span class="symbol">${notationHtml(item.symbol)} =</span>
        <input class="response-input" id="response-${index}" type="text" inputmode="decimal" autocomplete="off" aria-describedby="feedback-${index}">
        ${item.unit ? `<span class="unit">${notationHtml(item.unit)}</span>` : ""}
        <span class="result-mark" aria-hidden="true"></span>
      </div>
      <p class="feedback" id="feedback-${index}"></p>
    </div>`;
  }

  function renderQuestion(question) {
    const rows = question.rows.map((item) => `<tr><th scope="row">${notationHtml(item.label)}</th><td>${notationHtml(item.value)}</td></tr>`).join("");
    const responses = question.responses.map((item, index) => responseMarkup(item, index, question.answerParts[index], question.structure === "single")).join("");
    elements.question.innerHTML = `<div class="question-toolbar">
      <div><p class="question-kicker">Numerical question</p><h2>${notationHtml(question.templateLabel)}</h2></div>
      <button class="print-button" id="printQuestion" type="button">Print</button>
    </div>
    <p class="scaffold-key"><span aria-hidden="true">?</span>Open a working framework beside any calculation part if you need one.</p>
    <p class="question-intro">${notationHtml(question.intro)}</p>
    <table class="data-table"><tbody>${rows}</tbody></table>
    <p class="rounding-note">Give pH and pK<sub>a</sub> values to 2 decimal places. Give other numerical answers to 3 significant figures unless exact.</p>
    <div class="response-list">${responses}</div>
    <div class="check-row"><button class="check-button" id="checkAnswers" type="button">Check answers</button><p id="checkSummary" aria-live="polite"></p></div>`;
    document.getElementById("checkAnswers").addEventListener("click", checkAnswers);
    document.getElementById("printQuestion").addEventListener("click", () => window.print());
    elements.question.querySelectorAll(".response-input").forEach((input) => input.addEventListener("input", clearMark));
    elements.question.querySelectorAll(".working-input").forEach((input) => input.addEventListener("input", clearWorkingMark));
    elements.question.querySelectorAll(".working-mantissa-input, .working-exponent-input").forEach((input) => input.addEventListener("input", clearWorkingMark));
    elements.question.querySelectorAll("[data-working-notation-toggle]").forEach((button) => button.addEventListener("click", () => toggleWorkingNotation(button)));
    elements.question.querySelectorAll("[data-scaffold-toggle]").forEach((button) => button.addEventListener("click", () => toggleScaffold(button)));
    elements.question.querySelectorAll("[data-check-scaffold]").forEach((button) => button.addEventListener("click", () => checkScaffold(button)));
  }

  function renderAnswer(question) {
    const renderPart = (lines) => workingRows(lines).map((item) => item.type === "note"
      ? `<p class="math-note">${notationHtml(item.text)}</p>`
      : `<div class="math-row"><span class="math-lhs">${notationHtml(item.left)}</span><span class="math-equals">=</span><span class="math-rhs">${renderMathExpression(item.right)}</span></div>`).join("");
    const parts = question.answerParts.length > 1
      ? `<ol class="answer-parts" type="a">${question.answerParts.map((part) => `<li class="answer-part"><div class="worked-block">${renderPart(part)}</div></li>`).join("")}</ol>`
      : `<div class="worked-block">${renderPart(question.answerParts[0])}</div>`;
    elements.answer.innerHTML = `<h2 class="print-only worked-answer-print-title">WORKED ANSWER</h2>${parts}`;
    elements.answerPanel.hidden = false;
    elements.answerPanel.open = false;
  }

  function toggleScaffold(button) {
    const scaffold = document.getElementById(button.getAttribute("aria-controls"));
    if (!scaffold || !scaffold.hidden) return;
    const responseRow = button.closest(".response-row");
    const answerLine = responseRow.querySelector(".answer-line");
    const finalInput = answerLine.querySelector(".response-input");
    const finalSlot = scaffold.querySelector(".scaffold-final-slot");
    if (finalSlot && finalInput) {
      finalInput.dataset.expected = finalSlot.dataset.expected;
      finalInput.dataset.tolerance = finalSlot.dataset.tolerance;
      finalInput.classList.add("working-input", "scaffold-final-input");
      finalInput.addEventListener("input", clearWorkingMark);
      finalSlot.insertBefore(finalInput, finalSlot.querySelector(".working-marker"));
      answerLine.hidden = true;
    }
    scaffold.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", `Working framework open for part ${String.fromCharCode(97 + Number(button.dataset.scaffoldToggle))}`);
    button.title = "Working framework open";
    button.disabled = true;
    scaffold.querySelector(".working-input")?.focus();
  }

  function workingEditorValue(editor) {
    if (editor.dataset.mode === "standard") {
      return scaffoldCore.standardValue(editor.querySelector(".working-mantissa-input")?.value, editor.querySelector(".working-exponent-input")?.value);
    }
    return editor.querySelector(".working-input")?.value || "";
  }

  function toggleWorkingNotation(button) {
    const editor = button.closest("[data-working-editor]");
    const decimalInput = editor.querySelector(".working-input");
    const standardEntry = editor.querySelector(".working-standard-entry");
    const mantissaInput = editor.querySelector(".working-mantissa-input");
    const exponentInput = editor.querySelector(".working-exponent-input");
    const toStandard = editor.dataset.mode !== "standard";
    if (toStandard) {
      const entered = decimalInput.value.trim();
      let parts = scaffoldCore.parseStandardParts(entered);
      if (!parts && entered && Number.isFinite(core.enteredNumber(entered))) parts = scaffoldCore.standardParts(core.enteredNumber(entered));
      if (parts) {
        mantissaInput.value = parts.mantissa;
        exponentInput.value = parts.exponent;
      }
      editor.dataset.mode = "standard";
      decimalInput.hidden = true;
      standardEntry.hidden = false;
      button.textContent = "123";
      button.title = "Use a single number field";
      button.setAttribute("aria-pressed", "true");
      mantissaInput.focus();
    } else {
      const combined = scaffoldCore.standardValue(mantissaInput.value, exponentInput.value);
      if (combined) decimalInput.value = combined;
      editor.dataset.mode = "decimal";
      standardEntry.hidden = true;
      decimalInput.hidden = false;
      button.textContent = "×10ⁿ";
      button.title = "Enter this number in standard form";
      button.setAttribute("aria-pressed", "false");
      decimalInput.focus();
    }
    clearWorkingField(editor);
  }

  function clearWorkingField(field) {
    field.classList.remove("working-correct", "working-incorrect", "working-unanswered");
    field.querySelectorAll?.("input").forEach((input) => {
      input.classList.remove("working-correct", "working-incorrect", "working-unanswered");
      input.removeAttribute("aria-invalid");
    });
    if (field.matches?.("input")) {
      field.classList.remove("working-correct", "working-incorrect", "working-unanswered");
      field.removeAttribute("aria-invalid");
    }
    const marker = field.nextElementSibling;
    if (marker?.classList.contains("working-marker")) {
      marker.textContent = "";
      marker.classList.remove("correct", "incorrect");
    }
    const feedback = field.closest(".working-scaffold")?.querySelector(".scaffold-feedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("all-correct", "has-errors");
    }
  }

  function clearWorkingMark(event) {
    clearWorkingField(event.target.closest("[data-working-editor]") || event.target);
  }

  function checkScaffold(button) {
    const scaffold = document.getElementById(`scaffold-${button.dataset.checkScaffold}`);
    const fields = [...scaffold.querySelectorAll("[data-working-editor], .scaffold-final-input")];
    let correct = 0;
    let unanswered = 0;
    fields.forEach((field) => {
      const marker = field.nextElementSibling;
      const value = field.matches("[data-working-editor]") ? workingEditorValue(field) : field.value;
      const expected = Number(field.dataset.expected);
      const allowedTolerance = Number(field.dataset.tolerance);
      clearWorkingField(field);
      marker.classList.remove("correct", "incorrect");
      if (!value.trim()) {
        unanswered += 1;
        field.classList.add("working-unanswered");
        marker.textContent = "";
        return;
      }
      const result = core.markNumber(value, { expected, tolerance: allowedTolerance });
      const isCorrect = result.status === "correct";
      field.classList.add(isCorrect ? "working-correct" : "working-incorrect");
      marker.classList.add(isCorrect ? "correct" : "incorrect");
      marker.textContent = isCorrect ? "✓" : "×";
      if (isCorrect) {
        correct += 1;
      } else {
        field.querySelector?.("input:not([hidden])")?.setAttribute("aria-invalid", "true");
        if (field.matches("input")) field.setAttribute("aria-invalid", "true");
      }
    });
    const feedback = scaffold.querySelector(".scaffold-feedback");
    feedback.classList.remove("all-correct", "has-errors");
    if (correct === fields.length) {
      feedback.textContent = `All ${fields.length} numbers are correct.`;
      feedback.classList.add("all-correct");
    } else {
      const wrong = fields.length - correct - unanswered;
      feedback.textContent = `${correct}/${fields.length} correct${wrong ? `; ${wrong} to fix` : ""}${unanswered ? `; ${unanswered} still blank` : ""}.`;
      feedback.classList.add("has-errors");
    }
  }

  function clearMark(event) {
    const container = event.target.closest(".response-row");
    container.classList.remove("correct", "incorrect", "missing");
    container.querySelector(".feedback").textContent = "";
    const summary = document.getElementById("checkSummary");
    if (summary) summary.textContent = "";
  }

  function checkAnswers() {
    let correct = 0;
    currentQuestion.responses.forEach((answer, index) => {
      const input = document.getElementById(`response-${index}`);
      const container = input.closest(".response-row");
      const feedback = container.querySelector(".feedback");
      const result = core.markNumber(input.value, answer);
      container.classList.remove("correct", "incorrect", "missing");
      container.classList.add(result.status);
      if (result.status === "correct") {
        correct += 1;
        feedback.textContent = "Correct.";
      } else if (result.status === "missing") {
        feedback.textContent = "Enter a numerical value.";
      } else {
        feedback.textContent = `Check the calculation. Expected ${core.display(answer.expected, answer.format)}${answer.unit ? ` ${answer.unit}` : ""}.`;
      }
    });
    document.getElementById("checkSummary").textContent = `${correct} of ${currentQuestion.responses.length} correct`;
  }

  function renderGenerated(question, seed) {
    currentQuestion = question;
    currentQuestionId = core.formatQuestionId(seed);
    renderQuestion(question);
    renderAnswer(question);
    QuestionReview.mount(elements.question, currentQuestionId, loadReview);
    const structureLabel = question.structure === "single" ? "single calculation" : question.structure === "staged" ? "staged parts" : "direct";
    elements.meta.innerHTML = `${notationHtml(question.familyLabel)} · ${notationHtml(question.target)} · ${structureLabel}`;
    elements.seedInput.value = currentQuestionId;
    elements.seedFeedback.textContent = "";
    elements.seedFeedback.classList.remove("error-text");
  }

  function generateRandomQuestion() {
    try {
      const provisionalSeed = randomUint32();
      const selected = { level: elements.level.value, family: elements.family.value, template: elements.template.value, structure: elements.structure.value };
      const provisional = core.generate(selected, provisionalSeed);
      const encodedStructure = provisional.structure === "single" ? "single" : "staged";
      const seed = core.encodeQuestionId(provisional.templateId, provisional.level, encodedStructure, provisionalSeed);
      const question = core.generate({ level: provisional.level, family: provisional.familyId, template: provisional.templateId, structure: encodedStructure }, seed);
      renderGenerated(question, seed);
    } catch (error) {
      showGenerationError(error);
    }
  }

  function loadReview(id) {
    core.decodeQuestionId(id);
    elements.seedInput.value = id;
    loadQuestionId();
  }

  function loadQuestionId() {
    if (!QuestionReview.isTeacher()) return;
    try {
      const decoded = core.decodeQuestionId(elements.seedInput.value);
      elements.level.value = String(decoded.level);
      syncFamilies();
      elements.family.value = decoded.template.family;
      syncTemplates();
      elements.template.value = decoded.template.id;
      elements.structure.value = decoded.structure;
      const question = core.generate({ level: decoded.level, family: decoded.template.family, template: decoded.template.id, structure: decoded.structure }, decoded.seed);
      renderGenerated(question, decoded.seed);
      elements.seedFeedback.textContent = "Question loaded.";
    } catch (error) {
      elements.seedFeedback.textContent = error.message;
      elements.seedFeedback.classList.add("error-text");
    }
  }

  function showGenerationError(error) {
    elements.question.innerHTML = `<div class="error"><strong>Question could not be generated.</strong><p>${escapeHtml(error.message)}</p></div>`;
    elements.answerPanel.hidden = true;
    elements.meta.textContent = "Generation error";
  }

  elements.level.addEventListener("change", syncFamilies);
  elements.family.addEventListener("change", syncTemplates);
  elements.generate.addEventListener("click", generateRandomQuestion);
  elements.loadSeed.addEventListener("click", loadQuestionId);
  elements.seedInput.addEventListener("keydown", (event) => { if (event.key === "Enter") loadQuestionId(); });
  elements.seedInput.addEventListener("input", () => { elements.seedFeedback.textContent = ""; elements.seedFeedback.classList.remove("error-text"); });

  let printState = false;
  window.addEventListener("beforeprint", () => { printState = elements.answerPanel.open; elements.answerPanel.open = true; });
  window.addEventListener("afterprint", () => { elements.answerPanel.open = printState; });

  syncFamilies();
  elements.seedInput.closest('.seed-loader').hidden = true;
  generateRandomQuestion();
  QuestionReview.requested(loadReview);
})();
