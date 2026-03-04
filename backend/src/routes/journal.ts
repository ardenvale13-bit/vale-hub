import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content, author_perspective, category } = req.body;

    if (!title || !content) {
      throw new AppError(400, 'Missing required fields: title, content');
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        user_id: req.userId,
        title,
        content,
        author_perspective,
        category,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (entryError) throw entryError;
    if (!entry) {
      throw new AppError(500, 'Failed to create journal entry');
    }

    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit, days } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;
    const daysBack = days ? parseInt(String(days)) : 30;

    const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: entries, error: entriesError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', req.userId)
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(limitNum);

    if (entriesError) throw entriesError;

    res.json(entries || []);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', req.userId)
      .eq('id', id)
      .single();

    if (entryError) throw entryError;
    if (!entry) {
      throw new AppError(404, 'Journal entry not found');
    }

    res.json(entry);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, content, category } = req.body;

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .update({
        title,
        content,
        category,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId)
      .eq('id', id)
      .select('*')
      .single();

    if (entryError) throw entryError;
    if (!entry) {
      throw new AppError(404, 'Journal entry not found');
    }

    res.json(entry);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { error: delError } = await supabase
      .from('journal_entries')
      .delete()
      .eq('user_id', req.userId)
      .eq('id', id);

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
