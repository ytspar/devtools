/**
 * Logs Command Handlers
 *
 * Handles console log retrieval commands.
 */

import type { ConsoleLog, SweetlinkCommand, SweetlinkResponse } from '../../types.js';

/**
 * Handle get-logs command
 */
export function handleGetLogs(
  command: SweetlinkCommand,
  consoleLogs: ConsoleLog[]
): SweetlinkResponse {
  let logs = [...consoleLogs];

  if (command.filter) {
    const filterLower = command.filter.toLowerCase();
    logs = logs.filter(log =>
      log.level === filterLower ||
      log.message.toLowerCase().includes(filterLower)
    );
  }

  return {
    success: true,
    data: {
      logs,
      totalCount: consoleLogs.length,
      filteredCount: logs.length
    },
    timestamp: Date.now()
  };
}
