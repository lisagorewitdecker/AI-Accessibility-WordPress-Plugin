=== AI Accessibility Plugin ===
Contributors: lisagorewitdecker
Tags: accessibility, a11y, wcag, openai, ai
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 1.0.0
License: MIT

AI-powered accessibility analysis for WordPress. Scans posts and pages for WCAG 2.1 issues and provides AI-generated suggestions.

== Description ==

The AI Accessibility Plugin automatically scans your WordPress posts and pages for accessibility issues based on WCAG 2.1 guidelines and, optionally, uses AI (via the OpenAI API) to generate improved alt text and plain-language suggestions.

**Features:**

* **Automatic scanning** – Posts and pages are scanned for accessibility issues every time they are saved.
* **Alt-text analysis** – Detects missing, empty, or poor-quality alt attributes on images.
* **ARIA analysis** – Checks for broken `aria-labelledby`/`aria-describedby` references, missing accessible names, and ARIA misuse.
* **Heading structure** – Verifies heading hierarchy (h1–h6), detects skipped levels and empty headings.
* **Keyboard accessibility** – Flags click handlers on non-interactive elements, positive tabindex values, and missing skip-navigation links.
* **AI alt text generation** – Optionally calls the OpenAI API to suggest descriptive alt text for images that are missing it.
* **AI content review** – Suggests plain-language improvements to post content.
* **REST API** – A full JSON REST API (`/wp-json/ai-accessibility/v1/`) for headless or JavaScript-based integrations.
* **Admin dashboard** – Site-wide accessibility score summary.

== Installation ==

1. Upload the `ai-accessibility-plugin` folder to `/wp-content/plugins/`.
2. Activate the plugin via the **Plugins** menu in WordPress admin.
3. Go to **AI Accessibility → Settings** to configure your OpenAI API key (optional; required for AI features).

== Configuration ==

| Option | Description | Default |
|---|---|---|
| OpenAI API Key | Your key from platform.openai.com | — |
| AI Model | Which OpenAI model to use | `gpt-4o-mini` |
| Enable AI Suggestions | Generate AI-powered suggestions | Off |
| Auto-scan on Save | Scan posts automatically on save | On |

== REST API ==

All endpoints require a logged-in user with `edit_posts` capability.

**Analyze HTML**

```
POST /wp-json/ai-accessibility/v1/analyze
Content-Type: application/json
X-WP-Nonce: <nonce>

{
  "html":      "<p>Your content</p>",
  "post_id":   42,
  "enable_ai": false
}
```

**Get latest report for a post**

```
GET /wp-json/ai-accessibility/v1/report/42
```

**Get dashboard statistics**

```
GET /wp-json/ai-accessibility/v1/stats
```

== Changelog ==

= 1.0.0 =
* Initial release.
