/**
 * Document Outline Extraction
 *
 * Functions for extracting and formatting the semantic document outline.
 */

import type { OutlineNode } from './types.js';

// ============================================================================
// Semantic Element Sets
// ============================================================================

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the semantic category for an element tag
 */
function getSemanticCategory(tag: string): string {
  if (headingElements.has(tag)) return 'heading';
  if (['article', 'section', 'aside', 'nav'].includes(tag)) return 'sectioning';
  if (['main', 'header', 'footer'].includes(tag)) return 'landmark';
  if (['figure', 'figcaption', 'details', 'summary'].includes(tag)) return 'grouping';
  if (['form', 'fieldset', 'legend'].includes(tag)) return 'form';
  if (['table', 'thead', 'tbody', 'tfoot', 'caption'].includes(tag)) return 'table';
  if (['ul', 'ol', 'dl', 'menu'].includes(tag)) return 'list';
  return 'other';
}

/**
 * Get descriptive text for an element
 */
function getElementText(el: Element, tagName: string): string {
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
}

/**
 * Check if an element is visible
 */
function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Recursively extract outline nodes from an element
 */
function extractFromElement(root: Element): OutlineNode[] {
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
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Extract the document outline from the page
 */
export function extractDocumentOutline(): OutlineNode[] {
  const body = document.body;
  if (!body) return [];

  return extractFromElement(body);
}

/**
 * Convert an outline to markdown format
 */
export function outlineToMarkdown(outline: OutlineNode[], indent = 0): string {
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
