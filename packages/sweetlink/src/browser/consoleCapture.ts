/**
 * Console Capture Utility
 *
 * Shared console capturing logic used by both GlobalDevBar and SweetlinkBridge.
 * Provides consistent console interception and log formatting.
 */

import type { ConsoleLog } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of console logs to retain */
export const MAX_CONSOLE_LOGS = 100;

// ============================================================================
// Types
// ============================================================================

/**
 * Original console methods stored for restoration
 */
export interface OriginalConsoleMethods {
  log: typeof console.log;
  error: typeof console.error;
  warn: typeof console.warn;
  info: typeof console.info;
}

/**
 * Console capture state
 */
export interface ConsoleCaptureState {
  logs: ConsoleLog[];
  errorCount: number;
  warningCount: number;
  originalConsole: OriginalConsoleMethods | null;
  isPatched: boolean;
}

/**
 * Configuration for console capture
 */
export interface ConsoleCaptureConfig {
  maxLogs?: number;
  trackCounts?: boolean;
  onLog?: (log: ConsoleLog) => void;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a single argument for logging
 */
export function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
  }
  if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
    return String(arg);
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, (key, val) => {
        if (val instanceof Error) {
          return `${val.name}: ${val.message}`;
        }
        return val;
      });
    } catch {
      return '[object]';
    }
  }
  return String(arg);
}

/**
 * Format multiple arguments into a single message string
 */
export function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

// ============================================================================
// Console Capture Class
// ============================================================================

/**
 * ConsoleCapture - Captures console output and stores logs
 */
export class ConsoleCapture {
  private logs: ConsoleLog[] = [];
  private errorCount = 0;
  private warningCount = 0;
  private originalConsole: OriginalConsoleMethods | null = null;
  private isPatched = false;
  private maxLogs: number;
  private trackCounts: boolean;
  private onLog?: (log: ConsoleLog) => void;

  constructor(config: ConsoleCaptureConfig = {}) {
    this.maxLogs = config.maxLogs ?? MAX_CONSOLE_LOGS;
    this.trackCounts = config.trackCounts ?? true;
    this.onLog = config.onLog;
  }

  /**
   * Start capturing console output
   */
  start(): void {
    if (typeof window === 'undefined') return;
    if (this.isPatched) return;

    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };

    const captureLog = (level: string, args: unknown[]) => {
      const log: ConsoleLog = {
        level,
        message: formatArgs(args),
        timestamp: Date.now()
      };

      this.logs.push(log);
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      if (this.trackCounts) {
        if (level === 'error') this.errorCount++;
        if (level === 'warn') this.warningCount++;
      }

      if (this.onLog) {
        this.onLog(log);
      }
    };

    console.log = (...args) => {
      captureLog('log', args);
      this.originalConsole!.log(...args);
    };

    console.error = (...args) => {
      captureLog('error', args);
      this.originalConsole!.error(...args);
    };

    console.warn = (...args) => {
      captureLog('warn', args);
      this.originalConsole!.warn(...args);
    };

    console.info = (...args) => {
      captureLog('info', args);
      this.originalConsole!.info(...args);
    };

    this.isPatched = true;
  }

  /**
   * Stop capturing and restore original console methods
   */
  stop(): void {
    if (!this.isPatched || !this.originalConsole) return;

    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    this.isPatched = false;
  }

  /**
   * Get all captured logs
   */
  getLogs(): ConsoleLog[] {
    return [...this.logs];
  }

  /**
   * Get filtered logs
   */
  getFilteredLogs(filter: string): ConsoleLog[] {
    const filterLower = filter.toLowerCase();
    return this.logs.filter(log =>
      log.level === filterLower ||
      log.message.toLowerCase().includes(filterLower)
    );
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Get warning count
   */
  getWarningCount(): number {
    return this.warningCount;
  }

  /**
   * Get current state
   */
  getState(): ConsoleCaptureState {
    return {
      logs: this.getLogs(),
      errorCount: this.errorCount,
      warningCount: this.warningCount,
      originalConsole: this.originalConsole,
      isPatched: this.isPatched
    };
  }

  /**
   * Import logs from another source (e.g., early capture)
   */
  importLogs(logs: ConsoleLog[]): void {
    this.logs = [...logs, ...this.logs].slice(-this.maxLogs);
  }

  /**
   * Clear all logs and reset counts
   */
  clear(): void {
    this.logs = [];
    this.errorCount = 0;
    this.warningCount = 0;
  }
}

// ============================================================================
// Error Handler Utilities
// ============================================================================

/**
 * Create error event handler that captures to console logs
 */
export function createErrorHandler(
  logsRef: { logs: ConsoleLog[] },
  maxLogs: number = MAX_CONSOLE_LOGS
): (event: ErrorEvent) => void {
  return (event: ErrorEvent) => {
    logsRef.logs.push({
      level: 'error',
      message: `Uncaught: ${event.message}`,
      timestamp: Date.now(),
      source: event.filename,
      stack: event.error?.stack
    });

    if (logsRef.logs.length > maxLogs) {
      logsRef.logs = logsRef.logs.slice(-maxLogs);
    }
  };
}

/**
 * Create unhandled rejection handler that captures to console logs
 */
export function createRejectionHandler(
  logsRef: { logs: ConsoleLog[] },
  maxLogs: number = MAX_CONSOLE_LOGS
): (event: PromiseRejectionEvent) => void {
  return (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? `Unhandled rejection: ${reason.name}: ${reason.message}`
      : `Unhandled rejection: ${String(reason)}`;

    logsRef.logs.push({
      level: 'error',
      message,
      timestamp: Date.now(),
      stack: reason?.stack
    });

    if (logsRef.logs.length > maxLogs) {
      logsRef.logs = logsRef.logs.slice(-maxLogs);
    }
  };
}
