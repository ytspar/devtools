import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugLogger, normalizeDebugConfig } from './debug.js';

describe('normalizeDebugConfig', () => {
  it('returns disabled config for undefined', () => {
    const result = normalizeDebugConfig(undefined);
    expect(result.enabled).toBe(false);
  });

  it('returns disabled config for false', () => {
    const result = normalizeDebugConfig(false);
    expect(result.enabled).toBe(false);
  });

  it('returns all enabled for true', () => {
    const result = normalizeDebugConfig(true);
    expect(result.enabled).toBe(true);
    expect(result.logLifecycle).toBe(true);
    expect(result.logStateChanges).toBe(true);
    expect(result.logWebSocket).toBe(true);
    expect(result.logPerformance).toBe(true);
  });

  it('uses provided config values', () => {
    const result = normalizeDebugConfig({
      enabled: true,
      logLifecycle: false,
      logStateChanges: true,
      logWebSocket: false,
      logPerformance: true,
    });
    expect(result.enabled).toBe(true);
    expect(result.logLifecycle).toBe(false);
    expect(result.logStateChanges).toBe(true);
    expect(result.logWebSocket).toBe(false);
    expect(result.logPerformance).toBe(true);
  });

  it('defaults missing config options to true when enabled', () => {
    const result = normalizeDebugConfig({
      enabled: true,
    });
    expect(result.logLifecycle).toBe(true);
    expect(result.logStateChanges).toBe(true);
    expect(result.logWebSocket).toBe(true);
    expect(result.logPerformance).toBe(true);
  });
});

describe('DebugLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('does not log when disabled', () => {
    const logger = new DebugLogger({ enabled: false });
    logger.lifecycle('test');
    logger.state('test');
    logger.ws('test');
    logger.perf('test');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs lifecycle when enabled', () => {
    const logger = new DebugLogger({
      enabled: true,
      logLifecycle: true,
      logStateChanges: false,
      logWebSocket: false,
      logPerformance: false,
    });
    logger.lifecycle('init started');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    // Message is in the format string (first arg)
    expect(consoleSpy.mock.calls[0][0]).toContain('init started');
    expect(consoleSpy.mock.calls[0][0]).toContain('[lifecycle]');
  });

  it('logs state changes when enabled', () => {
    const logger = new DebugLogger({
      enabled: true,
      logLifecycle: false,
      logStateChanges: true,
      logWebSocket: false,
      logPerformance: false,
    });
    logger.state('collapsed', { value: true });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('collapsed');
    expect(consoleSpy.mock.calls[0][0]).toContain('[state]');
  });

  it('logs WebSocket events when enabled', () => {
    const logger = new DebugLogger({
      enabled: true,
      logLifecycle: false,
      logStateChanges: false,
      logWebSocket: true,
      logPerformance: false,
    });
    logger.ws('connected');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('connected');
    expect(consoleSpy.mock.calls[0][0]).toContain('[ws]');
  });

  it('logs performance when enabled', () => {
    const logger = new DebugLogger({
      enabled: true,
      logLifecycle: false,
      logStateChanges: false,
      logWebSocket: false,
      logPerformance: true,
    });
    logger.perf('FCP measured', { fcp: 150 });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('FCP measured');
    expect(consoleSpy.mock.calls[0][0]).toContain('[perf]');
  });

  it('respects individual category settings', () => {
    const logger = new DebugLogger({
      enabled: true,
      logLifecycle: true,
      logStateChanges: false,
      logWebSocket: true,
      logPerformance: false,
    });

    logger.lifecycle('test');
    logger.state('test');
    logger.ws('test');
    logger.perf('test');

    // Only lifecycle and ws should have logged
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('can update config with setConfig', () => {
    const logger = new DebugLogger({ enabled: false });
    logger.lifecycle('should not log');
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.setConfig({ enabled: true, logLifecycle: true });
    logger.lifecycle('should log');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
