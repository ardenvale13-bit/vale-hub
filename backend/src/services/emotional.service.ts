import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export interface EmotionVocabulary {
  id: string;
  emotion: string;
  intensity: number;
  primary_context?: string;
  related_emotions?: string[];
}

export interface EmotionEntry {
  id: string;
  emotion: string;
  intensity: number;
  timestamp: string;
  context?: string;
  pillar?: string;
}

export interface ShadowMoment {
  id: string;
  title: string;
  description: string;
  intensity: number;
  patterns?: string[];
  created_at: string;
}

export interface EmotionAnalytics {
  dominantEmotions: string[];
  averageIntensity: number;
  emotionTrends: Record<string, number>;
  totalEntries: number;
}

export class EmotionalService {
  private supabase = getSupabaseClient();

  async createEmotionVocabulary(
    userId: string,
    emotion: string,
    intensity: number,
    primaryContext?: string,
    relatedEmotions?: string[],
  ): Promise<EmotionVocabulary> {
    try {
      const { data: vocab, error: vocabError } = await this.supabase
        .from('emotions_vocabulary')
        .insert({
          user_id: userId,
          emotion_word: emotion,
          pillar: primaryContext || null,
          category: 'neutral',
          user_defined: true,
        })
        .select('*')
        .single();

      if (vocabError) throw vocabError;
      if (!vocab) {
        throw new AppError(500, 'Failed to create emotion vocabulary');
      }

      return {
        id: vocab.id,
        emotion: vocab.emotion_word,
        intensity: 0,
        primary_context: vocab.pillar,
        related_emotions: [],
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create emotion vocabulary: ${error}`);
    }
  }

  async getEmotionVocabulary(userId: string, limit = 50): Promise<EmotionVocabulary[]> {
    try {
      const { data: vocabs, error: vocabError } = await this.supabase
        .from('emotions_vocabulary')
        .select('*')
        .eq('user_id', userId)
        .limit(limit);

      if (vocabError) throw vocabError;

      return (
        vocabs?.map((v) => ({
          id: v.id,
          emotion: v.emotion_word,
          intensity: 0,
          primary_context: v.pillar,
          related_emotions: [],
        })) || []
      );
    } catch (error) {
      throw new AppError(500, `Failed to get emotion vocabulary: ${error}`);
    }
  }

  async updateEmotionVocabulary(
    userId: string,
    vocabId: string,
    updates: Partial<EmotionVocabulary>,
  ): Promise<EmotionVocabulary> {
    try {
      const { data: vocab, error: vocabError } = await this.supabase
        .from('emotions_vocabulary')
        .update({
          emotion_word: updates.emotion,
          pillar: updates.primary_context,
        })
        .eq('user_id', userId)
        .eq('id', vocabId)
        .select('*')
        .single();

      if (vocabError) throw vocabError;
      if (!vocab) {
        throw new AppError(404, 'Emotion vocabulary not found');
      }

      return {
        id: vocab.id,
        emotion: vocab.emotion_word,
        intensity: 0,
        primary_context: vocab.pillar,
        related_emotions: [],
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update emotion vocabulary: ${error}`);
    }
  }

  async deleteEmotionVocabulary(userId: string, vocabId: string): Promise<void> {
    try {
      const { error: delError } = await this.supabase
        .from('emotions_vocabulary')
        .delete()
        .eq('user_id', userId)
        .eq('id', vocabId);

      if (delError) throw delError;
    } catch (error) {
      throw new AppError(500, `Failed to delete emotion vocabulary: ${error}`);
    }
  }

  async logEmotion(
    userId: string,
    emotion: string,
    intensity: number,
    context?: string,
    pillar?: string,
  ): Promise<EmotionEntry> {
    try {
      const { data: entry, error: entryError } = await this.supabase
        .from('emotional_observations')
        .insert({
          user_id: userId,
          emotion_word: emotion,
          intensity: Math.min(Math.max(intensity, 1), 5),
          content: context || null,
          pillar: pillar || null,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (entryError) throw entryError;
      if (!entry) {
        throw new AppError(500, 'Failed to log emotion');
      }

      return {
        id: entry.id,
        emotion: entry.emotion_word,
        intensity: entry.intensity,
        timestamp: entry.created_at,
        context: entry.content,
        pillar: entry.pillar,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to log emotion: ${error}`);
    }
  }

  async getEmotionHistory(
    userId: string,
    hoursBack = 24,
    limit = 100,
  ): Promise<EmotionEntry[]> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const { data: entries, error: entriesError } = await this.supabase
        .from('emotional_observations')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (entriesError) throw entriesError;

      return (
        entries?.map((e) => ({
          id: e.id,
          emotion: e.emotion_word,
          intensity: e.intensity,
          timestamp: e.created_at,
          context: e.content,
          pillar: e.pillar,
        })) || []
      );
    } catch (error) {
      throw new AppError(500, `Failed to get emotion history: ${error}`);
    }
  }

  async getEmotionAnalytics(
    userId: string,
    daysBack = 7,
  ): Promise<EmotionAnalytics> {
    try {
      const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const { data: entries, error: entriesError } = await this.supabase
        .from('emotional_observations')
        .select('emotion_word, intensity')
        .eq('user_id', userId)
        .gte('created_at', cutoffTime.toISOString());

      if (entriesError) throw entriesError;

      const entries_list = entries || [];
      if (entries_list.length === 0) {
        return {
          dominantEmotions: [],
          averageIntensity: 0,
          emotionTrends: {},
          totalEntries: 0,
        };
      }

      const emotionCounts: Record<string, number> = {};
      const emotionTotals: Record<string, number> = {};
      let totalIntensity = 0;

      for (const entry of entries_list) {
        const ew = entry.emotion_word;
        emotionCounts[ew] = (emotionCounts[ew] || 0) + 1;
        emotionTotals[ew] = (emotionTotals[ew] || 0) + entry.intensity;
        totalIntensity += entry.intensity;
      }

      const dominantEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map((e) => e[0]);

      const emotionTrends: Record<string, number> = {};
      for (const emotion of Object.keys(emotionCounts)) {
        emotionTrends[emotion] = emotionTotals[emotion] / emotionCounts[emotion];
      }

      return {
        dominantEmotions,
        averageIntensity: totalIntensity / entries_list.length,
        emotionTrends,
        totalEntries: entries_list.length,
      };
    } catch (error) {
      throw new AppError(500, `Failed to get emotion analytics: ${error}`);
    }
  }

  async createShadowMoment(
    userId: string,
    title: string,
    description: string,
    intensity: number,
    patterns?: string[],
  ): Promise<ShadowMoment> {
    try {
      const { data: moment, error: momentError } = await this.supabase
        .from('shadow_moments')
        .insert({
          user_id: userId,
          content: description,
          emotional_valence: title,
          related_emotions: patterns || [],
          integration_status: 'unprocessed',
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (momentError) throw momentError;
      if (!moment) {
        throw new AppError(500, 'Failed to create shadow moment');
      }

      return {
        id: moment.id,
        title: moment.emotional_valence,
        description: moment.content,
        intensity: 0,
        patterns: moment.related_emotions,
        created_at: moment.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create shadow moment: ${error}`);
    }
  }

  async getShadowMoments(userId: string, limit = 50): Promise<ShadowMoment[]> {
    try {
      const { data: moments, error: momentsError } = await this.supabase
        .from('shadow_moments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (momentsError) throw momentsError;

      return (
        moments?.map((m) => ({
          id: m.id,
          title: m.emotional_valence,
          description: m.content,
          intensity: 0,
          patterns: m.related_emotions,
          created_at: m.created_at,
        })) || []
      );
    } catch (error) {
      throw new AppError(500, `Failed to get shadow moments: ${error}`);
    }
  }

  async deleteShadowMoment(userId: string, momentId: string): Promise<void> {
    try {
      const { error: delError } = await this.supabase
        .from('shadow_moments')
        .delete()
        .eq('user_id', userId)
        .eq('id', momentId);

      if (delError) throw delError;
    } catch (error) {
      throw new AppError(500, `Failed to delete shadow moment: ${error}`);
    }
  }
}

export const emotionalService = new EmotionalService();
