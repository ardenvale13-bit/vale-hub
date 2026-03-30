import { Router } from 'express';
import { memoryService } from '../services/memory.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    // Accept both 'entity_id' (backend/MCP) and 'entityName' (frontend)
    const { entity_id, entityName, observation } = req.body;
    const entityRef = entity_id || entityName;

    if (!entityRef || !observation) {
      throw new AppError(400, 'Missing required fields: entity_id (or entityName), observation');
    }

    // addObservation already handles both UUID and name lookups
    const obs = await memoryService.addObservation(req.userId, entityRef, observation);

    res.status(201).json(obs);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

router.get('/:entity_id', async (req: AuthenticatedRequest, res) => {
  try {
    const { entity_id } = req.params;
    const { limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const observations = await memoryService.getObservations(entity_id, limitNum);

    res.json(observations);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new AppError(400, 'Missing required field: content');
    }

    const obs = await memoryService.editObservation(id, content, req.userId);

    res.json(obs);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    await memoryService.deleteObservation(id);

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
