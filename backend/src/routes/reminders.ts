import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

// Get due reminders (scheduled_for <= now, not dismissed)
router.get('/due', async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', req.userId)
      .eq('dismissed', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: false })
      .limit(20);

    if (error) throw new AppError(500, `Failed to load due reminders: ${error.message}`);
    res.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// List all reminders (upcoming + recent dismissed)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const upcoming = req.query.upcoming === 'true';

    let query = supabase
      .from('reminders')
      .select('*')
      .eq('user_id', req.userId)
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (upcoming) {
      query = query.eq('dismissed', false);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to list reminders: ${error.message}`);
    res.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Create a reminder
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { content, scheduled_for, from_perspective, category } = req.body;
    if (!content?.trim()) throw new AppError(400, 'content is required');
    if (!scheduled_for) throw new AppError(400, 'scheduled_for is required');

    const scheduledDate = new Date(scheduled_for);
    if (isNaN(scheduledDate.getTime())) throw new AppError(400, 'Invalid date for scheduled_for');

    const validCategories = ['care', 'task', 'fun', 'love', 'health', 'general'];
    const cat = validCategories.includes(category) ? category : 'general';

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: req.userId,
        content: content.trim(),
        scheduled_for: scheduledDate.toISOString(),
        from_perspective: from_perspective || 'Lincoln',
        category: cat,
        dismissed: false,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, `Failed to create reminder: ${error.message}`);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Dismiss a reminder
router.patch('/:id/dismiss', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update({ dismissed: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*')
      .single();

    if (error) throw new AppError(500, `Failed to dismiss reminder: ${error.message}`);
    if (!data) throw new AppError(404, 'Reminder not found');
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Dismiss all due reminders
router.post('/dismiss-all', async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('reminders')
      .update({ dismissed: true })
      .eq('user_id', req.userId)
      .eq('dismissed', false)
      .lte('scheduled_for', now);

    if (error) throw new AppError(500, `Failed to dismiss all: ${error.message}`);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Delete a reminder
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw new AppError(500, `Failed to delete: ${error.message}`);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
