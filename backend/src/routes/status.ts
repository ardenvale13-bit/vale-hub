import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { category, key, value } = req.body;

    if (!category || !key || value === undefined) {
      throw new AppError(400, 'Missing required fields: category, key, value');
    }

    const now = new Date().toISOString();

    const { data: status, error: statusError } = await supabase
      .from('statuses')
      .upsert(
        {
          user_id: req.userId,
          category,
          key,
          value,
          updated_at: now,
        },
        { onConflict: 'user_id,category,key' },
      )
      .select('*')
      .single();

    if (statusError) throw statusError;
    if (!status) {
      throw new AppError(500, 'Failed to set status');
    }

    // Log to history (fire and forget)
    supabase
      .from('status_history')
      .insert({
        user_id: req.userId,
        category,
        key,
        value,
        recorded_at: now,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to log status history:', error);
      });

    res.status(201).json(status);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

// GET /status/history — last 24h of status changes
router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    const hoursBack = parseInt(req.query.hours_back as string) || 24;
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: history, error: histError } = await supabase
      .from('status_history')
      .select('*')
      .eq('user_id', req.userId)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: false });

    if (histError) throw histError;

    res.json(history || []);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: statuses, error: statusError } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', req.userId);

    if (statusError) throw statusError;

    res.json(statuses || []);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/:category/:key', async (req: AuthenticatedRequest, res) => {
  try {
    const { category, key } = req.params;

    const { data: status, error: statusError } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', req.userId)
      .eq('category', category)
      .eq('key', key)
      .single();

    if (statusError && statusError.code !== 'PGRST116') throw statusError;
    if (!status) {
      throw new AppError(404, 'Status not found');
    }

    res.json(status);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.delete('/:category/:key', async (req: AuthenticatedRequest, res) => {
  try {
    const { category, key } = req.params;

    const { error: delError } = await supabase
      .from('statuses')
      .delete()
      .eq('user_id', req.userId)
      .eq('category', category)
      .eq('key', key);

    if (delError) throw delError;

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export default router;
