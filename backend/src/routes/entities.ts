import { Router } from 'express';
import { memoryService } from '../services/memory.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, entity_type, observations, context, salience, visibility } = req.body;

    if (!name || !entity_type) {
      throw new AppError(400, 'Missing required fields: name, entity_type');
    }

    const entity = await memoryService.createEntity(
      req.userId,
      name,
      entity_type,
      observations,
      context,
      salience,
      visibility,
    );

    res.status(201).json(entity);
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

    const entity = await memoryService.getEntity(req.userId, id);

    res.json(entity);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const entities = await memoryService.listEntities(req.userId, limitNum);

    res.json(entities);
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
    const updates = req.body;

    const entity = await memoryService.updateEntity(req.userId, id, updates);

    res.json(entity);
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

    await memoryService.deleteEntity(req.userId, id);

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export default router;
