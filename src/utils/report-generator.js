'use strict';

/**
 * Report generator.
 *
 * Combines all analyzer results into a structured accessibility report with
 * an overall score and WCAG-level grading.
 */

/**
 * Calculate an accessibility score (0–100) from a set of analyzer results.
 * Deductions are weighted by severity.
 *
 * @param {Object} results - Map of analyzer name → result object.
 * @returns {number} Score in [0, 100].
 */
function calculateScore(results) {
  const WEIGHTS = {
    altText:     25,
    aria:        20,
    colorContrast: 20,
    headings:    20,
    keyboard:    15,
  };

  let totalWeight = 0;
  let earnedScore = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    totalWeight += weight;
    const result = results[key];
    if (!result) {
      // Not analysed — give full credit
      earnedScore += weight;
      continue;
    }

    let issueCount = 0;
    if (Array.isArray(result.issues)) {
      issueCount = result.issues.length;
    } else if (typeof result.ratio === 'number') {
      // colorContrast single-pair result
      issueCount = result.passesAA ? 0 : 1;
    }

    // Each issue reduces the component score proportionally (capped at the weight)
    const deduction = Math.min(weight, issueCount * (weight / 5));
    earnedScore += weight - deduction;
  }

  return Math.round((earnedScore / totalWeight) * 100);
}

/**
 * Map a numeric score to a WCAG level description.
 *
 * @param {number} score
 * @returns {'AAA'|'AA'|'A'|'FAIL'}
 */
function scoreToLevel(score) {
  if (score >= 95) return 'AAA';
  if (score >= 80) return 'AA';
  if (score >= 60) return 'A';
  return 'FAIL';
}

/**
 * Collect all issues from analyzer results into a flat list.
 *
 * @param {Object} results - Map of analyzer name → result object.
 * @returns {Array<{ analyzer: string, type: string, element: string, message: string }>}
 */
function collectIssues(results) {
  const allIssues = [];
  for (const [analyzer, result] of Object.entries(results)) {
    if (!result || !Array.isArray(result.issues)) continue;
    for (const issue of result.issues) {
      allIssues.push({ analyzer, ...issue });
    }
  }
  return allIssues;
}

/**
 * Generate a full accessibility report from a set of analyzer results.
 *
 * @param {Object} analyzerResults - Map of analyzer name → result object.
 * @param {Object} [meta={}]       - Optional metadata (url, title, timestamp).
 * @returns {{
 *   score: number,
 *   wcagLevel: string,
 *   passed: boolean,
 *   issueCount: number,
 *   issues: Array,
 *   details: Object,
 *   meta: Object,
 *   generatedAt: string
 * }}
 */
function generateReport(analyzerResults, meta = {}) {
  const score      = calculateScore(analyzerResults);
  const wcagLevel  = scoreToLevel(score);
  const issues     = collectIssues(analyzerResults);

  return {
    score,
    wcagLevel,
    passed:     issues.length === 0,
    issueCount: issues.length,
    issues,
    details:    analyzerResults,
    meta,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateReport, calculateScore, scoreToLevel, collectIssues };
