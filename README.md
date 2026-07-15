# AI Accessibility Plugin

AI-powered accessibility analysis for web applications, available as both an **NPM package** and a **WordPress plugin**.

The plugin scans HTML content for WCAG 2.1 issues across five categories — alt text, ARIA usage, heading structure, keyboard accessibility, and colour contrast — and can optionally call the OpenAI API to generate descriptive alt text and plain-language content suggestions.

---

## Features

| Feature | NPM | WordPress |
|---|:---:|:---:|
| Alt-text analysis (WCAG 1.1.1) | ✅ | ✅ |
| ARIA attribute checks (WCAG 4.1.2) | ✅ | ✅ |
| Heading hierarchy (WCAG 1.3.1) | ✅ | ✅ |
| Keyboard accessibility (WCAG 2.1.1) | ✅ | ✅ |
| Colour contrast (WCAG 1.4.3) | ✅ | — |
| AI alt-text generation (OpenAI) | ✅ | ✅ |
| AI content suggestions (OpenAI) | ✅ | ✅ |
| REST API | — | ✅ |
| Admin dashboard | — | ✅ |
| Auto-scan on post save | — | ✅ |

---

## NPM Package

### Installation

```bash
npm install ai-accessibility-plugin
```

Requires **Node.js ≥ 18**.

### Quick start

```js
const { AccessibilityAnalyzer } = require('ai-accessibility-plugin');

const analyzer = new AccessibilityAnalyzer({
  // Optional: enable AI suggestions via the OpenAI API
  apiKey:   process.env.OPENAI_API_KEY,
  enableAi: true,
});

const report = await analyzer.analyze('<html>...</html>', {
  url:   'https://example.com',
  title: 'My Page',
  // Optional: colour pairs to check
  colorPairs: [
    { fg: '#333333', bg: '#ffffff' },
  ],
});

console.log(report.score);      // 0–100
console.log(report.wcagLevel);  // 'AAA' | 'AA' | 'A' | 'FAIL'
console.log(report.issues);     // Array of issue objects
```

### Individual analyzers

```js
const {
  analyzeAltText,
  analyzeAriaLabels,
  analyzeHeadingStructure,
  analyzeKeyboardAccessibility,
  checkColorContrast,
} = require('ai-accessibility-plugin');

// Synchronous checks
const altResult      = analyzeAltText(html);
const ariaResult     = analyzeAriaLabels(html);
const headingResult  = analyzeHeadingStructure(html);
const keyboardResult = analyzeKeyboardAccessibility(html);

// Colour contrast
const contrast = checkColorContrast('#333333', '#ffffff');
// { ratio: 12.63, passesAA: true, passesAAA: true, wcagLevel: 'AAA' }
```

### AccessibilityAnalyzer options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `process.env.OPENAI_API_KEY` | OpenAI API key |
| `model` | `string` | `'gpt-4o-mini'` | OpenAI model |
| `enableAi` | `boolean` | `false` | Enable AI-powered suggestions |

### Report shape

```js
{
  score:       85,          // 0–100
  wcagLevel:  'AA',         // 'AAA' | 'AA' | 'A' | 'FAIL'
  passed:      false,
  issueCount:  3,
  issues: [
    {
      analyzer: 'altText',
      type:     'img-missing-alt',
      element:  '<img src="chart.png">',
      message:  '<img src="chart.png"> is missing an alt attribute.',
    },
    // …
  ],
  details: {
    altText:   { issues: [], images: [], passed: true },
    aria:      { issues: [], passed: true },
    headings:  { issues: [], headings: [], passed: true },
    keyboard:  { issues: [], passed: true },
    colorContrast: { issues: [], results: [], passed: true },
  },
  meta:        { url: 'https://…', title: '…' },
  generatedAt: '2025-01-01T00:00:00.000Z',
}
```

### Running tests

```bash
npm test
```

---

## WordPress Plugin

### Installation

1. Copy the `wordpress/` folder to `wp-content/plugins/ai-accessibility-plugin/`.
2. Activate via **Plugins → Installed Plugins**.
3. Go to **AI Accessibility → Settings** to configure your OpenAI API key.

### Settings

| Setting | Description | Default |
|---|---|---|
| OpenAI API Key | Key from [platform.openai.com](https://platform.openai.com/api-keys) | — |
| AI Model | OpenAI model to use | `gpt-4o-mini` |
| Enable AI Suggestions | Use AI for alt text and content review | Off |
| Auto-scan on Save | Scan automatically when a post is saved | On |

### REST API

All endpoints require authentication (`edit_posts` capability) via the `X-WP-Nonce` header.

#### `POST /wp-json/ai-accessibility/v1/analyze`

Analyse HTML content and return a report.

```json
{
  "html":      "<p>Your content</p>",
  "post_id":   42,
  "enable_ai": false
}
```

#### `GET /wp-json/ai-accessibility/v1/report/{post_id}`

Retrieve the most recent accessibility report for a post.

#### `GET /wp-json/ai-accessibility/v1/stats`

Return site-wide accessibility statistics (average score, total posts, passing/failing counts).

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

The `.env` file is listed in `.gitignore` and will never be committed.

---

## Issue types

| Issue type | WCAG SC | Description |
|---|---|---|
| `img-missing-alt` | 1.1.1 | `<img>` with no `alt` attribute |
| `img-empty-alt-review` | 1.1.1 | `<img alt="">` on a non-decorative image |
| `img-poor-alt` | 1.1.1 | Alt text starts with "image", "photo", etc. |
| `aria-labelledby-missing-target` | 4.1.2 | `aria-labelledby` references a missing `id` |
| `aria-describedby-missing-target` | 4.1.2 | `aria-describedby` references a missing `id` |
| `role-img-missing-label` | 4.1.2 | `role="img"` without `aria-label` |
| `button-no-accessible-name` | 4.1.2 | Empty `<button>` with no label |
| `link-no-accessible-name` | 4.1.2 | Empty `<a>` with no label |
| `presentation-role-on-interactive` | 4.1.2 | `role="presentation"` on an interactive element |
| `missing-h1` | 1.3.1 | Page has no `<h1>` |
| `multiple-h1` | 1.3.1 | Page has more than one `<h1>` |
| `empty-heading` | 1.3.1 | Heading element with no text content |
| `skipped-heading-level` | 1.3.1 | Heading levels skip (e.g. h1 → h3) |
| `positive-tabindex` | 2.4.3 | `tabindex` value greater than 0 |
| `click-without-keyboard` | 2.1.1 | `onclick` on a non-interactive element |
| `mouse-only-event` | 2.1.1 | Mouse event with no keyboard equivalent |
| `anchor-without-href` | 2.1.1 | `<a>` with no `href` and no `tabindex` |
| `missing-skip-link` | 2.4.1 | Page with `<nav>` but no skip-navigation link |
| `color-contrast-fail` | 1.4.3 | Colour pair fails WCAG AA contrast ratio |

---

## License

MIT
