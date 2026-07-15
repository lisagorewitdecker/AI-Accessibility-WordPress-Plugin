'use strict';

/**
 * Keyboard-accessibility analyzer.
 *
 * Checks that all interactive elements are keyboard-accessible, following
 * WCAG 2.1 Success Criterion 2.1.1 (Keyboard) and 2.4.3 (Focus Order).
 *
 * Attribute lookups use attribute-first indexOf-based search to avoid
 * polynomial ReDoS from nested [^>]* quantifier patterns.
 */

/**
 * Find the full opening-tag string that contains a match at `attrIndex`.
 *
 * @param {string} html      - Full HTML string.
 * @param {number} attrIndex - Index within `html` of the attribute.
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
 * Return the lower-cased tag name from a full opening tag string.
 *
 * @param {string} tag
 * @returns {string}
 */
function tagName(tag) {
  const m = tag.match(/^<([a-zA-Z][\w-]*)/);
  return m ? m[1].toLowerCase() : '';
}

/** Non-interactive HTML elements whose onclick needs a keyboard equivalent. */
const NONINTERACTIVE_TAGS = new Set([
  'div', 'span', 'p', 'li', 'td', 'th',
  'section', 'article', 'header', 'footer',
]);

/**
 * Analyse keyboard accessibility in an HTML string.
 *
 * @param {string} html - Raw HTML to analyse.
 * @returns {{
 *   issues: Array<{ type: string, element: string, message: string }>,
 *   passed: boolean
 * }}
 */
function analyzeKeyboardAccessibility(html) {
  const issues  = [];
  const htmlLow = html.toLowerCase();
  let   searchPos;

  // 1. tabindex values > 0 disrupt natural tab order.
  //    Safe: /tabindex="([1-9]\d*)"/ has no nested quantifiers.
  const tabindexRegex = /tabindex="([1-9]\d*)"/gi;
  let m;
  while ((m = tabindexRegex.exec(html)) !== null) {
    issues.push({
      type:    'positive-tabindex',
      element: m[0],
      message: `tabindex="${m[1]}" disrupts the natural tab order. Use tabindex="0" to include an element in tab order without changing sequence.`,
    });
  }

  // 2. tabindex="-1" on native interactive elements removes keyboard access.
  //    Attribute-first: find tabindex="-1", then check the enclosing tag name.
  const tabMinusOneAttr = 'tabindex="-1"';
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf(tabMinusOneAttr, searchPos)) !== -1) {
    const tag = findEnclosingTag(html, searchPos);
    if (tag) {
      const name = tagName(tag);
      if (['button', 'a', 'input', 'select', 'textarea'].includes(name)) {
        issues.push({
          type:    'interactive-element-not-focusable',
          element: tag,
          message: `<${name}> with tabindex="-1" is removed from the keyboard tab sequence.`,
        });
      }
    }
    searchPos += tabMinusOneAttr.length;
  }

  // 3. onclick handlers on non-interactive elements without role + tabindex.
  //    Attribute-first: find onclick=, then examine the enclosing tag.
  const onclickAttr = 'onclick=';
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf(onclickAttr, searchPos)) !== -1) {
    const tag = findEnclosingTag(html, searchPos);
    if (tag) {
      const name    = tagName(tag);
      const tagLow  = tag.toLowerCase();
      if (NONINTERACTIVE_TAGS.has(name)) {
        const hasRole     = /\brole="(?:button|link|checkbox|radio|tab|menuitem)"/.test(tagLow);
        const hasTabindex = /\btabindex=/.test(tagLow);
        if (!hasRole || !hasTabindex) {
          issues.push({
            type:    'click-without-keyboard',
            element: tag,
            message: `<${name}> has an onclick handler but is not keyboard-accessible. Add role="button" and tabindex="0", and implement an onkeydown handler.`,
          });
        }
      }
    }
    searchPos += onclickAttr.length;
  }

  // 4. Mouse-only events (onmousedown / onmouseover) without keyboard equivalents.
  for (const mouseAttr of ['onmousedown=', 'onmouseover=']) {
    searchPos = 0;
    while ((searchPos = htmlLow.indexOf(mouseAttr, searchPos)) !== -1) {
      const tag = findEnclosingTag(html, searchPos);
      if (tag) {
        const name    = tagName(tag);
        const tagLow  = tag.toLowerCase();
        // Native interactive elements have implicit keyboard support.
        if (!['button', 'a', 'input', 'select', 'textarea'].includes(name)) {
          const hasKbHandler = /\bonkey(?:down|up|press)=/.test(tagLow);
          if (!hasKbHandler) {
            issues.push({
              type:    'mouse-only-event',
              element: tag,
              message: `<${name}> uses a mouse-only event. Provide an equivalent keyboard event (onkeydown, onkeyup) for keyboard users.`,
            });
          }
        }
      }
      searchPos += mouseAttr.length;
    }
  }

  // 5. <a> without href and without tabindex — not keyboard-focusable.
  searchPos = 0;
  while ((searchPos = htmlLow.indexOf('<a', searchPos)) !== -1) {
    // Ensure it is <a> and not <abbr>, <article>, etc.
    const nextCh = html[searchPos + 2];
    if (nextCh && /[a-zA-Z]/.test(nextCh)) {
      searchPos += 1;
      continue;
    }
    const tagEnd = html.indexOf('>', searchPos);
    if (tagEnd === -1) break;
    const tag    = html.slice(searchPos, tagEnd + 1);
    const tagLow = tag.toLowerCase();
    if (!tagLow.includes('href=') && !tagLow.includes('tabindex=')) {
      issues.push({
        type:    'anchor-without-href',
        element: tag,
        message: '<a> without an href attribute is not keyboard-focusable. Add href or tabindex="0" if it is interactive.',
      });
    }
    searchPos = tagEnd + 1;
  }

  // 6. Missing skip-navigation link when a <nav> block is present.
  const hasSkipLink = /href="#(?:main|content|maincontent|skip)/i.test(html);
  const hasNav      = /<nav[\s>]/i.test(html);
  if (hasNav && !hasSkipLink) {
    issues.push({
      type:    'missing-skip-link',
      element: '',
      message: 'Page contains a <nav> block but no skip-navigation link. Add a "Skip to main content" link as the first focusable element.',
    });
  }

  return {
    issues,
    passed: issues.length === 0,
  };
}

module.exports = { analyzeKeyboardAccessibility };
