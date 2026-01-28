/**
 * Exec Command Handlers
 *
 * Handles JavaScript execution commands.
 */

import type { SweetlinkCommand, SweetlinkResponse } from '../../types.js';

/**
 * Handle exec-js command
 */
export function handleExecJS(command: SweetlinkCommand): SweetlinkResponse {
  try {
    if (!command.code) {
      return {
        success: false,
        error: 'Code is required',
        timestamp: Date.now()
      };
    }

    // Execute the code using indirect eval (same security model as original)
    // Note: This is intentional - exec-js is a debugging feature for dev tools
    const indirectEval = eval;
    const result = indirectEval(command.code);

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
