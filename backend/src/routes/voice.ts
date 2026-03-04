import { Router, Request, Response, NextFunction } from 'express';
import { voiceService } from '../services/voice.service.js';
import { getEnv } from '../config/env.js';

const router = Router();

// POST /api/voice/generate — Generate a voice note from text
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const { text, voice_id, perspective, context, model_id, stability, similarity_boost, style } =
      req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required and must be a string' });
    }

    const result = await voiceService.generateVoiceNote(userId, text, {
      voiceId: voice_id,
      perspective,
      context,
      modelId: model_id,
      stability,
      similarityBoost: similarity_boost,
      style,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/voice/notes — List voice notes
router.get('/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const perspective = req.query.perspective as string | undefined;

    const result = await voiceService.listVoiceNotes(userId, { limit, offset, perspective });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/voice/notes/:id — Get a single voice note with playback URL
router.get('/notes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const result = await voiceService.getVoiceNote(userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/voice/notes/:id — Delete a voice note
router.delete('/notes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const result = await voiceService.deleteVoiceNote(userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/voice/voices — List available ElevenLabs voices
router.get('/voices', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await voiceService.listVoices();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
