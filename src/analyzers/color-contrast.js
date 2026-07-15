'use strict';

/**
 * WCAG 2.1 colour-contrast utilities.
 *
 * Implements the relative-luminance and contrast-ratio formulas defined in
 * WCAG 2.1 Success Criteria 1.4.3 (AA) and 1.4.6 (AAA).
 *
 * References:
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum
 *   https://www.w3.org/TR/WCAG21/#relative-luminance
 */

const WCAG_AA_NORMAL  = 4.5;
const WCAG_AA_LARGE   = 3.0;
const WCAG_AAA_NORMAL = 7.0;
const WCAG_AAA_LARGE  = 4.5;

/**
 * Convert a single 8-bit sRGB channel value (0-255) to its linear component.
 *
 * @param {number} channel - sRGB channel value in [0, 255].
 * @returns {number} Linear light value in [0, 1].
 */
function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the relative luminance of an RGB colour.
 *
 * @param {number} r - Red channel (0-255).
 * @param {number} g - Green channel (0-255).
 * @param {number} b - Blue channel (0-255).
 * @returns {number} Relative luminance in [0, 1].
 */
function relativeLuminance(r, g, b) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate the WCAG contrast ratio between two colours.
 *
 * @param {{ r: number, g: number, b: number }} color1 - First colour.
 * @param {{ r: number, g: number, b: number }} color2 - Second colour.
 * @returns {number} Contrast ratio (always >= 1).
 */
function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(color1.r, color1.g, color1.b);
  const l2 = relativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse a CSS hex colour string to an RGB object.
 * Supports #RGB and #RRGGBB formats.
 *
 * @param {string} hex - Colour string, e.g. '#fff' or '#ffffff'.
 * @returns {{ r: number, g: number, b: number }|null} Parsed colour or null on failure.
 */
function parseHexColor(hex) {
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Parse a CSS rgb() / rgba() colour string to an RGB object.
 *
 * @param {string} rgb - e.g. 'rgb(255, 255, 255)' or 'rgba(0,0,0,0.5)'.
 * @returns {{ r: number, g: number, b: number }|null} Parsed colour or null on failure.
 */
function parseRgbColor(rgb) {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

/**
 * Parse a colour string that may be hex or rgb/rgba.
 *
 * @param {string} color - CSS colour string.
 * @returns {{ r: number, g: number, b: number }|null}
 */
function parseColor(color) {
  if (!color) return null;
  const s = color.trim();
  if (s.startsWith('#')) return parseHexColor(s);
  if (/^rgba?/i.test(s)) return parseRgbColor(s);
  return null;
}

/**
 * Evaluate a colour pair against WCAG contrast requirements.
 *
 * @param {string} foreground - CSS foreground colour string.
 * @param {string} background - CSS background colour string.
 * @param {{ isLargeText?: boolean }} [options={}]
 * @returns {{
 *   ratio: number,
 *   passesAA: boolean,
 *   passesAAA: boolean,
 *   wcagLevel: 'AAA'|'AA'|'FAIL',
 *   foreground: string,
 *   background: string,
 *   error?: string
 * }}
 */
function checkColorContrast(foreground, background, options = {}) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!fg || !bg) {
    return {
      ratio: 0,
      passesAA: false,
      passesAAA: false,
      wcagLevel: 'FAIL',
      foreground,
      background,
      error: `Unable to parse colour(s): "${foreground}" / "${background}"`,
    };
  }

  const ratio = contrastRatio(fg, bg);
  const isLarge = options.isLargeText === true;
  const aaThreshold  = isLarge ? WCAG_AA_LARGE  : WCAG_AA_NORMAL;
  const aaaThreshold = isLarge ? WCAG_AAA_LARGE : WCAG_AAA_NORMAL;

  const passesAA  = ratio >= aaThreshold;
  const passesAAA = ratio >= aaaThreshold;

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA,
    passesAAA,
    wcagLevel: passesAAA ? 'AAA' : passesAA ? 'AA' : 'FAIL',
    foreground,
    background,
  };
}

module.exports = {
  checkColorContrast,
  contrastRatio,
  relativeLuminance,
  parseColor,
  WCAG_AA_NORMAL,
  WCAG_AA_LARGE,
  WCAG_AAA_NORMAL,
  WCAG_AAA_LARGE,
};
