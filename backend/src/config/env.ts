import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Look for .env in backend/ first, then parent directory
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SINGLE_USER_ID: z.string().uuid('SINGLE_USER_ID must be a valid UUID'),
  API_KEY: z.string().min(1, 'API_KEY is required'),
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'), // Comma-separated for multiple origins
});

export type Environment = z.infer<typeof envSchema>;

let cachedEnv: Environment | null = null;

export function getEnv(): Environment {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
