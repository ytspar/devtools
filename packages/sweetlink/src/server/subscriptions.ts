/**
 * Subscription Management
 *
 * Handles WebSocket subscription tracking and cleanup.
 */

import type { WebSocket } from 'ws';
import type { LogSubscription, ChannelSubscription } from '../types.js';

// Internal subscription tracking interfaces (include WebSocket reference)
export interface InternalLogSubscription extends LogSubscription {
  clientWs: WebSocket;
}

export interface InternalChannelSubscription extends ChannelSubscription {
  clientWs: WebSocket;
}

// Pending screenshot requests
export interface PendingScreenshotRequest {
  requestId: string;
  clientWs: WebSocket;
  timeout: NodeJS.Timeout;
}

// Subscription maps - exported for use by the main server
export const logSubscriptions = new Map<string, InternalLogSubscription>();
export const channelSubscriptions = new Map<string, InternalChannelSubscription[]>();
export const pendingScreenshotRequests = new Map<string, PendingScreenshotRequest>();

/**
 * Clean up subscriptions when client disconnects
 */
export function cleanupClientSubscriptions(ws: WebSocket): void {
  // Remove from channel subscriptions
  for (const [_channel, subs] of channelSubscriptions) {
    const idx = subs.findIndex(s => s.clientWs === ws);
    if (idx !== -1) {
      subs.splice(idx, 1);
    }
  }

  // Remove log subscriptions
  for (const [id, sub] of logSubscriptions) {
    if (sub.clientWs === ws) {
      logSubscriptions.delete(id);
    }
  }

  // Clear pending screenshot requests
  for (const [id, pending] of pendingScreenshotRequests) {
    if (pending.clientWs === ws) {
      clearTimeout(pending.timeout);
      pendingScreenshotRequests.delete(id);
    }
  }
}
