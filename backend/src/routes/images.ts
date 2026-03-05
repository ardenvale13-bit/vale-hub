import { Router } from 'express';
import { imageService } from '../services/image.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Generate a new image
router.post('/generate', async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt, model, size, quality, style } = req.body;

    if (!prompt) {
      throw new AppError(400, 'Missing required field: prompt');
    }

    const image = await imageService.generateImage(req.userId, prompt, {
      model,
      size,
      quality,
      style,
    });

    res.status(201).json(image);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// List image generations
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 20;

    const images = await imageService.listImages(req.userId, limitNum);
    res.json(images);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Get single image with fresh signed URL
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const image = await imageService.getImage(req.userId, id);
    res.json(image);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Delete an image
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await imageService.deleteImage(req.userId, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

export default router;
