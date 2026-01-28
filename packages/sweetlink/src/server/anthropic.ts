/**
 * Anthropic Client
 *
 * Lazy-loaded Anthropic client for Claude API access.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Claude API settings */
export const CLAUDE_MODEL = 'claude-opus-4-5-20251101';
export const CLAUDE_MAX_TOKENS = 2048;

/** Claude Opus 4.5 pricing (per million tokens) */
export const CLAUDE_PRICING = {
  input: 15,
  output: 75,
} as const;

// Lazy-loaded Anthropic client
let anthropicClient: Anthropic | null = null;

/**
 * Get the Anthropic client instance (lazy-loaded)
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}
