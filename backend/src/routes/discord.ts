import { Router, Request, Response, NextFunction } from 'express';
import { discordService } from '../services/discord.service.js';
import { getEnv } from '../config/env.js';

const router = Router();

// POST /api/discord/connect — Connect bot with token
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const { bot_token } = req.body;

    if (!bot_token) {
      return res.status(400).json({ error: 'bot_token is required' });
    }

    const result = await discordService.connect(userId, bot_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/discord/disconnect — Disconnect the bot
router.post('/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const result = await discordService.disconnect(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/discord/reconnect — Auto-reconnect using stored token
router.post('/reconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const result = await discordService.autoReconnect(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/discord/status — Check connection status
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = discordService.getStatus();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/discord/send — Send a message to a channel
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const userId = env.SINGLE_USER_ID;
    const { channel_id, content, reply_to } = req.body;

    if (!channel_id || !content) {
      return res.status(400).json({ error: 'channel_id and content are required' });
    }

    const result = await discordService.sendMessage(userId, channel_id, content, {
      replyTo: reply_to,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/discord/messages/:channelId — Read messages from a channel
router.get('/messages/:channelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await discordService.readMessages(req.params.channelId, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/discord/guilds — List guilds the bot is in
router.get('/guilds', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await discordService.listGuilds();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/discord/channels/:guildId — List channels in a guild
router.get('/channels/:guildId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await discordService.listChannels(req.params.guildId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/discord/react — React to a message
router.post('/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel_id, message_id, emoji } = req.body;

    if (!channel_id || !message_id || !emoji) {
      return res.status(400).json({ error: 'channel_id, message_id, and emoji are required' });
    }

    const result = await discordService.reactToMessage(channel_id, message_id, emoji);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
