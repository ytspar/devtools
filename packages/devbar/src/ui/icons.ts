/**
 * DevBar Icons
 *
 * SVG icon creation utilities for the DevBar UI.
 */

/**
 * Create an SVG icon element with the given path data
 */
export function createSvgIcon(
  pathData: string,
  options: {
    viewBox?: string;
    fill?: boolean;
    stroke?: boolean;
  }
): SVGSVGElement {
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
