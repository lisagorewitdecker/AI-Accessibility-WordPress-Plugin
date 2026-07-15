<?php
/**
 * OpenAI API client for the AI Accessibility Plugin.
 *
 * Wraps the OpenAI Chat Completions endpoint to generate alt text and
 * accessibility suggestions. All methods return a result array rather than
 * throwing, so callers always receive usable output.
 *
 * @package AI_Accessibility_Plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class AIACC_AI_Client
 */
class AIACC_AI_Client {

    private const API_URL       = 'https://api.openai.com/v1/chat/completions';
    private const DEFAULT_MODEL = 'gpt-4o-mini';
    private const TIMEOUT       = 30;

    /** @var string OpenAI API key. */
    private string $api_key;

    /** @var string Model identifier. */
    private string $model;

    /**
     * Constructor.
     *
     * @param string|null $api_key API key (falls back to the saved option).
     * @param string|null $model   Model identifier.
     */
    public function __construct( ?string $api_key = null, ?string $model = null ) {
        $this->api_key = $api_key ?? (string) get_option( 'aiacc_openai_api_key', '' );
        $this->model   = $model   ?? (string) get_option( 'aiacc_model', self::DEFAULT_MODEL );
    }

    /**
     * Whether the client has a usable API key.
     */
    public function is_configured(): bool {
        return $this->api_key !== '';
    }

    /**
     * Generate descriptive alt text for an image URL.
     *
     * @param string $image_url Publicly accessible image URL.
     * @return array{ alt_text: string, source: string, error?: string }
     */
    public function generate_alt_text( string $image_url ): array {
        if ( ! $this->is_configured() ) {
            return [ 'alt_text' => '', 'source' => 'fallback' ];
        }

        $messages = [
            [
                'role'    => 'system',
                'content' => 'You are an accessibility expert. Write concise, descriptive alt text for images. '
                            . 'Do not start with "Image of" or "Picture of". '
                            . 'Keep it under 125 characters. Return only the alt text, no explanation.',
            ],
            [
                'role'    => 'user',
                'content' => 'Write alt text for this image: ' . $image_url,
            ],
        ];

        $result = $this->chat_completion( $messages );
        if ( isset( $result['error'] ) ) {
            return [ 'alt_text' => '', 'source' => 'fallback', 'error' => $result['error'] ];
        }

        return [ 'alt_text' => $result['content'], 'source' => 'ai' ];
    }

    /**
     * Analyse content for plain-language accessibility improvements.
     *
     * @param string $text Text content to review.
     * @return array{ suggestions: string[], source: string, error?: string }
     */
    public function analyze_content_accessibility( string $text ): array {
        if ( ! $this->is_configured() ) {
            return [ 'suggestions' => [], 'source' => 'fallback' ];
        }

        $messages = [
            [
                'role'    => 'system',
                'content' => 'You are a plain-language and accessibility expert (WCAG 2.1 level AA). '
                            . 'Review the following text and list up to 5 specific improvements to make it more accessible. '
                            . 'Focus on: plain language, sentence complexity, jargon, and cognitive load. '
                            . 'Return a JSON array of suggestion strings, nothing else.',
            ],
            [
                'role'    => 'user',
                'content' => substr( $text, 0, 2000 ),
            ],
        ];

        $result = $this->chat_completion( $messages );
        if ( isset( $result['error'] ) ) {
            return [ 'suggestions' => [], 'source' => 'fallback', 'error' => $result['error'] ];
        }

        $suggestions = json_decode( $result['content'], true );
        if ( ! is_array( $suggestions ) ) {
            $suggestions = [ $result['content'] ];
        }

        return [ 'suggestions' => $suggestions, 'source' => 'ai' ];
    }

    /**
     * Send a chat completion request to OpenAI.
     *
     * @param array $messages Array of { role, content } message objects.
     * @return array{ content?: string, error?: string }
     */
    private function chat_completion( array $messages ): array {
        $body = wp_json_encode( [
            'model'       => $this->model,
            'messages'    => $messages,
            'max_tokens'  => 256,
            'temperature' => 0.3,
        ] );

        $response = wp_remote_post(
            self::API_URL,
            [
                'headers' => [
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $this->api_key,
                ],
                'body'    => $body,
                'timeout' => self::TIMEOUT,
            ]
        );

        if ( is_wp_error( $response ) ) {
            return [ 'error' => $response->get_error_message() ];
        }

        $code = wp_remote_retrieve_response_code( $response );
        $data = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 200 || ! isset( $data['choices'][0]['message']['content'] ) ) {
            $msg = $data['error']['message'] ?? "HTTP {$code}";
            return [ 'error' => "OpenAI API error: {$msg}" ];
        }

        return [ 'content' => trim( $data['choices'][0]['message']['content'] ) ];
    }
}
