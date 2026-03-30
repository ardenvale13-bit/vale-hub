import express, { Request, Response } from 'express';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env.js';
import { initializeStorageBuckets } from './config/supabase.js';
import { apiKeyAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import entitiesRouter from './routes/entities.js';
import observationsRouter from './routes/observations.js';
import relationsRouter from './routes/relations.js';
import journalRouter from './routes/journal.js';
import emotionsRouter from './routes/emotions.js';
import statusRouter from './routes/status.js';
import identityRouter from './routes/identity.js';
import contextRouter from './routes/context.js';
import voiceRouter from './routes/voice.js';
import discordRouter from './routes/discord.js';
import orientationRouter from './routes/orientation.js';
import imagesRouter from './routes/images.js';
import pushRouter from './routes/push.js';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import threadsRouter from './routes/threads.js';
import libraryRouter from './routes/library.js';
import spotifyRouter from './routes/spotify.js';
import deskRouter from './routes/desk.js';
import gamesRouter from './routes/games.js';
import questionsRouter from './routes/questions.js';
import remindersRouter from './routes/reminders.js';
import weatherRouter from './routes/weather.js';
import { mcpTools } from './mcp/tools.js';
import { handleToolCall } from './mcp/handlers.js';
import { startReminderScheduler } from './services/reminder.scheduler.js';

const app = express();
const env = getEnv();

app.use(helmet({
  contentSecurityPolicy: false, // Allow SSE connections
}));

// Support multiple CORS origins (comma-separated in env)
const allowedOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (MCP clients, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow exact matches from env
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
    // Allow any Vercel preview/production URL for this project
    if (origin.endsWith('.vercel.app') && origin.includes('arden-vale')) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' })); // Supports base64 book uploads (~18MB raw files)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== MCP SSE TRANSPORT =====
// Implements the MCP SSE transport spec:
// - GET /sse → SSE stream, sends `endpoint` event with POST URL
// - POST /mcp/message?sessionId=xxx → receives JSON-RPC, responds via SSE

// Store active SSE sessions
const sseSessions = new Map<string, Response>();

// SSE endpoint — client connects here first
app.get('/sse', (req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Store the SSE connection
  sseSessions.set(sessionId, res);

  // Send the endpoint event — tells the client where to POST messages
  const messageUrl = `/mcp/message?sessionId=${sessionId}`;
  res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    sseSessions.delete(sessionId);
    console.log(`MCP SSE session ${sessionId} disconnected`);
  });

  console.log(`MCP SSE session ${sessionId} connected`);
});

// Handle JSON-RPC messages from MCP clients
async function handleMcpMessage(body: any): Promise<any> {
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  // Initialize handshake
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'vale',
          version: '0.1.0',
        },
      },
    };
  }

  // Notifications (no response needed)
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null; // No response for notifications
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: mcpTools },
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params;
    try {
      const result = await handleToolCall(name, toolArgs || {});

      // Build content blocks — start with text
      const content: any[] = [{ type: 'text', text: JSON.stringify(result) }];

      // If result contains _image_url fields, fetch and embed as viewable images
      try {
        const imageUrls: { url: string; label: string }[] = [];
        function findImageUrls(obj: any, path: string) {
          if (!obj || typeof obj !== 'object') return;
          if (obj._image_url && typeof obj._image_url === 'string') {
            imageUrls.push({ url: obj._image_url, label: path });
          }
          for (const [k, v] of Object.entries(obj)) {
            if (k !== '_image_url') findImageUrls(v, `${path}.${k}`);
          }
        }
        findImageUrls(result, 'result');

        for (const { url } of imageUrls) {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const contentType = imgRes.headers.get('content-type') || 'image/png';
            const mimeType = contentType.split(';')[0].trim();
            content.push({ type: 'image', data: buffer.toString('base64'), mimeType });
          }
        }
      } catch { /* image embedding is best-effort */ }

      return {
        jsonrpc: '2.0',
        id,
        result: { content },
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id: id || null,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// POST endpoint for MCP messages (SSE transport)
app.post('/mcp/message', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const sseRes = sessionId ? sseSessions.get(sessionId) : null;

  const response = await handleMcpMessage(req.body);

  if (sseRes && response) {
    // Send response through SSE stream
    sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    res.status(202).json({ ok: true });
  } else if (response) {
    // Fallback: direct HTTP response (for non-SSE clients)
    res.json(response);
  } else {
    // Notification — no response needed
    res.status(202).json({ ok: true });
  }
});

// Legacy direct POST endpoint (still works for simple HTTP clients)
app.post('/mcp', async (req: Request, res: Response) => {
  const response = await handleMcpMessage(req.body);
  if (response) {
    res.json(response);
  } else {
    res.status(202).json({ ok: true });
  }
});

app.use('/api/entities', apiKeyAuth, entitiesRouter);
app.use('/api/observations', apiKeyAuth, observationsRouter);
app.use('/api/relations', apiKeyAuth, relationsRouter);
app.use('/api/journal', apiKeyAuth, journalRouter);
app.use('/api/emotions', apiKeyAuth, emotionsRouter);
app.use('/api/status', apiKeyAuth, statusRouter);
app.use('/api/identity', apiKeyAuth, identityRouter);
app.use('/api/context', apiKeyAuth, contextRouter);
app.use('/api/voice', apiKeyAuth, voiceRouter);
app.use('/api/discord', apiKeyAuth, discordRouter);
app.use('/api/orientation', apiKeyAuth, orientationRouter);
app.use('/api/images', apiKeyAuth, imagesRouter);
app.use('/api/push', apiKeyAuth, pushRouter);
app.use('/api/health', apiKeyAuth, healthRouter);
app.use('/api/chat', apiKeyAuth, chatRouter);
app.use('/api/chat/threads', apiKeyAuth, threadsRouter);
app.use('/api/library', apiKeyAuth, libraryRouter);
app.use('/api/desk', apiKeyAuth, deskRouter);
app.use('/api/games', apiKeyAuth, gamesRouter);
app.use('/api/questions', apiKeyAuth, questionsRouter);
app.use('/api/reminders', apiKeyAuth, remindersRouter);
app.use('/api/weather', apiKeyAuth, weatherRouter);
// Spotify: /auth and /callback are public (no API key — browser OAuth redirects)
// All other spotify endpoints require apiKeyAuth
app.use('/api/spotify', (req, res, next) => {
  if (req.path === '/auth' || req.path === '/callback') return next();
  return apiKeyAuth(req, res, next);
}, spotifyRouter);

app.use(errorHandler);

async function start() {
  try {
    await initializeStorageBuckets();
    const host = '0.0.0.0';
    app.listen(env.PORT, host, () => {
      console.log(`Vale server running on ${host}:${env.PORT} [${env.NODE_ENV}]`);
      // Start background reminder scheduler — checks every 60s for due reminders
      startReminderScheduler();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
