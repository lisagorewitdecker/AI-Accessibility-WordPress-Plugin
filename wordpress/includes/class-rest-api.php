<?php
/**
 * WordPress REST API endpoints for the AI Accessibility Plugin.
 *
 * Namespace: /wp-json/ai-accessibility/v1/
 *
 * Endpoints:
 *   POST /analyze          — Analyse submitted HTML content.
 *   GET  /report/{post_id} — Retrieve the latest saved report for a post.
 *   GET  /stats            — Dashboard summary statistics.
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class AIACC_REST_API
 */
class AIACC_REST_API {

    private const NAMESPACE = 'ai-accessibility/v1';

    /**
     * Register REST routes.
     */
    public static function register_routes(): void {
        register_rest_route(
            self::NAMESPACE,
            '/analyze',
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [ self::class, 'analyze' ],
                'permission_callback' => [ self::class, 'check_permission' ],
                'args'                => [
                    'html' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'wp_kses_post',
                        'description'       => __( 'HTML content to analyse.', 'ai-accessibility-plugin' ),
                    ],
                    'post_id' => [
                        'required'          => false,
                        'type'              => 'integer',
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                        'description'       => __( 'Optional post ID to associate the report with.', 'ai-accessibility-plugin' ),
                    ],
                    'enable_ai' => [
                        'required'          => false,
                        'type'              => 'boolean',
                        'default'           => false,
                        'description'       => __( 'Whether to use AI-powered suggestions.', 'ai-accessibility-plugin' ),
                    ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/report/(?P<post_id>\d+)',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ self::class, 'get_report' ],
                'permission_callback' => [ self::class, 'check_permission' ],
                'args'                => [
                    'post_id' => [
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/stats',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ self::class, 'get_stats' ],
                'permission_callback' => [ self::class, 'check_permission' ],
            ]
        );
    }

    /**
     * POST /analyze
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function analyze( WP_REST_Request $request ): WP_REST_Response {
        $html      = $request->get_param( 'html' );
        $post_id   = (int) $request->get_param( 'post_id' );
        $enable_ai = (bool) $request->get_param( 'enable_ai' );

        if ( empty( trim( $html ) ) ) {
            return new WP_REST_Response(
                [ 'error' => __( 'html parameter must not be empty.', 'ai-accessibility-plugin' ) ],
                400
            );
        }

        $analyzer = new AIACC_Accessibility_Analyzer( null, $enable_ai );
        $results  = $analyzer->analyze( $html, [ 'post_id' => $post_id ] );
        $report   = AIACC_Report::build( $results );

        if ( $post_id > 0 ) {
            AIACC_Report::save( $post_id, $report );
        }

        return new WP_REST_Response( $report, 200 );
    }

    /**
     * GET /report/{post_id}
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function get_report( WP_REST_Request $request ): WP_REST_Response {
        $post_id = (int) $request->get_param( 'post_id' );
        $report  = AIACC_Report::get_latest( $post_id );

        if ( null === $report ) {
            return new WP_REST_Response(
                [ 'error' => __( 'No report found for this post.', 'ai-accessibility-plugin' ) ],
                404
            );
        }

        return new WP_REST_Response( $report, 200 );
    }

    /**
     * GET /stats
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function get_stats( WP_REST_Request $request ): WP_REST_Response {
        $stats = AIACC_Report::get_dashboard_stats();
        return new WP_REST_Response( $stats, 200 );
    }

    /**
     * Permission callback: require a logged-in user with edit_posts capability.
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public static function check_permission( WP_REST_Request $request ): bool {
        return current_user_can( 'edit_posts' );
    }
}
