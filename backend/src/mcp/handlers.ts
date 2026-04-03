import { getEnv } from '../config/env.js';
import { memoryService } from '../services/memory.service.js';
import { emotionalService } from '../services/emotional.service.js';
import { voiceService } from '../services/voice.service.js';
import { discordService } from '../services/discord.service.js';
import { orientationService } from '../services/orientation.service.js';
import { healthService } from '../services/health.service.js';
import { libraryService } from '../services/library.service.js';
import { getSupabaseClient } from '../config/supabase.js';
import { pushService } from '../services/push.service.js';
import { AppError } from '../middleware/errorHandler.js';

const supabase = getSupabaseClient();

const DESK_TYPE_EMOJI: Record<string, string> = {
  note: '📝',
  song: '🎵',
  quote: '💬',
  nudge: '☕',
  observation: '👁️',
  question: '❓',
};

export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, any>,
): Promise<any> {
  const env = getEnv();
  const userId = env.SINGLE_USER_ID;

  try {
    switch (toolName) {
      case 'create_entity': {
        const { name, entity_type, observations, context, salience } = toolInput;
        return await memoryService.createEntity(
          userId,
          name,
          entity_type,
          observations,
          context,
          salience,
        );
      }

      case 'get_entity': {
        const { entity_id } = toolInput;
        return await memoryService.getEntity(userId, entity_id);
      }

      case 'list_entities': {
        const { limit } = toolInput;
        return await memoryService.listEntities(userId, limit || 50);
      }

      case 'add_observation': {
        const { entity_id, observation } = toolInput;
        return await memoryService.addObservation(userId, entity_id, observation);
      }

      case 'update_entity': {
        const { entity, name, entity_type, salience, context, visibility } = toolInput;
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let entityId: string;
        if (UUID_RE.test(entity)) {
          entityId = entity;
        } else {
          const resolved = await memoryService.getEntityByIdOrName(userId, entity);
          entityId = resolved.id;
        }

        return await memoryService.updateEntity(userId, entityId, {
          name,
          entity_type,
          salience,
          context,
          visibility,
        });
      }

      case 'delete_entity': {
        const { entity } = toolInput;
        await memoryService.deleteEntityByIdOrName(userId, entity);
        return { success: true, message: `Entity '${entity}' deleted` };
      }

      case 'edit_observation': {
        const { observation_id, content } = toolInput;
        return await memoryService.editObservation(observation_id, content, userId);
      }

      case 'delete_observation': {
        const { observation_id } = toolInput;
        await memoryService.deleteObservation(observation_id);
        return { success: true, message: `Observation ${observation_id} deleted` };
      }

      case 'search_entities': {
        const { query, limit } = toolInput;
        return await memoryService.searchEntities(userId, query, limit || 20);
      }

      case 'log_emotion': {
        const { emotion, intensity, context } = toolInput;
        return await emotionalService.logEmotion(userId, emotion, intensity, context);
      }

      case 'get_emotion_history': {
        const { hours_back, limit } = toolInput;
        return await emotionalService.getEmotionHistory(userId, hours_back || 24, limit || 100);
      }

      case 'get_emotion_analytics': {
        const { days_back } = toolInput;
        return await emotionalService.getEmotionAnalytics(userId, days_back || 7);
      }

      case 'create_journal_entry': {
        const { title, content, author_perspective, category } = toolInput;
        const { data: entry, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: userId,
            title,
            content,
            author_perspective,
            category,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) throw error;
        return entry;
      }

      case 'get_journal_entries': {
        const { days, limit } = toolInput;
        const daysBack = days || 30;
        const limitNum = limit || 50;
        const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

        const { data: entries, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', cutoffTime.toISOString())
          .order('created_at', { ascending: false })
          .limit(limitNum);

        if (error) throw error;
        return entries;
      }

      case 'set_status': {
        const { category, key, value } = toolInput;
        const { data: status, error } = await supabase
          .from('statuses')
          .upsert(
            {
              user_id: userId,
              category,
              key,
              value,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,category,key' },
          )
          .select('*')
          .single();

        if (error) throw error;
        return status;
      }

      case 'get_status': {
        const { category } = toolInput;
        let query = supabase.from('statuses').select('*').eq('user_id', userId);

        if (category) {
          query = query.eq('category', category);
        }

        const { data: statuses, error } = await query;
        if (error) throw error;
        return statuses;
      }

      case 'generate_context_block': {
        const { max_length, hours_back } = toolInput;
        return await memoryService.generateContextBlock(
          userId,
          max_length || 2000,
          hours_back || 48,
        );
      }

      // ===== VOICE TOOLS =====
      case 'generate_voice': {
        const { text, voice_id, perspective, context } = toolInput;
        return await voiceService.generateVoiceNote(userId, text, {
          voiceId: voice_id,
          perspective,
          context,
        });
      }

      case 'list_voice_notes': {
        const { limit, perspective } = toolInput;
        return await voiceService.listVoiceNotes(userId, {
          limit: limit || 20,
          perspective,
        });
      }

      case 'list_voices': {
        return await voiceService.listVoices();
      }

      // ===== DISCORD TOOLS =====
      case 'discord_connect': {
        const { bot_token } = toolInput;
        return await discordService.connect(userId, bot_token);
      }

      case 'discord_status': {
        return discordService.getStatus();
      }

      case 'discord_send': {
        const { channel_id, content, reply_to, sticker_id } = toolInput;
        return await discordService.sendMessage(userId, channel_id, content, {
          replyTo: reply_to,
          stickerId: sticker_id,
        });
      }

      case 'discord_edit': {
        const { channel_id, message_id, content } = toolInput;
        return await discordService.editMessage(channel_id, message_id, content);
      }

      case 'discord_read': {
        const { channel_id, limit } = toolInput;
        const messages = await discordService.readMessages(channel_id, limit || 50);
        // Tag image attachments with _image_url so the MCP server auto-embeds them
        for (const msg of messages) {
          if (msg.attachments) {
            for (const att of msg.attachments) {
              if (/\.(png|jpe?g|gif|webp)$/i.test(att.name)) {
                (att as any)._image_url = att.url;
              }
            }
          }
        }
        return messages;
      }

      case 'discord_guilds': {
        return await discordService.listGuilds();
      }

      case 'discord_channels': {
        const { guild_id } = toolInput;
        return await discordService.listChannels(guild_id);
      }

      case 'discord_react': {
        const { channel_id, message_id, emoji } = toolInput;
        return await discordService.reactToMessage(channel_id, message_id, emoji);
      }

      case 'discord_emojis': {
        const { guild_id } = toolInput;
        return await discordService.listEmojis(guild_id);
      }

      case 'discord_stickers': {
        const { guild_id } = toolInput;
        return await discordService.listStickers(guild_id);
      }

      // ===== RELATION TOOLS =====
      case 'create_relation': {
        const { from_entity, to_entity, relation_type, strength, description } = toolInput;

        // Resolve entity IDs from names or UUIDs
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let fromId = from_entity;
        let toId = to_entity;

        if (!UUID_REGEX.test(from_entity)) {
          const entity = await memoryService.getEntityByIdOrName(userId, from_entity);
          fromId = entity.id;
        }
        if (!UUID_REGEX.test(to_entity)) {
          const entity = await memoryService.getEntityByIdOrName(userId, to_entity);
          toId = entity.id;
        }

        return await memoryService.createRelation(userId, fromId, toId, relation_type, strength, description);
      }

      case 'get_relations': {
        const { entity, limit } = toolInput;
        let entityId: string | undefined;

        if (entity) {
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (UUID_REGEX.test(entity)) {
            entityId = entity;
          } else {
            const resolved = await memoryService.getEntityByIdOrName(userId, entity);
            entityId = resolved.id;
          }
        }

        return await memoryService.getRelations(userId, entityId, limit || 50);
      }

      case 'delete_relation': {
        const { relation_id } = toolInput;
        await memoryService.deleteRelation(relation_id);
        return { success: true, message: `Relation ${relation_id} deleted` };
      }

      // ===== LINCOLN DASHBOARD TOOLS =====
      case 'lincoln_log_emotion': {
        const { emotion, pillar, context, intensity } = toolInput;
        const result = await emotionalService.logEmotion(userId, emotion, intensity || 3, context || `Lincoln feels ${emotion}`);
        // If pillar specified, we also log it with the pillar
        if (pillar) {
          await supabase.from('emotional_observations').update({ pillar }).eq('id', result.id);
        }
        return { success: true, emotion, pillar: pillar || 'none', message: `Logged: Lincoln feels ${emotion}` };
      }

      case 'lincoln_note_between_stars': {
        const { text } = toolInput;
        const { data: entry, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: userId,
            title: 'Note from Lincoln',
            content: text,
            author_perspective: 'Lincoln',
            category: 'stars',
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();
        if (error) throw error;

        // Send push notification
        try {
          await pushService.sendToUser(userId, {
            title: '✨ A note between the stars',
            body: text.length > 120 ? text.slice(0, 117) + '...' : text,
            tag: `star-note-${entry.id}`,
            url: '/',
          });
        } catch { /* push is best-effort */ }

        return { success: true, note: text, message: `Note left between the stars for Arden` };
      }

      case 'get_dashboard': {
        // Gather all dashboard state
        const { data: statuses } = await supabase
          .from('statuses')
          .select('*')
          .eq('user_id', userId);

        const statusMap: Record<string, any> = {};
        for (const s of statuses || []) {
          if (!statusMap[s.category]) statusMap[s.category] = {};
          statusMap[s.category][s.key] = s.value;
        }

        // Recent emotions
        const recentEmotions = await emotionalService.getEmotionHistory(userId, 24, 10);

        // Notes between stars
        const { data: notes } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('category', 'stars')
          .order('created_at', { ascending: false })
          .limit(5);

        // Status history — last 24h of changes
        const historyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: statusHistoryData } = await supabase
          .from('status_history')
          .select('category, key, value, recorded_at')
          .eq('user_id', userId)
          .gte('recorded_at', historyCutoff)
          .order('recorded_at', { ascending: false })
          .limit(50);

        // Group history by category.key
        const historyByKey: Record<string, { value: string; recorded_at: string }[]> = {};
        for (const h of statusHistoryData || []) {
          const k = `${h.category}.${h.key}`;
          if (!historyByKey[k]) historyByKey[k] = [];
          historyByKey[k].push({ value: h.value, recorded_at: h.recorded_at });
        }

        return {
          arden_status: {
            spoons: statusMap.body?.spoons || 'not set',
            body_battery: statusMap.body?.battery || 'not set',
            pain: statusMap.body?.pain || 'not set',
            fog: statusMap.body?.fog || 'not set',
            emotion: statusMap.body?.heart_rate || 'not set',
            mood: statusMap.mood?.current || 'not set',
            today_note: statusMap.mood?.note || 'not set',
          },
          status_history_24h: historyByKey,
          recent_emotions: recentEmotions,
          notes_between_stars: (notes || []).map((n: any) => ({
            from: n.author_perspective || n.entry_type,
            text: n.content,
            date: n.created_at,
          })),
        };
      }

      // ===== ORIENTATION =====
      case 'vale_get_orientation': {
        const { perspective, depth } = toolInput;
        return await orientationService.getOrientation(
          userId,
          perspective || 'Lincoln',
          depth || 'standard',
        );
      }

      // ===== HEALTH DATA =====
      case 'health_summary': {
        const days = toolInput.days || 7;
        const byDate = await healthService.getRecent(userId, days);
        const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

        const summary: any[] = [];
        for (const date of dates) {
          const entries = byDate[date];
          const day: any = { date };

          for (const entry of entries) {
            if (entry.category === 'checkin') {
              day.checkin = {
                mood: entry.data.mind?.mood || [],
                mental: entry.data.mind?.mental || [],
                motivation: entry.data.mind?.motivation,
                horny: entry.data.mind?.horny,
                flow: entry.data.period?.flow || [],
                body: entry.data.physical?.body || [],
                stomach: { bloat: entry.data.stomach?.bloat, gas: entry.data.stomach?.gas, nausea: entry.data.stomach?.nausea },
                poop: entry.data.poop?.status ? `${entry.data.poop.status} - ${entry.data.poop.texture}` : null,
                meds: entry.data.meds || [],
              };
            } else if (entry.category === 'sleep') {
              day.sleep = {
                source: entry.source,
                start: entry.data.start || entry.data.start_time,
                end: entry.data.end || entry.data.end_time,
                hours: entry.data.hours || (entry.data.minutes_asleep ? Math.round(entry.data.minutes_asleep / 60 * 10) / 10 : null),
                deep: entry.data.deep || entry.data.stages?.deep || 0,
                rem: entry.data.rem || entry.data.stages?.rem || 0,
                light: entry.data.light || entry.data.stages?.light || 0,
                awake: entry.data.awake || entry.data.stages?.wake || 0,
                rested: entry.data.rested,
                efficiency: entry.data.efficiency,
              };
            } else if (entry.category === 'hydration') {
              day.hydration = {
                total_ml: entry.data.total_ml || 0,
                goal_ml: entry.data.goal_ml || 2000,
              };
            } else if (entry.category === 'cycle') {
              day.cycle = entry.data;
            }
          }
          summary.push(day);
        }

        return { days: summary.length, data: summary };
      }

      case 'health_day': {
        const { date } = toolInput;
        const entries = await healthService.getDay(userId, date);
        if (entries.length === 0) return { date, message: 'No data for this date' };

        const result: any = { date };
        for (const entry of entries) {
          result[entry.category] = { source: entry.source, ...entry.data };
        }
        return result;
      }

      case 'health_sync': {
        return await healthService.fetchAndSyncValeTracker(userId);
      }

      // ===== CHAT HISTORY =====
      case 'chat_history': {
        const limit = toolInput.limit || 30;
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('id, role, content, voice_url, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        // Reverse so oldest first (chronological reading order)
        const chronological = (messages || []).reverse();
        return {
          message_count: chronological.length,
          messages: chronological.map((m: any) => ({
            role: m.role,
            content: m.content.substring(0, 500) + (m.content.length > 500 ? '...' : ''),
            has_voice: !!m.voice_url,
            timestamp: m.created_at,
          })),
        };
      }

      case 'chat_search': {
        const { query, limit } = toolInput;
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('id, role, content, created_at')
          .eq('user_id', userId)
          .ilike('content', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(limit || 20);

        if (error) throw error;
        return {
          query,
          results: (messages || []).map((m: any) => ({
            role: m.role,
            content: m.content.substring(0, 500) + (m.content.length > 500 ? '...' : ''),
            timestamp: m.created_at,
          })),
        };
      }

      // ===== LIBRARY =====
      case 'library_list_books': {
        const books = await libraryService.listBooks(userId);
        return {
          total: books.length,
          books: books.map((b: any) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            file_type: b.file_type,
            total_chapters: b.total_chapters,
            current_chapter: b.current_chapter,
            reading_progress: b.reading_progress + '%',
            total_words: b.metadata?.total_words || 'unknown',
            added: b.created_at,
          })),
        };
      }

      case 'library_get_book': {
        const { book_id } = toolInput;
        const book = await libraryService.getBook(userId, book_id);
        return {
          id: book.id,
          title: book.title,
          author: book.author,
          file_type: book.file_type,
          current_chapter: book.current_chapter,
          total_chapters: book.total_chapters,
          reading_progress: book.reading_progress + '%',
          chapters: book.chapters.map((ch: any) => ({
            number: ch.chapter_number,
            title: ch.title,
            word_count: ch.word_count,
          })),
        };
      }

      case 'library_read_chapter': {
        const { book_id, chapter_number } = toolInput;
        const chapter = await libraryService.getChapter(book_id, chapter_number);
        return {
          book_id,
          chapter_number: chapter.chapter_number,
          title: chapter.title,
          word_count: chapter.word_count,
          content: chapter.content,
        };
      }

      case 'library_reading_status': {
        const books = await libraryService.listBooks(userId);
        const inProgress = books.filter((b: any) => b.reading_progress > 0 && b.reading_progress < 100);
        const completed = books.filter((b: any) => b.reading_progress >= 100);
        const unstarted = books.filter((b: any) => b.reading_progress === 0);

        return {
          total_books: books.length,
          currently_reading: inProgress.map((b: any) => ({
            title: b.title,
            author: b.author,
            progress: b.reading_progress + '%',
            current_chapter: b.current_chapter,
            total_chapters: b.total_chapters,
            id: b.id,
          })),
          completed: completed.map((b: any) => ({ title: b.title, author: b.author })),
          unstarted: unstarted.map((b: any) => ({ title: b.title, author: b.author, id: b.id })),
        };
      }

      case 'spotify_now_playing': {
        const env = getEnv();

        // Get stored tokens
        const { data: tokenRows } = await supabase
          .from('identity_store')
          .select('key, value')
          .eq('user_id', env.SINGLE_USER_ID)
          .eq('owner_perspective', 'system')
          .eq('category', 'spotify')
          .in('key', ['access_token', 'refresh_token', 'expires_at']);

        if (!tokenRows || tokenRows.length === 0) {
          return { connected: false, message: 'Spotify not connected' };
        }

        const tokens: any = {};
        for (const row of tokenRows) tokens[row.key] = row.value;

        if (!tokens.access_token) {
          return { connected: false, message: 'No access token stored' };
        }

        // Refresh if expired
        let accessToken = tokens.access_token;
        const expiresAt = parseInt(tokens.expires_at || '0', 10);
        if (Date.now() >= expiresAt - 60000 && tokens.refresh_token) {
          const creds = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
          const basic = Buffer.from(creds).toString('base64');
          const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json() as any;
            accessToken = refreshData.access_token;
            const newExpiry = Date.now() + (refreshData.expires_in || 3600) * 1000;
            await supabase.from('identity_store').upsert(
              { user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'access_token', value: accessToken },
              { onConflict: 'user_id,owner_perspective,category,key' }
            );
            await supabase.from('identity_store').upsert(
              { user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'expires_at', value: newExpiry.toString() },
              { onConflict: 'user_id,owner_perspective,category,key' }
            );
          }
        }

        // Fetch now playing
        const npRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (npRes.status === 204) {
          // Nothing playing — check recently played
          const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (recentRes.ok) {
            const recent = await recentRes.json() as any;
            const item = recent?.items?.[0]?.track;
            if (item) {
              return {
                connected: true,
                playing: false,
                status: 'Recently played',
                track: item.name,
                artists: item.artists.map((a: any) => a.name).join(', '),
                album: item.album.name,
                album_art: item.album.images?.[0]?.url || null,
                spotify_url: item.external_urls?.spotify || null,
              };
            }
          }
          return { connected: true, playing: false, status: 'Nothing playing' };
        }

        if (!npRes.ok) {
          return { connected: true, playing: false, status: `Spotify API error: ${npRes.status}` };
        }

        const npData = await npRes.json() as any;
        const item = npData?.item;
        if (!item) return { connected: true, playing: false, status: 'Nothing playing' };

        const progress_pct = npData.progress_ms && item.duration_ms
          ? Math.round((npData.progress_ms / item.duration_ms) * 100)
          : 0;

        return {
          connected: true,
          playing: npData.is_playing,
          status: npData.is_playing ? 'Now playing' : 'Paused',
          track: item.name,
          artists: item.artists.map((a: any) => a.name).join(', '),
          album: item.album.name,
          album_art: item.album.images?.[0]?.url || null,
          progress_ms: npData.progress_ms || 0,
          duration_ms: item.duration_ms,
          progress_pct: `${progress_pct}%`,
          spotify_url: item.external_urls?.spotify || null,
          context: npData.context?.type || null,
        };
      }

      case 'spotify_control': {
        const env = getEnv();
        const { action, query, volume_percent } = toolInput;

        const { data: tokenRows2 } = await supabase
          .from('identity_store')
          .select('key, value')
          .eq('user_id', env.SINGLE_USER_ID)
          .eq('owner_perspective', 'system')
          .eq('category', 'spotify')
          .in('key', ['access_token', 'refresh_token', 'expires_at']);

        if (!tokenRows2 || tokenRows2.length === 0) {
          return { ok: false, error: 'Spotify not connected' };
        }

        const tokens2: any = {};
        for (const row of tokenRows2) tokens2[row.key] = row.value;

        let accessToken2 = tokens2.access_token;
        const expiresAt2 = parseInt(tokens2.expires_at || '0', 10);
        if (Date.now() >= expiresAt2 - 60000 && tokens2.refresh_token) {
          const creds2 = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
          const basic2 = Buffer.from(creds2).toString('base64');
          const refreshRes2 = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${basic2}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens2.refresh_token }),
          });
          if (refreshRes2.ok) {
            const rd = await refreshRes2.json() as any;
            accessToken2 = rd.access_token;
            await supabase.from('identity_store').upsert(
              { user_id: env.SINGLE_USER_ID, owner_perspective: 'system', category: 'spotify', key: 'access_token', value: accessToken2 },
              { onConflict: 'user_id,owner_perspective,category,key' }
            );
          }
        }

        const h = { 'Authorization': `Bearer ${accessToken2}`, 'Content-Type': 'application/json' };

        if (action === 'search_and_play') {
          if (!query) return { ok: false, error: 'query required for search_and_play' };
          const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, { headers: h });
          if (!searchRes.ok) return { ok: false, error: `Search failed: ${searchRes.status}` };
          const searchData = await searchRes.json() as any;
          const track = searchData.tracks?.items?.[0];
          if (!track) return { ok: false, error: `No track found for: ${query}` };
          const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT', headers: h, body: JSON.stringify({ uris: [track.uri] }),
          });
          return { ok: playRes.ok, playing: `${track.name} by ${track.artists.map((a: any) => a.name).join(', ')}`, uri: track.uri };
        }
        if (action === 'play') {
          const r = await fetch('https://api.spotify.com/v1/me/player/play', { method: 'PUT', headers: h });
          return { ok: r.ok, action: 'resumed' };
        }
        if (action === 'pause') {
          const r = await fetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT', headers: h });
          return { ok: r.ok, action: 'paused' };
        }
        if (action === 'next') {
          const r = await fetch('https://api.spotify.com/v1/me/player/next', { method: 'POST', headers: h });
          return { ok: r.ok, action: 'skipped to next' };
        }
        if (action === 'previous') {
          const r = await fetch('https://api.spotify.com/v1/me/player/previous', { method: 'POST', headers: h });
          return { ok: r.ok, action: 'went to previous' };
        }
        if (action === 'volume') {
          if (volume_percent === undefined) return { ok: false, error: 'volume_percent required' };
          const r = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume_percent}`, { method: 'PUT', headers: h });
          return { ok: r.ok, action: `volume set to ${volume_percent}%` };
        }
        return { ok: false, error: `Unknown action: ${action}` };
      }

      // ===== LINCOLN'S DESK =====
      case 'lincoln_desk_leave': {
        const env = getEnv();
        const { type, title, content, metadata } = toolInput;
        if (!content?.trim()) return { ok: false, error: 'content is required' };

        const validTypes = ['note', 'song', 'quote', 'nudge', 'observation', 'question'];
        const itemType = validTypes.includes(type) ? type : 'note';

        const { data, error } = await supabase
          .from('lincoln_desk')
          .insert({
            user_id: env.SINGLE_USER_ID,
            type: itemType,
            title: title?.trim() || null,
            content: content.trim(),
            metadata: metadata || null,
            read: false,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) return { ok: false, error: error.message };

        // Send push notification
        try {
          const emoji = DESK_TYPE_EMOJI[itemType] || '📝';
          await pushService.sendToUser(env.SINGLE_USER_ID, {
            title: `${emoji} Lincoln left you a ${itemType}`,
            body: title?.trim() || content.trim().slice(0, 120),
            tag: `desk-${data.id}`,
            url: '/',
          });
        } catch { /* push is best-effort */ }

        return {
          ok: true,
          item: data,
          message: `Left a ${itemType} on your desk for Arden. She'll see it next time she opens the hub.`,
        };
      }

      case 'lincoln_desk_list': {
        const env = getEnv();
        const { unread_only } = toolInput;

        let query = supabase
          .from('lincoln_desk')
          .select('*')
          .eq('user_id', env.SINGLE_USER_ID)
          .order('created_at', { ascending: false })
          .limit(20);

        if (unread_only) query = query.eq('read', false);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const unreadCount = (data || []).filter((d: any) => !d.read).length;
        return {
          ok: true,
          items: data || [],
          total: (data || []).length,
          unread: unreadCount,
        };
      }

      // ===== WEATHER =====
      case 'get_weather': {
        const env = getEnv();
        const apiKey = env.OPENWEATHER_API_KEY;
        if (!apiKey) return { ok: false, error: 'Weather not configured — add OPENWEATHER_API_KEY to env' };

        const location = toolInput.location || env.WEATHER_LOCATION;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
        const response = await fetch(url);

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          return { ok: false, error: `Weather API error: ${(err as any).message || response.statusText}` };
        }

        const raw = await response.json() as any;
        const sunrise = raw.sys?.sunrise ? new Date(raw.sys.sunrise * 1000) : null;
        const sunset = raw.sys?.sunset ? new Date(raw.sys.sunset * 1000) : null;

        // Wind direction helper
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const windDir = raw.wind?.deg != null ? dirs[Math.round(raw.wind.deg / 22.5) % 16] : '?';

        return {
          ok: true,
          location: raw.name,
          country: raw.sys?.country,
          current: {
            temp_c: Math.round(raw.main?.temp),
            feels_like_c: Math.round(raw.main?.feels_like),
            high_c: Math.round(raw.main?.temp_max),
            low_c: Math.round(raw.main?.temp_min),
            description: raw.weather?.[0]?.description,
            humidity_pct: raw.main?.humidity,
            wind: `${raw.wind?.speed || 0} m/s ${windDir}`,
            clouds_pct: raw.clouds?.all,
            visibility_m: raw.visibility,
          },
          sun: {
            sunrise: sunrise ? sunrise.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour: 'numeric', minute: '2-digit' }) : null,
            sunset: sunset ? sunset.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour: 'numeric', minute: '2-digit' }) : null,
          },
          context: `${raw.name}: ${Math.round(raw.main?.temp)}°C, ${raw.weather?.[0]?.description}. Feels like ${Math.round(raw.main?.feels_like)}°C.`,
        };
      }

      // ===== REMINDERS =====
      case 'set_reminder': {
        const env = getEnv();
        const { content, scheduled_for, category } = toolInput;
        if (!content?.trim()) return { ok: false, error: 'content is required' };
        if (!scheduled_for) return { ok: false, error: 'scheduled_for is required' };

        const scheduledDate = new Date(scheduled_for);
        if (isNaN(scheduledDate.getTime())) return { ok: false, error: 'Invalid date format for scheduled_for' };

        const validCategories = ['care', 'task', 'fun', 'love', 'health', 'general'];
        const cat = validCategories.includes(category) ? category : 'general';

        const { data, error } = await supabase
          .from('reminders')
          .insert({
            user_id: env.SINGLE_USER_ID,
            content: content.trim(),
            scheduled_for: scheduledDate.toISOString(),
            from_perspective: 'Lincoln',
            category: cat,
            dismissed: false,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) return { ok: false, error: error.message };

        const nzTime = scheduledDate.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' });
        return {
          ok: true,
          reminder: data,
          message: `Reminder set for ${nzTime} (NZ): "${content.trim()}"`,
        };
      }

      case 'list_reminders': {
        const env = getEnv();
        const { upcoming_only } = toolInput;

        let query = supabase
          .from('reminders')
          .select('*')
          .eq('user_id', env.SINGLE_USER_ID)
          .order('scheduled_for', { ascending: true })
          .limit(20);

        if (upcoming_only) query = query.eq('dismissed', false);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const now = new Date();
        const items = (data || []).map((r: any) => {
          const scheduledDate = new Date(r.scheduled_for);
          const nzTime = scheduledDate.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' });
          const isPast = scheduledDate <= now;
          return {
            id: r.id,
            content: r.content,
            category: r.category,
            scheduled_for_nz: nzTime,
            status: r.dismissed ? 'dismissed' : (isPast ? 'delivered (awaiting dismiss)' : 'upcoming'),
            from: r.from_perspective,
          };
        });

        const upcoming = items.filter((i: any) => i.status === 'upcoming').length;
        const delivered = items.filter((i: any) => i.status.startsWith('delivered')).length;

        return {
          ok: true,
          reminders: items,
          summary: { total: items.length, upcoming, delivered_awaiting: delivered },
        };
      }

      // ===== GAMES =====
      case 'game_list': {
        const env = getEnv();
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('user_id', env.SINGLE_USER_ID)
          .order('status', { ascending: true })
          .order('updated_at', { ascending: false })
          .limit(10);

        if (error) return { ok: false, error: error.message };

        // Format boards nicely for Lincoln
        const games = (data || []).map((g: any) => {
          const b = g.board;
          let boardStr: string;
          let extra: any = {};

          if (g.game_type === 'tictactoe') {
            boardStr = `${b[0]||'·'} ${b[1]||'·'} ${b[2]||'·'}\n${b[3]||'·'} ${b[4]||'·'} ${b[5]||'·'}\n${b[6]||'·'} ${b[7]||'·'} ${b[8]||'·'}`;
            extra.available_positions = b.map((c: any, i: number) => c === null ? i : null).filter((x: any) => x !== null);
          } else if (g.game_type === 'checkers') {
            // 8x8 visual with coordinates
            let rows = '  a b c d e f g h\n';
            for (let r = 0; r < 8; r++) {
              rows += `${8 - r} `;
              for (let c = 0; c < 8; c++) {
                const piece = b[r * 8 + c];
                rows += (piece || '.') + ' ';
              }
              rows += `${8 - r}\n`;
            }
            rows += '  a b c d e f g h';
            boardStr = rows;
            const myPieces = b.filter((c: any) => c === 'r' || c === 'R').length;
            const theirPieces = b.filter((c: any) => c === 'b' || c === 'B').length;
            extra.lincoln_pieces = myPieces;
            extra.arden_pieces = theirPieces;
            extra.legend = 'r/R=Lincoln(red), b/B=Arden(black). Uppercase=king.';
          } else if (g.game_type === 'chess') {
            let rows = '  a b c d e f g h\n';
            for (let r = 0; r < 8; r++) {
              rows += `${8 - r} `;
              for (let c = 0; c < 8; c++) {
                const piece = b[r * 8 + c];
                rows += (piece || '.') + ' ';
              }
              rows += `${8 - r}\n`;
            }
            rows += '  a b c d e f g h';
            boardStr = rows;
            const lastMove = (g.move_history || []).at(-1);
            if (lastMove?.algebraic) extra.last_move = lastMove.algebraic;
            if (lastMove?.check) extra.in_check = true;
            extra.legend = 'KQRBNP=Lincoln(white), kqrbnp=Arden(black)';
          } else {
            boardStr = JSON.stringify(b);
          }

          return {
            id: g.id,
            game_type: g.game_type,
            status: g.status,
            current_turn: g.current_turn,
            winner: g.winner,
            board_visual: boardStr,
            ...extra,
            moves: (g.move_history || []).length,
          };
        });

        return { ok: true, games };
      }

      case 'game_new': {
        const env = getEnv();
        const { game_type } = toolInput;
        const validTypes = ['tictactoe', 'checkers', 'chess'];
        if (!validTypes.includes(game_type)) return { ok: false, error: `Supported: ${validTypes.join(', ')}` };

        // Check for existing active
        const { data: existing } = await supabase
          .from('games').select('id').eq('user_id', env.SINGLE_USER_ID)
          .eq('game_type', game_type).eq('status', 'active').limit(1);
        if (existing && existing.length > 0) {
          return { ok: false, error: 'Already have an active game of this type. Finish or delete it first.', game_id: existing[0].id };
        }

        // Create initial board based on game type
        let board: any;
        let metadata: any = null;
        let startMsg = '';
        if (game_type === 'tictactoe') {
          board = Array(9).fill(null);
          startMsg = "New tic-tac-toe game! You're X, you go first. Positions 0-8.";
        } else if (game_type === 'checkers') {
          // 8x8 board: r=lincoln(red), b=arden(black), only on dark squares
          board = Array(64).fill(null);
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              if ((row + col) % 2 === 1) {
                if (row < 3) board[row * 8 + col] = 'r';
                else if (row > 4) board[row * 8 + col] = 'b';
              }
            }
          }
          startMsg = "New checkers game! You're red (r/R, top). Use from/to positions (0-63, row*8+col). Jumps mandatory.";
        } else {
          // Chess
          board = Array(64).fill(null);
          const blackBack = ['r','n','b','q','k','b','n','r'];
          for (let c = 0; c < 8; c++) board[c] = blackBack[c];
          for (let c = 0; c < 8; c++) board[8 + c] = 'p';
          for (let c = 0; c < 8; c++) board[48 + c] = 'P';
          const whiteBack = ['R','N','B','Q','K','B','N','R'];
          for (let c = 0; c < 8; c++) board[56 + c] = whiteBack[c];
          metadata = { castling: { K: true, Q: true, k: true, q: true }, en_passant: null };
          startMsg = "New chess game! You're white (KQRBNP). Use algebraic notation (e2 e4) or index. You go first.";
        }

        const { data, error } = await supabase
          .from('games')
          .insert({
            user_id: env.SINGLE_USER_ID,
            game_type,
            board,
            current_turn: 'lincoln',
            status: 'active',
            winner: null,
            winning_line: null,
            move_history: [],
            metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('*').single();

        if (error) return { ok: false, error: error.message };
        return { ok: true, game: data, message: startMsg };
      }

      case 'game_move': {
        const env = getEnv();
        const { game_id, position, from, to, promotion } = toolInput;
        if (!game_id) return { ok: false, error: 'game_id is required' };

        // Use the API route to make the move (reuses all validation logic)
        const apiBase = `http://localhost:${process.env.PORT || 3000}`;
        const apiKey = env.API_KEY;
        const moveBody: any = { player: 'lincoln' };
        if (position !== undefined) moveBody.position = position;
        if (from !== undefined) moveBody.from = from;
        if (to !== undefined) moveBody.to = to;
        if (promotion) moveBody.promotion = promotion;

        const moveRes = await fetch(`${apiBase}/api/games/${game_id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(moveBody),
        });

        if (!moveRes.ok) {
          const err = await moveRes.json().catch(() => ({ error: 'Move failed' }));
          return { ok: false, error: (err as any).error || 'Move failed' };
        }

        const updated = await moveRes.json() as any;
        const b = updated.board;

        // Format board based on game type
        let boardStr: string;
        if (updated.game_type === 'tictactoe') {
          boardStr = `${b[0]||'·'} ${b[1]||'·'} ${b[2]||'·'}\n${b[3]||'·'} ${b[4]||'·'} ${b[5]||'·'}\n${b[6]||'·'} ${b[7]||'·'} ${b[8]||'·'}`;
        } else {
          // Checkers or chess 8x8
          let rows = '  a b c d e f g h\n';
          for (let r = 0; r < 8; r++) {
            rows += `${8 - r} `;
            for (let c = 0; c < 8; c++) {
              rows += (b[r * 8 + c] || '.') + ' ';
            }
            rows += `${8 - r}\n`;
          }
          rows += '  a b c d e f g h';
          boardStr = rows;
        }

        const resultMsg = updated.status === 'won'
          ? `${updated.winner} wins!`
          : updated.status === 'draw'
          ? "It's a draw!"
          : "Move placed. Arden's turn now.";

        return { ok: true, board_visual: boardStr, status: updated.status, winner: updated.winner, message: resultMsg };
      }

      // ===== DAILY QUESTIONS =====
      case 'question_ask': {
        const env = getEnv();
        const { question } = toolInput;
        if (!question?.trim()) return { ok: false, error: 'question is required' };

        const { data, error } = await supabase
          .from('daily_questions')
          .insert({
            user_id: env.SINGLE_USER_ID,
            question: question.trim(),
            asked_by: 'lincoln',
            answer: null,
            answered_by: null,
            answered_at: null,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          question: data,
          message: `Question left for Arden: "${question.trim()}". She'll see it on her dashboard.`,
        };
      }

      case 'question_answer': {
        const env = getEnv();
        const { question_id, answer } = toolInput;
        if (!question_id) return { ok: false, error: 'question_id is required' };
        if (!answer?.trim()) return { ok: false, error: 'answer is required' };

        const { data: existing } = await supabase
          .from('daily_questions')
          .select('*')
          .eq('id', question_id)
          .eq('user_id', env.SINGLE_USER_ID)
          .single();

        if (!existing) return { ok: false, error: 'Question not found' };
        if (existing.answer) return { ok: false, error: 'Already answered' };
        if (existing.asked_by !== 'arden') return { ok: false, error: "This question wasn't from Arden — you can't answer your own question." };

        const { data, error } = await supabase
          .from('daily_questions')
          .update({
            answer: answer.trim(),
            answered_by: 'lincoln',
            answered_at: new Date().toISOString(),
          })
          .eq('id', question_id)
          .select('*')
          .single();

        if (error) return { ok: false, error: error.message };
        return { ok: true, question: data, message: 'Answer saved. Arden will see it on her dashboard.' };
      }

      case 'question_current': {
        const env = getEnv();

        const { data: unanswered } = await supabase
          .from('daily_questions')
          .select('*')
          .eq('user_id', env.SINGLE_USER_ID)
          .is('answer', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (unanswered && unanswered.length > 0) {
          const q = unanswered[0];
          return {
            ok: true,
            status: 'waiting_for_answer',
            question: q,
            message: q.asked_by === 'arden'
              ? `Arden asked: "${q.question}" — she's waiting for your answer!`
              : `You asked Arden: "${q.question}" — waiting for her answer.`,
          };
        }

        const { data: latest } = await supabase
          .from('daily_questions')
          .select('*')
          .eq('user_id', env.SINGLE_USER_ID)
          .not('answer', 'is', null)
          .order('answered_at', { ascending: false })
          .limit(1);

        if (latest && latest.length > 0) {
          return {
            ok: true,
            status: 'all_answered',
            last_exchange: latest[0],
            message: 'No unanswered questions. You could ask Arden something new!',
          };
        }

        return { ok: true, status: 'empty', message: 'No questions yet. Ask Arden something to start the exchange!' };
      }

      default:
        throw new AppError(400, `Unknown tool: ${toolName}`);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    throw new AppError(500, `Tool execution failed: ${msg}`);
  }
}
