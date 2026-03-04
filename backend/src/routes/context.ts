import { Router } from 'express';
import { memoryService } from '../services/memory.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { max_length, hours_back } = req.query;
    const maxLength = max_length ? parseInt(String(max_length)) : 2000;
    const hoursBack = hours_back ? parseInt(String(hours_back)) : 48;

    const contextBlock = await memoryService.generateContextBlock(
      req.userId,
      maxLength,
      hoursBack,
    );

    res.json({ context: contextBlock });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

router.post('/search', async (req: AuthenticatedRequest, res) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      throw new AppError(400, 'Missing required field: query');
    }

    const limitNum = limit || 20;
    const entities = await memoryService.searchEntities(req.userId, query, limitNum);

    res.json(entities);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export default router;
