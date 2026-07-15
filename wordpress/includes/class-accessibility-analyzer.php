<?php
/**
 * Accessibility analyzer for WordPress content.
 *
 * Runs WCAG 2.1 heuristic checks on HTML content and optionally enriches
 * the results with AI-generated suggestions.
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class AIACC_Accessibility_Analyzer
 */
class AIACC_Accessibility_Analyzer {

    /** @var AIACC_AI_Client */
    private AIACC_AI_Client $ai_client;

    /** @var bool Whether AI enrichment is enabled. */
    private bool $enable_ai;

    /**
     * Constructor.
     *
     * @param AIACC_AI_Client|null $ai_client AI client instance.
     * @param bool                 $enable_ai Whether to call the AI API.
     */
    public function __construct( ?AIACC_AI_Client $ai_client = null, bool $enable_ai = false ) {
        $this->ai_client = $ai_client ?? new AIACC_AI_Client();
        $this->enable_ai = $enable_ai && $this->ai_client->is_configured();
    }

    /**
     * Analyze an HTML string and return a structured result array.
     *
     * @param string $html  Raw HTML to analyse.
     * @param array  $meta  Optional metadata (url, title).
     * @return array Analyzer results keyed by check name.
     */
    public function analyze( string $html, array $meta = [] ): array {
        $results = [
            'alt_text'  => $this->check_alt_text( $html ),
            'aria'      => $this->check_aria( $html ),
            'headings'  => $this->check_headings( $html ),
            'keyboard'  => $this->check_keyboard( $html ),
            'meta'      => $meta,
        ];

        if ( $this->enable_ai ) {
            $results['ai_suggestions'] = $this->get_ai_suggestions( $html, $results );
        }

        return $results;
    }

    // -------------------------------------------------------------------------
    // Individual checks
    // -------------------------------------------------------------------------

    /**
     * Check all <img> elements for alt attribute issues.
     *
     * @param string $html
     * @return array{ issues: array, images: array, passed: bool }
     */
    private function check_alt_text( string $html ): array {
        $issues = [];
        $images = [];

        preg_match_all( '/<img(\s[^>]*)?\/?>/i', $html, $matches, PREG_SET_ORDER );

        foreach ( $matches as $match ) {
            $full  = $match[0];
            $attrs = $this->parse_attributes( $match[1] ?? '' );
            $src   = $attrs['src'] ?? '';

            $has_alt   = array_key_exists( 'alt', $attrs );
            $alt_value = $has_alt ? (string) $attrs['alt'] : null;
            $is_empty  = $has_alt && $alt_value === '';
            $decorative_pattern = '/(?:spacer|divider|dot|bullet|pixel|blank|separator|bg|background)/i';
            $is_decorative = $is_empty && preg_match( $decorative_pattern, $src );

            if ( ! $has_alt ) {
                $status = 'missing-alt';
                $issues[] = [
                    'type'    => 'img-missing-alt',
                    'element' => $full,
                    'message' => sprintf(
                        /* translators: %s image src */
                        __( '<img src="%s"> is missing an alt attribute.', 'ai-accessibility-plugin' ),
                        esc_html( $src )
                    ),
                ];
            } elseif ( $is_empty && ! $is_decorative ) {
                $status = 'empty-alt';
                $issues[] = [
                    'type'    => 'img-empty-alt-review',
                    'element' => $full,
                    'message' => sprintf(
                        /* translators: %s image src */
                        __( '<img src="%s"> has alt="" — confirm it is purely decorative.', 'ai-accessibility-plugin' ),
                        esc_html( $src )
                    ),
                ];
            } elseif ( $has_alt && ! $is_empty && preg_match( '/^(image|photo|picture|img|graphic|icon|logo)\b/i', $alt_value ) ) {
                $status = 'poor-alt';
                $issues[] = [
                    'type'    => 'img-poor-alt',
                    'element' => $full,
                    'message' => sprintf(
                        /* translators: 1: src, 2: alt */
                        __( '<img src="%1$s" alt="%2$s"> — alt text starts with a redundant word.', 'ai-accessibility-plugin' ),
                        esc_html( $src ),
                        esc_html( $alt_value )
                    ),
                ];
            } else {
                $status = $is_decorative ? 'decorative-ok' : 'ok';
            }

            $images[] = [ 'src' => $src, 'alt' => $alt_value, 'status' => $status ];
        }

        return [ 'issues' => $issues, 'images' => $images, 'passed' => empty( $issues ) ];
    }

    /**
     * Check ARIA attribute usage.
     *
     * @param string $html
     * @return array{ issues: array, passed: bool }
     */
    private function check_aria( string $html ): array {
        $issues = [];

        // aria-labelledby references non-existent id
        preg_match_all( '/aria-labelledby="([^"]+)"/i', $html, $matches, PREG_SET_ORDER );
        foreach ( $matches as $m ) {
            foreach ( explode( ' ', $m[1] ) as $id ) {
                if ( $id && ! preg_match( '/id="' . preg_quote( $id, '/' ) . '"/', $html ) ) {
                    $issues[] = [
                        'type'    => 'aria-labelledby-missing-target',
                        'element' => $m[0],
                        'message' => sprintf(
                            /* translators: %s: id value */
                            __( 'aria-labelledby references id "%s" which does not exist.', 'ai-accessibility-plugin' ),
                            esc_html( $id )
                        ),
                    ];
                }
            }
        }

        // aria-describedby references non-existent id
        preg_match_all( '/aria-describedby="([^"]+)"/i', $html, $matches, PREG_SET_ORDER );
        foreach ( $matches as $m ) {
            foreach ( explode( ' ', $m[1] ) as $id ) {
                if ( $id && ! preg_match( '/id="' . preg_quote( $id, '/' ) . '"/', $html ) ) {
                    $issues[] = [
                        'type'    => 'aria-describedby-missing-target',
                        'element' => $m[0],
                        'message' => sprintf(
                            /* translators: %s: id value */
                            __( 'aria-describedby references id "%s" which does not exist.', 'ai-accessibility-plugin' ),
                            esc_html( $id )
                        ),
                    ];
                }
            }
        }

        // role="img" without accessible name
        preg_match_all( '/<[a-z]+[^>]+role="img"[^>]*>/i', $html, $matches );
        foreach ( $matches[0] as $tag ) {
            if ( ! preg_match( '/aria-label=/i', $tag ) && ! preg_match( '/aria-labelledby=/i', $tag ) ) {
                $issues[] = [
                    'type'    => 'role-img-missing-label',
                    'element' => $tag,
                    'message' => __( 'Element with role="img" must have an aria-label or aria-labelledby.', 'ai-accessibility-plugin' ),
                ];
            }
        }

        // Empty buttons without accessible name
        preg_match_all( '/<button([^>]*)>\s*<\/button>/i', $html, $matches, PREG_SET_ORDER );
        foreach ( $matches as $m ) {
            if ( ! preg_match( '/aria-label=/i', $m[1] ) && ! preg_match( '/aria-labelledby=/i', $m[1] ) ) {
                $issues[] = [
                    'type'    => 'button-no-accessible-name',
                    'element' => $m[0],
                    'message' => __( 'Empty <button> has no aria-label or aria-labelledby.', 'ai-accessibility-plugin' ),
                ];
            }
        }

        return [ 'issues' => $issues, 'passed' => empty( $issues ) ];
    }

    /**
     * Check heading hierarchy.
     *
     * @param string $html
     * @return array{ issues: array, headings: array, passed: bool }
     */
    private function check_headings( string $html ): array {
        $issues   = [];
        $headings = [];

        for ( $level = 1; $level <= 6; $level++ ) {
            preg_match_all( "/<h{$level}([^>]*)>([\\s\\S]*?)<\\/h{$level}>/i", $html, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );
            foreach ( $matches as $m ) {
                $text = strip_tags( $m[2][0] );
                $text = preg_replace( '/\s+/', ' ', $text );
                $text = trim( $text );
                $headings[] = [
                    'level' => $level,
                    'text'  => $text,
                    'pos'   => $m[0][1],
                ];
            }
        }

        usort( $headings, fn( $a, $b ) => $a['pos'] <=> $b['pos'] );

        $h1_count = count( array_filter( $headings, fn( $h ) => $h['level'] === 1 ) );

        if ( $h1_count === 0 ) {
            $issues[] = [
                'type'    => 'missing-h1',
                'heading' => '',
                'message' => __( 'Page has no <h1>. Every page should have exactly one top-level heading.', 'ai-accessibility-plugin' ),
            ];
        } elseif ( $h1_count > 1 ) {
            $issues[] = [
                'type'    => 'multiple-h1',
                'heading' => '',
                'message' => sprintf(
                    /* translators: %d: number of h1 elements */
                    __( 'Page has %d <h1> elements; there should be only one.', 'ai-accessibility-plugin' ),
                    $h1_count
                ),
            ];
        }

        foreach ( $headings as $h ) {
            if ( $h['text'] === '' ) {
                $issues[] = [
                    'type'    => 'empty-heading',
                    'heading' => "<h{$h['level']}>",
                    'message' => sprintf(
                        /* translators: %d: heading level */
                        __( 'Empty <h%d> found. Headings must have descriptive text.', 'ai-accessibility-plugin' ),
                        $h['level']
                    ),
                ];
            }
        }

        for ( $i = 1; $i < count( $headings ); $i++ ) {
            $prev = $headings[ $i - 1 ]['level'];
            $curr = $headings[ $i ]['level'];
            if ( $curr > $prev + 1 ) {
                $issues[] = [
                    'type'    => 'skipped-heading-level',
                    'heading' => "<h{$curr}>{$headings[$i]['text']}</h{$curr}>",
                    'message' => sprintf(
                        /* translators: 1: previous level, 2: current level */
                        __( 'Heading level skipped from h%1$d to h%2$d.', 'ai-accessibility-plugin' ),
                        $prev,
                        $curr
                    ),
                ];
            }
        }

        return [
            'issues'   => $issues,
            'headings' => array_map( fn( $h ) => [ 'level' => $h['level'], 'text' => $h['text'] ], $headings ),
            'passed'   => empty( $issues ),
        ];
    }

    /**
     * Check keyboard accessibility.
     *
     * @param string $html
     * @return array{ issues: array, passed: bool }
     */
    private function check_keyboard( string $html ): array {
        $issues = [];

        // Positive tabindex
        preg_match_all( '/tabindex="([1-9]\d*)"/i', $html, $matches, PREG_SET_ORDER );
        foreach ( $matches as $m ) {
            $issues[] = [
                'type'    => 'positive-tabindex',
                'element' => $m[0],
                'message' => sprintf(
                    /* translators: %s: tabindex value */
                    __( 'tabindex="%s" disrupts the natural tab order. Use 0 or -1.', 'ai-accessibility-plugin' ),
                    esc_html( $m[1] )
                ),
            ];
        }

        // onclick on non-interactive elements without role/tabindex
        preg_match_all(
            '/<(div|span|p|li|td|th|section|article|header|footer)([^>]*onclick=[^>]*)>/i',
            $html,
            $matches,
            PREG_SET_ORDER
        );
        foreach ( $matches as $m ) {
            $tag   = $m[1];
            $attrs = $m[2];
            if ( ! preg_match( '/role="(?:button|link|checkbox|radio|tab|menuitem)"/i', $attrs )
                || ! preg_match( '/tabindex=/', $attrs ) ) {
                $issues[] = [
                    'type'    => 'click-without-keyboard',
                    'element' => $m[0],
                    'message' => sprintf(
                        /* translators: %s: tag name */
                        __( '<%s> has onclick but is not keyboard-accessible. Add role="button" and tabindex="0".', 'ai-accessibility-plugin' ),
                        esc_html( $tag )
                    ),
                ];
            }
        }

        // Skip-navigation link check
        $has_skip_link = (bool) preg_match( '/<a[^>]*href="#(?:main|content|maincontent|skip)[^"]*"[^>]*>/i', $html );
        $has_nav       = (bool) preg_match( '/<nav[\s>]/i', $html );
        if ( $has_nav && ! $has_skip_link ) {
            $issues[] = [
                'type'    => 'missing-skip-link',
                'element' => '',
                'message' => __( 'Page has a <nav> block but no skip-navigation link.', 'ai-accessibility-plugin' ),
            ];
        }

        return [ 'issues' => $issues, 'passed' => empty( $issues ) ];
    }

    /**
     * Collect AI-powered suggestions for issues found by static analysis.
     *
     * @param string $html    Original HTML.
     * @param array  $results Static analysis results.
     * @return array{ suggestions: array }
     */
    private function get_ai_suggestions( string $html, array $results ): array {
        $suggestions = [];

        // Generate alt text for images missing it (cap at 5 API calls).
        $missing = array_filter(
            $results['alt_text']['images'] ?? [],
            fn( $img ) => $img['status'] === 'missing-alt' && ! empty( $img['src'] )
        );
        $missing = array_slice( array_values( $missing ), 0, 5 );

        foreach ( $missing as $img ) {
            $result = $this->ai_client->generate_alt_text( $img['src'] );
            if ( ! empty( $result['alt_text'] ) ) {
                $suggestions[] = [
                    'type'       => 'ai-alt-text',
                    'element'    => sprintf( '<img src="%s">', esc_attr( $img['src'] ) ),
                    'suggestion' => sprintf(
                        /* translators: %s: suggested alt text */
                        __( 'Suggested alt text: "%s"', 'ai-accessibility-plugin' ),
                        esc_html( $result['alt_text'] )
                    ),
                    'source'     => $result['source'],
                ];
            }
        }

        return [ 'suggestions' => $suggestions ];
    }

    /**
     * Parse an HTML attribute string into a key-value map.
     *
     * @param string $attr_string Raw attribute string from a tag match.
     * @return array<string, string|bool>
     */
    private function parse_attributes( string $attr_string ): array {
        $attrs = [];
        preg_match_all(
            '/(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+)))?/i',
            $attr_string,
            $matches,
            PREG_SET_ORDER
        );
        foreach ( $matches as $m ) {
            $name  = strtolower( $m[1] );
            $value = isset( $m[2] ) && $m[2] !== '' ? $m[2]
                   : ( isset( $m[3] ) && $m[3] !== '' ? $m[3]
                   : ( isset( $m[4] ) && $m[4] !== '' ? $m[4]
                   : true ) );
            $attrs[ $name ] = $value;
        }
        return $attrs;
    }
}
