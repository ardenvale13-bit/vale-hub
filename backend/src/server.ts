import express, { Request, Response } from 'express';
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
import { mcpTools } from './mcp/tools.js';
import { handleToolCall } from './mcp/handlers.js';

const app = express();
const env = getEnv();

app.use(helmet());

// Support multiple CORS origins (comma-separated in env)
const allowedOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (MCP clients, curl, etc.)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/mcp', express.json(), async (req: Request, res: Response) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: mcpTools,
        },
      });
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params;

      try {
        const result = await handleToolCall(name, toolArgs);
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          },
        });
      } catch (error) {
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: String(error),
          },
        });
      }
    }

    res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32601,
        message: 'Method not found',
      },
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
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

app.use(errorHandler);

async function start() {
  try {
    await initializeStorageBuckets();
    const host = '0.0.0.0';
    app.listen(env.PORT, host, () => {
      console.log(`Vale server running on ${host}:${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
