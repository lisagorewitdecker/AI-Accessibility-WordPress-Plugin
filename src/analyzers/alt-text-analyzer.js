'use strict';

/**
 * Image alt-text analyzer.
 *
 * Performs local heuristic checks for WCAG 2.1 SC 1.1.1 (Non-text Content),
 * and optionally calls an AI provider to generate descriptive alt text for
 * images that are missing it.
 */

const { extractTags } = require('../utils/html-parser');

/**
 * File-extension patterns that identify decorative or icon images that may
 * legitimately use alt="".
 */
const LIKELY_DECORATIVE_PATTERN = /(?:spacer|divider|dot|bullet|pixel|blank|separator|bg|background)/i;

/**
 * Analyse <img> elements in an HTML string for alt-text issues.
 *
 * @param {string} html - Raw HTML to analyse.
 * @returns {{
 *   issues: Array<{ type: string, element: string, message: string }>,
 *   images: Array<{ src: string, alt: string|undefined, status: string }>,
 *   passed: boolean
 * }}
 */
function analyzeAltText(html) {
  const issues = [];
  const images = [];

  const imgTags = extractTags(html, 'img');

  for (const { full, attrs } of imgTags) {
    const src = attrs.src || '';
    const hasAlt = 'alt' in attrs;
    const altValue = hasAlt ? String(attrs.alt) : undefined;
    const isEmptyAlt = hasAlt && altValue === '';
    const isDecorative = isEmptyAlt && LIKELY_DECORATIVE_PATTERN.test(src);

    let status;

    if (!hasAlt) {
      status = 'missing-alt';
      issues.push({
        type: 'img-missing-alt',
        element: full,
        message: `<img src="${src}"> is missing an alt attribute. All images must have an alt attribute (use alt="" for decorative images).`,
      });
    } else if (isEmptyAlt && !isDecorative) {
      // Empty alt on a non-obviously-decorative image — flag for review
      status = 'empty-alt';
      issues.push({
        type: 'img-empty-alt-review',
        element: full,
        message: `<img src="${src}"> has alt="" — confirm this image is purely decorative. If it conveys information, add a descriptive alt text.`,
      });
    } else if (hasAlt && !isEmptyAlt) {
      // Warn about low-quality alt text patterns
      const altLower = altValue.toLowerCase();
      if (/^(image|photo|picture|img|graphic|icon|logo)\b/i.test(altValue)) {
        status = 'poor-alt';
        issues.push({
          type: 'img-poor-alt',
          element: full,
          message: `<img src="${src}" alt="${altValue}"> — alt text begins with a redundant word like "image" or "photo". Screen readers already announce images; describe what the image shows instead.`,
        });
      } else {
        status = 'ok';
      }
    } else {
      status = 'decorative-ok';
    }

    images.push({ src, alt: altValue, status });
  }

  return {
    issues,
    images,
    passed: issues.length === 0,
  };
}

module.exports = { analyzeAltText };
