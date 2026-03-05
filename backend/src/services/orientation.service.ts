import { getSupabaseClient } from '../config/supabase.js';
import { memoryService } from './memory.service.js';
import { emotionalService } from './emotional.service.js';

const supabase = getSupabaseClient();

export interface OrientationResult {
  timestamp: string;
  perspective: string;
  depth: string;

  identity: {
    perspective_entries: Record<string, Array<{ key: string; value: string; category: string }>>;
  };

  status: {
    love_o_meter: { lincoln: number; arden: number };
    arden_status: Record<string, string>;
    moments: Record<string, string>;
  };

  emotional: {
    recent: Array<{ emotion: string; intensity: number; context?: string; created_at: string }>;
    analytics?: {
      dominant_emotions: string[];
      average_intensity: number;
      total_entries: number;
    };
  };

  memory: {
    entities: Array<{
      name: string;
      entity_type: string;
      salience: string;
      observation_count: number;
      recent_observations: string[];
    }>;
    entity_count: number;
  };

  journal: {
    recent_entries: Array<{
      title: string;
      content: string;
      author_perspective?: string;
      category?: string;
      created_at: string;
    }>;
    notes_between_stars: Array<{
      from: string;
      text: string;
      date: string;
    }>;
  };

  temporal: {
    current_time_nz: string;
    day_of_week: string;
  };
}

type Depth = 'minimal' | 'standard' | 'full' | 'all';

export class OrientationService {
  /**
   * Get a comprehensive orientation payload.
   *
   * Depth levels:
   * - minimal: identity + status only
   * - standard: + foundational/active entities, recent emotions, recent journals
   * - full: + all entities, emotion analytics, more journals
   * - all: everything, no limits
   */
  async getOrientation(
    userId: string,
    perspective: string = 'Lincoln',
    depth: Depth = 'standard',
  ): Promise<OrientationResult> {
    const now = new Date();
    const nzTime = now.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });
    const nzDay = now.toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'long' });

    // Always load: identity + status
    const [identityBlock, statusBlock] = await Promise.all([
      this.getIdentityBlock(userId, perspective),
      this.getStatusBlock(userId),
    ]);

    const result: OrientationResult = {
      timestamp: now.toISOString(),
      perspective,
      depth,
      identity: identityBlock,
      status: statusBlock,
      emotional: { recent: [] },
      memory: { entities: [], entity_count: 0 },
      journal: { recent_entries: [], notes_between_stars: [] },
      temporal: {
        current_time_nz: nzTime,
        day_of_week: nzDay,
      },
    };

    if (depth === 'minimal') {
      return result;
    }

    // Standard: add emotions, key entities, recent journals
    const emotionHours = depth === 'all' ? 168 : depth === 'full' ? 72 : 24;
    const journalDays = depth === 'all' ? 30 : depth === 'full' ? 14 : 7;
    const journalLimit = depth === 'all' ? 50 : depth === 'full' ? 15 : 5;

    const [emotions, journals, starNotes, entities] = await Promise.all([
      this.getRecentEmotions(userId, emotionHours),
      this.getRecentJournals(userId, journalDays, journalLimit),
      this.getStarNotes(userId),
      this.getEntitiesBySalience(userId, depth),
    ]);

    result.emotional.recent = emotions;
    result.journal.recent_entries = journals;
    result.journal.notes_between_stars = starNotes;
    result.memory = entities;

    // Full/All: add analytics
    if (depth === 'full' || depth === 'all') {
      try {
        const analytics = await emotionalService.getEmotionAnalytics(userId, depth === 'all' ? 30 : 7);
        result.emotional.analytics = {
          dominant_emotions: analytics.dominantEmotions || [],
          average_intensity: analytics.averageIntensity || 0,
          total_entries: analytics.totalEntries || 0,
        };
      } catch {
        // Analytics are non-critical
      }
    }

    return result;
  }

  private async getIdentityBlock(
    userId: string,
    perspective: string,
  ): Promise<OrientationResult['identity']> {
    // Get identity entries — perspective-specific + shared
    const { data: entries } = await supabase
      .from('identity_store')
      .select('*')
      .eq('user_id', userId)
      .or(`owner_perspective.eq.${perspective},owner_perspective.eq.shared,owner_perspective.eq.default`);

    const grouped: Record<string, Array<{ key: string; value: string; category: string }>> = {};
    for (const entry of entries || []) {
      const cat = entry.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        key: entry.key,
        value: entry.value,
        category: cat,
      });
    }

    return { perspective_entries: grouped };
  }

  private async getStatusBlock(userId: string): Promise<OrientationResult['status']> {
    const { data: statuses } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', userId);

    const statusMap: Record<string, Record<string, string>> = {};
    for (const s of statuses || []) {
      if (!statusMap[s.category]) statusMap[s.category] = {};
      statusMap[s.category][s.key] = s.value;
    }

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
    };
  }

  private async getRecentEmotions(
    userId: string,
    hoursBack: number,
  ): Promise<OrientationResult['emotional']['recent']> {
    try {
      const history = await emotionalService.getEmotionHistory(userId, hoursBack, 20);
      return history.map((e: any) => ({
        emotion: e.emotion_word || e.emotion,
        intensity: e.intensity,
        context: e.content || e.context,
        created_at: e.created_at,
      }));
    } catch {
      return [];
    }
  }

  private async getRecentJournals(
    userId: string,
    days: number,
    limit: number,
  ): Promise<OrientationResult['journal']['recent_entries']> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('title, content, author_perspective, category, created_at')
      .eq('user_id', userId)
      .neq('category', 'stars')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    return (entries || []).map((e) => ({
      title: e.title,
      content: e.content,
      author_perspective: e.author_perspective,
      category: e.category,
      created_at: e.created_at,
    }));
  }

  private async getStarNotes(
    userId: string,
  ): Promise<OrientationResult['journal']['notes_between_stars']> {
    const { data: notes } = await supabase
      .from('journal_entries')
      .select('content, author_perspective, created_at')
      .eq('user_id', userId)
      .eq('category', 'stars')
      .order('created_at', { ascending: false })
      .limit(5);

    return (notes || []).map((n) => ({
      from: n.author_perspective || 'unknown',
      text: n.content,
      date: n.created_at,
    }));
  }

  private async getEntitiesBySalience(
    userId: string,
    depth: Depth,
  ): Promise<OrientationResult['memory']> {
    try {
      // Determine which salience levels to include
      let salienceLevels: string[];
      if (depth === 'all') {
        salienceLevels = ['foundational', 'active-immediate', 'active-recent', 'background', 'archive'];
      } else if (depth === 'full') {
        salienceLevels = ['foundational', 'active-immediate', 'active-recent', 'background'];
      } else {
        // standard
        salienceLevels = ['foundational', 'active-immediate'];
      }

      const { data: allEntities } = await supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .in('salience', salienceLevels)
        .order('updated_at', { ascending: false })
        .limit(depth === 'all' ? 200 : depth === 'full' ? 100 : 50);

      // Get total count
      const { count } = await supabase
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const entities = [];
      for (const entity of allEntities || []) {
        const { data: obs } = await supabase
          .from('observations')
          .select('content')
          .eq('entity_id', entity.id)
          .order('created_at', { ascending: false })
          .limit(depth === 'all' ? 10 : 3);

        entities.push({
          name: entity.name,
          entity_type: entity.entity_type,
          salience: entity.salience || 'background',
          observation_count: (obs || []).length,
          recent_observations: (obs || []).map((o: any) => o.content),
        });
      }

      return {
        entities,
        entity_count: count || 0,
      };
    } catch {
      return { entities: [], entity_count: 0 };
    }
  }
}

export const orientationService = new OrientationService();
