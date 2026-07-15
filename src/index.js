'use strict';

/**
 * AI Accessibility Plugin — main entry point.
 *
 * Exposes the `AccessibilityAnalyzer` class for use in Node.js projects and
 * re-exports individual analyzers for users who want more control.
 *
 * @example
 * const { AccessibilityAnalyzer } = require('ai-accessibility-plugin');
 *
 * const analyzer = new AccessibilityAnalyzer({ apiKey: process.env.OPENAI_API_KEY });
 * const report   = await analyzer.analyze('<html>...</html>');
 * console.log(report);
 */

const { analyzeAltText }             = require('./analyzers/alt-text-analyzer');
const { analyzeAriaLabels }          = require('./analyzers/aria-analyzer');
const { analyzeHeadingStructure }    = require('./analyzers/heading-analyzer');
const { analyzeKeyboardAccessibility } = require('./analyzers/keyboard-analyzer');
const { checkColorContrast }         = require('./analyzers/color-contrast');
const { AiClient }                   = require('./ai/ai-client');
const { generateReport }             = require('./utils/report-generator');

/**
 * High-level accessibility analyzer that combines all built-in checks and
 * optionally augments them with AI-generated suggestions.
 */
class AccessibilityAnalyzer {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.apiKey]          - OpenAI API key for AI-powered features.
   * @param {string}  [options.model]            - AI model to use (default: gpt-4o-mini).
   * @param {boolean} [options.enableAi=false]   - Enable AI-powered suggestions.
   * @param {Object}  [options.colorPairs]        - Array of {fg, bg} pairs for contrast checks.
   */
  constructor(options = {}) {
    this.options = {
      enableAi:   false,
      colorPairs: [],
      ...options,
    };

    this.aiClient = new AiClient({
      apiKey:    options.apiKey,
      model:     options.model,
    });
  }

  /**
   * Run all accessibility checks on an HTML string and return a full report.
   *
   * @param {string} html                   - Raw HTML content to analyse.
   * @param {Object} [options={}]
   * @param {string} [options.url]          - URL of the page (used in report metadata).
   * @param {string} [options.title]        - Page title (used in report metadata).
   * @param {Array<{fg:string,bg:string}>} [options.colorPairs] - Foreground/background colour pairs.
   * @returns {Promise<Object>} Accessibility report.
   */
  async analyze(html, options = {}) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new TypeError('analyze() requires a non-empty HTML string.');
    }

    const colorPairs = options.colorPairs || this.options.colorPairs || [];

    // Run all synchronous analyzers
    const altTextResult  = analyzeAltText(html);
    const ariaResult     = analyzeAriaLabels(html);
    const headingResult  = analyzeHeadingStructure(html);
    const keyboardResult = analyzeKeyboardAccessibility(html);

    // Run colour-contrast checks for each supplied colour pair
    const contrastResults = colorPairs.map(({ fg, bg, isLargeText }) =>
      checkColorContrast(fg, bg, { isLargeText }),
    );

    const analyzerResults = {
      altText:  altTextResult,
      aria:     ariaResult,
      headings: headingResult,
      keyboard: keyboardResult,
    };

    if (contrastResults.length > 0) {
      // Summarise contrast into a pseudo-result so the report generator can score it
      const contrastIssues = contrastResults
        .filter(r => !r.passesAA)
        .map(r => ({
          type:    'color-contrast-fail',
          element: '',
          message: `Contrast ratio ${r.ratio}:1 between "${r.foreground}" and "${r.background}" fails WCAG AA (requires ${r.isLargeText ? '3:1' : '4.5:1'}).`,
        }));

      analyzerResults.colorContrast = {
        issues:  contrastIssues,
        results: contrastResults,
        passed:  contrastIssues.length === 0,
      };
    }

    // Optionally enrich with AI suggestions
    if (this.options.enableAi && this.aiClient.isConfigured()) {
      const aiSuggestions = [];

      // Generate alt text for images that are missing it
      const missingAltImages = (altTextResult.images || [])
        .filter(img => img.status === 'missing-alt' && img.src)
        .slice(0, 5); // cap to avoid excessive API calls

      for (const img of missingAltImages) {
        const { altText, source, error } = await this.aiClient.generateAltText(img.src);
        if (altText) {
          aiSuggestions.push({
            type:       'ai-alt-text',
            element:    `<img src="${img.src}">`,
            suggestion: `Suggested alt text: "${altText}"`,
            source,
          });
        }
      }

      analyzerResults.aiSuggestions = { suggestions: aiSuggestions };
    }

    const meta = {
      url:   options.url   || '',
      title: options.title || '',
    };

    return generateReport(analyzerResults, meta);
  }

  /**
   * Convenience wrapper: check a single foreground/background colour pair.
   *
   * @param {string} foreground - CSS colour string.
   * @param {string} background - CSS colour string.
   * @param {Object} [options={}]
   * @returns {Object} Contrast result.
   */
  checkColorContrast(foreground, background, options = {}) {
    return checkColorContrast(foreground, background, options);
  }

  /**
   * Generate descriptive alt text for an image using AI.
   * Returns an empty string when no API key is configured.
   *
   * @param {string} imageUrl - Publicly accessible image URL.
   * @returns {Promise<{ altText: string, source: string }>}
   */
  async generateAltText(imageUrl) {
    return this.aiClient.generateAltText(imageUrl);
  }

  /**
   * Analyse only the alt-text usage in an HTML string (synchronous).
   *
   * @param {string} html
   * @returns {Object}
   */
  analyzeAltText(html) {
    return analyzeAltText(html);
  }

  /**
   * Analyse only the ARIA usage in an HTML string (synchronous).
   *
   * @param {string} html
   * @returns {Object}
   */
  analyzeAriaLabels(html) {
    return analyzeAriaLabels(html);
  }

  /**
   * Analyse only the heading structure in an HTML string (synchronous).
   *
   * @param {string} html
   * @returns {Object}
   */
  analyzeHeadingStructure(html) {
    return analyzeHeadingStructure(html);
  }

  /**
   * Analyse only the keyboard accessibility in an HTML string (synchronous).
   *
   * @param {string} html
   * @returns {Object}
   */
  analyzeKeyboardAccessibility(html) {
    return analyzeKeyboardAccessibility(html);
  }
}

module.exports = {
  AccessibilityAnalyzer,
  // Named exports for consumers who want individual analyzers
  analyzeAltText,
  analyzeAriaLabels,
  analyzeHeadingStructure,
  analyzeKeyboardAccessibility,
  checkColorContrast,
  AiClient,
  generateReport,
};
