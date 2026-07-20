<?php
/**
 * Uninstall file for the AI Accessibility Toolbar plugin.
 *
 * @package ai-accessibility-toolbar
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Load the uninstall handler (procedural script) which performs cleanup on include.
require_once __DIR__ . '/AIAccessibilityToolbarUninstallHandler.php';
