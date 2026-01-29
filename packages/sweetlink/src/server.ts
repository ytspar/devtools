/**
 * Sweetlink WebSocket Server
 *
 * Re-exports from server/ module for backwards compatibility.
 */

// Re-export everything from the server module
export {
  closeSweetlink,
  getAssociatedAppPort,
  getSweetlinkPort,
  type InitSweetlinkOptions,
  initSweetlink,
} from './server/index.js';

// Re-export types for backwards compatibility
export type {
  ConsoleLog,
  HmrScreenshotData,
  SweetlinkCommand,
  SweetlinkResponse,
} from './types.js';
