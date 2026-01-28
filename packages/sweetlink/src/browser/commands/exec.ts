/**
 * Exec Command Handlers
 *
 * Handles JavaScript execution commands.
 *
 * SECURITY WARNING: This module executes arbitrary JavaScript for debugging.
 * It is restricted to localhost connections and development environments only.
 */

import type { SweetlinkCommand, SweetlinkResponse } from '../../types.js';

// Maximum allowed code length to prevent abuse
const MAX_CODE_LENGTH = 10000;

/**
 * Handle exec-js command with security guards
 */
export function handleExecJS(command: SweetlinkCommand): SweetlinkResponse {
  try {
    // Security: Block in production environments
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return {
        success: false,
        error: 'exec-js is disabled in production for security reasons',
        timestamp: Date.now()
      };
    }

    if (!command.code) {
      return {
        success: false,
        error: 'Code is required',
        timestamp: Date.now()
      };
    }

    // Security: Validate code is a string and within length limits
    if (typeof command.code !== 'string') {
      return {
        success: false,
        error: 'Code must be a string',
        timestamp: Date.now()
      };
    }

    if (command.code.length > MAX_CODE_LENGTH) {
      return {
        success: false,
        error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`,
        timestamp: Date.now()
      };
    }

    // Execute the code - intentional for dev tools debugging
    // eslint-disable-next-line no-eval
    const result = (0, eval)(command.code);

    return {
      success: true,
      data: {
        result: typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : result,
        type: typeof result
      },
      timestamp: Date.now()
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
      timestamp: Date.now()
    };
  }
}
