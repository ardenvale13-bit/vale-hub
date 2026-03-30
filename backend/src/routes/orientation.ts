import { Router } from 'express';
import { orientationService } from '../services/orientation.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/orientation
 * Query params:
 *   perspective - Which perspective to orient from (default: Lincoln)
 *   depth - minimal | standard | full | all (default: standard)
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const perspective = String(req.query.perspective || 'Lincoln');
    const depth = String(req.query.depth || 'standard') as 'minimal' | 'standard' | 'full' | 'all';

    const validDepths = ['minimal', 'standard', 'full', 'all'];
    if (!validDepths.includes(depth)) {
      throw new AppError(400, `Invalid depth: '${depth}'. Must be one of: ${validDepths.join(', ')}`);
    }

    const orientation = await orientationService.getOrientation(req.userId, perspective, depth);
    res.json(orientation);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

export default router;
