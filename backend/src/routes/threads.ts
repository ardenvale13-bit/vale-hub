import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const MAX_THREADS = 5;

// GET /api/chat/threads — list all threads
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('chat_threads')
      .select('id, name, created_at, updated_at')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false });

    if (error) throw new AppError(500, error.message);
    res.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/chat/threads — create a new thread
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const env = getEnv();

    // Check limit
    const { count } = await supabase
      .from('chat_threads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    if ((count || 0) >= MAX_THREADS) {
      throw new AppError(400, `Maximum of ${MAX_THREADS} threads allowed. Delete one to create a new one.`);
    }

    const name = req.body?.name || `Chat ${(count || 0) + 1}`;
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({ user_id: env.SINGLE_USER_ID, name })
      .select('id, name, created_at, updated_at')
      .single();

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/chat/threads/:threadId — rename a thread
router.patch('/:threadId', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { name } = req.body;
    if (!name?.trim()) throw new AppError(400, 'name is required');

    const { data, error } = await supabase
      .from('chat_threads')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.params.threadId)
      .eq('user_id', req.userId)
      .select('id, name, created_at, updated_at')
      .single();

    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, 'Thread not found');
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/chat/threads/:threadId — delete thread + its messages
router.delete('/:threadId', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();

    // Delete messages in this thread first
    await supabase
      .from('chat_messages')
      .delete()
      .eq('thread_id', req.params.threadId);

    // Delete thread
    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', req.params.threadId)
      .eq('user_id', req.userId);

    if (error) throw new AppError(500, error.message);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
