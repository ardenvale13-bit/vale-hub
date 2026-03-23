import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

// Get the current active question exchange (most recent unanswered, or latest answered)
router.get('/current', async (req: AuthenticatedRequest, res) => {
  try {
    // First: any question waiting for an answer?
    const { data: unanswered } = await supabase
      .from('daily_questions')
      .select('*')
      .eq('user_id', req.userId)
      .is('answer', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (unanswered && unanswered.length > 0) {
      return res.json(unanswered[0]);
    }

    // Otherwise: most recent answered question
    const { data: latest } = await supabase
      .from('daily_questions')
      .select('*')
      .eq('user_id', req.userId)
      .not('answer', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(1);

    res.json(latest?.[0] || null);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// List question history (archive)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;
    const answeredOnly = req.query.answered === 'true';

    let query = supabase
      .from('daily_questions')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (answeredOnly) {
      query = query.not('answer', 'is', null);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);

    // Also get total count
    const { count } = await supabase
      .from('daily_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    res.json({ questions: data || [], total: count || 0 });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Ask a question (Lincoln or Arden posts a question for the other)
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { question, asked_by } = req.body;
    if (!question?.trim()) throw new AppError(400, 'question is required');
    if (!asked_by || !['lincoln', 'arden'].includes(asked_by)) {
      throw new AppError(400, 'asked_by must be lincoln or arden');
    }

    const { data, error } = await supabase
      .from('daily_questions')
      .insert({
        user_id: req.userId,
        question: question.trim(),
        asked_by,
        answer: null,
        answered_by: null,
        answered_at: null,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Answer a question
router.patch('/:id/answer', async (req: AuthenticatedRequest, res) => {
  try {
    const { answer, answered_by } = req.body;
    if (!answer?.trim()) throw new AppError(400, 'answer is required');
    if (!answered_by || !['lincoln', 'arden'].includes(answered_by)) {
      throw new AppError(400, 'answered_by must be lincoln or arden');
    }

    const { data: existing } = await supabase
      .from('daily_questions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!existing) throw new AppError(404, 'Question not found');
    if (existing.answer) throw new AppError(400, 'Question already answered');
    if (existing.asked_by === answered_by) throw new AppError(400, "You can't answer your own question");

    const { data, error } = await supabase
      .from('daily_questions')
      .update({
        answer: answer.trim(),
        answered_by,
        answered_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

export default router;
