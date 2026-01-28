/**
 * @sweetlink/dev-toolkit
 *
 * Autonomous development toolkit for Claude AI agents
 */

// Shared types
export type {
  ConsoleLog,
  SweetlinkCommand,
  SweetlinkResponse,
  HmrScreenshotData,
  ServerInfo,
  OutlineNode,
  PageSchema,
  LogSubscription,
  ChannelSubscription
} from './types.js';

// Server infrastructure
export { initSweetlink, closeSweetlink, getSweetlinkPort, getAssociatedAppPort } from './server.js';
export type { InitSweetlinkOptions } from './server.js';

// CDP integration
export {
  detectCDP,
  getCDPBrowser,
  findLocalDevPage,
  screenshotViaCDP,
  queryDOMViaCDP,
  execJSViaCDP,
  getNetworkRequestsViaCDP,
  getConsoleLogsViaCDP,
  getPerformanceMetricsViaCDP,
  testCDPConnection
} from './cdp.js';

// Browser client component (vanilla JS - no React dependency)
export { SweetlinkBridge, type SweetlinkBridgeConfig } from './browser/SweetlinkBridge.js';
// React version available via: '@ytspar/sweetlink/browser/react'

// Browser utilities (for use by devbar and other packages)
export {
  formatArg,
  formatArgs,
  ConsoleCapture,
  createErrorHandler,
  createRejectionHandler,
  MAX_CONSOLE_LOGS,
  type OriginalConsoleMethods,
  type ConsoleCaptureState,
  type ConsoleCaptureConfig
} from './browser/consoleCapture.js';

export {
  scaleCanvas,
  canvasToDataUrl,
  extractBase64FromDataUrl,
  getMediaTypeFromDataUrl,
  prepareForCapture,
  delay,
  copyCanvasToClipboard,
  gatherScreenshotMetadata,
  DEFAULT_SCREENSHOT_SCALE,
  DEFAULT_SCREENSHOT_QUALITY,
  DESIGN_REVIEW_SCALE,
  DEVBAR_SCREENSHOT_QUALITY,
  type ScaleCanvasOptions,
  type ToDataUrlOptions,
  type ScreenshotMetadata
} from './browser/screenshotUtils.js';

// URL utilities
export {
  generateSlugFromUrl,
  formatTimestampForFilename,
  generateBaseFilename,
  truncateMessage,
  SCREENSHOT_DIR,
  HMR_SCREENSHOT_DIR,
  MAX_SLUG_LENGTH,
  MAX_LOG_MESSAGE_LENGTH
} from './urlUtils.js';

// Viewport utilities (shared by CDP and Playwright)
export {
  parseViewport,
  DEFAULT_VIEWPORT,
  VIEWPORT_PRESETS,
  type ViewportConfig
} from './viewportUtils.js';

// Pixel Ruler for visual measurement
export {
  measureViaPlaywright,
  measureElementsScript,
  removeRulerScript,
  getCardHeaderPreset,
  getNavigationPreset
} from './ruler.js';
export type {
  MeasurementOptions,
  MeasurementResult,
  ElementMeasurement,
  RulerOutput
} from './ruler.js';
