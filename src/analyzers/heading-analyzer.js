'use strict';

/**
 * Heading-structure analyzer.
 *
 * Checks that a page's heading hierarchy follows WCAG 2.1 SC 1.3.1 (Info and
 * Relationships) and the general best practice of not skipping heading levels.
 */

const { stripTags } = require('../utils/html-parser');

/**
 * Extract heading elements from an HTML string using a safe two-pass approach:
 * first locate the closing tag, then slice the content — this avoids the
 * polynomial ReDoS that arises from `[\s\S]*?` inside a capturing group combined
 * with nested `[^>]*` patterns.
 *
 * @param {string} html  - Raw HTML string.
 * @param {number} level - Heading level 1–6.
 * @returns {Array<{ text: string, index: number }>}
 */
function extractHeadings(html, level) {
  const results  = [];
  const openTag  = `<h${level}`;
  const closeTag = `</h${level}>`;
  let   pos      = 0;

  while (pos < html.length) {
    // Find the opening tag
    const start = html.toLowerCase().indexOf(openTag, pos);
    if (start === -1) break;

    // Find the end of the opening tag (the ">")
    const openEnd = html.indexOf('>', start);
    if (openEnd === -1) break;

    // Find the closing tag
    const closeStart = html.toLowerCase().indexOf(closeTag, openEnd + 1);
    if (closeStart === -1) break;

    const innerHtml = html.slice(openEnd + 1, closeStart);
    const text      = stripTags(innerHtml);

    results.push({ text, index: start });

    pos = closeStart + closeTag.length;
  }

  return results;
}

/**
 * Analyse the heading structure of an HTML string.
 *
 * @param {string} html - Raw HTML to analyse.
 * @returns {{
 *   issues: Array<{ type: string, message: string, heading: string }>,
 *   headings: Array<{ level: number, text: string }>,
 *   passed: boolean
 * }}
 */
function analyzeHeadingStructure(html) {
  const headings = [];
  for (let level = 1; level <= 6; level++) {
    for (const { text, index } of extractHeadings(html, level)) {
      headings.push({ level, text, index });
    }
  }

  // Sort by document order
  headings.sort((a, b) => a.index - b.index);

  const issues = [];

  // 1. Check for missing <h1>
  const hasH1 = headings.some(h => h.level === 1);
  if (!hasH1) {
    issues.push({
      type:    'missing-h1',
      message: 'Page has no <h1> element. Every page should have exactly one top-level heading.',
      heading: '',
    });
  }

  // 2. Check for multiple <h1> elements
  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count > 1) {
    issues.push({
      type:    'multiple-h1',
      message: `Page has ${h1Count} <h1> elements. There should be only one per page.`,
      heading: '',
    });
  }

  // 3. Check for empty headings
  headings.forEach(h => {
    if (!h.text) {
      issues.push({
        type:    'empty-heading',
        message: `Empty <h${h.level}> found. Headings must have descriptive text content.`,
        heading: `<h${h.level}>`,
      });
    }
  });

  // 4. Check for skipped heading levels
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      issues.push({
        type:    'skipped-heading-level',
        message: `Heading level skipped from h${prev} to h${curr}. Heading levels should not be skipped.`,
        heading: `<h${curr}>${headings[i].text}</h${curr}>`,
      });
    }
  }

  return {
    issues,
    headings: headings.map(({ level, text }) => ({ level, text })),
    passed: issues.length === 0,
  };
}

module.exports = { analyzeHeadingStructure };

