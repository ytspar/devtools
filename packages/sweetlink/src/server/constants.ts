/**
 * Server Constants
 *
 * Shared constants for the Sweetlink WebSocket server.
 */

/** Package info for HTTP responses */
export const PACKAGE_INFO = {
  name: '@ytspar/sweetlink',
  version: '1.0.0',
  description: 'Autonomous development toolkit for AI agents - screenshots, DOM queries, console logs, and JavaScript execution via WebSocket and Chrome DevTools Protocol',
  documentation: 'https://github.com/ytspar/devtools/tree/main/packages/sweetlink',
  protocol: 'WebSocket',
  note: 'This is a WebSocket server. Connect using a WebSocket client (ws://localhost:<port>) instead of HTTP.',
};

/** Timeouts */
export const SCREENSHOT_REQUEST_TIMEOUT_MS = 10000;
