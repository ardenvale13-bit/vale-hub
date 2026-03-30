import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner_perspective, key, value, category } = req.body;

    if (!owner_perspective || !key || value === undefined) {
      throw new AppError(400, 'Missing required fields: owner_perspective, key, value');
    }

    // category is NOT NULL in schema, default to 'general' if not provided
    const resolvedCategory = category || 'general';

    const { data: identity, error: identityError } = await supabase
      .from('identity_store')
      .upsert(
        {
          user_id: req.userId,
          owner_perspective,
          key,
          value,
          category: resolvedCategory,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,owner_perspective,category,key' },
      )
      .select('*')
      .single();

    if (identityError) throw identityError;
    if (!identity) {
      throw new AppError(500, 'Failed to set identity value');
    }

    res.status(201).json(identity);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner_perspective } = req.query;

    let query = supabase
      .from('identity_store')
      .select('*')
      .eq('user_id', req.userId);

    if (owner_perspective) {
      query = query.eq('owner_perspective', String(owner_perspective));
    }

    const { data: identities, error: identityError } = await query;

    if (identityError) throw identityError;

    res.json(identities || []);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/:owner_perspective/:key', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner_perspective, key } = req.params;

    const { data: identity, error: identityError } = await supabase
      .from('identity_store')
      .select('*')
      .eq('user_id', req.userId)
      .eq('owner_perspective', owner_perspective)
      .eq('key', key)
      .single();

    if (identityError && identityError.code !== 'PGRST116') throw identityError;
    if (!identity) {
      throw new AppError(404, 'Identity value not found');
    }

    res.json(identity);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.patch('/:owner_perspective/:key', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner_perspective, key } = req.params;
    const { value, category } = req.body;

    if (value === undefined) {
      throw new AppError(400, 'Missing required field: value');
    }

    const { data: identity, error: identityError } = await supabase
      .from('identity_store')
      .update({
        value,
        category,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId)
      .eq('owner_perspective', owner_perspective)
      .eq('key', key)
      .select('*')
      .single();

    if (identityError) throw identityError;
    if (!identity) {
      throw new AppError(404, 'Identity value not found');
    }

    res.json(identity);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.delete('/:owner_perspective/:key', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner_perspective, key } = req.params;

    const { error: delError } = await supabase
      .from('identity_store')
      .delete()
      .eq('user_id', req.userId)
      .eq('owner_perspective', owner_perspective)
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
