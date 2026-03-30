import { useState, useEffect, useRef } from 'react';
import { api, StatusHistory, DashboardImage, SpotifyNowPlaying, DailyQuestion, DeskItem, Reminder, Weather } from '../services/api';
import { Heart, Star, Send, Loader2, ChevronDown, Clock, ImagePlus, X, Music2, ExternalLink, SkipBack, SkipForward, Play, Pause, HelpCircle, Archive, Inbox, Check, Bell, Coffee, HeartPulse, ListTodo, Gift, Cloud, CloudSun, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Sunrise, Sunset } from 'lucide-react';

// EQ Pillars from Binary Home
const EQ_PILLARS = [
  { key: 'self-awareness', label: 'Self-Awareness', color: '#34bed6' },
  { key: 'self-management', label: 'Self-Management', color: '#8a8a9a' },
  { key: 'social', label: 'Social', color: '#e5b2e6' },
  { key: 'relationship', label: 'Relationship', color: '#711ea6' },
];

interface StatusEntry {
  category: string;
  key: string;
  value: string;
}

interface StatusCard {
  label: string;
  category: string;
  key: string;
  unit?: string;
}

export default function Dashboard() {
  // Love-O-Meter state — single shared value 0-10 (5 = center)
  // Lower = Lincoln's side, Higher = Arden's side
  const [loveMeter, setLoveMeter] = useState(5);
  const [loveEntry, setLoveEntry] = useState('');
  const [isSubmittingLove, setIsSubmittingLove] = useState(false);

  // Lincoln & Arden soft/quiet moments
  const [lincolnSoft, setLincolnSoft] = useState('');
  const [ardenQuiet, setArdenQuiet] = useState('');

  // Emotion inputs
  const [lincolnFeels, setLincolnFeels] = useState('');
  const [ardenFeels, setArdenFeels] = useState('');

  // Status panel
  const [statusValues, setStatusValues] = useState<Record<string, string>>({
    'body-spoons': '3/5',
    'body-battery': '45%',
    'body-pain': 'moderate',
    'body-heart_rate': '72 bpm',
  });
  const [editingStatus, setEditingStatus] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  // Status text and note
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

  // Status history (last 24h)
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);

  // Spotify
  const [spotifyData, setSpotifyData] = useState<SpotifyNowPlaying | null>(null);

  // Daily question
  const [currentQuestion, setCurrentQuestion] = useState<DailyQuestion | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<DailyQuestion[]>([]);
  const [showQuestionArchive, setShowQuestionArchive] = useState(false);

  // Dashboard image
  const [dashboardImage, setDashboardImage] = useState<DashboardImage | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lincoln's Desk notifications
  const [deskItems, setDeskItems] = useState<DeskItem[]>([]);
  const [showDesk, setShowDesk] = useState(false);

  // Reminders
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const [showReminders, setShowReminders] = useState(true);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Poll desk for unread items every 30s
  useEffect(() => {
    let active = true;
    async function pollDesk() {
      try {
        const items = await api.desk.list(true);
        if (active) setDeskItems(items as DeskItem[]);
      } catch { /* desk might not be set up yet */ }
    }
    pollDesk();
    const interval = setInterval(pollDesk, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Poll for due reminders every 30s
  useEffect(() => {
    let active = true;
    async function pollReminders() {
      try {
        const items = await api.reminders.due();
        if (active) setDueReminders(items as Reminder[]);
      } catch { /* reminders table might not exist yet */ }
    }
    pollReminders();
    const interval = setInterval(pollReminders, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Spotify polling — every 10s
  useEffect(() => {
    let active = true;
    async function pollSpotify() {
      try {
        const data = await api.spotify.nowPlaying();
        if (active) setSpotifyData(data);
      } catch {
        // silently ignore — spotify might not be configured
      }
    }
    pollSpotify();
    const interval = setInterval(pollSpotify, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      // Fire all requests in parallel
      const [statuses, emotions, journals, history, dashImg, questionData, questionList] = await Promise.all([
        api.status.get().catch(() => [] as StatusEntry[]),
        api.emotions.list().catch(() => []),
        api.journal.list({ category: 'stars' }).catch(() => []),
        api.status.history(24).catch(() => [] as StatusHistory[]),
        api.images.getDashboardImage().catch(() => ({ image: null })),
        api.questions.current().catch(() => null),
        api.questions.list(5).catch(() => ({ questions: [], total: 0 })),
      ]);

      setCurrentQuestion(questionData as DailyQuestion | null);
      setRecentQuestions(((questionList as any)?.questions || []).filter((q: any) => q.answer));

      setStatusHistory(history as StatusHistory[]);
      if ((dashImg as any)?.image) {
        setDashboardImage((dashImg as any).image);
        setImageCaption((dashImg as any).image.caption || '');
      }

      // Process statuses
      const newStatusValues: Record<string, string> = { ...statusValues };
      for (const s of (statuses as StatusEntry[]) || []) {
        const key = `${s.category}-${s.key}`;
        newStatusValues[key] = s.value;
        if (s.category === 'mood' && s.key === 'current') setStatusText(s.value);
        if (s.category === 'mood' && s.key === 'note') setTodayNote(s.value);
        if (s.category === 'moment' && s.key === 'lincoln_soft') setLincolnSoft(s.value);
        if (s.category === 'moment' && s.key === 'arden_quiet') setArdenQuiet(s.value);
      }
      setStatusValues(newStatusValues);

      // Process emotions
      const counts: Record<string, number> = {};
      const feelings: string[] = [];
      for (const e of emotions as any[]) {
        const pillar = e.pillar || 'uncategorized';
        counts[pillar] = (counts[pillar] || 0) + 1;
        if (feelings.length < 5) feelings.push(e.emotion);
      }
      setPillarCounts(counts);
      setRecentFeelings(feelings);

      // Process star notes
      const notes = (journals as any[]).map((j: any) => ({
        from: j.author_perspective || j.entry_type || 'Lincoln',
        text: j.content,
        date: j.created_at || j.timestamp || '',
      }));
      setSavedNotes(notes.slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusSave(category: string, key: string, value: string) {
    const statusKey = `${category}-${key}`;
    setSavingStatus((prev) => ({ ...prev, [statusKey]: true }));
    try {
      await api.status.set(category, key, value);
      setStatusValues((prev) => ({ ...prev, [statusKey]: value }));
      setEditingStatus((prev) => {
        const next = { ...prev };
        delete next[statusKey];
        return next;
      });
    } catch (err) {
      console.error('Failed to save status:', err);
    } finally {
      setSavingStatus((prev) => ({ ...prev, [statusKey]: false }));
    }
  }

  async function handleLoveMeterChange(val: number) {
    const clamped = Math.min(10, Math.max(0, Math.round(val * 10) / 10));
    setLoveMeter(clamped);
    await handleStatusSave('love', 'meter', clamped.toString());
  }

  async function handleLoveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!loveEntry.trim()) return;
    setIsSubmittingLove(true);
    try {
      const text = loveEntry.trim();
      const lower = text.toLowerCase();
      // Determine direction: if entry starts with a name, shift that direction
      let shift = 0;
      if (lower.startsWith('arden')) {
        shift = 0.5; // shift toward Arden (higher)
      } else if (lower.startsWith('lincoln') || lower.startsWith('linc')) {
        shift = -0.5; // shift toward Lincoln (lower)
      }

      const newVal = Math.min(10, Math.max(0, Math.round((loveMeter + shift) * 10) / 10));
      setLoveMeter(newVal);
      await handleStatusSave('love', 'meter', newVal.toString());

      // Log it as an emotion too
      await api.emotions.create({
        emotion: text,
        intensity: 3,
        context: 'love-o-meter entry',
        pillar: 'relationship',
      });

      setLoveEntry('');
    } catch (err) {
      console.error('Failed to save love entry:', err);
    } finally {
      setIsSubmittingLove(false);
    }
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
        entryType: 'journal',
        author_perspective: noteFrom,
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
    } catch (err) {
      console.error('Failed to save emotion:', err);
    }
  }

  const statusItems: StatusCard[] = [
    { label: 'Spoons', category: 'body', key: 'spoons', unit: '/' },
    { label: 'Battery', category: 'body', key: 'battery', unit: '%' },
    { label: 'Pain', category: 'body', key: 'pain' },
    { label: 'HR', category: 'body', key: 'heart_rate', unit: 'bpm' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-obelisk-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-20">
      {/* Love-O-Meter */}
      <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border">
        <h2 className="text-xl font-bold text-obelisk-gold mb-4">Love-O-Meter</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-obelisk-muted">Lincoln</span>
            <div className="flex-1 mx-4 h-8 bg-obelisk-border rounded-full relative">
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={loveMeter}
                onChange={(e) => handleLoveMeterChange(parseFloat(e.target.value))}
                className="w-full h-full cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-obelisk-gold rounded-full border-2 border-obelisk-darker pointer-events-none"
                style={{ left: `${(loveMeter / 10) * 100}%` }}
              />
            </div>
            <span className="text-sm text-obelisk-muted">Arden</span>
          </div>
          <div className="text-center text-sm text-obelisk-muted">Position: {loveMeter.toFixed(1)}</div>
          <form onSubmit={handleLoveEntry} className="flex gap-2">
            <input
              type="text"
              value={loveEntry}
              onChange={(e) => setLoveEntry(e.target.value)}
              placeholder="Log a love moment..."
              className="flex-1 px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm"
            />
            <button
              type="submit"
              disabled={isSubmittingLove}
              className="px-4 py-2 bg-obelisk-gold text-obelisk-darker font-semibold rounded hover:bg-obelisk-gold/90 disabled:opacity-50"
            >
              {isSubmittingLove ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </section>

      {/* Status Cards with Editable Inputs */}
      <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border">
        <h2 className="text-xl font-bold text-obelisk-gold mb-4">Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusItems.map((item) => {
            const statusKey = `${item.category}-${item.key}`;
            const currentValue = statusValues[statusKey] || '—';
            const isEditing = statusKey in editingStatus;
            const editValue = editingStatus[statusKey] || currentValue;

            return (
              <div key={statusKey} className="bg-obelisk-darker rounded-lg p-4 border border-obelisk-border">
                <p className="text-obelisk-muted text-sm mb-3">{item.label}</p>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditingStatus((prev) => ({ ...prev, [statusKey]: e.target.value }))}
                      className="w-full px-2 py-1 bg-obelisk-card border border-obelisk-gold rounded text-obelisk-gold text-sm font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleStatusSave(item.category, item.key, editValue);
                        } else if (e.key === 'Escape') {
                          setEditingStatus((prev) => {
                            const next = { ...prev };
                            delete next[statusKey];
                            return next;
                          });
                        }
                      }}
                      onBlur={() => {
                        handleStatusSave(item.category, item.key, editValue);
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="text-2xl font-bold text-obelisk-gold cursor-pointer hover:opacity-80 transition"
                    onClick={() => setEditingStatus((prev) => ({ ...prev, [statusKey]: currentValue }))}
                  >
                    {currentValue}
                    {item.unit && <span className="text-lg ml-1">{item.unit}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Soft Moments */}
      <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border">
        <h2 className="text-xl font-bold text-obelisk-gold mb-4">Soft Moments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-obelisk-muted">Lincoln's Soft Moment</label>
            <input
              type="text"
              value={lincolnSoft}
              onChange={(e) => setLincolnSoft(e.target.value)}
              onBlur={() => handleStatusSave('moment', 'lincoln_soft', lincolnSoft)}
              placeholder="A quiet, tender moment..."
              className="w-full px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-obelisk-muted">Arden's Quiet Moment</label>
            <input
              type="text"
              value={ardenQuiet}
              onChange={(e) => setArdenQuiet(e.target.value)}
              onBlur={() => handleStatusSave('moment', 'arden_quiet', ardenQuiet)}
              placeholder="A peaceful, grounding moment..."
              className="w-full px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm"
            />
          </div>
        </div>
      </section>

      {/* Notes Between Stars */}
      <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border">
        <h2 className="text-xl font-bold text-obelisk-gold mb-4">Notes Between Stars</h2>
        <form onSubmit={handleSaveNote} className="space-y-3">
          <div className="flex gap-2">
            <select
              value={noteFrom}
              onChange={(e) => setNoteFrom(e.target.value as 'Lincoln' | 'Arden')}
              className="px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text"
            >
              <option value="Lincoln">Lincoln (gold)</option>
              <option value="Arden">Arden (pink)</option>
            </select>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write a note to the constellation..."
            className="w-full px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm h-20 resize-none"
          />
          <button
            type="submit"
            disabled={isSavingNote}
            className="w-full px-4 py-2 bg-obelisk-gold text-obelisk-darker font-semibold rounded hover:bg-obelisk-gold/90 disabled:opacity-50"
          >
            {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Star className="w-4 h-4 inline mr-2" />}
            Save Note
          </button>
        </form>
        {savedNotes.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-obelisk-muted">Recent:</p>
            {savedNotes.map((note, idx) => (
              <div key={idx} className="text-xs text-obelisk-text/70 p-2 bg-obelisk-darker rounded italic">
                <span className="font-semibold">{note.from}:</span> {note.text}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EQ Log */}
      <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border">
        <h2 className="text-xl font-bold text-obelisk-gold mb-4">EQ Log</h2>
        <form onSubmit={handleLogEq} className="space-y-3">
          <input
            type="text"
            value={eqEmotion}
            onChange={(e) => setEqEmotion(e.target.value)}
            placeholder="What emotion are you feeling?"
            className="w-full px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={eqPillar}
              onChange={(e) => setEqPillar(e.target.value)}
              className="px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text"
            >
              <option value="">EQ Pillar</option>
              {EQ_PILLARS.map((pillar) => (
                <option key={pillar.key} value={pillar.key}>
                  {pillar.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={eqContext}
              onChange={(e) => setEqContext(e.target.value)}
              placeholder="Context (optional)"
              className="px-3 py-2 bg-obelisk-darker border border-obelisk-border rounded text-obelisk-text text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isLoggingEq}
            className="w-full px-4 py-2 bg-obelisk-gold text-obelisk-darker font-semibold rounded hover:bg-obelisk-gold/90 disabled:opacity-50"
          >
            {isLoggingEq ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Heart className="w-4 h-4 inline mr-2" />}
            Log Emotion
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {recentFeelings.map((feeling, idx) => (
            <span key={idx} className="px-2 py-1 bg-obelisk-darker rounded-full text-xs text-obelisk-gold">
              {feeling}
            </span>
          ))}
        </div>
      </section>

      {/* Placeholder for additional sections that existed in original */}
      {dueReminders.length > 0 && showReminders && (
        <section className="bg-obelisk-card rounded-lg p-6 border border-obelisk-border border-obelisk-gold/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-obelisk-gold flex items-center gap-2">
              <Bell className="w-5 h-5" /> Due Reminders
            </h2>
            <button onClick={() => setShowReminders(false)} className="text-obelisk-muted hover:text-obelisk-gold">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {dueReminders.map((reminder) => (
              <div key={reminder.id} className="text-sm text-obelisk-text p-2 bg-obelisk-darker rounded">
                {reminder.content}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  