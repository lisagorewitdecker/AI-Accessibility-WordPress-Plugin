<?php
/**
 * Accessibility report model and persistence helpers.
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class AIACC_Report
 */
class AIACC_Report {

    /**
     * Weights for each check when calculating the overall score.
     */
    private const WEIGHTS = [
        'alt_text' => 25,
        'aria'     => 20,
        'headings' => 20,
        'keyboard' => 15,
    ];

    /**
     * Build a full report from raw analyzer results and save it to the DB.
     *
     * @param int   $post_id         WordPress post ID.
     * @param array $analyzer_results Results keyed by check name.
     * @return array Full report array.
     */
    public static function build_and_save( int $post_id, array $analyzer_results ): array {
        $report = self::build( $analyzer_results );
        self::save( $post_id, $report );
        return $report;
    }

    /**
     * Build a report array from analyzer results without saving.
     *
     * @param array $analyzer_results
     * @return array
     */
    public static function build( array $analyzer_results ): array {
        $score      = self::calculate_score( $analyzer_results );
        $wcag_level = self::score_to_level( $score );
        $issues     = self::collect_issues( $analyzer_results );

        return [
            'score'        => $score,
            'wcag_level'   => $wcag_level,
            'passed'       => empty( $issues ),
            'issue_count'  => count( $issues ),
            'issues'       => $issues,
            'details'      => $analyzer_results,
            'generated_at' => ( new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) ) )->format( 'c' ),
        ];
    }

    /**
     * Persist a report for a post.
     *
     * @param int   $post_id
     * @param array $report
     */
    public static function save( int $post_id, array $report ): void {
        global $wpdb;

        $table = $wpdb->prefix . 'aiacc_reports';
        $wpdb->insert(
            $table,
            [
                'post_id'     => $post_id,
                'score'       => $report['score'],
                'wcag_level'  => $report['wcag_level'],
                'issue_count' => $report['issue_count'],
                'report_data' => wp_json_encode( $report ),
            ],
            [ '%d', '%d', '%s', '%d', '%s' ]
        );
    }

    /**
     * Retrieve the most recent report for a post.
     *
     * @param int $post_id
     * @return array|null Report array or null if none found.
     */
    public static function get_latest( int $post_id ): ?array {
        global $wpdb;

        $table = $wpdb->prefix . 'aiacc_reports';
        $row   = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT report_data FROM {$table} WHERE post_id = %d ORDER BY id DESC LIMIT 1",
                $post_id
            )
        );

        if ( ! $row ) {
            return null;
        }

        return json_decode( $row->report_data, true );
    }

    /**
     * Retrieve aggregated stats for the admin dashboard.
     *
     * @return array{ avg_score: float, total_posts: int, passing: int, failing: int }
     */
    public static function get_dashboard_stats(): array {
        global $wpdb;

        $table = $wpdb->prefix . 'aiacc_reports';

        // Latest report per post
        $rows = $wpdb->get_results(
            "SELECT post_id, score, wcag_level
             FROM {$table}
             WHERE id IN (
                 SELECT MAX(id) FROM {$table} GROUP BY post_id
             )"
        );

        if ( empty( $rows ) ) {
            return [ 'avg_score' => 0.0, 'total_posts' => 0, 'passing' => 0, 'failing' => 0 ];
        }

        $scores  = array_column( (array) $rows, 'score' );
        $passing = count( array_filter( $scores, fn( $s ) => (int) $s >= 80 ) );

        return [
            'avg_score'   => round( array_sum( $scores ) / count( $scores ), 1 ),
            'total_posts' => count( $rows ),
            'passing'     => $passing,
            'failing'     => count( $rows ) - $passing,
        ];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static function calculate_score( array $results ): int {
        $total_weight  = 0;
        $earned_score  = 0;

        foreach ( self::WEIGHTS as $key => $weight ) {
            $total_weight += $weight;
            $result = $results[ $key ] ?? null;

            if ( ! $result ) {
                $earned_score += $weight;
                continue;
            }

            $issue_count  = count( $result['issues'] ?? [] );
            $deduction    = min( $weight, $issue_count * ( $weight / 5 ) );
            $earned_score += $weight - $deduction;
        }

        return (int) round( ( $earned_score / $total_weight ) * 100 );
    }

    private static function score_to_level( int $score ): string {
        if ( $score >= 95 ) return 'AAA';
        if ( $score >= 80 ) return 'AA';
        if ( $score >= 60 ) return 'A';
        return 'FAIL';
    }

    private static function collect_issues( array $results ): array {
        $all = [];
        foreach ( $results as $analyzer => $result ) {
            if ( ! is_array( $result ) || ! isset( $result['issues'] ) ) {
                continue;
            }
            foreach ( $result['issues'] as $issue ) {
                $all[] = array_merge( [ 'analyzer' => $analyzer ], $issue );
            }
        }
        return $all;
    }
}
