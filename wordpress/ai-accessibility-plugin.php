<?php
/**
 * Plugin Name:       AI Accessibility Plugin
 * Plugin URI:        https://github.com/lisagorewitdecker/AI-Accessibility-Plugin-API-WP-NPM
 * Description:       AI-powered accessibility analysis for WordPress. Scans posts and pages for WCAG 2.1 issues and provides AI-generated suggestions using the OpenAI API.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            AI Accessibility Plugin Contributors
 * License:           MIT
 * Text Domain:       ai-accessibility-plugin
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

define( 'AIACC_VERSION',     '1.0.0' );
define( 'AIACC_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'AIACC_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'AIACC_PLUGIN_FILE', __FILE__ );

// Load core classes.
require_once AIACC_PLUGIN_DIR . 'includes/class-ai-client.php';
require_once AIACC_PLUGIN_DIR . 'includes/class-accessibility-analyzer.php';
require_once AIACC_PLUGIN_DIR . 'includes/class-report.php';
require_once AIACC_PLUGIN_DIR . 'admin/class-admin.php';
require_once AIACC_PLUGIN_DIR . 'includes/class-rest-api.php';

/**
 * Main plugin bootstrap class.
 */
final class AI_Accessibility_Plugin {

    /** @var AI_Accessibility_Plugin|null Singleton instance. */
    private static ?self $instance = null;

    /**
     * Return the singleton instance.
     *
     * @return self
     */
    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** Private constructor — use get_instance(). */
    private function __construct() {
        $this->init_hooks();
    }

    /**
     * Register WordPress hooks.
     */
    private function init_hooks(): void {
        register_activation_hook( AIACC_PLUGIN_FILE,   [ $this, 'activate' ] );
        register_deactivation_hook( AIACC_PLUGIN_FILE, [ $this, 'deactivate' ] );

        add_action( 'init',            [ $this, 'load_textdomain' ] );
        add_action( 'rest_api_init',   [ 'AIACC_REST_API', 'register_routes' ] );

        if ( is_admin() ) {
            new AIACC_Admin();
        }
    }

    /**
     * Plugin activation: create database tables.
     */
    public function activate(): void {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();
        $table_name      = $wpdb->prefix . 'aiacc_reports';

        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id          BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            post_id     BIGINT(20) UNSIGNED NOT NULL,
            score       TINYINT(3) UNSIGNED NOT NULL DEFAULT 0,
            wcag_level  VARCHAR(4) NOT NULL DEFAULT 'FAIL',
            issue_count SMALLINT(5) UNSIGNED NOT NULL DEFAULT 0,
            report_data LONGTEXT NOT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY post_id (post_id)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );

        update_option( 'aiacc_db_version', AIACC_VERSION );
    }

    /**
     * Plugin deactivation.
     */
    public function deactivate(): void {
        // No-op: preserve data on deactivation.
    }

    /**
     * Load plugin text domain for i18n.
     */
    public function load_textdomain(): void {
        load_plugin_textdomain(
            'ai-accessibility-plugin',
            false,
            dirname( plugin_basename( AIACC_PLUGIN_FILE ) ) . '/languages/'
        );
    }
}

// Boot the plugin.
AI_Accessibility_Plugin::get_instance();
