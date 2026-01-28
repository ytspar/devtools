/**
 * GlobalDevBar - Vanilla JS implementation
 *
 * A development toolbar that displays breakpoint info, performance stats,
 * console error/warning counts, and provides screenshot capabilities via Sweetlink.
 *
 * This is a vanilla JS replacement for the React-based GlobalDevBar component
 * to avoid React dependency conflicts in host applications.
 */

import * as html2canvasModule from 'html2canvas-pro';

// Handle ESM/CJS interop for html2canvas-pro
type Html2CanvasFunc = (element: HTMLElement, options?: {
  logging?: boolean;
  useCORS?: boolean;
  allowTaint?: boolean;
  scale?: number;
  width?: number;
  windowWidth?: number
}) => Promise<HTMLCanvasElement>;
const html2canvas = ((html2canvasModule as unknown as { default: Html2CanvasFunc }).default ?? html2canvasModule) as Html2CanvasFunc;

// ============================================================================
// Inlined Types (from @ytspar/sweetlink/types)
// ============================================================================

/**
 * Structure for captured console log entries
 */
export interface ConsoleLog {
  level: 'log' | 'error' | 'warn' | 'info' | 'debug' | string;
  message: string;
  timestamp: number;
  stack?: string;
  source?: string;
}

/**
 * Commands that can be sent over the Sweetlink WebSocket connection
 */
export interface SweetlinkCommand {
  type:
    | 'screenshot'
    | 'query-dom'
    | 'get-logs'
    | 'exec-js'
    | 'get-network'
    | 'browser-client-ready'
    | 'save-screenshot'
    | 'design-review-screenshot'
    | 'save-outline'
    | 'save-schema'
    | 'refresh'
    | 'request-screenshot'
    | 'screenshot-response'
    | 'log-subscribe'
    | 'log-unsubscribe'
    | 'log-event'
    | 'hmr-screenshot'
    | 'subscribe'
    | 'unsubscribe'
    | 'screenshot-saved'
    | 'design-review-saved'
    | 'design-review-error'
    | 'outline-saved'
    | 'outline-error'
    | 'schema-saved'
    | 'schema-error';
  selector?: string;
  property?: string;
  code?: string;
  filter?: string;
  options?: Record<string, unknown>;
  data?: unknown;
  path?: string;
  screenshotPath?: string;
  reviewPath?: string;
  outlinePath?: string;
  schemaPath?: string;
  error?: string;
  requestId?: string;
  subscriptionId?: string;
  channel?: string;
  captureConsole?: boolean;
  timeout?: number;
  format?: 'jpeg' | 'png';
  quality?: number;
  scale?: number;
  includeMetadata?: boolean;
  filters?: {
    levels?: ('log' | 'error' | 'warn' | 'info' | 'debug')[];
    pattern?: string;
    source?: string;
  };
}

/**
 * Node in the document outline tree
 */
export interface OutlineNode {
  tagName: string;
  level: number;
  text: string;
  id?: string;
  children: OutlineNode[];
  category?: string;
}

/**
 * Extracted page schema information
 */
export interface PageSchema {
  jsonLd: unknown[];
  metaTags: Record<string, string>;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  microdata: unknown[];
}

// ============================================================================
// Inlined Utilities (from @ytspar/sweetlink)
// ============================================================================

/** Maximum number of console logs to retain */
const MAX_CONSOLE_LOGS = 100;

/** Higher quality JPEG for devbar screenshots */
const DEVBAR_SCREENSHOT_QUALITY = 0.8;

/**
 * Format a single argument for logging
 */
function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
  }
  if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
    return String(arg);
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, (_key, val) => {
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
function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

/**
 * Convert a canvas to a data URL
 */
function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  options: { format?: 'jpeg' | 'png'; quality?: number } = {}
): string {
  const { format = 'jpeg', quality = 0.7 } = options;
  if (format === 'png') {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Prepare the page for screenshot capture
 */
function prepareForCapture(): () => void {
  document.body.classList.add('devbar-capturing');
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  return () => {
    document.body.classList.remove('devbar-capturing');
  };
}

/**
 * Wait for a specified delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copy a canvas to the clipboard as a PNG image
 */
async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 'image/png');
  });
}

// ============================================================================
// Constants
// ============================================================================

/** Reconnection settings */
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

/** WebSocket settings */
const WS_PORT = 9223;

/** Notification display durations */
const SCREENSHOT_NOTIFICATION_MS = 3000;
const CLIPBOARD_NOTIFICATION_MS = 2000;
const DESIGN_REVIEW_NOTIFICATION_MS = 5000;

/** Screenshot capture settings */
const SCREENSHOT_BLUR_DELAY_MS = 50;
const SCREENSHOT_SCALE = 0.75;

/** Tailwind breakpoints */
const TAILWIND_BREAKPOINTS = {
  'base': { min: 0, label: 'Tailwind base: <640px' },
  'sm': { min: 640, label: 'Tailwind sm: >=640px' },
  'md': { min: 768, label: 'Tailwind md: >=768px' },
  'lg': { min: 1024, label: 'Tailwind lg: >=1024px' },
  'xl': { min: 1280, label: 'Tailwind xl: >=1280px' },
  '2xl': { min: 1536, label: 'Tailwind 2xl: >=1536px' },
} as const;

/** Button colors for devbar toolbar buttons */
const BUTTON_COLORS = {
  screenshot: '#10b981', // emerald - matches accent color
  review: '#a855f7',     // purple
  outline: '#06b6d4',    // cyan
  schema: '#f59e0b',     // amber
  error: '#ef4444',      // red
  warning: '#f59e0b',    // amber
} as const;

/** Category colors for outline display */
const CATEGORY_COLORS: Record<string, string> = {
  heading: '#10b981',    // emerald
  sectioning: '#3b82f6', // blue
  landmark: '#a855f7',   // purple
  grouping: '#06b6d4',   // cyan
  form: '#f59e0b',       // amber
  table: '#ec4899',      // pink
  list: '#84cc16',       // lime
  other: '#6b7280',      // gray
};

/** Base styles for toolbar action buttons */
const ACTION_BUTTON_BASE_STYLES = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  minWidth: '22px',
  minHeight: '22px',
  flexShrink: '0',
  borderRadius: '50%',
  border: '1px solid',
  transition: 'all 150ms',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an SVG icon element with the given path data
 */
function createSvgIcon(pathData: string, options: {
  viewBox?: string;
  fill?: boolean;
  stroke?: boolean;
}): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', options.viewBox || '0 0 24 24');

  if (options.fill) {
    svg.style.fill = 'currentColor';
  }
  if (options.stroke) {
    svg.style.stroke = 'currentColor';
    svg.style.fill = 'none';
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);

  return svg;
}

/**
 * Get button styling based on active state and color
 */
function getButtonStyles(color: string, isActive: boolean, isDisabled: boolean): Record<string, string> {
  return {
    ...ACTION_BUTTON_BASE_STYLES,
    borderColor: isActive ? color : `${color}80`,
    backgroundColor: isActive ? `${color}33` : 'transparent',
    color: isActive ? color : `${color}99`,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: '1',
  };
}

/**
 * Apply hover effects to a button element
 */
function applyButtonHoverEffects(
  btn: HTMLButtonElement,
  color: string,
  isActive: boolean = false
): void {
  btn.onmouseenter = () => {
    btn.style.backgroundColor = `${color}20`;
  };
  btn.onmouseleave = () => {
    btn.style.backgroundColor = isActive ? `${color}33` : 'transparent';
  };
}

/**
 * Create a styled button with common properties
 */
function createStyledButton(options: {
  color: string;
  text: string;
  padding?: string;
  borderRadius?: string;
  fontSize?: string;
  width?: string;
  height?: string;
}): HTMLButtonElement {
  const {
    color,
    text,
    padding = '6px 12px',
    borderRadius = '6px',
    fontSize = '0.75rem',
    width,
    height,
  } = options;

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: width ? undefined : padding,
    width,
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: `1px solid ${color}60`,
    borderRadius,
    color,
    fontSize,
    cursor: 'pointer',
    transition: 'all 150ms',
  });
  btn.textContent = text;
  applyButtonHoverEffects(btn, color);
  return btn;
}

/** Common modal overlay styles */
const MODAL_OVERLAY_STYLES: Record<string, string> = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: '10002',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Common modal box styles */
const MODAL_BOX_BASE_STYLES: Record<string, string> = {
  backgroundColor: 'rgba(17, 24, 39, 0.98)',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '700px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

/**
 * Configuration for creating a modal
 */
interface ModalConfig {
  color: string;
  title: string;
  onClose: () => void;
  onCopyMd: () => Promise<void>;
  onSave?: () => void;
  sweetlinkConnected: boolean;
}

/**
 * Create modal overlay with click-outside-to-close behavior
 */
function createModalOverlay(onClose: () => void): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-devbar', 'true');
  Object.assign(overlay.style, MODAL_OVERLAY_STYLES);
  overlay.onclick = (e) => {
    if (e.target === overlay) onClose();
  };
  return overlay;
}

/**
 * Create modal box with border and shadow
 */
function createModalBox(color: string): HTMLDivElement {
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    ...MODAL_BOX_BASE_STYLES,
    border: `1px solid ${color}`,
    boxShadow: `0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px ${color}33`,
  });
  return modal;
}

/**
 * Create modal header with title, copy/save/close buttons
 */
function createModalHeader(config: ModalConfig): HTMLDivElement {
  const { color, title, onClose, onCopyMd, onSave, sweetlinkConnected } = config;

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${color}40`,
  });

  const titleEl = document.createElement('h2');
  Object.assign(titleEl.style, {
    color,
    fontSize: '1rem',
    fontWeight: '600',
    margin: '0',
  });
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const headerButtons = document.createElement('div');
  Object.assign(headerButtons.style, { display: 'flex', gap: '10px' });

  // Copy MD button
  const copyBtn = createStyledButton({ color, text: 'Copy MD' });
  copyBtn.onclick = async () => {
    try {
      await onCopyMd();
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy MD'; }, 1500);
    } catch {
      console.error('[GlobalDevBar] Failed to copy to clipboard');
    }
  };
  headerButtons.appendChild(copyBtn);

  // Save button (if Sweetlink connected)
  if (sweetlinkConnected && onSave) {
    const saveBtn = createStyledButton({ color, text: 'Save' });
    saveBtn.onclick = onSave;
    headerButtons.appendChild(saveBtn);
  }

  // Close button - use same padding as other buttons for consistent height
  const closeBtn = createStyledButton({
    color,
    text: '×',
    padding: '6px 10px',
    fontSize: '0.875rem',
  });
  closeBtn.onclick = onClose;
  headerButtons.appendChild(closeBtn);

  header.appendChild(headerButtons);
  return header;
}

/**
 * Create modal content container
 */
function createModalContent(): HTMLDivElement {
  const content = document.createElement('div');
  Object.assign(content.style, {
    flex: '1',
    overflow: 'auto',
    padding: '16px 20px',
  });
  return content;
}

/**
 * Create empty state message for modals
 */
function createEmptyMessage(text: string): HTMLDivElement {
  const emptyMsg = document.createElement('div');
  Object.assign(emptyMsg.style, {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.875rem',
    padding: '40px',
  });
  emptyMsg.textContent = text;
  return emptyMsg;
}

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Early Console Capture (runs immediately on module load)
// ============================================================================

interface EarlyConsoleCapture {
  errorCount: number;
  warningCount: number;
  logs: ConsoleLog[];
  originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  } | null;
  isPatched: boolean;
}

const earlyConsoleCapture: EarlyConsoleCapture = (() => {
  const ssrFallback: EarlyConsoleCapture = {
    errorCount: 0,
    warningCount: 0,
    logs: [],
    originalConsole: null,
    isPatched: false
  };

  // Skip on server-side rendering
  if (typeof window === 'undefined') return ssrFallback;

  const capture: EarlyConsoleCapture = {
    errorCount: 0,
    warningCount: 0,
    logs: [],
    originalConsole: {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    },
    isPatched: false
  };

  const captureLog = (level: string, args: unknown[]) => {
    capture.logs.push({ level, message: formatArgs(args), timestamp: Date.now() });
    if (capture.logs.length > MAX_CONSOLE_LOGS) capture.logs = capture.logs.slice(-MAX_CONSOLE_LOGS);
  };

  // Patch console immediately
  if (!capture.isPatched && capture.originalConsole) {
    console.log = (...args) => { captureLog('log', args); capture.originalConsole!.log(...args); };
    console.error = (...args) => { captureLog('error', args); capture.errorCount++; capture.originalConsole!.error(...args); };
    console.warn = (...args) => { captureLog('warn', args); capture.warningCount++; capture.originalConsole!.warn(...args); };
    console.info = (...args) => { captureLog('info', args); capture.originalConsole!.info(...args); };
    capture.isPatched = true;
  }

  return capture;
})();

// ============================================================================
// CSS Styles
// ============================================================================

const TOOLTIP_STYLES = `
.devbar-tooltip {
  position: relative;
}
.devbar-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) scale(0.95);
  padding: 0.625rem 1rem;
  background: rgba(17, 24, 39, 0.98);
  color: #10b981;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  border-radius: 6px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  min-width: min(200px, calc(100vw - 32px));
  max-width: min(400px, calc(100vw - 32px));
  white-space: pre-wrap;
  z-index: 10001;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  will-change: opacity, transform;
  transition: opacity 50ms ease-out, transform 50ms ease-out, visibility 50ms;
}
.devbar-tooltip:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
}
.devbar-tooltip-left::after {
  left: 8px !important;
  right: auto !important;
  transform: translateX(0) scale(0.95) !important;
}
.devbar-tooltip-left:hover::after {
  transform: translateX(0) scale(1) !important;
}
.devbar-tooltip-right::after {
  left: auto !important;
  right: 8px !important;
  transform: translateX(0) scale(0.95) !important;
}
.devbar-tooltip-right:hover::after {
  transform: translateX(0) scale(1) !important;
}
.devbar-capturing .devbar-tooltip::after,
.devbar-capturing .devbar-tooltip:hover::after {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
.devbar-item {
  transition: opacity 150ms ease-out, color 150ms ease-out;
}
.devbar-item:hover {
  opacity: 1 !important;
  color: #10b981;
}
.devbar-clickable {
  transition: transform 150ms ease-out, background-color 150ms ease-out, box-shadow 150ms ease-out;
}
.devbar-clickable:hover {
  transform: scale(1.1);
  background-color: rgba(16, 185, 129, 0.15);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}
.devbar-badge {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.devbar-badge:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px currentColor;
}
.devbar-collapse {
  transition: transform 150ms ease-out, background-color 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out;
}
.devbar-collapse:hover {
  transform: scale(1.08);
  background-color: rgba(16, 185, 129, 0.15);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  border-color: #10b981;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes devbar-collapse {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
/* Main row - single row by default (SM, MD, LG, XL) */
.devbar-main {
  flex-wrap: nowrap;
}
/* Info section - truncates if needed to fit single row */
.devbar-info {
  white-space: nowrap;
}
.devbar-info > span {
  flex-shrink: 0;
}
/* Actions container - stays on same row by default */
.devbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-basis: auto;
  flex-shrink: 0;
}
/* BASE only (< 640px): wrap action buttons to centered second row */
@media (max-width: 639px) {
  [data-devbar] {
    min-width: fit-content !important;
    max-width: calc(100vw - 32px) !important;
  }
  .devbar-main {
    flex-wrap: wrap;
  }
  .devbar-actions {
    width: 100%;
    justify-content: center;
    margin-top: 0.25rem;
  }
}
`;

// ============================================================================
// Helper Functions
// ============================================================================

function extractDocumentOutline(): OutlineNode[] {
  const semanticElements = new Set([
    'article', 'aside', 'nav', 'section',
    'main', 'body',
    'header', 'footer', 'figure', 'figcaption',
    'details', 'summary', 'dialog', 'address', 'hgroup',
    'form', 'fieldset', 'legend',
    'ul', 'ol', 'dl', 'menu',
    'table', 'thead', 'tbody', 'tfoot', 'caption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);

  const headingElements = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

  const getSemanticCategory = (tag: string): string => {
    if (headingElements.has(tag)) return 'heading';
    if (['article', 'section', 'aside', 'nav'].includes(tag)) return 'sectioning';
    if (['main', 'header', 'footer'].includes(tag)) return 'landmark';
    if (['figure', 'figcaption', 'details', 'summary'].includes(tag)) return 'grouping';
    if (['form', 'fieldset', 'legend'].includes(tag)) return 'form';
    if (['table', 'thead', 'tbody', 'tfoot', 'caption'].includes(tag)) return 'table';
    if (['ul', 'ol', 'dl', 'menu'].includes(tag)) return 'list';
    return 'other';
  };

  const getElementText = (el: Element, tagName: string): string => {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent?.trim().slice(0, 80) || '';
    }

    if (headingElements.has(tagName)) {
      return el.textContent?.trim().slice(0, 100) || '';
    }

    if (tagName === 'figure') {
      const caption = el.querySelector('figcaption');
      if (caption) return caption.textContent?.trim().slice(0, 80) || '';
    }

    if (tagName === 'details') {
      const summary = el.querySelector('summary');
      if (summary) return summary.textContent?.trim().slice(0, 80) || '';
    }

    if (tagName === 'form') {
      const name = el.getAttribute('name') || el.getAttribute('id');
      if (name) return name;
    }

    if (tagName === 'fieldset') {
      const legend = el.querySelector('legend');
      if (legend) return legend.textContent?.trim().slice(0, 80) || '';
    }

    if (tagName === 'table') {
      const caption = el.querySelector('caption');
      if (caption) return caption.textContent?.trim().slice(0, 80) || '';
    }

    if (tagName === 'nav') {
      const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) return heading.textContent?.trim().slice(0, 50) || '';
      const firstLink = el.querySelector('a');
      if (firstLink) return `Navigation (${firstLink.textContent?.trim().slice(0, 30)}...)`;
    }

    if (['section', 'article', 'aside'].includes(tagName)) {
      const heading = el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
      if (heading) return heading.textContent?.trim().slice(0, 80) || '';
      const className = el.className?.toString().split(' ')[0];
      if (className && className.length < 30) return className;
    }

    if (['ul', 'ol'].includes(tagName)) {
      const items = el.querySelectorAll(':scope > li');
      return `${items.length} items`;
    }

    if (tagName === 'dl') {
      const terms = el.querySelectorAll(':scope > dt');
      return `${terms.length} terms`;
    }

    const role = el.getAttribute('role');
    if (role) return `[role="${role}"]`;

    return '';
  };

  const isVisible = (el: Element): boolean => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const extractFromElement = (root: Element): OutlineNode[] => {
    const nodes: OutlineNode[] = [];

    for (const child of Array.from(root.children)) {
      const tagName = child.tagName.toLowerCase();

      if (!isVisible(child)) continue;
      if (child.getAttribute('data-devbar')) continue;

      if (semanticElements.has(tagName)) {
        const text = getElementText(child, tagName);
        const isHeading = headingElements.has(tagName);
        const isLandmark = ['main', 'nav', 'header', 'footer', 'article', 'section', 'aside'].includes(tagName);
        const hasText = text.length > 0;

        if (isHeading || isLandmark || hasText) {
          const level = isHeading ? parseInt(tagName[1], 10) : 0;

          const node: OutlineNode = {
            tagName,
            level,
            text: text || `<${tagName}>`,
            id: child.id || undefined,
            children: [],
            category: getSemanticCategory(tagName)
          };

          if (!isHeading) {
            node.children = extractFromElement(child);
          }

          nodes.push(node);
        } else {
          const childNodes = extractFromElement(child);
          nodes.push(...childNodes);
        }
      } else {
        const childNodes = extractFromElement(child);
        nodes.push(...childNodes);
      }
    }

    return nodes;
  };

  const body = document.body;
  if (!body) return [];

  return extractFromElement(body);
}

function outlineToMarkdown(outline: OutlineNode[], indent = 0): string {
  let md = '';

  if (indent === 0) {
    md += '# Document Outline\n\n';
    md += '**Semantic Categories:**\n';
    md += '- `heading` - h1-h6 elements\n';
    md += '- `sectioning` - article, section, aside, nav\n';
    md += '- `landmark` - main, header, footer\n';
    md += '- `grouping` - figure, details, summary\n';
    md += '- `form` - form, fieldset\n';
    md += '- `table` - table elements\n';
    md += '- `list` - ul, ol, dl\n\n';
    md += '---\n\n';
  }

  for (const node of outline) {
    const prefix = '  '.repeat(indent);
    const tagLabel = `\`<${node.tagName}>\``;
    const anchor = node.id ? ` \`#${node.id}\`` : '';
    const category = node.category ? ` [${node.category}]` : '';

    if (node.category === 'heading' && indent === 0) {
      md += `${'#'.repeat(node.level)} ${tagLabel} ${node.text}${anchor}\n\n`;
    } else {
      md += `${prefix}- ${tagLabel}${category} ${node.text}${anchor}\n`;
    }

    if (node.children.length > 0) {
      md += outlineToMarkdown(node.children, indent + 1);
    }
  }

  return md;
}

function extractPageSchema(): PageSchema {
  const schema: PageSchema = {
    jsonLd: [],
    metaTags: {},
    openGraph: {},
    twitter: {},
    microdata: []
  };

  // Extract JSON-LD
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '');
      schema.jsonLd.push(data);
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  // Extract meta tags
  const metaTags = document.querySelectorAll('meta[name], meta[property]');
  metaTags.forEach((meta) => {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
    const content = meta.getAttribute('content') || '';

    if (name.startsWith('og:')) {
      schema.openGraph[name.replace('og:', '')] = content;
    } else if (name.startsWith('twitter:')) {
      schema.twitter[name.replace('twitter:', '')] = content;
    } else if (name) {
      schema.metaTags[name] = content;
    }
  });

  // Extract microdata
  const microdataItems = document.querySelectorAll('[itemscope]');
  microdataItems.forEach((item) => {
    const itemType = item.getAttribute('itemtype');
    const props: Record<string, string> = {};

    item.querySelectorAll('[itemprop]').forEach((prop) => {
      const propName = prop.getAttribute('itemprop') || '';
      const propValue = prop.getAttribute('content') ||
                       prop.getAttribute('href') ||
                       prop.textContent?.trim().slice(0, 200) || '';
      if (propName) props[propName] = propValue;
    });

    if (itemType || Object.keys(props).length > 0) {
      schema.microdata.push({ type: itemType, properties: props });
    }
  });

  return schema;
}

function schemaToMarkdown(schema: PageSchema): string {
  let md = '';

  if (schema.jsonLd.length > 0) {
    md += '## JSON-LD\n\n';
    schema.jsonLd.forEach((item, i) => {
      md += `### Schema ${i + 1}\n\n`;
      md += '```json\n' + JSON.stringify(item, null, 2) + '\n```\n\n';
    });
  }

  if (Object.keys(schema.openGraph).length > 0) {
    md += '## Open Graph\n\n';
    for (const [key, value] of Object.entries(schema.openGraph)) {
      md += `- **${key}**: ${value}\n`;
    }
    md += '\n';
  }

  if (Object.keys(schema.twitter).length > 0) {
    md += '## Twitter Cards\n\n';
    for (const [key, value] of Object.entries(schema.twitter)) {
      md += `- **${key}**: ${value}\n`;
    }
    md += '\n';
  }

  if (Object.keys(schema.metaTags).length > 0) {
    md += '## Meta Tags\n\n';
    for (const [key, value] of Object.entries(schema.metaTags)) {
      md += `- **${key}**: ${value}\n`;
    }
    md += '\n';
  }

  if (schema.microdata.length > 0) {
    md += '## Microdata\n\n';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema.microdata.forEach((item: any, i) => {
      md += `### Item ${i + 1}${item.type ? ` (${item.type})` : ''}\n\n`;
      for (const [key, value] of Object.entries(item.properties || {})) {
        md += `- **${key}**: ${value}\n`;
      }
      md += '\n';
    });
  }

  if (!md) {
    md = '_No structured data found on this page_\n';
  }

  return md;
}

// ============================================================================
// GlobalDevBar Class
// ============================================================================

export class GlobalDevBar {
  // Static storage for custom controls
  private static customControls: DevBarControl[] = [];

  private options: Required<Omit<GlobalDevBarOptions, 'sizeOverrides'>> & Pick<GlobalDevBarOptions, 'sizeOverrides'>;
  private container: HTMLDivElement | null = null;
  private ws: WebSocket | null = null;
  private consoleLogs: ConsoleLog[] = [];
  private sweetlinkConnected = false;
  private collapsed = false;
  private capturing = false;
  private copiedToClipboard = false;
  private lastScreenshot: string | null = null;
  private designReviewInProgress = false;
  private lastDesignReview: string | null = null;
  private designReviewError: string | null = null;
  private lastOutline: string | null = null;
  private lastSchema: string | null = null;
  private consoleFilter: 'error' | 'warn' | null = null;

  // Modal states
  private showOutlineModal = false;
  private showSchemaModal = false;

  private breakpointInfo: { tailwindBreakpoint: string; dimensions: string } | null = null;
  private perfStats: { fcp: string; lcp: string; totalSize: string } | null = null;
  private lcpValue: number | null = null;

  private reconnectAttempts = 0;

  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private screenshotTimeout: ReturnType<typeof setTimeout> | null = null;
  private designReviewTimeout: ReturnType<typeof setTimeout> | null = null;
  private designReviewErrorTimeout: ReturnType<typeof setTimeout> | null = null;
  private outlineTimeout: ReturnType<typeof setTimeout> | null = null;
  private schemaTimeout: ReturnType<typeof setTimeout> | null = null;

  private resizeHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private fcpObserver: PerformanceObserver | null = null;
  private lcpObserver: PerformanceObserver | null = null;
  private destroyed = false;

  // Overlay element for modals
  private overlayElement: HTMLDivElement | null = null;

  constructor(options: GlobalDevBarOptions = {}) {
    this.options = {
      position: options.position ?? 'bottom-left',
      accentColor: options.accentColor ?? '#10b981',
      showMetrics: {
        breakpoint: options.showMetrics?.breakpoint ?? true,
        fcp: options.showMetrics?.fcp ?? true,
        lcp: options.showMetrics?.lcp ?? true,
        pageSize: options.showMetrics?.pageSize ?? true,
      },
      showScreenshot: options.showScreenshot ?? true,
      showConsoleBadges: options.showConsoleBadges ?? true,
      sizeOverrides: options.sizeOverrides,
    };
  }

  // ============================================================================
  // Static Methods for Custom Controls
  // ============================================================================

  /**
   * Register a custom control to be displayed in the devbar
   */
  static registerControl(control: DevBarControl): void {
    // Remove existing control with same ID
    GlobalDevBar.customControls = GlobalDevBar.customControls.filter(c => c.id !== control.id);
    GlobalDevBar.customControls.push(control);
    // Trigger re-render of all instances
    const instance = getGlobalInstance();
    if (instance) {
      instance.render();
    }
  }

  /**
   * Unregister a custom control by ID
   */
  static unregisterControl(id: string): void {
    GlobalDevBar.customControls = GlobalDevBar.customControls.filter(c => c.id !== id);
    // Trigger re-render of all instances
    const instance = getGlobalInstance();
    if (instance) {
      instance.render();
    }
  }

  /**
   * Get all registered custom controls
   */
  static getControls(): DevBarControl[] {
    return [...GlobalDevBar.customControls];
  }

  /**
   * Clear all custom controls
   */
  static clearControls(): void {
    GlobalDevBar.customControls = [];
    const instance = getGlobalInstance();
    if (instance) {
      instance.render();
    }
  }

  /**
   * Initialize and mount the devbar
   */
  init(): void {
    if (typeof window === 'undefined') return;
    if (this.destroyed) return;

    // Inject tooltip styles
    this.injectStyles();

    // Copy early captured logs
    this.consoleLogs = [...earlyConsoleCapture.logs];

    // Setup WebSocket connection
    this.connectWebSocket();

    // Setup breakpoint detection
    this.setupBreakpointDetection();

    // Setup performance monitoring
    this.setupPerformanceMonitoring();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Initial render
    this.render();
  }

  /**
   * Destroy the devbar and cleanup
   */
  destroy(): void {
    this.destroyed = true;

    // Close WebSocket
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnection
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) this.ws.close();

    // Clear timeouts
    if (this.screenshotTimeout) clearTimeout(this.screenshotTimeout);
    if (this.designReviewTimeout) clearTimeout(this.designReviewTimeout);
    if (this.outlineTimeout) clearTimeout(this.outlineTimeout);
    if (this.schemaTimeout) clearTimeout(this.schemaTimeout);

    // Remove event listeners
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);

    // Disconnect observers
    if (this.fcpObserver) this.fcpObserver.disconnect();
    if (this.lcpObserver) this.lcpObserver.disconnect();

    // Restore console
    if (earlyConsoleCapture.originalConsole) {
      console.log = earlyConsoleCapture.originalConsole.log;
      console.error = earlyConsoleCapture.originalConsole.error;
      console.warn = earlyConsoleCapture.originalConsole.warn;
      console.info = earlyConsoleCapture.originalConsole.info;
    }

    // Remove DOM elements
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }

  private injectStyles(): void {
    const styleId = 'devbar-tooltip-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = TOOLTIP_STYLES;
      document.head.appendChild(style);
    }
  }

  private connectWebSocket(): void {
    if (this.destroyed) return;

    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    this.ws = ws;

    ws.onopen = () => {
      this.sweetlinkConnected = true;
      this.reconnectAttempts = 0;
      ws.send(JSON.stringify({ type: 'browser-client-ready' }));
      this.render();
    };

    ws.onmessage = async (event) => {
      try {
        const command = JSON.parse(event.data) as SweetlinkCommand;
        await this.handleSweetlinkCommand(command);
      } catch (e) {
        console.error('[GlobalDevBar] Error handling command:', e);
      }
    };

    ws.onclose = () => {
      this.sweetlinkConnected = false;
      this.render();

      // Auto-reconnect with exponential backoff
      if (!this.destroyed && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delayMs = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), Math.min(delayMs, MAX_RECONNECT_DELAY_MS));
      }
    };

    ws.onerror = () => {
      // Error will trigger onclose, which handles reconnection
    };
  }

  private async handleSweetlinkCommand(command: SweetlinkCommand): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    switch (command.type) {
      case 'screenshot': {
        const targetElement = command.selector
          ? document.querySelector(command.selector) as HTMLElement || document.body
          : document.body;
        const canvas = await html2canvas(targetElement, { logging: false, useCORS: true, allowTaint: true });
        ws.send(JSON.stringify({
          success: true,
          data: { screenshot: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, selector: command.selector || 'body' },
          timestamp: Date.now()
        }));
        break;
      }
      case 'get-logs': {
        let logs = this.consoleLogs;
        if (command.filter) {
          const filter = command.filter.toLowerCase();
          logs = logs.filter(log => log.level.includes(filter) || log.message.toLowerCase().includes(filter));
        }
        ws.send(JSON.stringify({ success: true, data: logs, timestamp: Date.now() }));
        break;
      }
      case 'query-dom': {
        if (command.selector) {
          const elements = Array.from(document.querySelectorAll(command.selector));
          const results = elements.map((el: Element) => {
            if (command.property) return (el as unknown as Record<string, unknown>)[command.property] ?? null;
            return { tagName: el.tagName, className: el.className, id: el.id, textContent: el.textContent?.trim().slice(0, 100) };
          });
          ws.send(JSON.stringify({ success: true, data: { count: results.length, results }, timestamp: Date.now() }));
        }
        break;
      }
      case 'exec-js': {
        if (command.code) {
          try {
            // Use indirect eval to avoid strict mode issues
            const indirectEval = eval;
            const result = indirectEval(command.code);
            ws.send(JSON.stringify({ success: true, data: result, timestamp: Date.now() }));
          } catch (e) {
            ws.send(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Execution failed', timestamp: Date.now() }));
          }
        }
        break;
      }
      case 'screenshot-saved':
        this.handleNotification('screenshot', command.path, SCREENSHOT_NOTIFICATION_MS);
        break;
      case 'design-review-saved':
        this.designReviewInProgress = false;
        this.handleNotification('designReview', command.reviewPath, DESIGN_REVIEW_NOTIFICATION_MS);
        break;
      case 'design-review-error':
        this.designReviewInProgress = false;
        this.designReviewError = command.error || 'Unknown error';
        console.error('[GlobalDevBar] Design review failed:', command.error);
        // Clear error after notification duration
        if (this.designReviewErrorTimeout) clearTimeout(this.designReviewErrorTimeout);
        this.designReviewErrorTimeout = setTimeout(() => {
          this.designReviewError = null;
          this.render();
        }, DESIGN_REVIEW_NOTIFICATION_MS);
        this.render();
        break;
      case 'outline-saved':
        this.handleNotification('outline', command.outlinePath, SCREENSHOT_NOTIFICATION_MS);
        break;
      case 'outline-error':
        console.error('[GlobalDevBar] Outline save failed:', command.error);
        break;
      case 'schema-saved':
        this.handleNotification('schema', command.schemaPath, SCREENSHOT_NOTIFICATION_MS);
        break;
      case 'schema-error':
        console.error('[GlobalDevBar] Schema save failed:', command.error);
        break;
    }
  }

  /**
   * Handle notification state updates with auto-clear timeout
   */
  private handleNotification(
    type: 'screenshot' | 'designReview' | 'outline' | 'schema',
    path: string | undefined,
    durationMs: number
  ): void {
    if (!path) return;

    // Update the appropriate state
    switch (type) {
      case 'screenshot':
        this.lastScreenshot = path;
        if (this.screenshotTimeout) clearTimeout(this.screenshotTimeout);
        this.screenshotTimeout = setTimeout(() => { this.lastScreenshot = null; this.render(); }, durationMs);
        break;
      case 'designReview':
        this.lastDesignReview = path;
        if (this.designReviewTimeout) clearTimeout(this.designReviewTimeout);
        this.designReviewTimeout = setTimeout(() => { this.lastDesignReview = null; this.render(); }, durationMs);
        break;
      case 'outline':
        this.lastOutline = path;
        if (this.outlineTimeout) clearTimeout(this.outlineTimeout);
        this.outlineTimeout = setTimeout(() => { this.lastOutline = null; this.render(); }, durationMs);
        break;
      case 'schema':
        this.lastSchema = path;
        if (this.schemaTimeout) clearTimeout(this.schemaTimeout);
        this.schemaTimeout = setTimeout(() => { this.lastSchema = null; this.render(); }, durationMs);
        break;
    }
    this.render();
  }

  private setupBreakpointDetection(): void {
    const updateBreakpointInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Determine breakpoint by checking thresholds in descending order
      let tailwindBreakpoint = 'base';
      if (width >= TAILWIND_BREAKPOINTS['2xl'].min) tailwindBreakpoint = '2xl';
      else if (width >= TAILWIND_BREAKPOINTS.xl.min) tailwindBreakpoint = 'xl';
      else if (width >= TAILWIND_BREAKPOINTS.lg.min) tailwindBreakpoint = 'lg';
      else if (width >= TAILWIND_BREAKPOINTS.md.min) tailwindBreakpoint = 'md';
      else if (width >= TAILWIND_BREAKPOINTS.sm.min) tailwindBreakpoint = 'sm';

      this.breakpointInfo = {
        tailwindBreakpoint,
        dimensions: `${width}x${height}`
      };
      this.render();
    };

    updateBreakpointInfo();
    this.resizeHandler = updateBreakpointInfo;
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupPerformanceMonitoring(): void {
    const updatePerfStats = () => {
      // FCP
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      const fcp = fcpEntry ? `${Math.round(fcpEntry.startTime)}ms` : '-';

      // LCP (from cached value, updated by observer)
      const lcp = this.lcpValue !== null ? `${Math.round(this.lcpValue)}ms` : '-';

      // Total Resource Size
      const resources = performance.getEntriesByType('resource');
      let totalBytes = 0;

      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        totalBytes += navEntry.transferSize || 0;
      }

      resources.forEach((entry) => {
        const resourceEntry = entry as PerformanceResourceTiming;
        totalBytes += resourceEntry.transferSize || 0;
      });

      const totalSize = totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(totalBytes / 1024)} KB`;

      this.perfStats = { fcp, lcp, totalSize };
      this.render();
    };

    if (document.readyState === 'complete') {
      setTimeout(updatePerfStats, 100);
    } else {
      window.addEventListener('load', () => setTimeout(updatePerfStats, 100));
    }

    // FCP Observer
    try {
      this.fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            updatePerfStats();
          }
        });
      });
      this.fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (e) {
      console.warn('[GlobalDevBar] FCP PerformanceObserver not supported', e);
    }

    // LCP Observer
    try {
      this.lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.lcpValue = lastEntry.startTime;
          updatePerfStats();
        }
      });
      this.lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('[GlobalDevBar] LCP PerformanceObserver not supported', e);
    }
  }

  private setupKeyboardShortcuts(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Close modals on Escape
      if (e.key === 'Escape') {
        if (this.consoleFilter || this.showOutlineModal || this.showSchemaModal) {
          this.consoleFilter = null;
          this.showOutlineModal = false;
          this.showSchemaModal = false;
          this.render();
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'S' || e.key === 's') {
          e.preventDefault();
          if (this.sweetlinkConnected && !this.capturing) {
            this.handleScreenshot(false);
          }
        } else if (e.key === 'C' || e.key === 'c') {
          const selection = window.getSelection();
          if (!selection || selection.toString().length === 0) {
            e.preventDefault();
            if (!this.capturing) {
              this.handleScreenshot(true);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private async handleScreenshot(copyToClipboard = false): Promise<void> {
    if (this.capturing) return;
    if (!copyToClipboard && !this.sweetlinkConnected) return;

    let cleanup: (() => void) | null = null;

    try {
      this.capturing = true;
      this.render();

      cleanup = prepareForCapture();
      await delay(SCREENSHOT_BLUR_DELAY_MS);

      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: SCREENSHOT_SCALE,
        width: window.innerWidth,
        windowWidth: window.innerWidth
      });

      // Restore page state
      cleanup();
      cleanup = null;

      if (copyToClipboard) {
        try {
          await copyCanvasToClipboard(canvas);
          this.copiedToClipboard = true;
          this.render();
          if (this.screenshotTimeout) clearTimeout(this.screenshotTimeout);
          this.screenshotTimeout = setTimeout(() => {
            this.copiedToClipboard = false;
            this.render();
          }, CLIPBOARD_NOTIFICATION_MS);
        } catch (e) {
          console.error('[GlobalDevBar] Failed to copy to clipboard:', e);
        }
      } else {
        const dataUrl = canvasToDataUrl(canvas, { format: 'jpeg', quality: DEVBAR_SCREENSHOT_QUALITY });
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'save-screenshot',
            data: {
              screenshot: dataUrl,
              width: canvas.width,
              height: canvas.height,
              logs: this.consoleLogs,
              url: window.location.href,
              timestamp: Date.now()
            }
          }));
        }
      }
    } catch (e) {
      console.error('[GlobalDevBar] Screenshot failed:', e);
      if (cleanup) cleanup();
    } finally {
      this.capturing = false;
      this.render();
    }
  }

  private async handleDesignReview(): Promise<void> {
    if (this.designReviewInProgress || !this.sweetlinkConnected) return;

    let cleanup: (() => void) | null = null;

    try {
      this.designReviewInProgress = true;
      this.designReviewError = null; // Clear any previous error
      if (this.designReviewErrorTimeout) {
        clearTimeout(this.designReviewErrorTimeout);
        this.designReviewErrorTimeout = null;
      }
      this.render();

      cleanup = prepareForCapture();
      await delay(SCREENSHOT_BLUR_DELAY_MS);

      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 1, // Full quality for design review
        width: window.innerWidth,
        windowWidth: window.innerWidth
      });

      // Restore page state
      cleanup();
      cleanup = null;

      const dataUrl = canvasToDataUrl(canvas, { format: 'png' });
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'design-review-screenshot',
          data: {
            screenshot: dataUrl,
            width: canvas.width,
            height: canvas.height,
            logs: this.consoleLogs,
            url: window.location.href,
            timestamp: Date.now()
          }
        }));
      }
    } catch (e) {
      console.error('[GlobalDevBar] Design review failed:', e);
      if (cleanup) cleanup();
      this.designReviewInProgress = false;
      this.render();
    }
  }

  private handleDocumentOutline(): void {
    // Toggle outline modal
    this.showOutlineModal = !this.showOutlineModal;
    this.showSchemaModal = false;
    this.consoleFilter = null;
    this.render();
  }

  private handlePageSchema(): void {
    // Toggle schema modal
    this.showSchemaModal = !this.showSchemaModal;
    this.showOutlineModal = false;
    this.consoleFilter = null;
    this.render();
  }

  private handleSaveOutline(): void {
    const outline = extractDocumentOutline();
    const markdown = outlineToMarkdown(outline);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'save-outline',
        data: {
          outline,
          markdown,
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        }
      }));
    }
  }

  private handleSaveSchema(): void {
    const schema = extractPageSchema();
    const markdown = schemaToMarkdown(schema);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'save-schema',
        data: {
          schema,
          markdown,
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        }
      }));
    }
  }

  private clearConsoleLogs(): void {
    // Clear the logs array
    earlyConsoleCapture.logs = [];
    earlyConsoleCapture.errorCount = 0;
    earlyConsoleCapture.warningCount = 0;
    this.consoleLogs = [];
    this.consoleFilter = null;
    this.render();
  }

  // ============================================================================
  // Render Methods (Using Safe DOM Methods)
  // ============================================================================

  private render(): void {
    if (this.destroyed) return;
    if (typeof document === 'undefined') return;

    // Remove existing container if any
    if (this.container) {
      this.container.remove();
    }

    // Create new container
    this.container = document.createElement('div');
    this.container.setAttribute('data-devbar', 'true');

    if (this.collapsed) {
      this.renderCollapsed();
    } else {
      this.renderExpanded();
    }

    document.body.appendChild(this.container);

    // Render overlays/modals
    this.renderOverlays();
  }

  private renderOverlays(): void {
    // Remove existing overlay
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }

    // Render console popup if filter is active
    if (this.consoleFilter) {
      this.renderConsolePopup();
    }

    // Render outline modal
    if (this.showOutlineModal) {
      this.renderOutlineModal();
    }

    // Render schema modal
    if (this.showSchemaModal) {
      this.renderSchemaModal();
    }
  }

  private renderConsolePopup(): void {
    const filterType = this.consoleFilter;
    if (!filterType) return;

    const logs = earlyConsoleCapture.logs.filter(log => log.level === filterType);
    const color = filterType === 'error' ? BUTTON_COLORS.error : BUTTON_COLORS.warning;
    const label = filterType === 'error' ? 'Errors' : 'Warnings';

    const popup = document.createElement('div');
    popup.setAttribute('data-devbar', 'true');
    Object.assign(popup.style, {
      position: 'fixed',
      bottom: '60px',
      left: '80px',
      zIndex: '10002',
      backgroundColor: 'rgba(17, 24, 39, 0.98)',
      border: `1px solid ${color}`,
      borderRadius: '8px',
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px ${color}33`,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      minWidth: '400px',
      maxWidth: '600px',
      maxHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: `1px solid ${color}40`,
    });

    const title = document.createElement('span');
    Object.assign(title.style, { color, fontSize: '0.8125rem', fontWeight: '600' });
    title.textContent = `Console ${label} (${logs.length})`;
    header.appendChild(title);

    const headerButtons = document.createElement('div');
    Object.assign(headerButtons.style, { display: 'flex', gap: '8px' });

    // Clear button
    const clearBtn = createStyledButton({
      color,
      text: 'Clear All',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '0.6875rem',
    });
    clearBtn.onclick = () => this.clearConsoleLogs();
    headerButtons.appendChild(clearBtn);

    // Close button - match Clear button padding for consistent height
    const closeBtn = createStyledButton({
      color,
      text: '×',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
    });
    closeBtn.onclick = () => {
      this.consoleFilter = null;
      this.render();
    };
    headerButtons.appendChild(closeBtn);

    header.appendChild(headerButtons);
    popup.appendChild(header);

    // Content
    const content = document.createElement('div');
    Object.assign(content.style, { flex: '1', overflow: 'auto', padding: '8px 0' });

    if (logs.length === 0) {
      const emptyMsg = document.createElement('div');
      Object.assign(emptyMsg.style, {
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.75rem',
      });
      emptyMsg.textContent = `No ${filterType}s recorded`;
      content.appendChild(emptyMsg);
    } else {
      this.renderConsoleLogs(content, logs, color);
    }

    popup.appendChild(content);
    this.overlayElement = popup;
    document.body.appendChild(popup);
  }

  /**
   * Render console log items into a container
   */
  private renderConsoleLogs(container: HTMLElement, logs: ConsoleLog[], color: string): void {
    logs.forEach((log, index) => {
      const logItem = document.createElement('div');
      Object.assign(logItem.style, {
        padding: '8px 14px',
        borderBottom: index < logs.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
      });

      const timestamp = document.createElement('span');
      Object.assign(timestamp.style, {
        color: '#6b7280',
        fontSize: '0.625rem',
        marginRight: '8px',
      });
      timestamp.textContent = new Date(log.timestamp).toLocaleTimeString();
      logItem.appendChild(timestamp);

      const message = document.createElement('span');
      Object.assign(message.style, {
        color,
        fontSize: '0.6875rem',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      });
      message.textContent = log.message.length > 500 ? log.message.slice(0, 500) + '...' : log.message;
      logItem.appendChild(message);

      container.appendChild(logItem);
    });
  }

  private renderOutlineModal(): void {
    const outline = extractDocumentOutline();
    const color = BUTTON_COLORS.outline;

    const closeModal = () => {
      this.showOutlineModal = false;
      this.render();
    };

    const overlay = createModalOverlay(closeModal);
    const modal = createModalBox(color);

    const header = createModalHeader({
      color,
      title: 'Document Outline',
      onClose: closeModal,
      onCopyMd: async () => {
        const markdown = outlineToMarkdown(outline);
        await navigator.clipboard.writeText(markdown);
      },
      onSave: () => this.handleSaveOutline(),
      sweetlinkConnected: this.sweetlinkConnected,
    });
    modal.appendChild(header);

    const content = createModalContent();

    if (outline.length === 0) {
      content.appendChild(createEmptyMessage('No semantic elements found in this document'));
    } else {
      this.renderOutlineNodes(outline, content, 0);
    }

    modal.appendChild(content);
    overlay.appendChild(modal);

    this.overlayElement = overlay;
    document.body.appendChild(overlay);
  }

  /**
   * Recursively render outline nodes into a container element
   */
  private renderOutlineNodes(nodes: OutlineNode[], parentEl: HTMLElement, depth: number): void {
    for (const node of nodes) {
      const nodeEl = document.createElement('div');
      Object.assign(nodeEl.style, {
        padding: `4px 0 4px ${depth * 16}px`,
      });

      const tagSpan = document.createElement('span');
      const categoryColor = CATEGORY_COLORS[node.category || 'other'] || CATEGORY_COLORS.other;
      Object.assign(tagSpan.style, {
        color: categoryColor,
        fontSize: '0.6875rem',
        fontWeight: '500',
      });
      tagSpan.textContent = `<${node.tagName}>`;
      nodeEl.appendChild(tagSpan);

      if (node.category) {
        const categorySpan = document.createElement('span');
        Object.assign(categorySpan.style, {
          color: '#6b7280',
          fontSize: '0.625rem',
          marginLeft: '6px',
        });
        categorySpan.textContent = `[${node.category}]`;
        nodeEl.appendChild(categorySpan);
      }

      const textSpan = document.createElement('span');
      Object.assign(textSpan.style, {
        color: '#d1d5db',
        fontSize: '0.6875rem',
        marginLeft: '8px',
      });
      const truncatedText = node.text.length > 60 ? node.text.slice(0, 60) + '...' : node.text;
      textSpan.textContent = truncatedText;
      nodeEl.appendChild(textSpan);

      if (node.id) {
        const idSpan = document.createElement('span');
        Object.assign(idSpan.style, {
          color: '#9ca3af',
          fontSize: '0.625rem',
          marginLeft: '6px',
        });
        idSpan.textContent = `#${node.id}`;
        nodeEl.appendChild(idSpan);
      }

      parentEl.appendChild(nodeEl);

      if (node.children.length > 0) {
        this.renderOutlineNodes(node.children, parentEl, depth + 1);
      }
    }
  }

  private renderSchemaModal(): void {
    const schema = extractPageSchema();
    const color = BUTTON_COLORS.schema;

    const closeModal = () => {
      this.showSchemaModal = false;
      this.render();
    };

    const overlay = createModalOverlay(closeModal);
    const modal = createModalBox(color);

    const header = createModalHeader({
      color,
      title: 'Page Schema',
      onClose: closeModal,
      onCopyMd: async () => {
        const markdown = schemaToMarkdown(schema);
        await navigator.clipboard.writeText(markdown);
      },
      onSave: () => this.handleSaveSchema(),
      sweetlinkConnected: this.sweetlinkConnected,
    });
    modal.appendChild(header);

    const content = createModalContent();

    const hasContent =
      schema.jsonLd.length > 0 ||
      Object.keys(schema.openGraph).length > 0 ||
      Object.keys(schema.twitter).length > 0 ||
      Object.keys(schema.metaTags).length > 0;

    if (!hasContent) {
      content.appendChild(createEmptyMessage('No structured data found on this page'));
    } else {
      this.renderSchemaSection(content, 'JSON-LD', schema.jsonLd, color);
      this.renderSchemaSection(content, 'Open Graph', schema.openGraph, '#3b82f6');
      this.renderSchemaSection(content, 'Twitter Cards', schema.twitter, '#1da1f2');
      this.renderSchemaSection(content, 'Meta Tags', schema.metaTags, '#6b7280');
    }

    modal.appendChild(content);
    overlay.appendChild(modal);

    this.overlayElement = overlay;
    document.body.appendChild(overlay);
  }

  /**
   * Render a section of schema data (either array or key-value object)
   */
  private renderSchemaSection(
    container: HTMLElement,
    title: string,
    items: Record<string, string> | unknown[],
    color: string
  ): void {
    const isEmpty = Array.isArray(items) ? items.length === 0 : Object.keys(items).length === 0;
    if (isEmpty) return;

    const section = document.createElement('div');
    section.style.marginBottom = '20px';

    const sectionTitle = document.createElement('h3');
    Object.assign(sectionTitle.style, {
      color,
      fontSize: '0.8125rem',
      fontWeight: '600',
      marginBottom: '10px',
      borderBottom: `1px solid ${color}40`,
      paddingBottom: '6px',
    });
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    if (Array.isArray(items)) {
      this.renderJsonLdItems(section, items);
    } else {
      this.renderKeyValueItems(section, items);
    }

    container.appendChild(section);
  }

  /**
   * Render JSON-LD items as formatted code blocks with syntax highlighting
   */
  private renderJsonLdItems(container: HTMLElement, items: unknown[]): void {
    items.forEach((item, i) => {
      const itemEl = document.createElement('div');
      itemEl.style.marginBottom = '10px';

      const itemTitle = document.createElement('div');
      Object.assign(itemTitle.style, {
        color: '#9ca3af',
        fontSize: '0.6875rem',
        marginBottom: '4px',
      });
      itemTitle.textContent = `Schema ${i + 1}`;
      itemEl.appendChild(itemTitle);

      const codeEl = document.createElement('pre');
      Object.assign(codeEl.style, {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '4px',
        padding: '10px',
        overflow: 'auto',
        fontSize: '0.625rem',
        margin: '0',
        maxHeight: '300px', // Taller for more content
      });
      // Syntax highlight the JSON using DOM methods for safety
      this.appendHighlightedJson(codeEl, JSON.stringify(item, null, 2));
      itemEl.appendChild(codeEl);

      container.appendChild(itemEl);
    });
  }

  /**
   * Append syntax-highlighted JSON to an element using safe DOM methods
   * Uses textContent for all text to prevent XSS
   */
  private appendHighlightedJson(container: HTMLElement, json: string): void {
    // Color map for different token types
    const colors: Record<string, string> = {
      key: '#10b981',      // green
      string: '#fbbf24',   // amber/yellow
      number: '#c084fc',   // purple
      boolean: '#60a5fa',  // blue
      nullVal: '#f87171',  // red
      punct: '#9ca3af',    // gray
    };

    // Simple tokenizer for JSON using matchAll for safety
    const tokenPattern = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|([{}\[\],])|(\s+)/g;

    for (const match of json.matchAll(tokenPattern)) {
      const [, str, colon, bool, nullToken, num, punct, whitespace] = match;

      if (whitespace) {
        container.appendChild(document.createTextNode(whitespace));
      } else if (str !== undefined) {
        const span = document.createElement('span');
        span.style.color = colon ? colors.key : colors.string;
        span.textContent = str;
        container.appendChild(span);
        if (colon) {
          const colonSpan = document.createElement('span');
          colonSpan.style.color = colors.punct;
          colonSpan.textContent = ':';
          container.appendChild(colonSpan);
        }
      } else if (bool) {
        const span = document.createElement('span');
        span.style.color = colors.boolean;
        span.textContent = bool;
        container.appendChild(span);
      } else if (nullToken) {
        const span = document.createElement('span');
        span.style.color = colors.nullVal;
        span.textContent = nullToken;
        container.appendChild(span);
      } else if (num) {
        const span = document.createElement('span');
        span.style.color = colors.number;
        span.textContent = num;
        container.appendChild(span);
      } else if (punct) {
        const span = document.createElement('span');
        span.style.color = colors.punct;
        span.textContent = punct;
        container.appendChild(span);
      }
    }
  }

  /**
   * Render key-value pairs as rows with ellipsis overflow and hover tooltip
   */
  private renderKeyValueItems(container: HTMLElement, items: Record<string, string>): void {
    for (const [key, value] of Object.entries(items)) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        marginBottom: '4px',
        alignItems: 'flex-start',
      });

      const keyEl = document.createElement('span');
      Object.assign(keyEl.style, {
        color: '#9ca3af',
        fontSize: '0.6875rem',
        minWidth: '120px',
        flexShrink: '0',
      });
      keyEl.textContent = key;
      row.appendChild(keyEl);

      const valueEl = document.createElement('span');
      const strValue = String(value);
      Object.assign(valueEl.style, {
        color: '#d1d5db',
        fontSize: '0.6875rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
        cursor: strValue.length > 30 ? 'help' : 'default',
      });
      valueEl.textContent = strValue;
      // Show full value on hover via title attribute
      if (strValue.length > 30) {
        valueEl.title = strValue;
      }
      row.appendChild(valueEl);

      container.appendChild(row);
    }
  }

  private renderCollapsed(): void {
    if (!this.container) return;

    const { position, accentColor } = this.options;
    const errorCount = earlyConsoleCapture.logs.filter(log => log.level === 'error').length;
    const warningCount = earlyConsoleCapture.logs.filter(log => log.level === 'warn').length;

    // Position styles for collapsed state
    const collapsedPositions: Record<string, { bottom?: string; left?: string; top?: string; right?: string; transform?: string }> = {
      'bottom-left': { bottom: '20px', left: '94px' },
      'bottom-right': { bottom: '20px', right: '30px' },
      'top-left': { top: '20px', left: '94px' },
      'top-right': { top: '20px', right: '30px' },
      'bottom-center': { bottom: '12px', left: '50%', transform: 'translateX(-50%)' },
    };
    const posStyle = collapsedPositions[position] ?? collapsedPositions['bottom-left'];

    const wrapper = this.container;
    wrapper.className = 'devbar-tooltip devbar-tooltip-left devbar-collapse';
    wrapper.setAttribute('data-tooltip',
      `Click to expand DevBar${this.sweetlinkConnected ? ' (Sweetlink connected)' : ' (Sweetlink not connected)'}${errorCount > 0 ? `\n${errorCount} console error${errorCount === 1 ? '' : 's'}` : ''}`
    );

    // Reset position properties first to avoid stale values
    wrapper.style.top = '';
    wrapper.style.bottom = '';
    wrapper.style.left = '';
    wrapper.style.right = '';
    wrapper.style.transform = '';

    Object.assign(wrapper.style, {
      position: 'fixed',
      ...posStyle,
      zIndex: '9999',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      border: `1px solid ${accentColor}`,
      borderRadius: '50%',
      color: accentColor,
      boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px ${accentColor}1A`,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '33px',
      height: '33px',
      animation: 'devbar-collapse 150ms ease-out'
    });

    wrapper.onclick = () => {
      this.collapsed = false;
      this.render();
    };

    // Connection indicator dot
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: this.sweetlinkConnected ? '#10b981' : '#6b7280',
      boxShadow: this.sweetlinkConnected ? '0 0 6px #10b981' : 'none'
    });
    wrapper.appendChild(dot);

    // Error badge
    if (errorCount > 0) {
      const errorBadge = document.createElement('span');
      Object.assign(errorBadge.style, {
        position: 'absolute',
        top: '-4px',
        right: warningCount > 0 ? '10px' : '-4px',
        minWidth: '14px',
        height: '14px',
        padding: '0 3px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        color: '#fff',
        fontSize: '0.5rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      errorBadge.textContent = errorCount > 99 ? '!' : String(errorCount);
      wrapper.appendChild(errorBadge);
    }

    // Warning badge
    if (warningCount > 0) {
      const warnBadge = document.createElement('span');
      Object.assign(warnBadge.style, {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        minWidth: '14px',
        height: '14px',
        padding: '0 3px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(245, 158, 11, 0.9)',
        color: '#fff',
        fontSize: '0.5rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      warnBadge.textContent = warningCount > 99 ? '!' : String(warningCount);
      wrapper.appendChild(warnBadge);
    }
  }

  private renderExpanded(): void {
    if (!this.container) return;

    const { position, accentColor, showMetrics, showScreenshot, showConsoleBadges } = this.options;
    const errorCount = earlyConsoleCapture.logs.filter(log => log.level === 'error').length;
    const warningCount = earlyConsoleCapture.logs.filter(log => log.level === 'warn').length;

    const positionStyles: Record<string, { bottom?: string; left?: string; top?: string; right?: string; transform?: string }> = {
      'bottom-left': { bottom: '20px', left: '80px' },
      'bottom-right': { bottom: '20px', right: '16px' },
      'top-left': { top: '20px', left: '80px' },
      'top-right': { top: '20px', right: '16px' },
      'bottom-center': { bottom: '12px', left: '50%', transform: 'translateX(-50%)' },
    };

    const posStyle = positionStyles[position] ?? positionStyles['bottom-left'];
    const isCentered = position === 'bottom-center';
    const sizeOverrides = this.options.sizeOverrides;

    const wrapper = this.container;

    // Reset position properties first to avoid stale values from previous renders
    wrapper.style.top = '';
    wrapper.style.bottom = '';
    wrapper.style.left = '';
    wrapper.style.right = '';
    wrapper.style.transform = '';

    // Calculate size values with overrides or defaults
    // Width always fit-content, maxWidth prevents overlap with other dev bars
    // BASE breakpoint (<640px) wraps buttons to centered second row via CSS
    const defaultWidth = 'fit-content';
    const defaultMinWidth = 'auto';
    const defaultMaxWidth = isCentered ? 'calc(100vw - 140px)' : 'calc(100vw - 32px)';

    Object.assign(wrapper.style, {
      position: 'fixed',
      ...posStyle,
      zIndex: '9999',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      border: `1px solid ${accentColor}`,
      borderRadius: '12px',
      color: accentColor,
      boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px ${accentColor}1A`,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxSizing: 'border-box',
      width: sizeOverrides?.width ?? defaultWidth,
      maxWidth: sizeOverrides?.maxWidth ?? defaultMaxWidth,
      minWidth: sizeOverrides?.minWidth ?? defaultMinWidth,
      cursor: 'default'
    });

    wrapper.ondblclick = () => {
      this.collapsed = true;
      this.render();
    };

    // Main row - wrapping controlled by CSS media query
    const mainRow = document.createElement('div');
    mainRow.className = 'devbar-main';
    Object.assign(mainRow.style, {
      display: 'flex',
      alignItems: 'center',
      alignContent: 'flex-start',
      justifyContent: 'flex-start',
      gap: '0.5rem',
      padding: '0.5rem 0.75rem',
      minWidth: '0',
      boxSizing: 'border-box',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.6875rem',
      lineHeight: '1rem'
    });

    // Connection indicator (click to collapse)
    const connIndicator = document.createElement('span');
    connIndicator.className = 'devbar-tooltip devbar-tooltip-left devbar-clickable';
    connIndicator.setAttribute('data-tooltip', this.sweetlinkConnected ? 'Sweetlink connected (click to minimize)' : 'Sweetlink disconnected (click to minimize)');
    Object.assign(connIndicator.style, {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: '0'
    });
    connIndicator.onclick = (e) => {
      e.stopPropagation();
      this.collapsed = true;
      this.render();
    };

    const connDot = document.createElement('span');
    Object.assign(connDot.style, {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: this.sweetlinkConnected ? '#10b981' : '#6b7280',
      boxShadow: this.sweetlinkConnected ? '0 0 6px #10b981' : 'none',
      transition: 'all 300ms'
    });
    connIndicator.appendChild(connDot);

    // Status row wrapper - keeps connection dot, info, and badges together
    const statusRow = document.createElement('div');
    statusRow.className = 'devbar-status';
    Object.assign(statusRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      flexWrap: 'nowrap',
      flexShrink: '0'
    });
    statusRow.appendChild(connIndicator);

    // Info section
    const infoSection = document.createElement('div');
    infoSection.className = 'devbar-info';
    Object.assign(infoSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      flexShrink: '1',
      minWidth: '0',
      overflow: 'hidden'
    });

    // Breakpoint info
    if (showMetrics.breakpoint && this.breakpointInfo) {
      const bp = this.breakpointInfo.tailwindBreakpoint as keyof typeof TAILWIND_BREAKPOINTS;
      const breakpointData = TAILWIND_BREAKPOINTS[bp];

      const bpSpan = document.createElement('span');
      bpSpan.className = 'devbar-tooltip devbar-tooltip-left devbar-item';
      Object.assign(bpSpan.style, { opacity: '0.9', cursor: 'default' });
      bpSpan.setAttribute('data-tooltip', `${breakpointData?.label || bp}\nViewport: ${this.breakpointInfo.dimensions}`);

      let bpText: string = bp;
      if (bp !== 'base') {
        bpText = bp === 'sm'
          ? `${bp} - ${this.breakpointInfo.dimensions.split('x')[0]}`
          : `${bp} - ${this.breakpointInfo.dimensions}`;
      }
      bpSpan.textContent = bpText;
      infoSection.appendChild(bpSpan);
    }

    // Performance stats
    if (this.perfStats) {
      const addSeparator = () => {
        const sep = document.createElement('span');
        sep.style.opacity = '0.4';
        sep.textContent = '|';
        infoSection.appendChild(sep);
      };

      if (showMetrics.fcp) {
        addSeparator();
        const fcpSpan = document.createElement('span');
        fcpSpan.className = 'devbar-tooltip devbar-tooltip-left devbar-item';
        Object.assign(fcpSpan.style, { opacity: '0.85', cursor: 'default' });
        fcpSpan.setAttribute('data-tooltip', 'First Contentful Paint (FCP): Time until first text/image renders.\n\nGood: <1.8s\nNeeds work: 1.8-3s\nPoor: >3s');
        fcpSpan.textContent = `FCP ${this.perfStats.fcp}`;
        infoSection.appendChild(fcpSpan);
      }

      if (showMetrics.lcp) {
        addSeparator();
        const lcpSpan = document.createElement('span');
        lcpSpan.className = 'devbar-tooltip devbar-tooltip-left devbar-item';
        Object.assign(lcpSpan.style, { opacity: '0.85', cursor: 'default' });
        lcpSpan.setAttribute('data-tooltip', 'Largest Contentful Paint (LCP): Time until largest visible element renders.\n\nGood: <2.5s\nNeeds work: 2.5-4s\nPoor: >4s');
        lcpSpan.textContent = `LCP ${this.perfStats.lcp}`;
        infoSection.appendChild(lcpSpan);
      }

      if (showMetrics.pageSize) {
        addSeparator();
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'devbar-tooltip devbar-tooltip-left devbar-item';
        Object.assign(sizeSpan.style, { opacity: '0.7', cursor: 'default' });
        sizeSpan.setAttribute('data-tooltip', 'Total page size (compressed/transferred).\nIncludes HTML, CSS, JS, images, and other resources.');
        sizeSpan.textContent = this.perfStats.totalSize;
        infoSection.appendChild(sizeSpan);
      }
    }

    statusRow.appendChild(infoSection);

    // Console badges - add to status row so they stay with info
    if (showConsoleBadges) {
      if (errorCount > 0) {
        statusRow.appendChild(this.createConsoleBadge('error', errorCount, BUTTON_COLORS.error));
      }
      if (warningCount > 0) {
        statusRow.appendChild(this.createConsoleBadge('warn', warningCount, BUTTON_COLORS.warning));
      }
    }

    mainRow.appendChild(statusRow);

    // Action buttons - use CSS class for responsive layout
    if (showScreenshot) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'devbar-actions';
      actionsContainer.appendChild(this.createScreenshotButton(accentColor));
      actionsContainer.appendChild(this.createAIReviewButton());
      actionsContainer.appendChild(this.createOutlineButton());
      actionsContainer.appendChild(this.createSchemaButton());
      mainRow.appendChild(actionsContainer);
    }

    wrapper.appendChild(mainRow);

    // Render custom controls row if there are any
    if (GlobalDevBar.customControls.length > 0) {
      const customRow = document.createElement('div');
      Object.assign(customRow.style, {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0 0.75rem 0.5rem 0.75rem',
        borderTop: `1px solid ${accentColor}30`,
        marginTop: '0',
        paddingTop: '0.5rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.6875rem',
      });

      GlobalDevBar.customControls.forEach(control => {
        const btn = document.createElement('button');
        btn.type = 'button';

        const color = control.variant === 'warning' ? BUTTON_COLORS.warning : accentColor;
        const isActive = control.active ?? false;
        const isDisabled = control.disabled ?? false;

        Object.assign(btn.style, {
          padding: '4px 10px',
          backgroundColor: isActive ? `${color}33` : 'transparent',
          border: `1px solid ${isActive ? color : `${color}60`}`,
          borderRadius: '6px',
          color: isActive ? color : `${color}99`,
          fontSize: '0.625rem',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? '0.5' : '1',
          transition: 'all 150ms',
        });

        btn.textContent = control.label;
        btn.disabled = isDisabled;

        if (!isDisabled) {
          btn.onmouseenter = () => {
            btn.style.backgroundColor = `${color}20`;
            btn.style.borderColor = color;
            btn.style.color = color;
          };
          btn.onmouseleave = () => {
            btn.style.backgroundColor = isActive ? `${color}33` : 'transparent';
            btn.style.borderColor = isActive ? color : `${color}60`;
            btn.style.color = isActive ? color : `${color}99`;
          };
          btn.onclick = () => control.onClick();
        }

        customRow.appendChild(btn);
      });

      wrapper.appendChild(customRow);
    }
  }

  /**
   * Create a console badge for error/warning counts
   */
  private createConsoleBadge(
    type: 'error' | 'warn',
    count: number,
    color: string
  ): HTMLSpanElement {
    const label = type === 'error' ? 'error' : 'warning';
    const isActive = this.consoleFilter === type;

    const badge = document.createElement('span');
    badge.className = 'devbar-tooltip devbar-tooltip-right devbar-badge';
    badge.setAttribute('data-tooltip', `${count} console ${label}${count === 1 ? '' : 's'} (click to view)`);
    Object.assign(badge.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '18px',
      height: '18px',
      padding: '0 5px',
      borderRadius: '9999px',
      backgroundColor: isActive ? color : `${color}E6`,
      color: '#fff',
      fontSize: '0.625rem',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: isActive ? `0 0 8px ${color}CC` : 'none',
    });
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.onclick = () => {
      this.consoleFilter = this.consoleFilter === type ? null : type;
      this.showOutlineModal = false;
      this.showSchemaModal = false;
      this.render();
    };

    return badge;
  }

  private createScreenshotButton(accentColor: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'devbar-tooltip devbar-tooltip-right';

    const tooltip = this.copiedToClipboard
      ? 'Copied to clipboard!'
      : this.lastScreenshot
        ? `Screenshot saved to:\n${this.lastScreenshot}`
        : `Screenshot\n\nClick: Save to file\nShift+Click: Copy to clipboard\n\nKeyboard:\nCmd/Ctrl+Shift+S: Save\nCmd/Ctrl+Shift+C: Copy${!this.sweetlinkConnected ? '\n\nWarning: Sweetlink not connected' : ''}`;
    btn.setAttribute('data-tooltip', tooltip);

    Object.assign(btn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      minWidth: '22px',
      minHeight: '22px',
      flexShrink: '0',
      borderRadius: '50%',
      border: '1px solid',
      borderColor: this.copiedToClipboard || this.lastScreenshot ? accentColor : `${accentColor}80`,
      backgroundColor: this.copiedToClipboard || this.lastScreenshot ? `${accentColor}33` : 'transparent',
      color: this.copiedToClipboard || this.lastScreenshot ? accentColor : `${accentColor}99`,
      cursor: !this.capturing ? 'pointer' : 'not-allowed',
      opacity: '1',
      transition: 'all 150ms'
    });

    btn.disabled = this.capturing;
    btn.onclick = (e) => this.handleScreenshot(e.shiftKey);

    // Button content
    if (this.copiedToClipboard) {
      btn.textContent = '!';
      btn.style.fontSize = '0.5rem';
    } else if (this.lastScreenshot) {
      btn.textContent = 'v';
      btn.style.fontSize = '0.5rem';
    } else if (this.capturing) {
      btn.textContent = '...';
      btn.style.fontSize = '0.5rem';
    } else {
      // Camera icon SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 50.8 50.8');
      svg.style.stroke = 'currentColor';
      svg.style.fill = 'none';

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('stroke-linecap', 'round');
      g.setAttribute('stroke-linejoin', 'round');
      g.setAttribute('stroke-width', '4');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M19.844 7.938H7.938v11.905m0 11.113v11.906h11.905m23.019-11.906v11.906H30.956m11.906-23.018V7.938H30.956');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '25.4');
      circle.setAttribute('cy', '25.4');
      circle.setAttribute('r', '8.731');

      g.appendChild(path);
      g.appendChild(circle);
      svg.appendChild(g);
      btn.appendChild(svg);
    }

    return btn;
  }

  private createAIReviewButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'devbar-tooltip devbar-tooltip-right';

    const tooltip = this.designReviewInProgress
      ? 'AI Design Review in progress...'
      : this.designReviewError
        ? `Design review failed:\n${this.designReviewError}`
        : this.lastDesignReview
          ? `Design review saved to:\n${this.lastDesignReview}`
          : `AI Design Review\n\nCaptures screenshot and sends to\nClaude for design analysis.\n\nRequires ANTHROPIC_API_KEY.${!this.sweetlinkConnected ? '\n\nWarning: Sweetlink not connected' : ''}`;
    btn.setAttribute('data-tooltip', tooltip);

    const hasError = !!this.designReviewError;
    const isActive = this.designReviewInProgress || !!this.lastDesignReview || hasError;
    const isDisabled = this.designReviewInProgress || !this.sweetlinkConnected;

    // Use error color (red) when there's an error, otherwise normal review color
    const buttonColor = hasError ? '#ef4444' : BUTTON_COLORS.review;
    Object.assign(btn.style, getButtonStyles(buttonColor, isActive, isDisabled));
    if (!this.sweetlinkConnected) btn.style.opacity = '0.5';

    btn.disabled = isDisabled;
    btn.onclick = () => this.handleDesignReview();

    if (this.designReviewInProgress) {
      btn.textContent = '~';
      btn.style.fontSize = '0.5rem';
      btn.style.animation = 'pulse 1s infinite';
    } else if (this.designReviewError) {
      // Show 'x' for error state
      btn.textContent = '×';
      btn.style.fontSize = '0.875rem';
      btn.style.fontWeight = 'bold';
    } else if (this.lastDesignReview) {
      btn.textContent = 'v';
      btn.style.fontSize = '0.5rem';
    } else {
      btn.appendChild(createSvgIcon(
        'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
        { fill: true }
      ));
    }

    return btn;
  }

  private createOutlineButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'devbar-tooltip devbar-tooltip-right';

    const tooltip = this.lastOutline
      ? `Outline saved to:\n${this.lastOutline}`
      : `Document Outline\n\nView page heading structure and\nsave as markdown.`;
    btn.setAttribute('data-tooltip', tooltip);

    const isActive = this.showOutlineModal || !!this.lastOutline;
    Object.assign(btn.style, getButtonStyles(BUTTON_COLORS.outline, isActive, false));
    btn.onclick = () => this.handleDocumentOutline();

    if (this.lastOutline) {
      btn.textContent = 'v';
      btn.style.fontSize = '0.5rem';
    } else {
      btn.appendChild(createSvgIcon('M3 4h18v2H3V4zm0 7h12v2H3v-2zm0 7h18v2H3v-2z', { fill: true }));
    }

    return btn;
  }

  private createSchemaButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'devbar-tooltip devbar-tooltip-right';

    const tooltip = this.lastSchema
      ? `Schema saved to:\n${this.lastSchema}`
      : `Page Schema\n\nView JSON-LD, Open Graph, and\nother structured data.`;
    btn.setAttribute('data-tooltip', tooltip);

    const isActive = this.showSchemaModal || !!this.lastSchema;
    Object.assign(btn.style, getButtonStyles(BUTTON_COLORS.schema, isActive, false));
    btn.onclick = () => this.handlePageSchema();

    if (this.lastSchema) {
      btn.textContent = 'v';
      btn.style.fontSize = '0.5rem';
    } else {
      btn.appendChild(createSvgIcon(
        'M4 18v-3.7a1.5 1.5 0 00-1.5-1.5H2v-1.6h.5A1.5 1.5 0 004 9.7V6a2 2 0 012-2h1v2H6v4.3a1.5 1.5 0 01-1.5 1.5v.4A1.5 1.5 0 016 13.7V18h1v2H6a2 2 0 01-2-2zm16 0v-3.7a1.5 1.5 0 011.5-1.5H22v-.4a1.5 1.5 0 01-1.5-1.5V6h1V4h-1a2 2 0 00-2 2v3.7a1.5 1.5 0 001.5 1.5h.5v1.6h-.5a1.5 1.5 0 00-1.5 1.5V18a2 2 0 002 2h1v-2h-1z',
        { fill: true }
      ));
    }

    return btn;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

// Use window-based global to survive HMR (Hot Module Replacement)
const DEVBAR_GLOBAL_KEY = '__YTSPAR_DEVBAR_INSTANCE__';

function getGlobalInstance(): GlobalDevBar | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as Record<string, GlobalDevBar | null>)[DEVBAR_GLOBAL_KEY] ?? null;
}

function setGlobalInstance(instance: GlobalDevBar | null): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, GlobalDevBar | null>)[DEVBAR_GLOBAL_KEY] = instance;
}

/**
 * Initialize and mount the GlobalDevBar
 *
 * HMR-safe: Uses window-based global that survives module reloads.
 * If an instance already exists, it will be destroyed and recreated.
 */
export function initGlobalDevBar(options?: GlobalDevBarOptions): GlobalDevBar {
  const existing = getGlobalInstance();
  if (existing) {
    // Check if already initialized with same position - skip re-init during HMR
    const existingPosition = existing['options']?.position ?? 'bottom-left';
    const newPosition = options?.position ?? 'bottom-left';
    if (existingPosition === newPosition) {
      return existing;
    }
    // Position changed, destroy and recreate
    existing.destroy();
    setGlobalInstance(null);
  }
  const instance = new GlobalDevBar(options);
  instance.init();
  setGlobalInstance(instance);
  return instance;
}

/**
 * Get the current GlobalDevBar instance
 */
export function getGlobalDevBar(): GlobalDevBar | null {
  return getGlobalInstance();
}

/**
 * Destroy the GlobalDevBar
 */
export function destroyGlobalDevBar(): void {
  const instance = getGlobalInstance();
  if (instance) {
    instance.destroy();
    setGlobalInstance(null);
  }
}

// Re-export console capture for external use
export { earlyConsoleCapture };
