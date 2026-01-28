/**
 * Sweetlink WebSocket Server
 *
 * Re-exports from server/ module for backwards compatibility.
 */

// Re-export everything from the server module
export {
  initSweetlink,
  closeSweetlink,
  getSweetlinkPort,
  getAssociatedAppPort,
  type InitSweetlinkOptions,
} from './server/index.js';

// Re-export types for backwards compatibility
export type {
  SweetlinkCommand,
  SweetlinkResponse,
  ConsoleLog,
  HmrScreenshotData,
} from './types.js';
