=== AI Accessibility Toolbar & API ===
Contributors: lisamgorewitdecker
Tags: accessibility, ai, gemini, summarize, dyslexia, high contrast, a11y
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
== Changelog ==

= 1.3 =
* Security: nonce is now verified before rate limiting so unauthenticated visitors cannot exhaust the rate-limit bucket.
* Security: rate limiter now uses a proper sliding window that cannot be indefinitely refreshed.
* Security: `X-Forwarded-For` resolution now uses the right-most (proxy-appended) IP to reduce spoofing.
* Security: API-key admin field no longer echoes any portion of the stored key into the HTML.
* Reliability: settings form uses Post-Redirect-Get to prevent duplicate submissions on refresh.
* Reliability: explicit JSON decode error handling for upstream Gemini responses.
* Reliability: removed duplicate `wp_enqueue_script` / `wp_localize_script` calls; `filemtime` cache-busting now actually applies.
* Reliability: fixed a JS parse error at the top of `assets/js/widget.js` that prevented the widget from loading.
* UX: client-side truncation is now aligned with the server via a localized `maxInput` value.
* UX: summarize button is disabled while a request is in flight; friendlier 429 rate-limit message.
* Optional: `ai_toolbar_trust_proxy` filter to enable X-Forwarded-For / CF-Connecting-IP resolution for sites behind a reverse proxy.

= 1.2 =
* Extracted CSS to `assets/css/widget.css` and JS to `assets/js/widget.js`.

== Upgrade Notice ==

= 1.3 =
Security & reliability update: fixes a broken JS header that could prevent the widget from loading, removes duplicate script enqueues, hardens X-Forwarded-For handling, and stops the settings page from echoing part of the stored API key. Update recommended.

= 1.2 =
Assets are now loaded from separate CSS/JS files with cache-busting. No breaking changes; simply update.