import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const supabase = getSupabaseClient();

export interface HealthEntry {
  id?: string;
  date: string;
  source: string;
  category: string;
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

class HealthService {
  /**
   * Upsert a health entry — one per (date, source, category)
   */
  async upsert(userId: string, entry: Omit<HealthEntry, 'id'>): Promise<HealthEntry> {
    const { data, error } = await supabase
      .from('health_entries')
      .upsert(
        {
          user_id: userId,
          date: entry.date,
          source: entry.source,
          category: entry.category,
          data: entry.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date,source,category' },
      )
      .select('*')
      .single();

    if (error) throw new AppError(500, `Failed to upsert health entry: ${error.message}`);
    return data;
  }

  /**
   * Bulk upsert — used for syncing entire datasets
   */
  async bulkUpsert(userId: string, entries: Omit<HealthEntry, 'id'>[]): Promise<number> {
    const rows = entries.map((e) => ({
      user_id: userId,
      date: e.date,
      source: e.source,
      category: e.category,
      data: e.data,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('health_entries')
      .upsert(rows, { onConflict: 'user_id,date,source,category' });

    if (error) throw new AppError(500, `Failed to bulk upsert: ${error.message}`);
    return rows.length;
  }

  /**
   * Get a single day's health data across all sources
   */
  async getDay(userId: string, date: string): Promise<HealthEntry[]> {
    const { data, error } = await supabase
      .from('health_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('source');

    if (error) throw new AppError(500, `Failed to get day: ${error.message}`);
    return data || [];
  }

  /**
   * Get a date range of health data
   */
  async getRange(userId: string, startDate: string, endDate: string, category?: string): Promise<HealthEntry[]> {
    let query = supabase
      .from('health_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to get range: ${error.message}`);
    return data || [];
  }

  /**
   * Get the most recent N days of data
   */
  async getRecent(userId: string, days: number = 7): Promise<Record<string, HealthEntry[]>> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const entries = await this.getRange(userId, startDate, endDate);

    // Group by date
    const byDate: Record<string, HealthEntry[]> = {};
    for (const entry of entries) {
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    }

    return byDate;
  }

  /**
   * Delete a health entry
   */
  async delete(userId: string, entryId: string): Promise<void> {
    const { error } = await supabase
      .from('health_entries')
      .delete()
      .eq('user_id', userId)
      .eq('id', entryId);

    if (error) throw new AppError(500, `Failed to delete: ${error.message}`);
  }

  /**
   * Sync Vale Tracker data — takes the raw JSONBin data and normalizes into health_entries
   */
  async syncValeTracker(userId: string, valeData: any): Promise<{ synced: number }> {
    const entries: Omit<HealthEntry, 'id'>[] = [];

    // Sync checkins
    if (valeData.checkins) {
      for (const [dateKey, checkin] of Object.entries(valeData.checkins)) {
        const c = checkin as any;
        entries.push({
          date: c.date || dateKey,
          source: 'vale-tracker',
          category: 'checkin',
          data: {
            period: c.period || {},
            physical: c.physical || {},
            stomach: c.stomach || {},
            poop: c.poop || {},
            skin: c.skin || {},
            food: c.food || {},
            meds: c.meds || [],
            mind: c.mind || {},
            sexual: c.sexual || {},
          },
        });
      }
    }

    // Sync sleep
    if (valeData.sleep && Array.isArray(valeData.sleep)) {
      for (const s of valeData.sleep) {
        if (!s.date) continue;
        entries.push({
          date: s.date,
          source: 'vale-tracker',
          category: 'sleep',
          data: {
            start: s.start,
            end: s.end,
            hours: s.hours,
            rem: s.rem,
            deep: s.deep,
            light: s.light,
            awake: s.awake,
            dream: s.dream,
            rested: s.rested,
          },
        });
      }
    }

    // Sync hydration
    if (valeData.hydration?.days) {
      for (const [dateKey, dayData] of Object.entries(valeData.hydration.days)) {
        const d = dayData as any;
        const totalMl = (d.entries || []).reduce((sum: number, e: any) => sum + (e.ml || 0), 0);
        entries.push({
          date: dateKey,
          source: 'vale-tracker',
          category: 'hydration',
          data: {
            total_ml: totalMl,
            goal_ml: d.goalMl || 2000,
            entries: d.entries || [],
          },
        });
      }
    }

    // Sync cycle settings as a single entry
    if (valeData.settings) {
      const today = new Date().toISOString().split('T')[0];
      entries.push({
        date: today,
        source: 'vale-tracker',
        category: 'cycle',
        data: {
          cycle_length: valeData.settings.cycleLength,
          period_length: valeData.settings.periodLength,
          last_period_start: valeData.settings.lastPeriodStart,
        },
      });
    }

    const count = await this.bulkUpsert(userId, entries);
    return { synced: count };
  }

  /**
   * Ingest Fitbit sleep data
   */
  async syncFitbitSleep(userId: string, sleepData: any[]): Promise<{ synced: number }> {
    const entries: Omit<HealthEntry, 'id'>[] = [];

    for (const s of sleepData) {
      const date = s.dateOfSleep;
      if (!date) continue;

      const stages = s.levels?.summary || {};
      entries.push({
        date,
        source: 'fitbit',
        category: 'sleep',
        data: {
          start_time: s.startTime,
          end_time: s.endTime,
          duration_ms: s.duration,
          minutes_asleep: s.minutesAsleep,
          minutes_awake: s.minutesAwake,
          efficiency: s.efficiency,
          is_main_sleep: s.isMainSleep,
          stages: {
            deep: stages.deep?.minutes || 0,
            light: stages.light?.minutes || 0,
            rem: stages.rem?.minutes || 0,
            wake: stages.wake?.minutes || 0,
          },
          sleep_score: s.score, // if available from Fitbit Premium
        },
      });
    }

    const count = await this.bulkUpsert(userId, entries);
    return { synced: count };
  }
}

export const healthService = new HealthService();
