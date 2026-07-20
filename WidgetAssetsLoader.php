<?php
/**
 * Widget Assets Loader.
 *
 * Registers and enqueues the front-end CSS/JS for the AI Accessibility Toolbar
 * widget, and localizes the configuration object consumed by the JS.
 *
 * NOTE: This file is intended to REPLACE the inline `ai_toolbar_enqueue_assets()`
 * implementation that currently lives in AIAccessibilityToolbarPlugin.php.
 * Remove that duplicate before including this file, or a fatal
 * "Cannot redeclare function" error will occur.
 *
 * @package ai-accessibility-toolbar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if ( ! function_exists( 'ai_toolbar_asset_version' ) ) {
	/**
	 * Resolve a cache-busting version string for a bundled asset.
	 *
	 * Uses filemtime() when available, falling back to the plugin version so
	 * the returned value is always a truthy string (never `false`, which would
	 * make WordPress fall back to its own core version and break busting).
	 *
	 * @param string $absolute_path Absolute filesystem path to the asset.
	 * @return string
	 */
	function ai_toolbar_asset_version( $absolute_path ) {
		$default = defined( 'AI_TOOLBAR_VERSION' ) ? AI_TOOLBAR_VERSION : '1.0';

		if ( ! is_string( $absolute_path ) || '' === $absolute_path || ! file_exists( $absolute_path ) ) {
			return $default;
		}

		$mtime = filemtime( $absolute_path );
		return ( false === $mtime ) ? $default : (string) $mtime;
	}
}

if ( ! function_exists( 'ai_toolbar_enqueue_assets' ) ) {
	/**
	 * Enqueue the widget's stylesheet and script on the public-facing site.
	 *
	 * Hooked to `wp_enqueue_scripts` from the main plugin file.
	 *
	 * @return void
	 */
	function ai_toolbar_enqueue_assets() {
		if ( is_admin() ) {
			return;
		}

		// Guard against being loaded without the main plugin's constants.
		if ( ! defined( 'AI_TOOLBAR_DIR' ) || ! defined( 'AI_TOOLBAR_URL' ) ) {
			return;
		}

		$css_rel = 'assets/css/AIWidgetStyles.css';
		$js_rel  = 'assets/js/AIAccessibilityToolbar.js';
		$css_abs = AI_TOOLBAR_DIR . $css_rel;
		$js_abs  = AI_TOOLBAR_DIR . $js_rel;

		wp_enqueue_style(
			'ai-toolbar-widget',
			AI_TOOLBAR_URL . $css_rel,
			array(),
			ai_toolbar_asset_version( $css_abs )
		);

		wp_enqueue_script(
			'ai-toolbar-widget',
			AI_TOOLBAR_URL . $js_rel,
			array(),
			ai_toolbar_asset_version( $js_abs ),
			true
		);

		$max_input = defined( 'AI_TOOLBAR_MAX_INPUT' ) ? (int) AI_TOOLBAR_MAX_INPUT : 12000;

		$config = array(
			'endpoint' => esc_url_raw( rest_url( 'ai-toolbar/v1/summarize' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'maxInput' => $max_input,
			'i18n'     => array(
				'processing'  => __( '✨ AI is reading and processing this page…', 'ai-accessibility-toolbar' ),
				'summary'     => __( '📝 Webpage Summary:', 'ai-accessibility-toolbar' ),
				'requestFail' => __( 'Request failed.', 'ai-accessibility-toolbar' ),
				'connError'   => __( '❌ Connection error contacting the API endpoint.', 'ai-accessibility-toolbar' ),
				'rateLimited' => __( '⏳ Too many requests — please try again shortly.', 'ai-accessibility-toolbar' ),
			),
		);

		// Prefer wp_add_inline_script over wp_localize_script for structured JSON:
		// it avoids the historical string-casting quirks of wp_localize_script.
		$inline = 'window.AI_TOOLBAR = ' . wp_json_encode( $config ) . ';';
		wp_add_inline_script( 'ai-toolbar-widget', $inline, 'before' );
	}
}

// Register the hook (WordPress guarantees add_action exists once ABSPATH is defined).
add_action( 'wp_enqueue_scripts', 'ai_toolbar_enqueue_assets' );