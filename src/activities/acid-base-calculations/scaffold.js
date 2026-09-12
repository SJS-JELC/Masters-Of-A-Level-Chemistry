(function (root) {
  "use strict";

  const core = root.AcidBaseCore;
  const superscriptDigits = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
  const numberSource = String.raw`[+−-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:×|x|\*)\s*10(?:\^?\s*[+−-]?\d+|[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)|[+−-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+−-]?\d+)?`;

  function tolerance(raw, expected) {
    const normalised = String(raw).replace(/[−–—]/g, "-").replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => superscriptDigits[character]);
    const scientific = normalised.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:×|x|\*)\s*10\^?\s*([+-]?\d+)$/i)
      || normalised.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))e([+-]?\d+)$/i);
    const mantissa = scientific ? scientific[1] : normalised;
    const decimalPlaces = (mantissa.split(".")[1] || "").length;
    const scale = scientific ? 10 ** Number(scientific[2]) : 1;
    const roundingTolerance = decimalPlaces ? 0.5000001 * 10 ** (-decimalPlaces) * scale : 0;
    return Math.max(Math.abs(expected) * 1e-9, Math.abs(roundingTolerance), 1e-15);
  }

  function numericTokens(value) {
    const source = String(value);
    return [...source.matchAll(new RegExp(numberSource, "gi"))].filter((match) => {
      const before = source[match.index - 1] || "";
      const after = source[match.index + match[0].length] || "";
      return !/[A-Za-z₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(before)
        && !/[A-Za-z₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(after)
        && before !== "-";
    }).map((match) => {
      const expected = core.enteredNumber(match[0]);
      return Object.freeze({ raw: match[0], index: match.index, expected, tolerance: tolerance(match[0], expected) });
    });
  }

  function prefersStandardForm(value) {
    const magnitude = Math.abs(Number(value));
    return Number.isFinite(magnitude) && magnitude !== 0 && (magnitude < 0.001 || magnitude > 10000);
  }

  function parseStandardParts(value) {
    const normalised = String(value || "").trim().replace(/[−–—]/g, "-").replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => superscriptDigits[character]);
    const match = normalised.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:[eE]|(?:×|x|\*)\s*10\s*\^?\s*)([+-]?\d+)$/);
    return match ? { mantissa: match[1], exponent: match[2] } : null;
  }

  function standardValue(mantissa, exponent) {
    const first = String(mantissa || "").trim();
    const power = String(exponent || "").trim().replace(/[−–—]/g, "-");
    return first && /^[+-]?\d+$/.test(power) ? `${first}e${power}` : "";
  }

  function standardParts(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return { mantissa: String(number || 0), exponent: "0" };
    const exponent = Math.floor(Math.log10(Math.abs(number)));
    const mantissa = Number((number / 10 ** exponent).toPrecision(12));
    return { mantissa: String(mantissa), exponent: String(exponent) };
  }

  root.AcidBaseScaffold = Object.freeze({ numericTokens, prefersStandardForm, parseStandardParts, standardValue, standardParts });
})(typeof globalThis !== "undefined" ? globalThis : window);
