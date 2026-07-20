<?php
/**
 * Plugin Name: AI Accessibility Toolbar
 * Description: A Material Design accessibility toolbar with an AI-powered "Summarize this page" button backed securely by the Gemini API.
 * Version: 1.3
 * Author: Lisa M Gorewit-Decker & Gemini
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ai-accessibility-toolbar
 * Requires at least: 5.8
 * Requires PHP: 7.4
 *
 * @package ai-accessibility-toolbar
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
define( 'AI_TOOLBAR_VERSION',      '1.3' );
define( 'AI_TOOLBAR_FILE',         __FILE__ );
define( 'AI_TOOLBAR_DIR',          plugin_dir_path( __FILE__ ) );
define( 'AI_TOOLBAR_URL',          plugin_dir_url( __FILE__ ) );
define( 'AI_TOOLBAR_OPTION_KEY',   'ai_toolbar_gemini_key' );
define( 'AI_TOOLBAR_MODEL',        'gemini-1.5-flash' );
define( 'AI_TOOLBAR_API_BASE',     'https://generativelanguage.googleapis.com/v1beta/models/' );
define( 'AI_TOOLBAR_MAX_INPUT',    12000 );
define( 'AI_TOOLBAR_RATE_LIMIT',   5 );   // Requests…
define( 'AI_TOOLBAR_RATE_WINDOW',  60 );  // …per this many seconds, per IP.

// Load the front-end asset loader (defines ai_toolbar_enqueue_assets()).
require_once AI_TOOLBAR_DIR . 'WidgetAssetsLoader.php';

// ---------------------------------------------------------------------------
// 1. Admin settings page (secure API-key storage)
// ---------------------------------------------------------------------------
add_action( 'admin_init', 'ai_toolbar_register_setting' );
function ai_toolbar_register_setting() {
    register_setting(
        'ai_toolbar_settings_group',
        AI_TOOLBAR_OPTION_KEY,
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
            'show_in_rest'      => false,
        )
    );
}

add_action( 'admin_menu', 'ai_toolbar_add_settings_page' );
function ai_toolbar_add_settings_page() {
    add_options_page(
        __( 'AI Toolbar Settings', 'ai-accessibility-toolbar' ),
        __( 'AI Toolbar', 'ai-accessibility-toolbar' ),
        'manage_options',
        'ai-accessibility-toolbar',
        'ai_toolbar_render_settings'
    );
}

// Post-Redirect-Get handler — processes the settings form and redirects before any output.
add_action( 'admin_init', 'ai_toolbar_process_settings_form' );
function ai_toolbar_process_settings_form() {
    if (
        ! is_admin()
        || 'POST' !== $_SERVER['REQUEST_METHOD']
        || empty( $_POST['ai_toolbar_nonce'] )
        || ( ! isset( $_GET['page'] ) || 'ai-accessibility-toolbar' !== $_GET['page'] )
    ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( esc_html__( 'You do not have permission to perform this action.', 'ai-accessibility-toolbar' ) );
    }

    check_admin_referer( 'ai_toolbar_save_settings', 'ai_toolbar_nonce' );

    if ( isset( $_POST['ai_toolbar_gemini_key'] ) ) {
        $submitted = sanitize_text_field( wp_unslash( $_POST['ai_toolbar_gemini_key'] ) );
        // Only update the stored key when the admin actually types a new value.
        // An empty submission means "leave the existing key unchanged".
        if ( '' !== $submitted ) {
            update_option( AI_TOOLBAR_OPTION_KEY, $submitted );
        }
    }

    wp_safe_redirect(
        add_query_arg(
            array(
                'page'             => 'ai-accessibility-toolbar',
                'settings-updated' => '1',
            ),
            admin_url( 'options-general.php' )
        )
    );
    exit;
}

function ai_toolbar_render_settings() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    // Show success notice after Post-Redirect-Get.
    if ( ! empty( $_GET['settings-updated'] ) ) {
        echo '<div class="updated notice is-dismissible"><p>'
            . esc_html__( 'Settings saved successfully.', 'ai-accessibility-toolbar' )
            . '</p></div>';
    }

    $api_key      = (string) get_option( AI_TOOLBAR_OPTION_KEY, '' );
    $masked_value = $api_key !== '' ? str_repeat( '•', min( 20, strlen( $api_key ) ) ) : '';
    ?>
    <div class="wrap" style="max-width:600px;">
        <h1><?php esc_html_e( 'AI Accessibility Toolbar Settings', 'ai-accessibility-toolbar' ); ?></h1>

        <form method="post" action="">
            <?php wp_nonce_field( 'ai_toolbar_save_settings', 'ai_toolbar_nonce' ); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="ai_toolbar_gemini_key">
                            <?php esc_html_e( 'Gemini API Key', 'ai-accessibility-toolbar' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="password"
                            name="ai_toolbar_gemini_key"
                            id="ai_toolbar_gemini_key"
                            class="regular-text"
                            autocomplete="new-password"
                            spellcheck="false"
                            value=""
                            placeholder="<?php echo esc_attr( $masked_value !== '' ? $masked_value : 'AIzaSy…' ); ?>"
                        >
                        <p class="description">
                            <?php esc_html_e(
                                'Stored server-side in the WordPress options table and never exposed to visitors. Get a key at Google AI Studio. Leave blank to keep the current key.',
                                'ai-accessibility-toolbar'
                            ); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button( __( 'Save Settings', 'ai-accessibility-toolbar' ) ); ?>
        </form>
    </div>
    <?php
}

// ---------------------------------------------------------------------------
// 2. REST endpoint (nonce + rate-limit + real Gemini call)
// ---------------------------------------------------------------------------
add_action( 'rest_api_init', function () {
    register_rest_route(
        'ai-toolbar/v1',
        '/summarize',
        array(
            'methods'             => WP_REST_Server::CREATABLE, // 'POST'
            'callback'            => 'ai_toolbar_handle_api_request',
            'permission_callback' => 'ai_toolbar_rest_permission_check',
            'args'                => array(
                'text' => array(
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_textarea_field',
                ),
            ),
        )
    );
} );


/**
 * REST permission check — enforces a valid WP REST nonce.
 */
function ai_toolbar_rest_permission_check( WP_REST_Request $request ) {
    $nonce = $request->get_header( 'x_wp_nonce' );
    if ( ! $nonce ) {
        $nonce = $request->get_param( '_wpnonce' );
    }
    if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
        return new WP_Error(
            'rest_forbidden',
            __( 'Invalid or missing security token.', 'ai-accessibility-toolbar' ),
            array( 'status' => 403 )
        );
    }
    return true;
}

/**
 * Very small IP-based rate limiter using WordPress transients.
 *
 * Uses an anchored fixed window: the TTL is set on the first request and never
 * extended, so the window cannot be indefinitely refreshed by sustained traffic.
 *
 * @return true|WP_Error true if allowed, WP_Error otherwise.
 */
function ai_toolbar_check_rate_limit() {
    $ip  = ai_toolbar_get_client_ip();
    $key = 'ai_toolbar_rl_' . md5( $ip );

    $stored = get_transient( $key );

    if ( false === $stored ) {
        // First request in this window — anchor the expiry now.
        set_transient(
            $key,
            array(
                'count'   => 1,
                'expires' => time() + AI_TOOLBAR_RATE_WINDOW,
            ),
            AI_TOOLBAR_RATE_WINDOW
        );
        return true;
    }

    // Normalise legacy integer values or any malformed data.
    if ( is_int( $stored ) || is_numeric( $stored ) ) {
        $count   = (int) $stored;
        $expires = 0; // Unknown — treat as expired.
    } elseif ( is_array( $stored ) && isset( $stored['count'] ) ) {
        $count   = (int) $stored['count'];
        $expires = isset( $stored['expires'] ) ? (int) $stored['expires'] : 0;
    } else {
        // Unrecognised format — reset the bucket.
        delete_transient( $key );
        set_transient(
            $key,
            array(
                'count'   => 1,
                'expires' => time() + AI_TOOLBAR_RATE_WINDOW,
            ),
            AI_TOOLBAR_RATE_WINDOW
        );
        return true;
    }

    if ( $count >= AI_TOOLBAR_RATE_LIMIT ) {
        return new WP_Error(
            'rate_limited',
            __( 'Too many requests. Please try again in a moment.', 'ai-accessibility-toolbar' ),
            array( 'status' => 429 )
        );
    }

    // Preserve the original window expiry — do NOT reset it.
    $remaining = ( $expires > 0 ) ? max( 1, $expires - time() ) : AI_TOOLBAR_RATE_WINDOW;
    set_transient(
        $key,
        array(
            'count'   => $count + 1,
            'expires' => $expires > 0 ? $expires : ( time() + AI_TOOLBAR_RATE_WINDOW ),
        ),
        $remaining
    );
    return true;
}

function ai_toolbar_get_client_ip() {
    // Default: use the direct connection address — safe for any network topology.
    $remote = ! empty( $_SERVER['REMOTE_ADDR'] )
        ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
        : '0.0.0.0';

    if ( ! apply_filters( 'ai_toolbar_trust_proxy', false ) ) {
        // Proxy headers are not trusted; only use the actual TCP peer address.
        return filter_var( $remote, FILTER_VALIDATE_IP ) ? $remote : '0.0.0.0';
    }

    // When the site runs behind a known, authoritative proxy (e.g. Cloudflare),
    // prefer the IP that proxy injects. Only enable this filter if you control
    // the proxy and trust its headers — otherwise clients can spoof the value.
    $candidates = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR' );
    foreach ( $candidates as $header ) {
        if ( empty( $_SERVER[ $header ] ) ) {
            continue;
        }
        $value = sanitize_text_field( wp_unslash( $_SERVER[ $header ] ) );
        if ( strpos( $value, ',' ) !== false ) {
            // X-Forwarded-For: <client>, <proxy1>, <proxy2>
            // The leftmost value is the original client as reported by the first proxy.
            $parts = explode( ',', $value, 2 );
            $value = trim( $parts[0] );
        }
        if ( filter_var( $value, FILTER_VALIDATE_IP ) ) {
            return $value;
        }
    }

    return filter_var( $remote, FILTER_VALIDATE_IP ) ? $remote : '0.0.0.0';
}

function ai_toolbar_handle_api_request( WP_REST_Request $request ) {
    // Rate-limit before doing anything expensive.
    $allowed = ai_toolbar_check_rate_limit();
    if ( is_wp_error( $allowed ) ) {
        return $allowed;
    }

    $params            = $request->get_json_params();
    $text_to_summarize = isset( $params['text'] ) ? sanitize_textarea_field( $params['text'] ) : '';

    if ( '' === trim( $text_to_summarize ) ) {
        return new WP_Error(
            'no_text',
            __( 'No text content provided.', 'ai-accessibility-toolbar' ),
            array( 'status' => 400 )
        );
    }

    $api_key = (string) get_option( AI_TOOLBAR_OPTION_KEY, '' );
    if ( '' === $api_key ) {
        return new WP_Error(
            'no_key',
            __( 'API key is not configured on the server.', 'ai-accessibility-toolbar' ),
            array( 'status' => 500 )
        );
    }

    // UTF-8-safe truncation.
    $truncated = function_exists( 'mb_substr' )
        ? mb_substr( $text_to_summarize, 0, AI_TOOLBAR_MAX_INPUT, 'UTF-8' )
        : substr( $text_to_summarize, 0, AI_TOOLBAR_MAX_INPUT );

    $prompt = "Provide a comprehensive, easy-to-read summary of this website content:\n\n" . $truncated;

    // Real Gemini generateContent payload.
    $payload = array(
        'contents' => array(
            array(
                'role'  => 'user',
                'parts' => array(
                    array( 'text' => $prompt ),
                ),
            ),
        ),
    );

    $body = wp_json_encode( $payload );
    if ( false === $body ) {
        return new WP_Error(
            'encode_error',
            __( 'Could not encode request body.', 'ai-accessibility-toolbar' ),
            array( 'status' => 500 )
        );
    }

    $endpoint = AI_TOOLBAR_API_BASE . rawurlencode( AI_TOOLBAR_MODEL ) . ':generateContent';

    $response = wp_remote_post(
        $endpoint,
        array(
            'headers' => array(
                'Content-Type'    => 'application/json',
                'x-goog-api-key'  => $api_key, // Header, not URL — stays out of logs.
            ),
            'body'    => $body,
            'timeout' => 30,
        )
    );

    if ( is_wp_error( $response ) ) {
        return new WP_Error(
            'network_error',
            $response->get_error_message(),
            array( 'status' => 502 )
        );
    }

    $status_code = (int) wp_remote_retrieve_response_code( $response );
    $raw_body    = wp_remote_retrieve_body( $response );
    $data        = json_decode( $raw_body, true );

    if ( $status_code < 200 || $status_code >= 300 ) {
        $msg = isset( $data['error']['message'] )
            ? $data['error']['message']
            : sprintf( /* translators: %d: HTTP status code */
                __( 'Upstream Gemini API returned HTTP %d.', 'ai-accessibility-toolbar' ),
                $status_code
            );
        return new WP_Error(
            'gemini_http_error',
            $msg,
            array( 'status' => 502 )
        );
    }

    // For 2xx responses the body must be valid JSON; surface a clear error otherwise.
    if ( null === $data ) {
        return new WP_Error(
            'decode_error',
            __( 'Could not decode the Gemini API response.', 'ai-accessibility-toolbar' ),
            array( 'status' => 502 )
        );
    }

    if ( isset( $data['error']['message'] ) ) {
        return new WP_Error(
            'gemini_error',
            (string) $data['error']['message'],
            array( 'status' => 400 )
        );
    }

    // Extract text from the standard generateContent response shape.
    $summary = '';
    if ( isset( $data['candidates'] ) && is_array( $data['candidates'] ) ) {
        foreach ( $data['candidates'] as $candidate ) {
            if ( ! isset( $candidate['content']['parts'] ) || ! is_array( $candidate['content']['parts'] ) ) {
                continue;
            }
            foreach ( $candidate['content']['parts'] as $part ) {
                if ( isset( $part['text'] ) && is_string( $part['text'] ) && '' !== $part['text'] ) {
                    $summary .= $part['text'];
                }
            }
            if ( '' !== $summary ) {
                break;
            }
        }
    }

    if ( '' === $summary ) {
        $summary = __( 'No response generated.', 'ai-accessibility-toolbar' );
    }

    return rest_ensure_response( array( 'summary' => $summary ) );
}

// ---------------------------------------------------------------------------
// 3. Front-end widget: enqueue assets + inject HTML
// ---------------------------------------------------------------------------

add_action( 'wp_footer', 'ai_toolbar_inject_widget' );
function ai_toolbar_inject_widget() {
    if ( is_admin() ) {
        return;
    }
    ?>
    <button
        id="ai-widget-trigger"
        type="button"
        aria-label="<?php esc_attr_e( 'Open accessibility menu', 'ai-accessibility-toolbar' ); ?>"
        aria-controls="ai-widget-panel"
        aria-expanded="false">✨</button>

    <div
        id="ai-widget-panel"
        role="dialog"
        aria-modal="false"
        aria-label="<?php esc_attr_e( 'Site accessibility options', 'ai-accessibility-toolbar' ); ?>"
        hidden>
        <h3>✨ <?php esc_html_e( 'Site Accessibility', 'ai-accessibility-toolbar' ); ?></h3>

        <button type="button" class="ai-widget-btn ai-primary-btn" id="wpSummarizeBtn">
            📝 <?php esc_html_e( 'Summarize Page Content', 'ai-accessibility-toolbar' ); ?>
        </button>

        <hr class="ai-widget-divider" aria-hidden="true">

        <button type="button" class="ai-widget-btn" id="wpDyslexiaBtn">
            🔤 <?php esc_html_e( 'Toggle Dyslexia Font', 'ai-accessibility-toolbar' ); ?>
        </button>
        <button type="button" class="ai-widget-btn" id="wpContrastBtn">
            🌗 <?php esc_html_e( 'High Contrast Mode', 'ai-accessibility-toolbar' ); ?>
        </button>
        <button type="button" class="ai-widget-btn" id="wpRulerBtn">
            📏 <?php esc_html_e( 'Toggle Reading Ruler', 'ai-accessibility-toolbar' ); ?>
        </button>
        <button type="button" class="ai-widget-btn" id="wpLinksBtn">
            🔗 <?php esc_html_e( 'Highlight All Links', 'ai-accessibility-toolbar' ); ?>
        </button>
        <button type="button" class="ai-widget-btn" id="wpImagesBtn">
            🚫 <?php esc_html_e( 'Hide Distracting Images', 'ai-accessibility-toolbar' ); ?>
        </button>
    </div>
    <?php
}

// ---------------------------------------------------------------------------
// 4. Uninstall
// ---------------------------------------------------------------------------
register_uninstall_hook( __FILE__, 'ai_toolbar_run_uninstall_handler' );
function ai_toolbar_run_uninstall_handler() {
    $handler = __DIR__ . '/AIAccessibilityToolbarUninstallHandler.php';
    if ( file_exists( $handler ) ) {
        // Provide the constant that the handler expects.
        if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
            define( 'WP_UNINSTALL_PLUGIN', true );
        }
        include $handler;
    } else {
        // Fallback: at minimum, remove the option so no secrets linger.
        delete_option( AI_TOOLBAR_OPTION_KEY );
    }
}