'use strict';

/**
 * Lightweight HTML parsing utilities.
 * Extracts elements and attributes from HTML strings without an external parser.
 */

/**
 * Extract all occurrences of a tag from an HTML string.
 *
 * @param {string} html - Raw HTML string.
 * @param {string} tag  - Tag name to find (e.g. 'img', 'a').
 * @returns {Array<{full: string, attrs: Object}>} Array of matched tag objects.
 */
function extractTags(html, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}(\\s[^>]*)?(?:\\/>|>)`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const full = match[0];
    const attrs = parseAttributes(match[1] || '');
    results.push({ full, attrs });
  }
  return results;
}

/**
 * Parse an HTML attribute string into a key-value map.
 *
 * @param {string} attrString - The attribute portion of an opening tag.
 * @returns {Object} Key-value map of attribute names to values.
 */
function parseAttributes(attrString) {
  const attrs = {};
  // Match name="value", name='value', or name=value, and bare name attributes
  const attrRegex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = attrRegex.exec(attrString)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2]
      : m[3] !== undefined ? m[3]
      : m[4] !== undefined ? m[4]
      : true;
    attrs[name] = value;
  }
  return attrs;
}

/**
 * Strip all HTML tags from a string and return plain text.
 * Uses a character-level state machine to avoid ReDoS and multi-character
 * sanitization issues present in regex-based stripping.
 *
 * @param {string} html - Raw HTML string.
 * @returns {string} Plain text content.
 */
function stripTags(html) {
  let result = '';
  let inTag   = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') {
      inTag = true;
    } else if (ch === '>' && inTag) {
      inTag = false;
    } else if (!inTag) {
      result += ch;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Extract inline or <style> block CSS declarations from HTML.
 *
 * @param {string} html - Raw HTML string.
 * @returns {string[]} Array of CSS declaration strings.
 */
function extractStyleBlocks(html) {
  const blocks = [];
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleTagRegex.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

module.exports = { extractTags, parseAttributes, stripTags, extractStyleBlocks };
