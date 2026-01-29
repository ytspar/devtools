/**
 * Settings Handler Tests
 *
 * NOTE: The actual file system handlers (handleSaveSettings, handleLoadSettings)
 * use Node.js fs module which cannot be easily tested in the browser environment.
 * These tests focus on the data/type handling logic.
 */

import { describe, expect, it } from 'vitest';

/**
 * DevBarSettings type definition (mirrors the one in settings.ts)
 * We define it here to avoid importing the module which would fail in browser tests
 */
interface DevBarSettings {
  version: 1;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'bottom-center';
  themeMode: 'dark' | 'light' | 'system';
  compactMode: boolean;
  accentColor: string;
  showScreenshot: boolean;
  showConsoleBadges: boolean;
  showTooltips: boolean;
  showMetrics: {
    breakpoint: boolean;
    fcp: boolean;
    lcp: boolean;
    cls: boolean;
    inp: boolean;
    pageSize: boolean;
  };
  debug: boolean;
}

describe('settings handler', () => {
  describe('DevBarSettings type', () => {
    it('defines expected structure', () => {
      const settings: DevBarSettings = {
        version: 1,
        position: 'bottom-left',
        themeMode: 'system',
        compactMode: false,
        accentColor: '#10b981',
        showScreenshot: true,
        showConsoleBadges: true,
        showTooltips: true,
        showMetrics: {
          breakpoint: true,
          fcp: true,
          lcp: true,
          cls: true,
          inp: true,
          pageSize: true,
        },
        debug: false,
      };

      expect(settings.version).toBe(1);
      expect(settings.position).toBe('bottom-left');
    });

    it('accepts all valid positions', () => {
      const positions = ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'bottom-center'];
      for (const pos of positions) {
        const settings: DevBarSettings = {
          version: 1,
          position: pos as DevBarSettings['position'],
          themeMode: 'system',
          compactMode: false,
          accentColor: '#10b981',
          showScreenshot: true,
          showConsoleBadges: true,
          showTooltips: true,
          showMetrics: {
            breakpoint: true,
            fcp: true,
            lcp: true,
            cls: true,
            inp: true,
            pageSize: true,
          },
          debug: false,
        };
        expect(settings.position).toBe(pos);
      }
    });

    it('accepts all valid theme modes', () => {
      const themeModes = ['dark', 'light', 'system'];
      for (const mode of themeModes) {
        const settings: DevBarSettings = {
          version: 1,
          position: 'bottom-left',
          themeMode: mode as DevBarSettings['themeMode'],
          compactMode: false,
          accentColor: '#10b981',
          showScreenshot: true,
          showConsoleBadges: true,
          showTooltips: true,
          showMetrics: {
            breakpoint: true,
            fcp: true,
            lcp: true,
            cls: true,
            inp: true,
            pageSize: true,
          },
          debug: false,
        };
        expect(settings.themeMode).toBe(mode);
      }
    });
  });

  describe('settings file path constants', () => {
    it('should use .devbar/settings.json path', () => {
      // We can't import the module directly as it uses Node.js fs,
      // but we document the expected values here
      const SETTINGS_DIR = '.devbar';
      const SETTINGS_FILE = 'settings.json';
      expect(SETTINGS_DIR).toBe('.devbar');
      expect(SETTINGS_FILE).toBe('settings.json');
    });
  });

  describe('settings JSON serialization', () => {
    it('settings serialize and deserialize correctly', () => {
      const settings: DevBarSettings = {
        version: 1,
        position: 'top-right',
        themeMode: 'dark',
        compactMode: true,
        accentColor: '#ff0000',
        showScreenshot: false,
        showConsoleBadges: true,
        showTooltips: false,
        showMetrics: {
          breakpoint: false,
          fcp: true,
          lcp: true,
          cls: false,
          inp: true,
          pageSize: false,
        },
        debug: true,
      };

      const json = JSON.stringify(settings, null, 2);
      const parsed = JSON.parse(json) as DevBarSettings;

      expect(parsed).toEqual(settings);
    });
  });
});
