import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

// List desk items — unread first, then by date
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const unreadOnly = req.query.unread === 'true';

    let query = supabase
      .from('lincoln_desk')
      .select('*')
      .eq('user_id', req.userId)
      .order('read', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to load desk items: ${error.message}`);
    res.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Get unread count
router.get('/unread-count', async (req: AuthenticatedRequest, res) => {
  try {
    const { count, error } = await supabase
      .from('lincoln_desk')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('read', false);

    if (error) throw new AppError(500, `Failed to count unread: ${error.message}`);
    res.json({ count: count || 0 });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Create a desk item (used by MCP tool or API)
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { type, title, content, metadata } = req.body;
    if (!content?.trim()) throw new AppError(400, 'content is required');

    const validTypes = ['note', 'song', 'quote', 'nudge', 'observation', 'question'];
    const itemType = validTypes.includes(type) ? type : 'note';

    const { data, error } = await supabase
      .from('lincoln_desk')
      .insert({
        user_id: req.userId,
        type: itemType,
        title: title?.trim() || null,
        content: content.trim(),
        metadata: metadata || null,
        read: false,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, `Failed to create desk item: ${error.message}`);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Mark item as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('lincoln_desk')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*')
      .single();

    if (error) throw new AppError(500, `Failed to mark as read: ${error.message}`);
    if (!data) throw new AppError(404, 'Item not found');
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Mark all as read
router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  try {
    const { error } = await supabase
      .from('lincoln_desk')
      .update({ read: true })
      .eq('user_id', req.userId)
      .eq('read', false);

    if (error) throw new AppError(500, `Failed to mark all read: ${error.message}`);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// Delete item
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { error } = await supabase
      .from('lincoln_desk')
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
