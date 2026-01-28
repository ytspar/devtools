#!/usr/bin/env node
/**
 * Setup script to symlink shared Claude context files to the consuming project
 *
 * This script runs as postinstall and creates symlinks from the project's
 * .claude/context/ directory to the shared context files in this package.
 *
 * Symlinks are relative paths so they work across different environments.
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find the consuming project's root (where node_modules is)
// We're at: node_modules/@ytspar/sweetlink/scripts/
const packageRoot = join(__dirname, '..');
const nodeModules = join(packageRoot, '..', '..', '..');
const projectRoot = join(nodeModules, '..');

// Source: this package's claude-context/
const sourceDir = join(packageRoot, 'claude-context');

// Target: project's .claude/context/
const targetDir = join(projectRoot, '.claude', 'context');

// Files to symlink (add more as needed)
const filesToLink = [
  'ui-verification-mandate.md',
  'debugging-protocol.md',
  'sweetlink-architecture.md',
  'component-development-guide.md',
];

function setupSymlinks() {
  // Skip if running in the tools repo itself (during development)
  if (projectRoot.includes('ytspar/devtools')) {
    return;
  }

  // Check if source directory exists
  if (!existsSync(sourceDir)) {
    // claude-context not built yet, skip silently
    return;
  }

  // Check if project has .claude directory (indicates Claude Code project)
  const claudeDir = join(projectRoot, '.claude');
  if (!existsSync(claudeDir)) {
    // Not a Claude Code project, skip silently
    return;
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  console.log('[@ytspar/sweetlink] Setting up Claude context symlinks...');

  for (const file of filesToLink) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    // Skip if source doesn't exist
    if (!existsSync(sourcePath)) {
      continue;
    }

    // Calculate relative path for symlink
    const relativePath = relative(targetDir, sourcePath);

    // Check if symlink already exists and points to correct location
    if (existsSync(targetPath)) {
      try {
        const currentLink = readlinkSync(targetPath);
        if (currentLink === relativePath) {
          continue; // Already correct
        }
        // Remove incorrect symlink
        unlinkSync(targetPath);
      } catch {
        // Not a symlink - don't overwrite user's files
        console.log(`  [skip] ${file} - file exists (not a symlink)`);
        continue;
      }
    }

    // Create symlink
    try {
      symlinkSync(relativePath, targetPath);
      console.log(`  [link] ${file}`);
    } catch (err) {
      console.error(`  [error] ${file} - ${err.message}`);
    }
  }
}

setupSymlinks();
