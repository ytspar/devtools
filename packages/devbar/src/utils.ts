/**
 * DevBar Utility Functions
 *
 * Shared utilities used by the DevBar components.
 */

// ============================================================================
// Console Log Formatting
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
export function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

// ============================================================================
// Canvas Utilities
// ============================================================================

/**
 * Convert a canvas to a data URL
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  options: { format?: 'jpeg' | 'png'; quality?: number } = {}
): string {
  const { format = 'jpeg', quality = 0.7 } = options;
  if (format === 'png') {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

// ============================================================================
// Screenshot Utilities
// ============================================================================

/**
 * Prepare the page for screenshot capture by adding capture class and blurring active element.
 * Returns a cleanup function to restore the page state.
 */
export function prepareForCapture(): () => void {
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
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copy a canvas to the clipboard as a PNG image
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
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
