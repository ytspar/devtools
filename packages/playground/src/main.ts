/**
 * DevTools Playground - Main entry point
 *
 * Initializes the DevBar and renders demo content for testing.
 */

import { initGlobalDevBar } from '@ytspar/devbar';
import { createDemoContent } from './demo-content';

// Initialize DevBar
initGlobalDevBar({
  position: 'bottom-left',
  accentColor: '#10b981',
  showMetrics: {
    breakpoint: true,
    fcp: true,
    lcp: true,
    pageSize: true,
  },
  showScreenshot: true,
  showConsoleBadges: true,
});

// Render demo content
const app = document.getElementById('app');
if (app) {
  app.appendChild(createDemoContent());
}

// Log some sample messages for testing console capture
console.log('[Playground] Application initialized');
console.info('[Playground] DevBar and Sweetlink packages loaded');
