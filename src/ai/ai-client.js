'use strict';

/**
 * AI client for generating accessibility suggestions via the OpenAI Chat
 * Completions API.
 *
 * To use this module, set the OPENAI_API_KEY environment variable or pass
 * an apiKey in the options object.
 *
 * The module is designed so that every public function returns a result even
 * when the API is unavailable: it will return a graceful fallback rather than
 * throwing an unhandled error.
 */

const https = require('https');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL  = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Make an HTTPS POST request and return the response body as a parsed object.
 *
 * @param {string} url      - Request URL.
 * @param {Object} headers  - HTTP headers.
 * @param {Object} body     - Request body (will be JSON-serialised).
 * @param {number} timeoutMs - Request timeout in milliseconds.
 * @returns {Promise<Object>} Parsed JSON response body.
 */
function httpsPost(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj  = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse API response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send a chat completion request to OpenAI.
 *
 * @param {string}   apiKey   - OpenAI API key.
 * @param {string}   model    - Model identifier.
 * @param {Array<{role:string,content:string}>} messages - Chat messages.
 * @param {number}   timeoutMs - Request timeout.
 * @returns {Promise<string>} The assistant's reply text.
 */
async function chatCompletion(apiKey, model, messages, timeoutMs) {
  const response = await httpsPost(
    OPENAI_API_URL,
    { Authorization: 'Bearer ' + apiKey },
    { model, messages, max_tokens: 256, temperature: 0.3 },
    timeoutMs,
  );

  if (response.error) {
    throw new Error(`OpenAI API error: ${response.error.message}`);
  }

  return response.choices[0].message.content.trim();
}

/**
 * AiClient wraps the OpenAI API for accessibility-specific tasks.
 */
class AiClient {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.apiKey]     - OpenAI API key (falls back to OPENAI_API_KEY env var).
   * @param {string}  [options.model]      - Model to use (default: gpt-4o-mini).
   * @param {number}  [options.timeoutMs]  - Request timeout in ms (default: 30 000).
   */
  constructor(options = {}) {
    this.apiKey    = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model     = options.model  || DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Indicate whether this client has a usable API key.
   *
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Generate descriptive alt text for an image given its URL.
   *
   * @param {string} imageUrl - Publicly accessible image URL.
   * @returns {Promise<{ altText: string, source: 'ai'|'fallback' }>}
   */
  async generateAltText(imageUrl) {
    if (!this.isConfigured()) {
      return { altText: '', source: 'fallback' };
    }

    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are an accessibility expert. Write concise, descriptive alt text for images. ' +
            'Do not start with "Image of" or "Picture of". ' +
            'Keep it under 125 characters. Return only the alt text, no explanation.',
        },
        {
          role: 'user',
          content: `Write alt text for this image: ${imageUrl}`,
        },
      ];

      const altText = await chatCompletion(this.apiKey, this.model, messages, this.timeoutMs);
      return { altText, source: 'ai' };
    } catch (err) {
      return { altText: '', source: 'fallback', error: err.message };
    }
  }

  /**
   * Suggest an ARIA label for an element described in plain text.
   *
   * @param {string} elementDescription - Description of the element and its context.
   * @returns {Promise<{ label: string, source: 'ai'|'fallback' }>}
   */
  async suggestAriaLabel(elementDescription) {
    if (!this.isConfigured()) {
      return { label: '', source: 'fallback' };
    }

    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are an accessibility expert. Suggest a concise, descriptive ARIA label for the described UI element. ' +
            'Return only the label text (without quotes), no explanation.',
        },
        {
          role: 'user',
          content: `Suggest an aria-label for this element: ${elementDescription}`,
        },
      ];

      const label = await chatCompletion(this.apiKey, this.model, messages, this.timeoutMs);
      return { label, source: 'ai' };
    } catch (err) {
      return { label: '', source: 'fallback', error: err.message };
    }
  }

  /**
   * Analyse a block of text for readability and plain-language accessibility.
   *
   * @param {string} text - Content to review.
   * @returns {Promise<{ suggestions: string[], source: 'ai'|'fallback' }>}
   */
  async analyzeContentAccessibility(text) {
    if (!this.isConfigured()) {
      return { suggestions: [], source: 'fallback' };
    }

    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are a plain-language and accessibility expert (WCAG 2.1 level AA). ' +
            'Review the following text and list up to 5 specific improvements to make it more accessible. ' +
            'Focus on: plain language, sentence complexity, jargon, and cognitive load. ' +
            'Return a JSON array of suggestion strings, nothing else.',
        },
        {
          role: 'user',
          content: text.slice(0, 2000), // cap to avoid excessive token use
        },
      ];

      const reply = await chatCompletion(this.apiKey, this.model, messages, this.timeoutMs);
      let suggestions;
      try {
        suggestions = JSON.parse(reply);
        if (!Array.isArray(suggestions)) suggestions = [reply];
      } catch {
        suggestions = [reply];
      }
      return { suggestions, source: 'ai' };
    } catch (err) {
      return { suggestions: [], source: 'fallback', error: err.message };
    }
  }
}

module.exports = { AiClient };
