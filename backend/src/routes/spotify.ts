import { Router, Request, Response } from 'express';
import { getEnv } from '../config/env.js';
import { getSupabaseClient } from '../config/supabase.js';

const router = Router();

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────

function getSpotifyBasicAuth(): string {
  const env = getEnv();
  const creds = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
  return Buffer.from(creds).toString('base64');
}

async function getStoredTokens(): Promise<{ access_token?: string; refresh_token?: string; expires_at?: number } | null> {
  const env = getEnv();
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('identity_store')
    .select('key, value')
    .eq('user_id', env.SINGLE_USER_ID)
    .eq('owner_perspective', 'system')
    .eq('category', 'spotify')
    .in('key', ['access_token', 'refresh_token', 'expires_at']);

  if (!data || data.length === 0) return null;
  const tokens: any = {};
  for (const row of data) tokens[row.key] = row.value;
  return tokens;
}

async function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number) {
  const env = getEnv();
  const supabase = getSupabaseClient();
  const expiresAt = Date.now() + expiresIn * 1000;

  const upserts = [
    { user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'access_token', value: accessToken },
    { user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'expires_at', value: expiresAt.toString() },
  ];
  if (refreshToken) {
    upserts.push({ user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'refresh_token', value: refreshToken });
  }

  for (const row of upserts) {
    const { error } = await supabase.from('identity_store').upsert(row, { onConflict: 'user_id,owner_perspective,category,key' });
    if (error) {
      console.warn('Upsert failed, trying delete+insert:', error.message);
      await supabase.from('identity_store')
        .delete()
        .eq('user_id', row.user_id)
        .eq('owner_perspective', row.owner_perspective)
        .eq('category', row.category)
        .eq('key', row.key);
      const { error: insertError } = await supabase.from('identity_store').insert(row);
      if (insertError) console.error('Insert also failed:', insertError.message);
    }
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const env = getEnv();
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${getSpotifyBasicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    await storeTokens(data.access_token, data.refresh_token || null, data.expires_in || 3600);
    return data.access_token;
  } catch {
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens?.access_token || !tokens?.refresh_token) return null;

  const expiresAt = parseInt(tokens.expires_at || '0', 10);
  // Refresh if token expires within 60 seconds
  if (Date.now() < expiresAt - 60000) {
    return tokens.access_token;
  }
  return await refreshAccessToken(tokens.refresh_token);
}

// ───────────────────────────────────────────
// OAuth flow
// ───────────────────────────────────────────

// GET /api/spotify/auth — redirect to Spotify authorization page
router.get('/auth', (req: Request, res: Response) => {
  const env = getEnv();
  if (!env.SPOTIFY_CLIENT_ID) {
    return res.status(400).json({ error: 'SPOTIFY_CLIENT_ID not configured' });
  }

  const redirectUri = env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/spotify/callback`;
  const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-read-recently-played',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: redirectUri,
    state: 'vale-hub-auth',
  });

  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// GET /api/spotify/callback — handle OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const env = getEnv();
  const { code, error } = req.query;

  if (error || !code) {
    const frontendUrl = env.FRONTEND_URL || 'https://vale-hub.vercel.app';
    return res.send(`<html><body style="background:#2c2151;color:#e8e0f0;font-family:sans-serif;padding:2rem">
      <h2>Spotify auth failed</h2><p>${error || 'No code received'}</p>
      <p><a href="${frontendUrl}" style="color:#e5b2e6">Return to Vale Hub</a></p>
    </body></html>`);
  }

  const redirectUri = env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/spotify/callback`;

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${getSpotifyBasicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Spotify token exchange failed:', tokenRes.status, err);
      throw new Error(`Token exchange failed (${tokenRes.status}): ${err}`);
    }

    const tokenData = await tokenRes.json() as any;
    console.log('Spotify token received, has refresh_token:', !!tokenData.refresh_token);
    await storeTokens(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in || 3600);
    console.log('Spotify tokens stored successfully');

    // Redirect to frontend dashboard
    const frontendUrl = env.FRONTEND_URL || 'https://vale-hub.vercel.app';
    console.log('Redirecting to:', `${frontendUrl}/?spotify=connected`);
    return res.redirect(`${frontendUrl}/?spotify=connected`);
  } catch (err: any) {
    console.error('Spotify callback error:', err);
    const frontendUrl = env.FRONTEND_URL || 'https://vale-hub.vercel.app';
    return res.send(`<html><body style="background:#2c2151;color:#e8e0f0;font-family:sans-serif;padding:2rem">
      <h2>Spotify auth error</h2><p>${err.message}</p>
      <p><a href="${frontendUrl}" style="color:#e5b2e6">Return to Vale Hub</a></p>
    </body></html>`);
  }
});

// ───────────────────────────────────────────
// Now playing
// ───────────────────────────────────────────

// GET /api/spotify/now-playing
router.get('/now-playing', async (_req: Request, res: Response) => {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return res.json({ connected: false, playing: false });
  }

  try {
    const spRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    // 204 = nothing playing
    if (spRes.status === 204) {
      // Fall back to recently played
      const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (recentRes.ok) {
        const recent = await recentRes.json() as any;
        const item = recent?.items?.[0]?.track;
        if (item) {
          return res.json({
            connected: true,
            playing: false,
            track: {
              id: item.id,
              name: item.name,
              artists: item.artists.map((a: any) => a.name),
              album: item.album.name,
              albumArt: item.album.images?.[0]?.url || null,
              albumArtSmall: item.album.images?.[2]?.url || item.album.images?.[1]?.url || null,
              duration_ms: item.duration_ms,
              progress_ms: 0,
              external_url: item.external_urls?.spotify || null,
            },
          });
        }
      }
      return res.json({ connected: true, playing: false });
    }

    if (!spRes.ok) {
      return res.json({ connected: false, playing: false });
    }

    const data = await spRes.json() as any;
    const item = data?.item;

    if (!item) {
      return res.json({ connected: true, playing: false });
    }

    return res.json({
      connected: true,
      playing: data.is_playing,
      track: {
        id: item.id,
        name: item.name,
        artists: item.artists.map((a: any) => a.name),
        album: item.album.name,
        albumArt: item.album.images?.[0]?.url || null,
        albumArtSmall: item.album.images?.[2]?.url || item.album.images?.[1]?.url || null,
        duration_ms: item.duration_ms,
        progress_ms: data.progress_ms || 0,
        external_url: item.external_urls?.spotify || null,
        context_type: data.context?.type || null, // playlist, album, artist
      },
    });
  } catch (err) {
    console.error('Spotify now-playing error:', err);
    return res.json({ connected: false, playing: false });
  }
});

// GET /api/spotify/status — is connected?
router.get('/status', async (_req: Request, res: Response) => {
  const tokens = await getStoredTokens();
  return res.json({ connected: !!(tokens?.refresh_token) });
});

// DELETE /api/spotify/disconnect — remove stored tokens
router.delete('/disconnect', async (_req: Request, res: Response) => {
  const env = getEnv();
  const supabase = getSupabaseClient();
  await supabase
    .from('identity_store')
    .delete()
    .eq('user_id', env.SINGLE_USER_ID)
    .eq('owner_perspective', 'system')
    .eq('category', 'spotify');
  return res.json({ ok: true });
});

export default router;
