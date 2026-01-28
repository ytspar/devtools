// DevBar - Development toolbar and utilities
// Pure vanilla JavaScript - no framework dependencies

// Main vanilla JS devbar
export {
  GlobalDevBar,
  initGlobalDevBar,
  getGlobalDevBar,
  destroyGlobalDevBar,
  earlyConsoleCapture,
  type GlobalDevBarOptions,
} from './GlobalDevBar.js';

// Early console capture script for injection
export { EARLY_CONSOLE_CAPTURE_SCRIPT } from './earlyConsoleCapture.js';
