import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility to get the correct WebSocket URL based on the environment.
 */
export const getWebSocketUrl = (path: string): string | null => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isVercel = window.location.hostname.includes('vercel.app');

  // Vercel Serverless doesn't support WebSockets, so we return null to avoid console errors.
  // The app has a fallback polling mechanism (setInterval) that will keep it working.
  if (isVercel) {
    console.log("WebSocket connection skipped: Not supported on Vercel Serverless. Polling fallback is active.");
    return null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // In local development, the backend usually runs on port 8000
  const host = isLocalhost ? 'localhost:8000' : window.location.host;
  
  return `${protocol}//${host}${path}`;
};
