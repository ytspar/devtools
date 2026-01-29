import { describe, expect, it } from 'vitest';
import {
  PRESET_DEBUG,
  PRESET_FULL,
  PRESET_MINIMAL,
  PRESET_PERFORMANCE,
  PRESET_RESPONSIVE,
} from './presets.js';

describe('PRESET_MINIMAL', () => {
  it('has all metrics disabled', () => {
    expect(PRESET_MINIMAL.showMetrics?.breakpoint).toBe(false);
    expect(PRESET_MINIMAL.showMetrics?.fcp).toBe(false);
    expect(PRESET_MINIMAL.showMetrics?.lcp).toBe(false);
    expect(PRESET_MINIMAL.showMetrics?.cls).toBe(false);
    expect(PRESET_MINIMAL.showMetrics?.inp).toBe(false);
    expect(PRESET_MINIMAL.showMetrics?.pageSize).toBe(false);
  });

  it('has screenshot disabled', () => {
    expect(PRESET_MINIMAL.showScreenshot).toBe(false);
  });

  it('has console badges enabled', () => {
    expect(PRESET_MINIMAL.showConsoleBadges).toBe(true);
  });

  it('has tooltips disabled', () => {
    expect(PRESET_MINIMAL.showTooltips).toBe(false);
  });
});

describe('PRESET_FULL', () => {
  it('has all metrics enabled', () => {
    expect(PRESET_FULL.showMetrics?.breakpoint).toBe(true);
    expect(PRESET_FULL.showMetrics?.fcp).toBe(true);
    expect(PRESET_FULL.showMetrics?.lcp).toBe(true);
    expect(PRESET_FULL.showMetrics?.cls).toBe(true);
    expect(PRESET_FULL.showMetrics?.inp).toBe(true);
    expect(PRESET_FULL.showMetrics?.pageSize).toBe(true);
  });

  it('has all features enabled', () => {
    expect(PRESET_FULL.showScreenshot).toBe(true);
    expect(PRESET_FULL.showConsoleBadges).toBe(true);
    expect(PRESET_FULL.showTooltips).toBe(true);
  });
});

describe('PRESET_PERFORMANCE', () => {
  it('has Core Web Vitals enabled', () => {
    expect(PRESET_PERFORMANCE.showMetrics?.fcp).toBe(true);
    expect(PRESET_PERFORMANCE.showMetrics?.lcp).toBe(true);
    expect(PRESET_PERFORMANCE.showMetrics?.cls).toBe(true);
    expect(PRESET_PERFORMANCE.showMetrics?.inp).toBe(true);
    expect(PRESET_PERFORMANCE.showMetrics?.pageSize).toBe(true);
  });

  it('has breakpoint disabled', () => {
    expect(PRESET_PERFORMANCE.showMetrics?.breakpoint).toBe(false);
  });

  it('has non-performance features disabled', () => {
    expect(PRESET_PERFORMANCE.showScreenshot).toBe(false);
    expect(PRESET_PERFORMANCE.showConsoleBadges).toBe(false);
  });
});

describe('PRESET_RESPONSIVE', () => {
  it('has only breakpoint enabled', () => {
    expect(PRESET_RESPONSIVE.showMetrics?.breakpoint).toBe(true);
    expect(PRESET_RESPONSIVE.showMetrics?.fcp).toBe(false);
    expect(PRESET_RESPONSIVE.showMetrics?.lcp).toBe(false);
    expect(PRESET_RESPONSIVE.showMetrics?.cls).toBe(false);
    expect(PRESET_RESPONSIVE.showMetrics?.inp).toBe(false);
    expect(PRESET_RESPONSIVE.showMetrics?.pageSize).toBe(false);
  });

  it('has screenshot enabled', () => {
    expect(PRESET_RESPONSIVE.showScreenshot).toBe(true);
  });
});

describe('PRESET_DEBUG', () => {
  it('has all metrics enabled', () => {
    expect(PRESET_DEBUG.showMetrics?.breakpoint).toBe(true);
    expect(PRESET_DEBUG.showMetrics?.fcp).toBe(true);
    expect(PRESET_DEBUG.showMetrics?.lcp).toBe(true);
    expect(PRESET_DEBUG.showMetrics?.cls).toBe(true);
    expect(PRESET_DEBUG.showMetrics?.inp).toBe(true);
    expect(PRESET_DEBUG.showMetrics?.pageSize).toBe(true);
  });

  it('has debug mode enabled', () => {
    expect(PRESET_DEBUG.debug).toBe(true);
  });

  it('has all features enabled', () => {
    expect(PRESET_DEBUG.showScreenshot).toBe(true);
    expect(PRESET_DEBUG.showConsoleBadges).toBe(true);
    expect(PRESET_DEBUG.showTooltips).toBe(true);
  });
});
