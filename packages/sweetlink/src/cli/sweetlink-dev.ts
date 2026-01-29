#!/usr/bin/env node

/**
 * Sweetlink Development Server
 *
 * Starts the WebSocket server for Sweetlink in development mode.
 * Run alongside the Remix dev server.
 *
 * Environment variables:
 * - SWEETLINK_WS_PORT: WebSocket server port (default: 9223)
 * - PORT: Associated app port for origin validation (optional)
 * - ANTHROPIC_API_KEY: Required for AI design review feature
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load .env from the project directory (cwd)
config({ path: join(process.cwd(), '.env') });

import { closeSweetlink, initSweetlink } from '../server.js';

const port = parseInt(process.env.SWEETLINK_WS_PORT || '9223', 10);
const appPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;

console.log('[Sweetlink] Starting development server...');
console.log(`[Sweetlink] Project directory: ${process.cwd()}`);

initSweetlink({ port, appPort });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Sweetlink] SIGTERM signal received: closing WebSocket server');
  closeSweetlink();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Sweetlink] SIGINT signal received: closing WebSocket server');
  closeSweetlink();
  process.exit(0);
});

// Keep the process running
console.log('[Sweetlink] Server running. Press Ctrl+C to stop.');
