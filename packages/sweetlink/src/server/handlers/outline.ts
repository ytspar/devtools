/**
 * Outline Handler
 *
 * Handles saving document outlines to the file system.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  generateSlugFromUrl,
  generateBaseFilename,
  SCREENSHOT_DIR,
} from '../../urlUtils.js';
import { getProjectRoot } from '../index.js';

export interface OutlineSaveResult {
  outlinePath: string;
}

/**
 * Handle document outline save: saves the outline as markdown to the screenshots folder
 */
export async function handleSaveOutline(data: {
  outline: unknown[];
  markdown: string;
  url: string;
  title: string;
  timestamp: number;
}): Promise<OutlineSaveResult> {
  const { markdown, url, title, timestamp } = data;

  // Create directory if it doesn't exist (relative to project root captured at server start)
  const dir = join(getProjectRoot(), SCREENSHOT_DIR);
  await fs.mkdir(dir, { recursive: true });

  // Generate a slug from URL path or title and create filename with shared utility
  const slug = generateSlugFromUrl(url, title);
  const baseFilename = generateBaseFilename('outline', timestamp, slug);

  // Build the outline markdown file with frontmatter
  const outlineMarkdown = `---
title: ${title || 'Document Outline'}
url: ${url}
timestamp: ${new Date(timestamp).toISOString()}
---

# Document Outline

> Page: ${title || url}
> Generated: ${new Date(timestamp).toLocaleString()}

${markdown || '_No headings found in this document_'}
`;

  // Save the outline markdown
  const outlinePath = join(dir, `${baseFilename}.md`);
  await fs.writeFile(outlinePath, outlineMarkdown, 'utf-8');
  console.log(`[Sweetlink] Document outline saved: ${outlinePath}`);

  return { outlinePath };
}
