<?php
/**
 * WordPress admin interface for the AI Accessibility Plugin.
 *
 * Adds a top-level admin menu with:
 *   - Dashboard: site-wide accessibility statistics.
 *   - Settings: OpenAI API key and plugin configuration.
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class AIACC_Admin
 */
class AIACC_Admin {

    private const SETTINGS_GROUP  = 'aiacc_settings';
    private const SETTINGS_PAGE   = 'ai-accessibility-settings';
    private const CAPABILITY       = 'manage_options';

    public function __construct() {
        add_action( 'admin_menu',            [ $this, 'add_admin_menu' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'add_meta_boxes',        [ $this, 'add_meta_box' ] );
        add_action( 'save_post',             [ $this, 'save_post_hook' ], 10, 2 );
    }

    // -------------------------------------------------------------------------
    // Menu
    // -------------------------------------------------------------------------

    public function add_admin_menu(): void {
        add_menu_page(
            __( 'AI Accessibility', 'ai-accessibility-plugin' ),
            __( 'AI Accessibility', 'ai-accessibility-plugin' ),
            self::CAPABILITY,
            'ai-accessibility',
            [ $this, 'render_dashboard_page' ],
            'dashicons-universal-access',
            80
        );

        add_submenu_page(
            'ai-accessibility',
            __( 'Dashboard', 'ai-accessibility-plugin' ),
            __( 'Dashboard', 'ai-accessibility-plugin' ),
            self::CAPABILITY,
            'ai-accessibility',
            [ $this, 'render_dashboard_page' ]
        );

        add_submenu_page(
            'ai-accessibility',
            __( 'Settings', 'ai-accessibility-plugin' ),
            __( 'Settings', 'ai-accessibility-plugin' ),
            self::CAPABILITY,
            self::SETTINGS_PAGE,
            [ $this, 'render_settings_page' ]
        );
    }

    // -------------------------------------------------------------------------
    // Settings
    // -------------------------------------------------------------------------

    public function register_settings(): void {
        register_setting(
            self::SETTINGS_GROUP,
            'aiacc_openai_api_key',
            [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => '',
            ]
        );

        register_setting(
            self::SETTINGS_GROUP,
            'aiacc_model',
            [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'gpt-4o-mini',
            ]
        );

        register_setting(
            self::SETTINGS_GROUP,
            'aiacc_enable_ai',
            [
                'type'    => 'boolean',
                'default' => false,
            ]
        );

        register_setting(
            self::SETTINGS_GROUP,
            'aiacc_auto_scan',
            [
                'type'    => 'boolean',
                'default' => true,
            ]
        );

        add_settings_section(
            'aiacc_general',
            __( 'General Settings', 'ai-accessibility-plugin' ),
            '__return_false',
            self::SETTINGS_PAGE
        );

        add_settings_field(
            'aiacc_openai_api_key',
            __( 'OpenAI API Key', 'ai-accessibility-plugin' ),
            [ $this, 'field_api_key' ],
            self::SETTINGS_PAGE,
            'aiacc_general'
        );

        add_settings_field(
            'aiacc_model',
            __( 'AI Model', 'ai-accessibility-plugin' ),
            [ $this, 'field_model' ],
            self::SETTINGS_PAGE,
            'aiacc_general'
        );

        add_settings_field(
            'aiacc_enable_ai',
            __( 'Enable AI Suggestions', 'ai-accessibility-plugin' ),
            [ $this, 'field_enable_ai' ],
            self::SETTINGS_PAGE,
            'aiacc_general'
        );

        add_settings_field(
            'aiacc_auto_scan',
            __( 'Auto-scan on Save', 'ai-accessibility-plugin' ),
            [ $this, 'field_auto_scan' ],
            self::SETTINGS_PAGE,
            'aiacc_general'
        );
    }

    // -------------------------------------------------------------------------
    // Settings field renderers
    // -------------------------------------------------------------------------

    public function field_api_key(): void {
        $value = (string) get_option( 'aiacc_openai_api_key', '' );
        // Mask existing key for display
        $display = $value ? str_repeat( '*', max( 0, strlen( $value ) - 4 ) ) . substr( $value, -4 ) : '';
        ?>
        <input
            type="password"
            id="aiacc_openai_api_key"
            name="aiacc_openai_api_key"
            class="regular-text"
            value="<?php echo esc_attr( $value ); ?>"
            autocomplete="off"
        >
        <?php if ( $display ) : ?>
            <p class="description">
                <?php
                printf(
                    /* translators: %s: masked API key */
                    esc_html__( 'Current key: %s', 'ai-accessibility-plugin' ),
                    '<code>' . esc_html( $display ) . '</code>'
                );
                ?>
            </p>
        <?php endif; ?>
        <p class="description">
            <?php esc_html_e( 'Required for AI-powered features. Get a key at platform.openai.com.', 'ai-accessibility-plugin' ); ?>
        </p>
        <?php
    }

    public function field_model(): void {
        $value  = (string) get_option( 'aiacc_model', 'gpt-4o-mini' );
        $models = [ 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo' ];
        ?>
        <select id="aiacc_model" name="aiacc_model">
            <?php foreach ( $models as $model ) : ?>
                <option value="<?php echo esc_attr( $model ); ?>" <?php selected( $value, $model ); ?>>
                    <?php echo esc_html( $model ); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <?php
    }

    public function field_enable_ai(): void {
        $value = (bool) get_option( 'aiacc_enable_ai', false );
        ?>
        <label>
            <input type="checkbox" name="aiacc_enable_ai" value="1" <?php checked( $value ); ?>>
            <?php esc_html_e( 'Use AI to generate alt text and content suggestions (requires API key)', 'ai-accessibility-plugin' ); ?>
        </label>
        <?php
    }

    public function field_auto_scan(): void {
        $value = (bool) get_option( 'aiacc_auto_scan', true );
        ?>
        <label>
            <input type="checkbox" name="aiacc_auto_scan" value="1" <?php checked( $value ); ?>>
            <?php esc_html_e( 'Automatically scan posts and pages when they are saved.', 'ai-accessibility-plugin' ); ?>
        </label>
        <?php
    }

    // -------------------------------------------------------------------------
    // Page renderers
    // -------------------------------------------------------------------------

    public function render_dashboard_page(): void {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'ai-accessibility-plugin' ) );
        }

        $stats = AIACC_Report::get_dashboard_stats();
        ?>
        <div class="wrap aiacc-dashboard">
            <h1><?php esc_html_e( 'AI Accessibility Dashboard', 'ai-accessibility-plugin' ); ?></h1>

            <div class="aiacc-stat-cards">
                <div class="aiacc-stat-card">
                    <span class="aiacc-stat-value"><?php echo esc_html( $stats['avg_score'] ); ?></span>
                    <span class="aiacc-stat-label"><?php esc_html_e( 'Avg. Score', 'ai-accessibility-plugin' ); ?></span>
                </div>
                <div class="aiacc-stat-card">
                    <span class="aiacc-stat-value"><?php echo esc_html( $stats['total_posts'] ); ?></span>
                    <span class="aiacc-stat-label"><?php esc_html_e( 'Posts Scanned', 'ai-accessibility-plugin' ); ?></span>
                </div>
                <div class="aiacc-stat-card aiacc-stat-passing">
                    <span class="aiacc-stat-value"><?php echo esc_html( $stats['passing'] ); ?></span>
                    <span class="aiacc-stat-label"><?php esc_html_e( 'Passing (≥80)', 'ai-accessibility-plugin' ); ?></span>
                </div>
                <div class="aiacc-stat-card aiacc-stat-failing">
                    <span class="aiacc-stat-value"><?php echo esc_html( $stats['failing'] ); ?></span>
                    <span class="aiacc-stat-label"><?php esc_html_e( 'Need Attention', 'ai-accessibility-plugin' ); ?></span>
                </div>
            </div>

            <p>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::SETTINGS_PAGE ) ); ?>" class="button">
                    <?php esc_html_e( 'Go to Settings', 'ai-accessibility-plugin' ); ?>
                </a>
            </p>
        </div>
        <?php
    }

    public function render_settings_page(): void {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'ai-accessibility-plugin' ) );
        }
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'AI Accessibility Settings', 'ai-accessibility-plugin' ); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields( self::SETTINGS_GROUP );
                do_settings_sections( self::SETTINGS_PAGE );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Meta box
    // -------------------------------------------------------------------------

    public function add_meta_box(): void {
        $post_types = apply_filters( 'aiacc_post_types', [ 'post', 'page' ] );
        foreach ( $post_types as $pt ) {
            add_meta_box(
                'aiacc-accessibility-report',
                __( 'Accessibility Report', 'ai-accessibility-plugin' ),
                [ $this, 'render_meta_box' ],
                $pt,
                'normal',
                'default'
            );
        }
    }

    public function render_meta_box( WP_Post $post ): void {
        $report = AIACC_Report::get_latest( $post->ID );
        wp_nonce_field( 'aiacc_scan_post_' . $post->ID, 'aiacc_nonce' );
        ?>
        <div id="aiacc-meta-box" data-post-id="<?php echo esc_attr( $post->ID ); ?>">
            <?php if ( $report ) : ?>
                <p>
                    <strong><?php esc_html_e( 'Score:', 'ai-accessibility-plugin' ); ?></strong>
                    <?php echo esc_html( $report['score'] ); ?>/100
                    (<?php echo esc_html( $report['wcag_level'] ); ?>)
                </p>
                <p>
                    <strong><?php esc_html_e( 'Issues found:', 'ai-accessibility-plugin' ); ?></strong>
                    <?php echo esc_html( $report['issue_count'] ); ?>
                </p>
                <?php if ( ! empty( $report['issues'] ) ) : ?>
                    <details>
                        <summary><?php esc_html_e( 'View issues', 'ai-accessibility-plugin' ); ?></summary>
                        <ul class="aiacc-issue-list">
                            <?php foreach ( $report['issues'] as $issue ) : ?>
                                <li>
                                    <code><?php echo esc_html( $issue['type'] ); ?></code>:
                                    <?php echo esc_html( $issue['message'] ); ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    </details>
                <?php endif; ?>
                <p class="description">
                    <?php
                    printf(
                        /* translators: %s: datetime */
                        esc_html__( 'Last scanned: %s', 'ai-accessibility-plugin' ),
                        esc_html( $report['generated_at'] )
                    );
                    ?>
                </p>
            <?php else : ?>
                <p><?php esc_html_e( 'No accessibility report yet. Save the post to run a scan.', 'ai-accessibility-plugin' ); ?></p>
            <?php endif; ?>
            <button type="button" id="aiacc-scan-now" class="button">
                <?php esc_html_e( 'Scan Now', 'ai-accessibility-plugin' ); ?>
            </button>
            <span id="aiacc-scan-status"></span>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Auto-scan on save
    // -------------------------------------------------------------------------

    /**
     * Run an accessibility scan when a post is saved (if auto-scan is enabled).
     *
     * @param int     $post_id
     * @param WP_Post $post
     */
    public function save_post_hook( int $post_id, WP_Post $post ): void {
        // Skip autosaves, revisions, and non-supported post types.
        if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
            return;
        }

        if ( ! get_option( 'aiacc_auto_scan', true ) ) {
            return;
        }

        $post_types = apply_filters( 'aiacc_post_types', [ 'post', 'page' ] );
        if ( ! in_array( $post->post_type, $post_types, true ) ) {
            return;
        }

        $html      = apply_filters( 'the_content', $post->post_content );
        $enable_ai = (bool) get_option( 'aiacc_enable_ai', false );

        $analyzer = new AIACC_Accessibility_Analyzer( null, $enable_ai );
        $results  = $analyzer->analyze( $html );
        AIACC_Report::build_and_save( $post_id, $results );
    }

    // -------------------------------------------------------------------------
    // Assets
    // -------------------------------------------------------------------------

    public function enqueue_assets( string $hook ): void {
        if ( ! in_array( $hook, [ 'post.php', 'post-new.php', 'toplevel_page_ai-accessibility', 'ai-accessibility_page_ai-accessibility-settings' ], true ) ) {
            return;
        }

        wp_enqueue_style(
            'aiacc-admin',
            AIACC_PLUGIN_URL . 'admin/admin.css',
            [],
            AIACC_VERSION
        );

        wp_enqueue_script(
            'aiacc-admin',
            AIACC_PLUGIN_URL . 'admin/admin.js',
            [ 'jquery' ],
            AIACC_VERSION,
            true
        );

        wp_localize_script(
            'aiacc-admin',
            'aacc_admin',
            [
                'rest_url' => esc_url_raw( rest_url( 'ai-accessibility/v1/' ) ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'i18n'     => [
                    'scanning'   => __( 'Scanning…', 'ai-accessibility-plugin' ),
                    'scan_error' => __( 'Scan failed. Please try again.', 'ai-accessibility-plugin' ),
                ],
            ]
        );
    }
}
