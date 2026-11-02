'use strict';

// Non-English catalogs are explicitly marked as incomplete automatic translations.
const PG_REVIEWED_LANGUAGES = Object.freeze(['en']);
const PG_READY_LANGUAGES = Object.freeze(['en','ka','es','fr','de','it','pt','tr','ru','uk','ar','fa','hi','bn','id','vi','th','zh-CN','ja','ko','nl','pl','ro','el','cs','hu','sw']);

/* Local catalog loader. Catalogs contain interface copy only; account data stays in the browser. */
function createPortgainyI18n(languages, loadCatalog) {
  const supported = new Set(languages.map(item => item.code));
  let language = 'en', catalog = Object.create(null), requestId = 0;
  const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const isolate = value => ['ar','fa'].includes(language) ? `\u2068${String(value)}\u2069` : String(value);

  function placeholders(value) {
    return [...String(value).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
  }

  function numericValues(value) {
    const starts = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50];
    const ascii = String(value).replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, '').replace(/[٠-٩۰-۹०-९০-৯๐-๙]/g, digit => {
      const point = digit.codePointAt(0), start = starts.find(base => point >= base && point < base + 10);
      return String(point - start);
    });
    return (ascii.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map(number => number.replaceAll(',', '')).sort();
  }

  function safeTranslation(source, translation) {
    if (typeof translation !== 'string' || !translation.trim()) return source;
    const expected = placeholders(source), actual = placeholders(translation);
    const numbers = numericValues(source), translatedNumbers = numericValues(translation);
    return expected.length === actual.length && expected.every((value, i) => value === actual[i])
      && numbers.length === translatedNumbers.length && numbers.every((value, i) => value === translatedNumbers[i]) ? translation : source;
  }

  async function use(code) {
    if (!supported.has(code)) throw new Error('Unsupported language');
    const request = ++requestId;
    const next = code === 'en' ? Object.create(null) : await loadCatalog(code);
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Invalid language catalog');
    if (request !== requestId) return false;
    catalog = next;
    language = code;
    return true;
  }

  function text(source, parameters = {}) {
    source = String(source ?? '');
    const translated = safeTranslation(source, catalog[source]);
    return translated.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      Object.hasOwn(parameters, name) ? isolate(parameters[name]) : match);
  }

  function html(source, parameters = {}) {
    return escapeHtml(text(source, parameters));
  }

  // Structural placeholders let translators move emphasis without introducing HTML.
  function rich(source, parameters = {}) {
    source = String(source ?? '');
    let translated = safeTranslation(source, catalog[source]);
    function validEmphasis(value) {
      let open = null;
      for (const match of value.matchAll(/\{(strongStart|strongEnd|timerStart|timerEnd)\}/g)) {
        const name = match[1];
        if (name.endsWith('Start')) { if (open) return false; open = name.slice(0, -5); }
        else { if (!open || name !== `${open}End`) return false; open = null; }
      }
      return open === null;
    }
    if (!validEmphasis(translated)) translated = source;
    let result = '', offset = 0;
    for (const match of translated.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
      result += escapeHtml(translated.slice(offset, match.index));
      const name = match[1];
      if (name === 'strongStart') result += '<b>';
      else if (name === 'strongEnd') result += '</b>';
      else if (name === 'timerStart') result += '<b data-earn-timer>';
      else if (name === 'timerEnd') result += '</b>';
      else result += escapeHtml(Object.hasOwn(parameters, name) ? isolate(parameters[name]) : match[0]);
      offset = match.index + match[0].length;
    }
    return result + escapeHtml(translated.slice(offset));
  }

  return Object.freeze({ use, text, html, rich, get language() { return language; } });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createPortgainyI18n, PG_READY_LANGUAGES, PG_REVIEWED_LANGUAGES };
