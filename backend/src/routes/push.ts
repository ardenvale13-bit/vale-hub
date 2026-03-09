import { Router } from 'express';
import { pushService } from '../services/push.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Get VAPID public key — needed by client to subscribe
router.get('/vapid-key', (_req, res) => {
  const key = pushService.getPublicKey();
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: key });
});

// Subscribe to push notifications
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription object' });
    }

    await pushService.saveSubscription(req.userId, subscription);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    await pushService.removeSubscription(endpoint);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove subscription' });
  }
});

export default router;
