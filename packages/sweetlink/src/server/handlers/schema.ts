/**
 * Schema Handler
 *
 * Handles saving page schemas to the file system.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { generateBaseFilename, generateSlugFromUrl, SCREENSHOT_DIR } from '../../urlUtils.js';
import { getProjectRoot } from '../index.js';

export interface SchemaSaveResult {
  schemaPath: string;
}

/**
 * Handle page schema save: saves structured data as markdown to the screenshots folder
 */
export async function handleSaveSchema(data: {
  schema: unknown;
  markdown: string;
  url: string;
  title: string;
  timestamp: number;
}): Promise<SchemaSaveResult> {
  const { schema, markdown, url, title, timestamp } = data;

  // Create directory if it doesn't exist (relative to project root captured at server start)
  const dir = join(getProjectRoot(), SCREENSHOT_DIR);
  await fs.mkdir(dir, { recursive: true });

  // Generate a slug from URL path or title and create filename with shared utility
  const slug = generateSlugFromUrl(url, title);
  const baseFilename = generateBaseFilename('schema', timestamp, slug);

  // Build the schema markdown file with frontmatter
  const schemaMarkdown = `---
title: ${title || 'Page Schema'}
url: ${url}
timestamp: ${new Date(timestamp).toISOString()}
---

# Page Schema

> Page: ${title || url}
> Generated: ${new Date(timestamp).toLocaleString()}

${markdown || '_No structured data found on this page_'}

---

## Raw JSON

\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
`;

  // Save the schema markdown
  const schemaPath = join(dir, `${baseFilename}.md`);
  await fs.writeFile(schemaPath, schemaMarkdown, 'utf-8');
  console.log(`[Sweetlink] Page schema saved: ${schemaPath}`);

  return { schemaPath };
}
