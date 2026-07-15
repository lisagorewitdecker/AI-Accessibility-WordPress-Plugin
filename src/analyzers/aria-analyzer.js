'use strict';

/**
 * ARIA (Accessible Rich Internet Applications) analyzer.
 *
 * Checks for common ARIA misuse patterns based on WAI-ARIA 1.2 and
 * WCAG 2.1 Success Criterion 4.1.2 (Name, Role, Value).
 *
 * All attribute-in-tag lookups use an attribute-first approach:
 * locate the attribute literal, then find the surrounding tag boundaries
 * via simple indexOf calls.  This eliminates the polynomial ReDoS risk
 * * of patterns like [^>]*attr="..."[^>]* (as a regex).
 */

/**
 * Find the full opening-tag string that contains a given attribute match.
 * Returns null if no valid enclosing opening tag can be determined.
 *
 * @param {string} html      - Full HTML string.
 * @param {number} attrIndex - Index of the attribute occurrence within `html`.
 * @returns {string|null}
 */
function findEnclosingTag(html, attrIndex) {
  const tagStart = html.lastIndexOf('<', attrIndex);
  if (tagStart === -1) return null;
  if (html[tagStart + 1] === '/') return null; // closing tag
  const tagEnd = html.indexOf('>', attrIndex);
  if (tagEnd === -1) return null;
  return html.slice(tagStart, tagEnd + 1);
}

/**
 * Return true if `str` contains `attr=` (case-insensitive).
 */
function hasAttr(str, attr) {
  return str.toLowerCase().includes(attr.toLowerCase() + '=');
}

/**
 * Analyse ARIA usage in an HTML string.
 *
 * @param {string} html - Raw HTML to analyse.
 * @returns {{
 *   issues: Array<{ type: string, element: string, message: string }>,
 *   passed: boolean
 * }}
 */
function analyzeAriaLabels(html) {
  const issues   = [];
  const htmlLow  = html.toLowerCase();
  let   searchPos;
  let   m;

  // 1. aria-labelledby should reference an existing id
  const labelledbyRegex = /aria-labelledby="([^"]*)"/gi;
  while ((m = labelledbyRegex.exec(html)) !== null) {
    const ids = m[1].split(/\s+/);
    for (const id of ids) {
      if (id && !new RegExp(`id="${id}"`).test(html)) {
        issues.push({
          type:    'aria-labelledby-missing-target',
          element: m[0],
          message: `aria-labelledby references id "${id}" which does not exist in the document.`,
        });
      }
    }
  }

  // 2. aria-describedby should reference an existing id
  const describedbyRegex = /aria-describedby="([^"]*)"/gi;
  while ((m = describedbyRegex.exec(html)) !== null) {
    const ids = m[1].split(/\s+/);
    for (const id of ids) {
      if (id && !new RegExp(`id="${id}"`).test(html)) {
        issues.push({
          type:    'aria-describedby-missing-target',
          element: m[0],
          message: `aria-describedby references id "${id}" which does not exist in the document.`,
        });
      }
    }
  }

  // 3. Elements with role="img" must have aria-label or aria-labelledby.
  //    Uses attribute-first lookup to avoid nested [^>]* ReDoS patterns.
  const roleImgAttr = 'role="img"';
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf(roleImgAttr, searchPos)) !== -1) {
    const tag = findEnclosingTag(html, searchPos);
    if (tag && !hasAttr(tag, 'aria-label') && !hasAttr(tag, 'aria-labelledby')) {
      issues.push({
        type:    'role-img-missing-label',
        element: tag,
        message: 'Element with role="img" must have an aria-label or aria-labelledby attribute.',
      });
    }
    searchPos += roleImgAttr.length;
  }

  // 4. aria-hidden="true" must not be used on focusable elements.
  const ariaHiddenAttr = 'aria-hidden="true"';
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf(ariaHiddenAttr, searchPos)) !== -1) {
    const tag = findEnclosingTag(html, searchPos);
    if (tag) {
      const tagLow  = tag.toLowerCase();
      const tagName = (tagLow.match(/^<([a-z]+)/) || [])[1] || '';
      const focusableNames = ['button', 'a', 'input', 'select', 'textarea'];
      if (focusableNames.includes(tagName) || /tabindex="\d+"/.test(tagLow)) {
        issues.push({
          type:    'aria-hidden-focusable',
          element: tag,
          message: 'aria-hidden="true" must not be applied to focusable elements.',
        });
      }
    }
    searchPos += ariaHiddenAttr.length;
  }

  // 5. presentation / none roles on interactive elements.
  for (const attr of ['role="presentation"', 'role="none"']) {
    searchPos = 0;
    while ((searchPos = htmlLow.indexOf(attr, searchPos)) !== -1) {
      const tag = findEnclosingTag(html, searchPos);
      if (tag) {
        const tagName = (tag.toLowerCase().match(/^<([a-z]+)/) || [])[1] || '';
        if (['button', 'a', 'input', 'select', 'textarea'].includes(tagName)) {
          issues.push({
            type:    'presentation-role-on-interactive',
            element: tag,
            message: `${attr} must not be applied to <${tagName}> elements.`,
          });
        }
      }
      searchPos += attr.length;
    }
  }

  // 6. Empty <button> elements with no accessible name.
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf('<button', searchPos)) !== -1) {
    const openEnd = html.indexOf('>', searchPos);
    if (openEnd === -1) break;
    const openTag  = html.slice(searchPos, openEnd + 1);
    const afterTag = html.slice(openEnd + 1);
    if (/^\s*<\/button>/i.test(afterTag)) {
      if (!hasAttr(openTag, 'aria-label') && !hasAttr(openTag, 'aria-labelledby')) {
        const cm          = afterTag.match(/^(\s*<\/button>)/i);
        const fullElement = openTag + (cm ? cm[1] : '');
        issues.push({
          type:    'button-no-accessible-name',
          element: fullElement,
          message: 'Empty <button> found with no aria-label or aria-labelledby. Buttons must have an accessible name.',
        });
      }
    }
    searchPos = openEnd + 1;
  }

  // 7. Empty <a> elements with no accessible name.
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf('<a', searchPos)) !== -1) {
    // Ensure it is <a> or <a ... and not <abbr>, <article>, etc.
    const nextCh = html[searchPos + 2];
    if (nextCh && /[a-zA-Z]/.test(nextCh)) {
      searchPos += 1;
      continue;
    }
    const openEnd = html.indexOf('>', searchPos);
    if (openEnd === -1) break;
    const openTag  = html.slice(searchPos, openEnd + 1);
    const afterTag = html.slice(openEnd + 1);
    if (/^\s*<\/a>/i.test(afterTag)) {
      if (!hasAttr(openTag, 'aria-label') && !hasAttr(openTag, 'aria-labelledby')) {
        const cm          = afterTag.match(/^(\s*<\/a>)/i);
        const fullElement = openTag + (cm ? cm[1] : '');
        issues.push({
          type:    'link-no-accessible-name',
          element: fullElement,
          message: 'Empty <a> element found with no aria-label or aria-labelledby. Links must have an accessible name.',
        });
      }
    }
    searchPos = openEnd + 1;
  }

  return {
    issues,
    passed: issues.length === 0,
  };
}

module.exports = { analyzeAriaLabels };
