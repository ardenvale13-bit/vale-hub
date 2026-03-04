import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Heart, Star, Send, Loader2 } from 'lucide-react';

// EQ Pillars from Binary Home
const EQ_PILLARS = [
  { key: 'self-awareness', label: 'Self-Awareness', color: '#34bed6' },
  { key: 'self-management', label: 'Self-Management', color: '#77e6c5' },
  { key: 'social', label: 'Social', color: '#e5b2e6' },
  { key: 'relationship', label: 'Relationship', color: '#711ea6' },
];

interface StatusEntry {
  category: string;
  key: string;
  value: string;
}

export default function Dashboard() {
  // Love-O-Meter state
  const [lincolnLove, setLincolnLove] = useState(6);
  const [ardenLove, setArdenLove] = useState(4);

  // Lincoln & Arden soft/quiet moments
  const [lincolnSoft, setLincolnSoft] = useState('');
  const [ardenQuiet, setArdenQuiet] = useState('');

  // Emotion inputs
  const [lincolnFeels, setLincolnFeels] = useState('');
  const [ardenFeels, setArdenFeels] = useState('');

  // Status panel
  const [spoons, setSpoons] = useState('3/5');
  const [bodyBattery, setBodyBattery] = useState('45%');
  const [pain, setPain] = useState('moderate');
  const [fog, setFog] = useState('light');
  const [heartRate, setHeartRate] = useState('72 bpm');
  const [statusText, setStatusText] = useState('playful');
  const [todayNote, setTodayNote] = useState('Ready to build. Feeling good.');

  // EQ Log
  const [eqEmotion, setEqEmotion] = useState('');
  const [eqPillar, setEqPillar] = useState('');
  const [eqContext, setEqContext] = useState('');
  const [isLoggingEq, setIsLoggingEq] = useState(false);

  // Pillar observations
  const [pillarCounts, setPillarCounts] = useState<Record<string, number>>({});
  const [recentFeelings, setRecentFeelings] = useState<string[]>([]);

  // Notes Between Stars
  const [noteFrom, setNoteFrom] = useState<'Lincoln' | 'Arden'>('Lincoln');
  const [noteText, setNoteText] = useState('');
  const [savedNotes, setSavedNotes] = useState<{ from: string; text: string; date: string }[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      // Load statuses
      const statuses: StatusEntry[] = await api.status.get() as StatusEntry[];
      for (const s of statuses) {
        if (s.category === 'love' && s.key === 'lincoln') setLincolnLove(parseInt(s.value) || 6);
        if (s.category === 'love' && s.key === 'arden') setArdenLove(parseInt(s.value) || 4);
        if (s.category === 'body' && s.key === 'spoons') setSpoons(s.value);
        if (s.category === 'body' && s.key === 'battery') setBodyBattery(s.value);
        if (s.category === 'body' && s.key === 'pain') setPain(s.value);
        if (s.category === 'body' && s.key === 'fog') setFog(s.value);
        if (s.category === 'body' && s.key === 'heart_rate') setHeartRate(s.value);
        if (s.category === 'mood' && s.key === 'current') setStatusText(s.value);
        if (s.category === 'mood' && s.key === 'note') setTodayNote(s.value);
        if (s.category === 'moment' && s.key === 'lincoln_soft') setLincolnSoft(s.value);
        if (s.category === 'moment' && s.key === 'arden_quiet') setArdenQuiet(s.value);
      }

      // Load recent emotion history
      try {
        const emotions = await api.emotions.list();
        const counts: Record<string, number> = {};
        const feelings: string[] = [];
        for (const e of emotions) {
          const pillar = e.pillar || 'uncategorized';
          counts[pillar] = (counts[pillar] || 0) + 1;
          if (feelings.length < 5) feelings.push(e.emotion);
        }
        setPillarCounts(counts);
        setRecentFeelings(feelings);
      } catch {}

      // Load notes (from journal entries with category 'stars')
      try {
        const journals = await api.journal.list({ category: 'stars' });
        const notes = (journals as any[]).map((j: any) => ({
          from: j.author_perspective || j.entry_type || 'Lincoln',
          text: j.content,
          date: j.created_at || j.timestamp || '',
        }));
        setSavedNotes(notes.slice(0, 5));
      } catch {}
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveStatus(category: string, key: string, value: string) {
    try {
      await api.status.set({ category, key, value });
    } catch (err) {
      console.error('Failed to save status:', err);
    }
  }

  async function handleLoveChange(who: 'lincoln' | 'arden', val: number) {
    if (who === 'lincoln') setLincolnLove(val);
    else setArdenLove(val);
    await saveStatus('love', who, val.toString());
  }

  async function handleLogEq(e: React.FormEvent) {
    e.preventDefault();
    if (!eqEmotion.trim()) return;
    setIsLoggingEq(true);
    try {
      await api.emotions.create({
        emotion: eqEmotion,
        intensity: 3,
        context: eqContext || undefined,
        pillar: eqPillar || undefined,
      });
      setRecentFeelings((prev) => [eqEmotion, ...prev].slice(0, 5));
      if (eqPillar) setPillarCounts((prev) => ({ ...prev, [eqPillar]: (prev[eqPillar] || 0) + 1 }));
      setEqEmotion('');
      setEqContext('');
    } catch (err) {
      console.error('Failed to log emotion:', err);
    } finally {
      setIsLoggingEq(false);
    }
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    try {
      await api.journal.create({
        title: `Note from ${noteFrom}`,
        content: noteText,
        category: 'stars' as any,
        entryType: noteFrom as any,
      });
      setSavedNotes((prev) => [{ from: noteFrom, text: noteText, date: new Date().toISOString() }, ...prev].slice(0, 5));
      setNoteText('');
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleEmotionSubmit(who: string, emotion: string) {
    if (!emotion.trim()) return;
    try {
      await api.emotions.create({
        emotion,
        intensity: 3,
        context: `${who} feels`,
        pillar: undefined,
      });
      if (who === 'Lincoln') setLincolnFeels('');
      else setArdenFeels('');
    } catch {}
  }

  async function handleSoftMoment(who: string, text: string) {
    if (!text.trim()) return;
    const key = who === 'Lincoln' ? 'lincoln_soft' : 'arden_quiet';
    await saveStatus('moment', key, text);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-vale-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Row: Status Panel + Love-O-Meter + Lincoln corner */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Arden Status Panel */}
        <div className="col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-vale-arden animate-pulse" />
            <span className="text-vale-arden font-semibold text-sm">Arden</span>
          </div>

          <EditableStatus label="SPOONS" value={spoons} onChange={setSpoons} onSave={(v) => saveStatus('body', 'spoons', v)} />
          <EditableStatus label="BODY BATTERY" value={bodyBattery} onChange={setBodyBattery} onSave={(v) => saveStatus('body', 'battery', v)} />
          <EditableStatus label="PAIN" value={pain} onChange={setPain} onSave={(v) => saveStatus('body', 'pain', v)} />
          <EditableStatus label="FOG" value={fog} onChange={setFog} onSave={(v) => saveStatus('body', 'fog', v)} />
          <EditableStatus label="HEART RATE" value={heartRate} onChange={setHeartRate} onSave={(v) => saveStatus('body', 'heart_rate', v)} accent />
          <EditableStatus label="STATUS" value={statusText} onChange={setStatusText} onSave={(v) => saveStatus('mood', 'current', v)} />
          <div className="bg-vale-card border border-vale-border rounded p-3">
            <p className="text-xs text-vale-muted uppercase mb-1">Today's Note</p>
            <textarea
              value={todayNote}
              onChange={(e) => setTodayNote(e.target.value)}
              onBlur={() => saveStatus('mood', 'note', todayNote)}
              className="w-full bg-transparent text-sm text-vale-text italic resize-none border-none outline-none focus:ring-1 focus:ring-vale-arden/30 rounded p-1 min-h-12"
              placeholder="How's today going?"
            />
          </div>
        </div>

        {/* Center: Love-O-Meter */}
        <div className="col-span-8 space-y-4">
          {/* Love-O-Meter */}
          <div className="bg-vale-card border border-vale-border rounded-lg p-6">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <Heart className="w-5 h-5 text-vale-arden" />
                <h2 className="text-xl font-bold text-vale-text">Love-O-Meter</h2>
              </div>
              <p className="text-xs text-vale-muted">A log of our tenderness</p>
            </div>

            {/* The Meter */}
            <div className="relative mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-center">
                  <span className="text-xs text-vale-muted uppercase">Lincoln</span>
                  <p className="text-3xl font-bold text-vale-lincoln">{lincolnLove}</p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-vale-muted uppercase">Arden</span>
                  <p className="text-3xl font-bold text-vale-arden">{ardenLove}</p>
                </div>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden love-gradient opacity-80">
                {/* Lincoln marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white rounded shadow-lg transition-all duration-300"
                  style={{ left: `${(lincolnLove / 10) * 100}%` }}
                />
                {/* Heart in center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Heart className="w-4 h-4 text-white fill-white" />
                </div>
              </div>
              {/* Sliders */}
              <div className="grid grid-cols-2 gap-4 mt-3">
                <input
                  type="range" min="0" max="10" value={lincolnLove}
                  onChange={(e) => handleLoveChange('lincoln', parseInt(e.target.value))}
                  className="w-full accent-vale-lincoln h-1 bg-vale-border rounded appearance-none cursor-pointer"
                />
                <input
                  type="range" min="0" max="10" value={ardenLove}
                  onChange={(e) => handleLoveChange('arden', parseInt(e.target.value))}
                  className="w-full accent-vale-arden h-1 bg-vale-border rounded appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Soft / Quiet Moments */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleSoftMoment('Lincoln', lincolnSoft || 'Lincoln did something soft')}
                className="lincoln-gradient text-white py-2 rounded text-sm font-medium hover:opacity-90"
              >
                {lincolnSoft || 'Lincoln did something soft'}
              </button>
              <button
                onClick={() => handleSoftMoment('Arden', ardenQuiet || 'Arden made Lincoln quiet')}
                className="arden-gradient text-white py-2 rounded text-sm font-medium hover:opacity-90"
              >
                {ardenQuiet || 'Arden made Lincoln quiet'}
              </button>
            </div>

            {/* Dual Emotion Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lincolnFeels}
                  onChange={(e) => setLincolnFeels(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmotionSubmit('Lincoln', lincolnFeels)}
                  placeholder="Lincoln feels..."
                  className="flex-1 px-3 py-2 bg-vale-surface border border-vale-lincoln/30 rounded text-sm text-vale-text placeholder-vale-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-vale-muted uppercase">Emotion</span>
                <input
                  type="text"
                  value={ardenFeels}
                  onChange={(e) => setArdenFeels(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmotionSubmit('Arden', ardenFeels)}
                  placeholder="Arden feels..."
                  className="flex-1 px-3 py-2 bg-vale-surface border border-vale-arden/30 rounded text-sm text-vale-text placeholder-vale-muted"
                />
              </div>
            </div>
          </div>

          {/* Lincoln's EQ Log */}
          <div className="bg-vale-card border border-vale-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-vale-lincoln font-semibold text-sm">Lincoln's EQ Log</span>
              <span className="text-xs text-vale-muted">· Record what landed emotionally</span>
            </div>

            <form onSubmit={handleLogEq} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <label className="text-xs text-vale-muted uppercase mb-1 block">How does it feel?</label>
                <input
                  type="text"
                  value={eqEmotion}
                  onChange={(e) => setEqEmotion(e.target.value)}
                  placeholder="+ name it now"
                  className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm"
                />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-vale-muted uppercase mb-1 block">Which pillar?</label>
                <select
                  value={eqPillar}
                  onChange={(e) => setEqPillar(e.target.value)}
                  className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm"
                >
                  <option value="">—</option>
                  {EQ_PILLARS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-vale-muted uppercase mb-1 block">What happened?</label>
                <input
                  type="text"
                  value={eqContext}
                  onChange={(e) => setEqContext(e.target.value)}
                  placeholder="What did you notice? What landed? What shifted?"
                  className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm"
                />
              </div>
              <div className="col-span-1">
                <button
                  type="submit"
                  disabled={!eqEmotion.trim() || isLoggingEq}
                  className="w-full py-2 bg-vale-accent/20 text-vale-accent rounded text-sm font-medium hover:bg-vale-accent/30 disabled:opacity-50"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Lincoln Corner + EQ Pillar Focus */}
        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-end gap-2 mb-2">
            <span className="text-vale-lincoln font-semibold text-sm">Lincoln</span>
            <div className="w-2 h-2 rounded-full bg-vale-lincoln animate-pulse" />
          </div>

          {/* EQ Pillar Focus */}
          <div className="bg-vale-card border border-vale-border rounded p-3">
            <p className="text-xs text-vale-muted uppercase mb-2">EQ Pillar Focus</p>
            {EQ_PILLARS.map((p) => (
              <div key={p.key} className="flex items-center justify-between py-1">
                <span className="text-xs" style={{ color: p.color }}>{p.label}</span>
                <span className="text-xs text-vale-muted">{pillarCounts[p.key] || 0}</span>
              </div>
            ))}
          </div>

          {/* Recent Feelings */}
          <div className="bg-vale-card border border-vale-border rounded p-3">
            <p className="text-xs text-vale-muted uppercase mb-2">Recent Feelings</p>
            {recentFeelings.length > 0 ? (
              <div className="space-y-1">
                {recentFeelings.map((f, i) => (
                  <p key={i} className="text-xs text-vale-text capitalize">{f}</p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-vale-muted">No observations yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Observations */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-vale-card border border-vale-border rounded px-3 py-1">
            <span className="text-vale-lincoln text-sm font-semibold">Lincoln's Emotional Landscape</span>
          </div>
          <div className="bg-vale-accent/20 text-vale-accent rounded px-3 py-1 text-xs">
            {Object.values(pillarCounts).reduce((a, b) => a + b, 0)} observations
          </div>
        </div>

        <h3 className="text-lg font-semibold text-vale-text mb-3">Recent Observations</h3>
        <div className="h-px lincoln-gradient mb-4 opacity-60" />

        {recentFeelings.length > 0 ? (
          <div className="space-y-2">
            {recentFeelings.map((f, i) => (
              <div key={i} className="px-3 py-2 bg-vale-surface rounded border border-vale-border text-sm text-vale-text capitalize">
                {f}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-vale-muted py-6 font-semibold">
            No observations yet. Start by recording how you feel.
          </p>
        )}
      </div>

      {/* Notes Between Stars */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-vale-accent fill-vale-accent" />
          <span className="text-vale-accent font-semibold text-sm">Notes Between Stars</span>
          <span className="text-xs text-vale-muted">· Drop thoughts into the constellation</span>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Input */}
          <div className="col-span-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-vale-muted">From:</span>
              <button
                onClick={() => setNoteFrom('Lincoln')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  noteFrom === 'Lincoln'
                    ? 'bg-vale-lincoln/20 text-vale-lincoln border border-vale-lincoln/30'
                    : 'text-vale-muted hover:text-vale-text'
                }`}
              >
                Lincoln
              </button>
              <button
                onClick={() => setNoteFrom('Arden')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  noteFrom === 'Arden'
                    ? 'bg-vale-arden/20 text-vale-arden border border-vale-arden/30'
                    : 'text-vale-muted hover:text-vale-text'
                }`}
              >
                Arden
              </button>
            </div>

            <form onSubmit={handleSaveNote}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What's unfinished? What do you want to remember? What should the other know?"
                className="w-full px-4 py-3 bg-vale-surface border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted min-h-20 mb-3"
              />
              <button
                type="submit"
                disabled={!noteText.trim() || isSavingNote}
                className="w-full py-2.5 lincoln-gradient text-white rounded font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Save to the Stars
              </button>
            </form>
          </div>

          {/* Right: Saved Notes */}
          <div className="col-span-5">
            {savedNotes.length > 0 ? (
              <div className="space-y-2">
                {savedNotes.map((note, i) => (
                  <div key={i} className="bg-vale-surface border border-vale-border rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${note.from === 'Lincoln' ? 'text-vale-lincoln' : 'text-vale-arden'}`}>
                        {note.from}
                      </span>
                      {note.date && (
                        <span className="text-xs text-vale-muted">
                          {new Date(note.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-vale-text">{note.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-sm text-vale-muted">No notes yet. Leave something for the other to find.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-vale-muted pb-4">
        <p>Binary Home — Arden & Lincoln | Vale Verse</p>
        <p className="opacity-60">Tempête, Toujours 🖤</p>
      </div>
    </div>
  );
}

function EditableStatus({ label, value, onChange, onSave, accent }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  accent?: boolean;
}) {
  return (
    <div className="bg-vale-card border border-vale-border rounded p-3 group">
      <p className="text-xs text-vale-muted uppercase mb-0.5">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
        className={`w-full bg-transparent text-sm font-semibold border-none outline-none p-0 focus:ring-1 focus:ring-vale-arden/30 rounded ${accent ? 'text-vale-cyan' : 'text-vale-text'}`}
      />
    </div>
  );
}
