/**
 * DevBar Type Definitions
 *
 * Re-exports shared types from @ytspar/sweetlink and defines DevBar-specific types.
 *
 * NOTE: We import from the types sub-path to avoid pulling in Node.js-only modules.
 */

// Re-export shared types from sweetlink's types module
export type {
  ConsoleLog,
  SweetlinkCommand,
  OutlineNode,
  PageSchema,
} from '@ytspar/sweetlink/types';

// ============================================================================
// DevBar Configuration Types
// ============================================================================

/**
 * Options for configuring the GlobalDevBar
 */
export interface GlobalDevBarOptions {
  /** Position of the devbar. Default: 'bottom-left' */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'bottom-center';
  /** Primary accent color (CSS color). Default: '#10b981' (emerald) */
  accentColor?: string;
  /** Which metrics to show. Default: all enabled */
  showMetrics?: {
    breakpoint?: boolean;
    fcp?: boolean;
    lcp?: boolean;
    pageSize?: boolean;
  };
  /** Whether to show the screenshot button. Default: true */
  showScreenshot?: boolean;
  /** Whether to show console error/warning badges. Default: true */
  showConsoleBadges?: boolean;
  /** Whether to show tooltips on hover. Default: true */
  showTooltips?: boolean;
  /** Size overrides for special layouts (e.g., when other dev bars are present) */
  sizeOverrides?: {
    /** Custom width (CSS value). Default: calc(100vw - 140px) for centered, fit-content otherwise */
    width?: string;
    /** Custom max-width (CSS value). Default: 600px for centered, calc(100vw - 32px) otherwise */
    maxWidth?: string;
    /** Custom min-width (CSS value). Optional */
    minWidth?: string;
  };
}

/**
 * Custom control that can be registered by host applications
 */
export interface DevBarControl {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'warning';
}
