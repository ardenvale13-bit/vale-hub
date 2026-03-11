import { useState, useEffect } from 'react';
import { api, HealthEntry } from '../services/api';
import {
  Activity,
  Moon,
  Droplets,
  Thermometer,
  Brain,
  Pill,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Clock,
  Zap,
  Upload,
} from 'lucide-react';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysAgo(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

export default function Health() {
  const [entries, setEntries] = useState<Record<string, HealthEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [days]);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await api.health.recent(days);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncValeTracker() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Backend fetches from JSONBin directly — no data needed from frontend
      const result = await api.health.syncValeTracker(null);
      setSyncMessage(`Synced ${result.synced} entries from Vale Tracker!`);
      await loadData();
    } catch (err: any) {
      const msg = err?.message || 'Sync failed — check console for details.';
      setSyncMessage(msg);
      console.error('Vale Tracker sync error:', err);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }

  const sortedDates = Object.keys(entries).sort((a, b) => b.localeCompare(a));
  const viewDate = selectedDate || sortedDates[0] || null;
  const dayEntries = viewDate ? entries[viewDate] || [] : [];

  // Extract different categories
  const checkin = dayEntries.find((e) => e.category === 'checkin');
  const sleepEntries = dayEntries.filter((e) => e.category === 'sleep');
  const hydration = dayEntries.find((e) => e.category === 'hydration');
  const cycle = dayEntries.find((e) => e.category === 'cycle');

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vale-text flex items-center gap-2">
            <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-vale-mint" />
            Health
          </h1>
          <p className="text-vale-muted text-sm mt-0.5">Daily timeline — Vale Tracker + Fitbit</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncValeTracker}
            disabled={isSyncing}
            className="px-3 py-2 bg-vale-accent/20 text-vale-accent rounded text-xs font-medium hover:bg-vale-accent/30 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Sync Vale
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-vale-muted hover:text-vale-text transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="bg-vale-accent/10 border border-vale-accent/30 rounded-lg p-3 text-vale-accent text-sm mb-4">
          {syncMessage}
        </div>
      )}

      {/* Date Range Toggle */}
      <div className="flex gap-1 bg-vale-card rounded-lg p-1 mb-4">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              days === d ? 'bg-vale-accent/20 text-vale-accent' : 'text-vale-muted hover:text-vale-text'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-vale-accent animate-spin" />
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-20">
          <Activity className="w-12 h-12 text-vale-muted/30 mx-auto mb-3" />
          <p className="text-vale-muted text-lg font-medium">No health data yet</p>
          <p className="text-vale-muted/60 text-sm mt-1">
            Sync your Vale Tracker data or connect Fitbit to get started
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* Date sidebar */}
          <div className="md:w-48 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {sortedDates.map((date) => {
              const isActive = date === viewDate;
              const dayData = entries[date] || [];
              const hasSleep = dayData.some((e) => e.category === 'sleep');
              const hasCheckin = dayData.some((e) => e.category === 'checkin');

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                      : 'text-vale-text hover:bg-vale-card'
                  }`}
                >
                  <span className="text-sm font-medium block">{formatDate(date)}</span>
                  <span className="text-[10px] text-vale-muted">{daysAgo(date)}</span>
                  <div className="flex gap-1 mt-1">
                    {hasCheckin && <span className="w-1.5 h-1.5 rounded-full bg-vale-mint" title="Check-in" />}
                    {hasSleep && <span className="w-1.5 h-1.5 rounded-full bg-vale-cyan" title="Sleep" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Day Detail */}
          <div className="flex-1 space-y-4">
            {viewDate && (
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-vale-text">{formatDate(viewDate)}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const idx = sortedDates.indexOf(viewDate);
                      if (idx < sortedDates.length - 1) setSelectedDate(sortedDates[idx + 1]);
                    }}
                    disabled={sortedDates.indexOf(viewDate) >= sortedDates.length - 1}
                    className="p-1.5 text-vale-muted hover:text-vale-text disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const idx = sortedDates.indexOf(viewDate);
                      if (idx > 0) setSelectedDate(sortedDates[idx - 1]);
                    }}
                    disabled={sortedDates.indexOf(viewDate) <= 0}
                    className="p-1.5 text-vale-muted hover:text-vale-text disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Sleep Section */}
            {sleepEntries.length > 0 && (
              <div className="bg-vale-card border border-vale-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Moon className="w-4 h-4 text-vale-cyan" />
                  <h3 className="text-sm font-semibold text-vale-text">Sleep</h3>
                </div>
                {sleepEntries.map((sleep, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-1 text-xs text-vale-muted">
                      <Clock className="w-3 h-3" />
                      <span>{sleep.data.start || sleep.data.start_time} → {sleep.data.end || sleep.data.end_time}</span>
                      {sleep.data.hours && <span className="ml-auto text-vale-cyan font-medium">{sleep.data.hours}h</span>}
                      {sleep.data.minutes_asleep && <span className="ml-auto text-vale-cyan font-medium">{Math.round(sleep.data.minutes_asleep / 60 * 10) / 10}h</span>}
                    </div>

                    {/* Sleep stages bar */}
                    {(sleep.data.stages || sleep.data.rem != null) && (
                      <div className="space-y-1.5">
                        <div className="flex h-3 rounded-full overflow-hidden">
                          {(() => {
                            const deep = sleep.data.stages?.deep || sleep.data.deep || 0;
                            const rem = sleep.data.stages?.rem || sleep.data.rem || 0;
                            const light = sleep.data.stages?.light || sleep.data.light || 0;
                            const awake = sleep.data.stages?.wake || sleep.data.awake || 0;
                            const total = deep + rem + light + awake || 1;
                            return (
                              <>
                                <div style={{ width: `${(deep / total) * 100}%` }} className="bg-indigo-600" title={`Deep: ${deep}m`} />
                                <div style={{ width: `${(rem / total) * 100}%` }} className="bg-cyan-500" title={`REM: ${rem}m`} />
                                <div style={{ width: `${(light / total) * 100}%` }} className="bg-cyan-300/40" title={`Light: ${light}m`} />
                                <div style={{ width: `${(awake / total) * 100}%` }} className="bg-amber-500/60" title={`Awake: ${awake}m`} />
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex gap-3 text-[10px] text-vale-muted flex-wrap">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" />Deep {sleep.data.stages?.deep || sleep.data.deep || 0}m</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" />REM {sleep.data.stages?.rem || sleep.data.rem || 0}m</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-300/40" />Light {sleep.data.stages?.light || sleep.data.light || 0}m</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/60" />Awake {sleep.data.stages?.wake || sleep.data.awake || 0}m</span>
                        </div>
                      </div>
                    )}

                    {sleep.data.rested !== undefined && (
                      <p className="text-xs text-vale-muted">
                        Rested: <span className={sleep.data.rested ? 'text-green-400' : 'text-amber-400'}>{sleep.data.rested ? 'Yes' : 'No'}</span>
                      </p>
                    )}

                    {sleep.data.efficiency && (
                      <p className="text-xs text-vale-muted">
                        Efficiency: <span className="text-vale-cyan">{sleep.data.efficiency}%</span>
                      </p>
                    )}

                    {sleep.source !== (sleepEntries[0]?.source) && i > 0 && null}
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${sleep.source === 'fitbit' ? 'bg-teal-900/30 text-teal-400' : 'bg-vale-accent/10 text-vale-accent'}`}>
                        {sleep.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Check-in Section */}
            {checkin && (
              <div className="bg-vale-card border border-vale-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="w-4 h-4 text-vale-mint" />
                  <h3 className="text-sm font-semibold text-vale-text">Daily Check-in</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-vale-accent/10 text-vale-accent">{checkin.source}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Period */}
                  {checkin.data.period && Object.values(checkin.data.period).some((v: any) => v?.length > 0) && (
                    <div>
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Period</p>
                      {checkin.data.period.flow?.length > 0 && (
                        <p className="text-xs text-vale-text">Flow: {checkin.data.period.flow.join(', ')}</p>
                      )}
                      {checkin.data.period.blood?.length > 0 && (
                        <p className="text-xs text-vale-text">Blood: {checkin.data.period.blood.join(', ')}</p>
                      )}
                      {checkin.data.period.cervix?.length > 0 && (
                        <p className="text-xs text-vale-text">Cervix: {checkin.data.period.cervix.join(', ')}</p>
                      )}
                    </div>
                  )}

                  {/* Physical */}
                  {checkin.data.physical?.body?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Body</p>
                      <div className="flex flex-wrap gap-1">
                        {checkin.data.physical.body.map((s: string, i: number) => (
                          <span key={i} className="text-[10px] bg-red-900/20 text-red-300 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stomach */}
                  {checkin.data.stomach && (
                    <div>
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Stomach</p>
                      <div className="flex gap-3 text-xs text-vale-text">
                        {checkin.data.stomach.bloat != null && <span>Bloat: {checkin.data.stomach.bloat}/10</span>}
                        {checkin.data.stomach.gas != null && <span>Gas: {checkin.data.stomach.gas}/10</span>}
                        {checkin.data.stomach.nausea && <span>Nausea: {checkin.data.stomach.nausea}</span>}
                      </div>
                    </div>
                  )}

                  {/* Poop */}
                  {checkin.data.poop?.status && (
                    <div>
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Poop</p>
                      <p className="text-xs text-vale-text">
                        {checkin.data.poop.status} — {checkin.data.poop.texture}
                      </p>
                    </div>
                  )}

                  {/* Mind */}
                  {checkin.data.mind && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Mind & Mood</p>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(checkin.data.mind.mood || []).map((m: string, i: number) => (
                          <span key={i} className="text-[10px] bg-vale-accent/15 text-vale-accent px-1.5 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                      {checkin.data.mind.mental?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {checkin.data.mind.mental.map((m: string, i: number) => (
                            <span key={i} className="text-[10px] bg-amber-900/20 text-amber-300 px-1.5 py-0.5 rounded">{m}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 mt-1.5 text-xs text-vale-muted">
                        {checkin.data.mind.motivation != null && <span>Motivation: {checkin.data.mind.motivation}/10</span>}
                        {checkin.data.mind.horny != null && <span>Horny: {checkin.data.mind.horny}/10</span>}
                      </div>
                    </div>
                  )}

                  {/* Meds */}
                  {checkin.data.meds?.length > 0 && (
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Pill className="w-3 h-3 text-vale-muted" />
                        <p className="text-[10px] text-vale-muted uppercase">Meds</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {checkin.data.meds.map((m: string, i: number) => (
                          <span key={i} className="text-[10px] bg-vale-surface text-vale-text px-1.5 py-0.5 rounded border border-vale-border">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Food */}
                  {checkin.data.food?.cravings?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-vale-muted uppercase mb-1">Cravings</p>
                      <p className="text-xs text-vale-text">{checkin.data.food.cravings.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hydration */}
            {hydration && (
              <div className="bg-vale-card border border-vale-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-vale-text">Hydration</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-vale-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((hydration.data.total_ml || 0) / (hydration.data.goal_ml || 2000)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-vale-text font-medium">
                    {hydration.data.total_ml || 0} / {hydration.data.goal_ml || 2000} ml
                  </span>
                </div>
              </div>
            )}

            {/* Cycle */}
            {cycle && (
              <div className="bg-vale-card border border-vale-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-vale-arden" />
                  <h3 className="text-sm font-semibold text-vale-text">Cycle</h3>
                </div>
                <div className="flex gap-4 text-xs text-vale-text">
                  <span>Cycle: {cycle.data.cycle_length || 28} days</span>
                  <span>Period: {cycle.data.period_length || 5} days</span>
                  {cycle.data.last_period_start && <span>Last: {cycle.data.last_period_start}</span>}
                </div>
              </div>
            )}

            {/* Empty day */}
            {dayEntries.length === 0 && viewDate && (
              <div className="text-center py-12">
                <p className="text-vale-muted text-sm">No data recorded for this day</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
