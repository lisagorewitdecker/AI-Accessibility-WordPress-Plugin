<?php
/**
 * Uninstall handler for AI Accessibility Toolbar & API.
 *
 * Runs when the plugin is deleted via the WordPress admin.
 * Removes all persistent data created by the plugin.
 *
 * @package ai-accessibility-toolbar
 */

// Exit if not called by WordPress during uninstall.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Also require ABSPATH as a belt-and-braces guard against direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'ai_toolbar_delete_site_data' ) ) {
	/**
	 * Delete the plugin's data for a single site.
	 *
	 * @return void
	 */
	function ai_toolbar_delete_site_data() {
		global $wpdb;

		// 1. Remove the stored API key.
		delete_option( 'ai_toolbar_gemini_key' );

		// 2. Remove any leftover rate-limit transients (both value and timeout rows).
		// These use the prefix "ai_toolbar_rl_" defined in the plugin.
		$prefixes = array(
			'_transient_ai_toolbar_rl_',
			'_transient_timeout_ai_toolbar_rl_',
		);

		foreach ( $prefixes as $prefix ) {
			$like = $wpdb->esc_like( $prefix ) . '%';
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query(
				$wpdb->prepare(
					"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
					$like
				)
			);
		}

		// 3. Flush the options from the object cache explicitly if needed,
		// though delete_option() already handles cache invalidation for the key.
		wp_cache_delete( 'ai_toolbar_gemini_key', 'options' );
	}
}

if ( ! function_exists( 'ai_toolbar_delete_network_data' ) ) {
	/**
	 * Delete plugin-level network-wide data (site options, user meta, etc.).
	 *
	 * Currently a placeholder for future network-wide options; safe to call
	 * even if the plugin never stored anything at the network level.
	 *
	 * @return void
	 */
	function ai_toolbar_delete_network_data() {
		// If a future version uses add_site_option()/update_site_option(), clean it up here.
		if ( function_exists( 'delete_site_option' ) ) {
			delete_site_option( 'ai_toolbar_gemini_key' );
		}
	}
}

// Multisite: iterate over every site so nothing is left behind.
if ( is_multisite() ) {
	$batch_size = 100;
	$offset     = 0;

	do {
		$site_ids = get_sites(
			array(
				'fields' => 'ids',
				'number' => $batch_size,
				'offset' => $offset,
			)
		);

		if ( empty( $site_ids ) ) {
			break;
		}

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( (int) $site_id );
			ai_toolbar_delete_site_data();
			restore_current_blog();
		}

		$offset    += $batch_size;
		$site_count = count( $site_ids );
	} while ( $batch_size === $site_count );

	ai_toolbar_delete_network_data();
} else {
	ai_toolbar_delete_site_data();
}
