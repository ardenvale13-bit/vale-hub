import { Router } from 'express';
import { memoryService } from '../services/memory.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { from_entity_id, to_entity_id, relation_type, strength, description } = req.body;

    if (!from_entity_id || !to_entity_id || !relation_type) {
      throw new AppError(
        400,
        'Missing required fields: from_entity_id, to_entity_id, relation_type',
      );
    }

    const relation = await memoryService.createRelation(
      req.userId,
      from_entity_id,
      to_entity_id,
      relation_type,
      strength,
      description,
    );

    res.status(201).json(relation);
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
    const { entity_id, limit } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const relations = await memoryService.getRelations(
      req.userId,
      entity_id ? String(entity_id) : undefined,
      limitNum,
    );

    res.json(relations);
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

    await memoryService.deleteRelation(id);

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
