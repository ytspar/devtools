/**
 * SweetlinkBridge - Vanilla JS WebSocket bridge for browser-side Sweetlink integration
 *
 * This module provides framework-agnostic browser integration for Sweetlink,
 * eliminating the React dependency to avoid conflicts with host applications.
 *
 * @version 2.1.0
 */

import html2canvas from 'html2canvas-pro';

import type { ConsoleLog, SweetlinkCommand, SweetlinkResponse, HmrScreenshotData, ServerInfo } from '../types.js';
import {
  formatArgs,
  MAX_CONSOLE_LOGS,
  createErrorHandler,
  createRejectionHandler,
  type OriginalConsoleMethods
} from './consoleCapture.js';
import {
  scaleCanvas,
  canvasToDataUrl,
  DEFAULT_SCREENSHOT_SCALE,
  DEFAULT_SCREENSHOT_QUALITY
} from './screenshotUtils.js';

// ============================================================================
// Constants
// ============================================================================

/** Port offset from app port to calculate WebSocket port */
const SWEETLINK_PORT_OFFSET = 6223;
const DEFAULT_WS_PORT = 9223;
const DEFAULT_MAX_PORT_RETRIES = 10;

/** HMR settings */
const DEFAULT_HMR_DEBOUNCE_MS = 300;
const DEFAULT_HMR_CAPTURE_DELAY_MS = 100;

/** Reconnection settings */
const RECONNECT_DELAY_MS = 2000;
const VERIFICATION_TIMEOUT_MS = 1000;
const PORT_RETRY_DELAY_MS = 100;
const PORT_SEARCH_FAIL_RETRY_MS = 3000;

export interface SweetlinkBridgeConfig {
  basePort?: number;
  maxPortRetries?: number;
  hmrScreenshots?: boolean;
  hmrDebounceMs?: number;
  hmrCaptureDelay?: number;
}

// ============================================================================
// SweetlinkBridge Class
// ============================================================================

export class SweetlinkBridge {
  private ws: WebSocket | null = null;
  private connected = false;
  private serverInfo: ServerInfo | null = null;
  private verified = false;
  private consoleLogs: ConsoleLog[] = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private savedScreenshotTimeout: ReturnType<typeof setTimeout> | null = null;
  private savedReviewTimeout: ReturnType<typeof setTimeout> | null = null;

  // HMR tracking
  private hmrSequence = 0;
  private hmrDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastHmrCaptureTime = 0;

  // Configuration
  private readonly basePort: number;
  private readonly maxPortRetries: number;
  private readonly hmrScreenshots: boolean;
  private readonly hmrDebounceMs: number;
  private readonly hmrCaptureDelay: number;
  private readonly currentAppPort: number;
  private currentPort: number;

  // Cleanup functions
  private cleanupFunctions: (() => void)[] = [];
  private originalConsole: OriginalConsoleMethods;

  constructor(config: SweetlinkBridgeConfig = {}) {
    // Skip on server-side
    if (typeof window === 'undefined') {
      this.basePort = DEFAULT_WS_PORT;
      this.maxPortRetries = DEFAULT_MAX_PORT_RETRIES;
      this.hmrScreenshots = false;
      this.hmrDebounceMs = DEFAULT_HMR_DEBOUNCE_MS;
      this.hmrCaptureDelay = DEFAULT_HMR_CAPTURE_DELAY_MS;
      this.currentAppPort = 0;
      this.currentPort = DEFAULT_WS_PORT;
      this.originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
      return;
    }

    // Calculate app port from URL
    this.currentAppPort = parseInt(window.location.port, 10) ||
      (window.location.protocol === 'https:' ? 443 : 80);

    // Calculate expected WS port (appPort + port offset)
    this.basePort = config.basePort ??
      (this.currentAppPort > 0 ? this.currentAppPort + SWEETLINK_PORT_OFFSET : DEFAULT_WS_PORT);

    this.maxPortRetries = config.maxPortRetries ?? DEFAULT_MAX_PORT_RETRIES;
    this.hmrScreenshots = config.hmrScreenshots ?? false;
    this.hmrDebounceMs = config.hmrDebounceMs ?? DEFAULT_HMR_DEBOUNCE_MS;
    this.hmrCaptureDelay = config.hmrCaptureDelay ?? DEFAULT_HMR_CAPTURE_DELAY_MS;
    this.currentPort = this.basePort;

    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };
  }

  /**
   * Initialize the bridge - call this to start the connection
   */
  init(): void {
    if (typeof window === 'undefined') return;

    this.setupConsoleCapture();
    this.setupErrorHandlers();
    this.connectWebSocket(this.basePort);

    if (this.hmrScreenshots) {
      this.setupHmrDetection();
    }
  }

  /**
   * Clean up and disconnect
   */
  destroy(): void {
    // Clear timeouts
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.savedScreenshotTimeout) clearTimeout(this.savedScreenshotTimeout);
    if (this.savedReviewTimeout) clearTimeout(this.savedReviewTimeout);
    if (this.hmrDebounceTimeout) clearTimeout(this.hmrDebounceTimeout);

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Restore console
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    // Run cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];

    this.connected = false;
    this.verified = false;
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.connected && this.verified;
  }

  /**
   * Get server info
   */
  getServerInfo(): ServerInfo | null {
    return this.serverInfo;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupConsoleCapture(): void {
    const captureLog = (level: string, args: unknown[]) => {
      this.consoleLogs.push({
        level,
        message: formatArgs(args),
        timestamp: Date.now()
      });

      // Keep only last N logs
      if (this.consoleLogs.length > MAX_CONSOLE_LOGS) {
        this.consoleLogs = this.consoleLogs.slice(-MAX_CONSOLE_LOGS);
      }
    };

    console.log = (...args) => {
      captureLog('log', args);
      this.originalConsole.log(...args);
    };

    console.error = (...args) => {
      captureLog('error', args);
      this.originalConsole.error(...args);
    };

    console.warn = (...args) => {
      captureLog('warn', args);
      this.originalConsole.warn(...args);
    };

    console.info = (...args) => {
      captureLog('info', args);
      this.originalConsole.info(...args);
    };
  }

  private setupErrorHandlers(): void {
    const logsRef = { logs: this.consoleLogs };
    const errorHandler = createErrorHandler(logsRef, MAX_CONSOLE_LOGS);
    const rejectionHandler = createRejectionHandler(logsRef, MAX_CONSOLE_LOGS);

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    this.cleanupFunctions.push(() => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    });
  }

  private connectWebSocket(port: number): void {
    const wsUrl = `ws://localhost:${port}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    this.currentPort = port;
    this.verified = false;

    // Timeout for server-info response
    const verificationTimeout = setTimeout(() => {
      if (!this.verified && ws.readyState === WebSocket.OPEN) {
        // Server didn't send server-info (old version) - accept for backwards compatibility
        console.log(`[Sweetlink] Server on port ${port} is old version (no server-info). Accepting for backwards compatibility.`);
        this.verified = true;
        this.connected = true;
      }
    }, VERIFICATION_TIMEOUT_MS);

    ws.onopen = () => {
      console.log(`[Sweetlink] Connected to server on port ${port}`);
      ws.send(JSON.stringify({ type: 'browser-client-ready' }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle screenshot-saved confirmation
        if (message.type === 'screenshot-saved') {
          console.log('[Sweetlink] Screenshot saved:', message.path);
          return;
        }

        // Handle design-review-saved confirmation
        if (message.type === 'design-review-saved') {
          console.log('[Sweetlink] Design review saved:', message.reviewPath);
          return;
        }

        // Handle design-review-error
        if (message.type === 'design-review-error') {
          console.error('[Sweetlink] Design review failed:', message.error);
          return;
        }

        // Handle server-info message for verification
        if (message.type === 'server-info') {
          clearTimeout(verificationTimeout);
          const info = message as ServerInfo;
          console.log('[Sweetlink] Server info received:', info);

          // Check if server matches our app port
          const serverMatchesApp = info.appPort === null || info.appPort === this.currentAppPort;

          if (!serverMatchesApp) {
            console.log(`[Sweetlink] Server is for port ${info.appPort}, but we're on port ${this.currentAppPort}. Trying next port...`);
            ws.close();

            const nextPort = port + 1;
            if (nextPort < this.basePort + this.maxPortRetries) {
              setTimeout(() => this.connectWebSocket(nextPort), PORT_RETRY_DELAY_MS);
            } else {
              console.log(`[Sweetlink] No matching server found for port ${this.currentAppPort}. Will retry...`);
              setTimeout(() => this.connectWebSocket(this.basePort), PORT_SEARCH_FAIL_RETRY_MS);
            }
            return;
          }

          this.verified = true;
          this.serverInfo = info;
          this.connected = true;
          console.log(`[Sweetlink] Verified connection to server for port ${info.appPort ?? 'any'} (project: ${info.projectDir})`);
          return;
        }

        // Handle other commands only if verified
        if (!this.verified) {
          console.warn('[Sweetlink] Ignoring command before verification');
          return;
        }

        const command = message as SweetlinkCommand;
        console.log('[Sweetlink] Received command:', command.type);

        const response = await this.handleCommand(command);
        ws.send(JSON.stringify(response));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Sweetlink] Error handling command:', errorMessage);

        ws.send(JSON.stringify({
          success: false,
          error: errorMessage,
          timestamp: Date.now()
        } as SweetlinkResponse));
      }
    };

    ws.onclose = (event) => {
      clearTimeout(verificationTimeout);
      console.log('[Sweetlink] Disconnected from server');
      this.connected = false;
      this.serverInfo = null;
      this.verified = false;

      // If closed due to origin mismatch (code 4001), try next port immediately
      if (event.code === 4001) {
        const nextPort = port + 1;
        if (nextPort < this.basePort + this.maxPortRetries) {
          console.log(`[Sweetlink] Origin mismatch, trying port ${nextPort}...`);
          setTimeout(() => this.connectWebSocket(nextPort), PORT_RETRY_DELAY_MS);
          return;
        }
      }

      // Try to reconnect
      this.reconnectTimeout = setTimeout(() => {
        console.log('[Sweetlink] Attempting to reconnect...');
        this.connectWebSocket(this.basePort);
      }, RECONNECT_DELAY_MS);
    };

    ws.onerror = (error) => {
      clearTimeout(verificationTimeout);
      console.error('[Sweetlink] WebSocket error:', error);
    };
  }

  private async handleCommand(command: SweetlinkCommand): Promise<SweetlinkResponse> {
    switch (command.type) {
      case 'screenshot':
        return await this.handleScreenshot(command);

      case 'request-screenshot':
        return await this.handleRequestScreenshot(command);

      case 'query-dom':
        return this.handleQueryDOM(command);

      case 'get-logs':
        return this.handleGetLogs(command);

      case 'exec-js':
        return this.handleExecJS(command);

      default:
        return {
          success: false,
          error: `Unknown command: ${command.type}`,
          timestamp: Date.now()
        };
    }
  }

  private async handleScreenshot(command: SweetlinkCommand): Promise<SweetlinkResponse> {
    try {
      const element = command.selector
        ? document.querySelector(command.selector)
        : document.body;

      if (!element) {
        return {
          success: false,
          error: `Element not found: ${command.selector}`,
          timestamp: Date.now()
        };
      }

      const canvas = await html2canvas(element as HTMLElement, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        ...command.options
      });

      const dataUrl = canvas.toDataURL('image/png');

      return {
        success: true,
        data: {
          screenshot: dataUrl,
          width: canvas.width,
          height: canvas.height,
          selector: command.selector || 'body'
        },
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
        timestamp: Date.now()
      };
    }
  }

  private async handleRequestScreenshot(command: SweetlinkCommand): Promise<SweetlinkResponse> {
    try {
      const element = command.selector
        ? document.querySelector(command.selector)
        : document.body;

      if (!element) {
        const errorResponse = {
          type: 'screenshot-response',
          requestId: command.requestId,
          success: false,
          error: `Element not found: ${command.selector}`,
          timestamp: Date.now()
        };
        this.ws?.send(JSON.stringify(errorResponse));
        return errorResponse;
      }

      const scaleFactor = command.scale || DEFAULT_SCREENSHOT_SCALE;
      const format = command.format || 'jpeg';
      const quality = command.quality || DEFAULT_SCREENSHOT_QUALITY;

      const originalCanvas = await html2canvas(element as HTMLElement, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        ...command.options
      });

      // Scale down using shared utility
      const smallCanvas = scaleCanvas(originalCanvas, { scale: scaleFactor });
      const dataUrl = canvasToDataUrl(smallCanvas, { format, quality });

      const responseData: Record<string, unknown> = {
        screenshot: dataUrl,
        width: smallCanvas.width,
        height: smallCanvas.height,
        selector: command.selector || 'body'
      };

      if (command.includeMetadata !== false) {
        responseData.url = window.location.href;
        responseData.timestamp = Date.now();
        responseData.viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };
      }

      const response = {
        type: 'screenshot-response',
        requestId: command.requestId,
        success: true,
        data: responseData,
        timestamp: Date.now()
      };

      this.ws?.send(JSON.stringify(response));

      return {
        success: true,
        data: responseData,
        timestamp: Date.now()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Screenshot failed';
      const errorResponse = {
        type: 'screenshot-response',
        requestId: command.requestId,
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
      this.ws?.send(JSON.stringify(errorResponse));
      return errorResponse;
    }
  }

  private handleQueryDOM(command: SweetlinkCommand): SweetlinkResponse {
    try {
      if (!command.selector) {
        return {
          success: false,
          error: 'Selector is required',
          timestamp: Date.now()
        };
      }

      const elements = document.querySelectorAll(command.selector);

      if (elements.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            count: 0,
            elements: []
          },
          timestamp: Date.now()
        };
      }

      const results = Array.from(elements).map((el, index) => {
        const result: Record<string, unknown> = {
          index,
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          textContent: el.textContent?.slice(0, 200) || null
        };

        if (command.property) {
          const prop = command.property;
          if (prop === 'computedStyle') {
            const style = window.getComputedStyle(el);
            result.computedStyle = {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              position: style.position
            };
          } else if (prop === 'boundingRect') {
            result.boundingRect = el.getBoundingClientRect();
          } else if (prop === 'attributes') {
            result.attributes = Object.fromEntries(
              Array.from(el.attributes).map(attr => [attr.name, attr.value])
            );
          } else {
            result[prop] = (el as unknown as Record<string, unknown>)[prop];
          }
        }

        return result;
      });

      return {
        success: true,
        data: {
          found: true,
          count: elements.length,
          elements: results
        },
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
        timestamp: Date.now()
      };
    }
  }

  private handleGetLogs(command: SweetlinkCommand): SweetlinkResponse {
    let logs = [...this.consoleLogs];

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
        totalCount: this.consoleLogs.length,
        filteredCount: logs.length
      },
      timestamp: Date.now()
    };
  }

  private handleExecJS(command: SweetlinkCommand): SweetlinkResponse {
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

  private setupHmrDetection(): void {
    console.log('[Sweetlink] Setting up HMR detection for automatic screenshots');

    // Vite HMR detection
    const viteAfterUpdate = () => this.captureHmrScreenshot('vite');
    document.addEventListener('vite:afterUpdate', viteAfterUpdate);
    this.cleanupFunctions.push(() => document.removeEventListener('vite:afterUpdate', viteAfterUpdate));

    // Vite custom event
    const viteHmrHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { file?: string } | undefined;
      this.captureHmrScreenshot('vite', detail?.file);
    };
    document.addEventListener('vite:hmr', viteHmrHandler);
    this.cleanupFunctions.push(() => document.removeEventListener('vite:hmr', viteHmrHandler));

    // Remix HMR detection
    const remixHmrHandler = () => this.captureHmrScreenshot('remix');
    window.addEventListener('remix-hmr', remixHmrHandler);
    this.cleanupFunctions.push(() => window.removeEventListener('remix-hmr', remixHmrHandler));
  }

  private async captureHmrScreenshot(
    trigger: string,
    changedFile?: string,
    hmrMetadata?: HmrScreenshotData['hmrMetadata']
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.verified) return;

    // Debounce rapid HMR events
    const now = Date.now();
    if (now - this.lastHmrCaptureTime < this.hmrDebounceMs) {
      if (this.hmrDebounceTimeout) {
        clearTimeout(this.hmrDebounceTimeout);
      }
      this.hmrDebounceTimeout = setTimeout(() => {
        this.captureHmrScreenshot(trigger, changedFile, hmrMetadata);
      }, this.hmrDebounceMs);
      return;
    }

    this.lastHmrCaptureTime = now;

    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, this.hmrCaptureDelay));

    try {
      const originalCanvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Scale down for efficiency using shared utility
      const smallCanvas = scaleCanvas(originalCanvas, { scale: DEFAULT_SCREENSHOT_SCALE });
      const dataUrl = canvasToDataUrl(smallCanvas, { format: 'jpeg', quality: DEFAULT_SCREENSHOT_QUALITY });

      // Prepare logs
      const allLogs = [...this.consoleLogs];
      const errors = allLogs.filter(l => l.level === 'error');
      const warnings = allLogs.filter(l => l.level === 'warn');

      this.hmrSequence++;

      const hmrData: HmrScreenshotData = {
        trigger,
        changedFile,
        screenshot: dataUrl,
        url: window.location.href,
        timestamp: Date.now(),
        sequenceNumber: this.hmrSequence,
        logs: {
          all: allLogs,
          errors,
          warnings,
          sinceLastCapture: allLogs.length
        },
        hmrMetadata
      };

      this.ws.send(JSON.stringify({
        type: 'hmr-screenshot',
        data: hmrData
      }));

      console.log(`[Sweetlink] HMR screenshot captured (${trigger})`);

    } catch (error) {
      console.error('[Sweetlink] HMR screenshot capture failed:', error);
    }
  }
}

// ============================================================================
// Auto-initialization function for script tag usage
// ============================================================================

let globalBridge: SweetlinkBridge | null = null;

/**
 * Initialize Sweetlink Bridge - call from host application
 */
export function initSweetlinkBridge(config?: SweetlinkBridgeConfig): SweetlinkBridge {
  if (globalBridge) {
    return globalBridge;
  }

  globalBridge = new SweetlinkBridge(config);
  globalBridge.init();
  return globalBridge;
}

/**
 * Get the global bridge instance
 */
export function getSweetlinkBridge(): SweetlinkBridge | null {
  return globalBridge;
}

/**
 * Destroy the global bridge instance
 */
export function destroySweetlinkBridge(): void {
  if (globalBridge) {
    globalBridge.destroy();
    globalBridge = null;
  }
}

// Export default for backwards compatibility
export default SweetlinkBridge;
