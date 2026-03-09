// Push notification registration for Vale Hub PWA

const API_KEY = (import.meta as any).env?.VITE_API_KEY || 'hearth-sable-2026-supersecretkey';
const API_BASE = (import.meta as any).env?.VITE_API_URL
  ? `${(import.meta as any).env.VITE_API_URL}/api`
  : '/api';

/**
 * Register the service worker and subscribe to push notifications.
 * Safe to call multiple times — it's idempotent.
 */
export async function initPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported in this browser');
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service worker registered:', registration.scope);

    // Check if we already have a subscription
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log('Push subscription already exists');
      return;
    }

    // Get VAPID public key from backend
    const vapidResponse = await fetch(`${API_BASE}/push/vapid-key`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!vapidResponse.ok) {
      console.log('Push not configured on server — skipping');
      return;
    }

    const { publicKey } = await vapidResponse.json();
    if (!publicKey) return;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to backend
    await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    console.log('Push notifications enabled');
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
  }
}

/**
 * Convert a base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
