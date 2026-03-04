import { Router } from 'express';
import { memoryService } from '../services/memory.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    // Accept both 'type' (frontend) and 'entity_type' (backend/MCP)
    const { name, entity_type, type, observations, context, salience, visibility } = req.body;
    const entityType = entity_type || type;

    if (!name || !entityType) {
      throw new AppError(400, 'Missing required fields: name, entity_type (or type)');
    }

    const entity = await memoryService.createEntity(
      req.userId,
      name,
      entityType,
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

// Get entity by ID or name
router.get('/:idOrName', async (req: AuthenticatedRequest, res) => {
  try {
    const { idOrName } = req.params;

    // Try UUID first, then fall back to name lookup
    const entity = await memoryService.getEntityByIdOrName(req.userId, idOrName);

    res.json(entity);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

// Salience counts — must be before /:idOrName to avoid matching "salience-counts" as a name
router.get('/salience-counts', async (req: AuthenticatedRequest, res) => {
  try {
    const counts = await memoryService.getSalienceCounts(req.userId);
    res.json(counts);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit, salience, context } = req.query;
    const limitNum = limit ? parseInt(String(limit)) : 50;

    const entities = await memoryService.listEntities(
      req.userId,
      limitNum,
      salience ? String(salience) : undefined,
      context ? String(context) : undefined,
    );

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

// Delete by ID or name
router.delete('/:idOrName', async (req: AuthenticatedRequest, res) => {
  try {
    const { idOrName } = req.params;

    await memoryService.deleteEntityByIdOrName(req.userId, idOrName);

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export default router;
