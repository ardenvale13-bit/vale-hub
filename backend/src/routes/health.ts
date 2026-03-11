import { Router } from 'express';
import { healthService } from '../services/health.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

interface AuthenticatedRequest extends Express.Request {
  userId: string;
  [key: string]: any;
}

// GET /api/health/recent?days=7
router.get('/recent', async (req: any, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const data = await healthService.getRecent(req.userId, days);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to get recent health data' });
  }
});

// GET /api/health/day/:date
router.get('/day/:date', async (req: any, res) => {
  try {
    const data = await healthService.getDay(req.userId, req.params.date);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to get day data' });
  }
});

// GET /api/health/range?start=2026-03-01&end=2026-03-12&category=sleep
router.get('/range', async (req: any, res) => {
  try {
    const { start, end, category } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
    const data = await healthService.getRange(req.userId, start as string, end as string, category as string);
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to get range data' });
  }
});

// POST /api/health/entry — manual upsert of a single health entry
router.post('/entry', async (req: any, res) => {
  try {
    const { date, source, category, data } = req.body;
    if (!date || !category) return res.status(400).json({ error: 'date and category required' });
    const entry = await healthService.upsert(req.userId, {
      date,
      source: source || 'manual',
      category,
      data: data || {},
    });
    res.json(entry);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to save health entry' });
  }
});

// POST /api/health/sync/vale-tracker — bulk sync Vale Tracker data
router.post('/sync/vale-tracker', async (req: any, res) => {
  try {
    const { data: valeData } = req.body;
    if (!valeData) return res.status(400).json({ error: 'data field required with Vale Tracker JSON' });
    const result = await healthService.syncValeTracker(req.userId, valeData);
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to sync Vale Tracker data' });
  }
});

// POST /api/health/sync/fitbit-sleep — bulk sync Fitbit sleep data
router.post('/sync/fitbit-sleep', async (req: any, res) => {
  try {
    const { sleep } = req.body;
    if (!sleep || !Array.isArray(sleep)) return res.status(400).json({ error: 'sleep array required' });
    const result = await healthService.syncFitbitSleep(req.userId, sleep);
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to sync Fitbit sleep data' });
  }
});

// DELETE /api/health/:id
router.delete('/:id', async (req: any, res) => {
  try {
    await healthService.delete(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to delete health entry' });
  }
});

export default router;
