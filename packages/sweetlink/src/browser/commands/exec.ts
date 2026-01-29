/**
 * Exec Command Handlers
 *
 * Handles JavaScript execution commands.
 *
 * SECURITY WARNING: This module executes arbitrary JavaScript for debugging.
 * It is restricted to localhost connections and development environments only.
 */

import type { SweetlinkCommand, SweetlinkResponse } from '../../types.js';

const MAX_CODE_LENGTH = 10000;

function errorResponse(error: string): SweetlinkResponse {
  return { success: false, error, timestamp: Date.now() };
}

/**
 * Handle exec-js command with security guards
 */
export function handleExecJS(command: SweetlinkCommand): SweetlinkResponse {
  // Security: Block in production environments
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return errorResponse('exec-js is disabled in production for security reasons');
  }

  if (!command.code) {
    return errorResponse('Code is required');
  }

  if (typeof command.code !== 'string') {
    return errorResponse('Code must be a string');
  }

  if (command.code.length > MAX_CODE_LENGTH) {
    return errorResponse(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
  }

  try {
    // Execute the code - intentional for dev tools debugging
    // eslint-disable-next-line no-eval
    const result = (0, eval)(command.code);

    return {
      success: true,
      data: {
        result: typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : result,
        type: typeof result,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Execution failed');
  }
}
