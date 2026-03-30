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

// Get latest dashboard image (must be before /:id)
router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  try {
    const image = await imageService.getDashboardImage(req.userId);
    if (!image) {
      return res.json({ image: null });
    }
    res.json({ image });
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

// Upload an image (base64 in JSON body)
router.post('/upload', async (req: AuthenticatedRequest, res) => {
  try {
    const { image, caption, tag, filename, mimeType } = req.body;

    if (!image) {
      throw new AppError(400, 'Missing required field: image (base64 string)');
    }

    const result = await imageService.uploadImage(req.userId, image, {
      filename,
      caption,
      tag: tag || 'general',
      mimeType,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Delete an uploaded image (media record)
router.delete('/uploaded/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await imageService.deleteUploadedImage(req.userId, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Delete an image generation
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
