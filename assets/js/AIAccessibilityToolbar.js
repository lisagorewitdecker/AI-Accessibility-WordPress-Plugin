/*
* AI Accessibility Toolbar - Widget Script
* Requires the AI_TOOLBAR global (provided by wp_add_inline_script).
*/
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var config = window.AI_TOOLBAR || {};
        var i18n = config.i18n || {};

        // Align the client-side truncation with the server's AI_TOOLBAR_MAX_INPUT.
        // Falls back to 12000 (the server default) if the value wasn't provided.
        var MAX_INPUT = (typeof config.maxInput === 'number' && config.maxInput > 0)
            ? config.maxInput
            : 12000;

        var trigger = document.getElementById('ai-widget-trigger');
        var panel = document.getElementById('ai-widget-panel');

        if (!trigger || !panel) {
            return;
        }

        // ------------------------------------------------------------------
        // Toast
        // ------------------------------------------------------------------
        var toast = document.getElementById('ai-wp-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ai-wp-toast';
            document.body.appendChild(toast);
        }
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.style.whiteSpace = 'pre-wrap';
        toast.hidden = true;

        var toastTimer = null;
        function showToast(msg) {
            toast.textContent = msg;
            toast.hidden = false;
            if (toastTimer) {
                clearTimeout(toastTimer);
            }
            toastTimer = setTimeout(function () {
                toast.hidden = true;
            }, 8500);
        }

        // ------------------------------------------------------------------
        // Panel toggle
        // ------------------------------------------------------------------
        function setPanel(open) {
            panel.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
        }

        trigger.addEventListener('click', function () {
            setPanel(panel.hidden);
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !panel.hidden) {
                setPanel(false);
                trigger.focus();
            }
        });

        // ------------------------------------------------------------------
        // Summarize
        // ------------------------------------------------------------------
        var summarizeBtn = document.getElementById('wpSummarizeBtn');
        if (summarizeBtn) {
            summarizeBtn.addEventListener('click', async function () {
                // Guard against rapid double-clicks that would waste rate-limit budget.
                if (summarizeBtn.disabled) {
                    return;
                }
                summarizeBtn.disabled = true;

                showToast(i18n.processing || 'Processing...');
                setPanel(false);

                // Use UTF-16 code-unit-safe slice; server does mb_substr in UTF-8,
                // so we intentionally undershoot slightly to stay within the limit.
                var raw = (document.body && document.body.innerText) ? document.body.innerText : '';
                var text = raw.slice(0, MAX_INPUT);

                try {
                    if (!config.endpoint) {
                        showToast('❌ ' + (i18n.requestFail || 'Request failed.'));
                        return;
                    }
                    var response = await fetch(config.endpoint, {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': config.nonce || ''
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            text: text
                        })
                    });

                    var data = null;
                    try {
                        data = await response.json();
                    } catch (parseErr) {
                        data = null;
                    }

                    if (!response.ok || (data && data.code)) {
                        // Special-case the rate-limit response for a friendlier message.
                        if (response.status === 429) {
                            showToast(i18n.rateLimited || (data && data.message) || 'Too many requests.');
                        } else {
                            var errMsg = (data && data.message) ? data.message : (i18n.requestFail || 'Request failed.');
                            showToast('❌ ' + errMsg);
                        }
                    } else if (data && data.summary) {
                        showToast((i18n.summary || 'Summary:') + '\n\n' + data.summary);
                    } else {
                        showToast('❌ ' + (i18n.requestFail || 'Request failed.'));
                    }
                } catch (err) {
                    showToast(i18n.connError || 'Connection error.');
                } finally {
                    summarizeBtn.disabled = false;
                }
            });
        }

        // ------------------------------------------------------------------
        // Generic style toggle helper
        // ------------------------------------------------------------------
        function toggleStyle(id, css) {
            var existing = document.getElementById(id);
            if (existing) {
                existing.remove();
                return false;
            }
            var el = document.createElement('style');
            el.id = id;
            el.textContent = css;
            document.head.appendChild(el);
            return true;
        }

        function bind(id, handler) {
            var btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        }

        // ------------------------------------------------------------------
        // Feature toggles
        // ------------------------------------------------------------------
        bind('wpDyslexiaBtn', function () {
            toggleStyle(
                'ai-wp-dyslexia',
                "* { font-family: 'OpenDyslexic', 'Lexend', 'Comic Sans MS', sans-serif !important;" +
                " letter-spacing: 0.08em !important; word-spacing: 0.15em !important; }"
            );
        });

        bind('wpContrastBtn', function () {
            toggleStyle(
                'ai-wp-contrast',
                "html, body { background-color: #121212 !important; color: #ffffff !important; }" +
                "a { color: #ffff00 !important; }"
            );
        });

        // Reading ruler
        var rulerHandler = null;
        bind('wpRulerBtn', function () {
            var ruler = document.getElementById('ai-wp-ruler');
            if (ruler) {
                ruler.remove();
                if (rulerHandler) {
                    document.removeEventListener('mousemove', rulerHandler);
                    rulerHandler = null;
                }
                return;
            }
            ruler = document.createElement('div');
            ruler.id = 'ai-wp-ruler';
            ruler.style.cssText =
                'position:fixed; left:0; width:100vw; height:8px;' +
                ' background:rgba(255,204,0,0.5); border-top:2px solid #ffcc00;' +
                ' pointer-events:none; z-index:9999999;';
            document.body.appendChild(ruler);
            rulerHandler = function (e) {
                ruler.style.top = (e.clientY + 15) + 'px';
            };
            document.addEventListener('mousemove', rulerHandler);
        });

        bind('wpLinksBtn', function () {
            toggleStyle(
                'ai-wp-links',
                "a, a * { background-color: #ffff00 !important; color: #000 !important;" +
                " text-decoration: underline !important; font-weight: bold !important; }"
            );
        });

        bind('wpImagesBtn', function () {
            toggleStyle(
                'ai-wp-images',
                "img, video, iframe, picture { display: none !important; }"
            );
        });
    });
})();
