import { getEnv } from '../config/env.js';
import { memoryService } from '../services/memory.service.js';
import { emotionalService } from '../services/emotional.service.js';
import { voiceService } from '../services/voice.service.js';
import { discordService } from '../services/discord.service.js';
import { orientationService } from '../services/orientation.service.js';
import { imageService } from '../services/image.service.js';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const supabase = getSupabaseClient();

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
        const { channel_id, content, reply_to } = toolInput;
        return await discordService.sendMessage(userId, channel_id, content, {
          replyTo: reply_to,
        });
      }

      case 'discord_read': {
        const { channel_id, limit } = toolInput;
        return await discordService.readMessages(channel_id, limit || 50);
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
      case 'lincoln_set_love': {
        const { value } = toolInput;
        const clamped = Math.min(10, Math.max(0, Math.round(value)));
        const { data, error } = await supabase
          .from('statuses')
          .upsert(
            { user_id: userId, category: 'love', key: 'lincoln', value: clamped.toString(), updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category,key' },
          )
          .select('*')
          .single();
        if (error) throw error;
        return { success: true, love_value: clamped, message: `Lincoln's Love-O-Meter set to ${clamped}/10` };
      }

      case 'lincoln_log_emotion': {
        const { emotion, pillar, context, intensity } = toolInput;
        const result = await emotionalService.logEmotion(userId, emotion, intensity || 3, context || `Lincoln feels ${emotion}`);
        // If pillar specified, we also log it with the pillar
        if (pillar) {
          await supabase.from('emotional_observations').update({ pillar }).eq('id', result.id);
        }
        return { success: true, emotion, pillar: pillar || 'none', message: `Logged: Lincoln feels ${emotion}` };
      }

      case 'lincoln_soft_moment': {
        const { text } = toolInput;
        const { data, error } = await supabase
          .from('statuses')
          .upsert(
            { user_id: userId, category: 'moment', key: 'lincoln_soft', value: text, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category,key' },
          )
          .select('*')
          .single();
        if (error) throw error;
        return { success: true, moment: text, message: `Soft moment recorded: "${text}"` };
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

        return {
          love_o_meter: {
            lincoln: parseInt(statusMap.love?.lincoln || '6'),
            arden: parseInt(statusMap.love?.arden || '4'),
          },
          arden_status: {
            spoons: statusMap.body?.spoons || 'not set',
            body_battery: statusMap.body?.battery || 'not set',
            pain: statusMap.body?.pain || 'not set',
            fog: statusMap.body?.fog || 'not set',
            heart_rate: statusMap.body?.heart_rate || 'not set',
            mood: statusMap.mood?.current || 'not set',
            today_note: statusMap.mood?.note || 'not set',
          },
          moments: {
            lincoln_soft: statusMap.moment?.lincoln_soft || 'none',
            arden_quiet: statusMap.moment?.arden_quiet || 'none',
          },
          recent_emotions: recentEmotions,
          notes_between_stars: (notes || []).map((n: any) => ({
            from: n.author_perspective || n.entry_type,
            text: n.content,
            date: n.created_at,
          })),
        };
      }

      // ===== IMAGE GENERATION =====
      case 'generate_image': {
        const { prompt, size, quality, style } = toolInput;
        return await imageService.generateImage(userId, prompt, { size, quality, style });
      }

      case 'list_images': {
        const { limit } = toolInput;
        return await imageService.listImages(userId, limit || 20);
      }

      case 'delete_image': {
        const { image_id } = toolInput;
        await imageService.deleteImage(userId, image_id);
        return { success: true, message: `Image ${image_id} deleted` };
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
