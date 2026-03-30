import webpush from 'web-push';
import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';

const supabase = getSupabaseClient();

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushService {
  private initialized = false;

  private init() {
    if (this.initialized) return;
    const env = getEnv();

    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      console.warn('VAPID keys not configured — push notifications disabled');
      return;
    }

    webpush.setVapidDetails(
      'mailto:ardenvale13@gmail.com',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );

    this.initialized = true;
  }

  /**
   * Save a push subscription for a user.
   */
  async saveSubscription(userId: string, subscription: PushSubscriptionData): Promise<void> {
    // Upsert by endpoint — one device = one subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: 'endpoint' },
      );

    if (error) {
      console.error('Failed to save push subscription:', error.message);
      throw error;
    }
  }

  /**
   * Remove a push subscription.
   */
  async removeSubscription(endpoint: string): Promise<void> {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }

  /**
   * Send a push notification to all subscriptions for a user.
   */
  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      tag?: string;
      url?: string;
      actions?: Array<{ action: string; title: string }>;
    },
  ): Promise<number> {
    this.init();
    if (!this.initialized) return 0;

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error || !subs || subs.length === 0) return 0;

    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err: any) {
        // 410 Gone or 404 = subscription expired, clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint);
        } else {
          console.error('Push send failed:', err.message);
        }
      }
    }

    // Clean up expired subscriptions
    if (stale.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale);
    }

    return sent;
  }

  /**
   * Get the VAPID public key for client-side subscription.
   */
  getPublicKey(): string | null {
    const env = getEnv();
    return env.VAPID_PUBLIC_KEY || null;
  }
}

export const pushService = new PushService();
