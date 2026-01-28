/**
 * DevBar Utility Functions
 *
 * Re-exports shared utilities from @ytspar/sweetlink for use by DevBar components.
 * This avoids code duplication between packages.
 *
 * NOTE: We import from specific sub-paths to avoid pulling in Node.js-only modules
 * that would break browser/test environments.
 */

// Re-export console formatting utilities from sweetlink's browser module
export { formatArg, formatArgs } from '@ytspar/sweetlink/browser/consoleCapture';

// Re-export screenshot utilities from sweetlink's browser module
export {
  canvasToDataUrl,
  prepareForCapture,
  delay,
  copyCanvasToClipboard,
} from '@ytspar/sweetlink/browser/screenshotUtils';
