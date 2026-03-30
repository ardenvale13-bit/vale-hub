import { Router } from 'express';
import { emotionalService } from '../services/emotional.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/vocabulary', async (req: AuthenticatedRequest, res) => {
  try {
    const { emotion, intensity, primary_context, related_emotions } = req.body;

    if (!emotion || intensity === undefined) {
      throw new AppError(400, 'Missing required fields: emotion, intensity');
    }

    const vocab = await emotionalService.createEmotionVocabulary(
      req.userId,
      emotion,
      intensity,
      primary_context,
      related_emotions,
    );

    res.status(201).json(vocab);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/vocabulary', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const vocabs = await emotionalService.getEmotionVocabulary(req.userId, limitNum);

    res.json(vocabs);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.patch('/vocabulary/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vocab = await emotionalService.updateEmotionVocabulary(req.userId, id, updates);

    res.json(vocab);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.delete('/vocabulary/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    await emotionalService.deleteEmotionVocabulary(req.userId, id);

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.post('/log', async (req: AuthenticatedRequest, res) => {
  try {
    const { emotion, intensity, context, pillar } = req.body;

    if (!emotion || intensity === undefined) {
      throw new AppError(400, 'Missing required fields: emotion, intensity');
    }

    const entry = await emotionalService.logEmotion(req.userId, emotion, intensity, context, pillar);

    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    const { hours_back, limit } = req.query;
    const hoursBack = hours_back ? parseInt(String(hours_back)) : 24;
    const limitNum = limit ? parseInt(String(limit)) : 100;

    const history = await emotionalService.getEmotionHistory(req.userId, hoursBack, limitNum);

    res.json(history);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/analytics', async (req: AuthenticatedRequest, res) => {
  try {
    const { days_back } = req.query;
    const daysBack = days_back ? parseInt(String(days_back)) : 7;

    const analytics = await emotionalService.getEmotionAnalytics(req.userId, daysBack);

    res.json(analytics);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.post('/shadow-moments', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, intensity, patterns } = req.body;

    if (!title || !description || intensity === undefined) {
      throw new AppError(400, 'Missing required fields: title, description, intensity');
    }

    const moment = await emotionalService.createShadowMoment(
      req.userId,
      title,
      description,
      intensity,
      patterns,
    );

    res.status(201).json(moment);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/shadow-moments', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const moments = await emotionalService.getShadowMoments(req.userId, limitNum);

    res.json(moments);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.delete('/shadow-moments/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    await emotionalService.deleteShadowMoment(req.userId, id);

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export default router;
