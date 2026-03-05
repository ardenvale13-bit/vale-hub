import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const env = getEnv();

  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

export async function initializeStorageBuckets() {
  const supabase = getSupabaseClient();

  const buckets = ['voice-notes', 'avatars', 'media'];

  for (const bucketName of buckets) {
    try {
      const { data: bucketList } = await supabase.storage.listBuckets();
      const bucketExists = bucketList?.some((b) => b.name === bucketName);

      if (!bucketExists) {
        await supabase.storage.createBucket(bucketName, {
          public: false,
        });
        console.log(`Created storage bucket: ${bucketName}`);
      }
    } catch (error) {
      console.error(`Failed to initialize bucket ${bucketName}:`, error);
    }
  }
}
