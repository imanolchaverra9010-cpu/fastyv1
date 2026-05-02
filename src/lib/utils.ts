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

/**
 * Utility for Push Notifications
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) return new Uint8Array(0);
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPush(userId: number) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if we already have a subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      if (!VAPID_PUBLIC_KEY) {
        console.warn('VITE_VAPID_PUBLIC_KEY is not defined');
        return false;
      }
      // Subscribe the user
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Send the subscription to the backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        subscription: subscription
      }),
    });

    return true;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return false;
  }
}

/**
 * Checks if the current time in Bogotá is between 7:00 PM and 6:00 AM
 */
export function isNightFeeTime() {
  const now = new Date();
  const bogotaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const hours = bogotaTime.getHours();
  // 7 PM (19:00) until 6 AM
  return hours >= 19 || hours < 6;
}

