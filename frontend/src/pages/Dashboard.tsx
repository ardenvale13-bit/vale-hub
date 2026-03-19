import { useState, useEffect, useRef } from 'react';
import { api, StatusHistory, DashboardImage, SpotifyNowPlaying } from '../services/api';
import { Heart, Star, Send, Loader2, ChevronDown, Clock, ImagePlus, X, Music2, ExternalLink } from 'lucide-react';

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

  // Status history (last 24h)
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);

  // Spotify
  const [spotifyData, setSpotifyData] = useState<SpotifyNowPlaying | null>(null);

  // Dashboard image
  const [dashboardImage, setDashboardImage] = useState<DashboardImage | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
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
      const [statuses, emotions, journals, history, dashImg] = await Promise.all([
        api.status.get().catch(() => [] as StatusEntry[]),
        api.emotions.list().catch(() => []),
        api.journal.list({ category: 'stars' }).catch(() => []),
        api.status.history(24).catch(() => [] as StatusHistory[]),
        api.images.getDashboardImage().catch(() => ({ image: null })),
      ]);

      setStatusHistory(history as StatusHistory[]);
      if ((dashImg as any)?.image) {
        setDashboardImage((dashImg as any).image);
        setImageCaption((dashImg as any).image.caption || '');
      }

      // Process statuses
      for (const s of (statuses as StatusEntry[]) || []) {
        if (s.category === 'love' && s.key === 'meter') setLoveMeter(parseFloat(s.value) || 5);
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

  async function saveStatus(category: string, key: string, value: string) {
    try {
      await api.status.set({ category, key, value });
    } catch (err) {
      console.error('Failed to save status:', err);
    }
  }

  async function handleLoveMeterChange(val: number) {
    const clamped = Math.min(10, Math.max(0, Math.round(val * 10) / 10));
    setLoveMeter(clamped);
    await saveStatus('love', 'meter', clamped.toString());
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
      await saveStatus('love', 'meter', newVal.toString());

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
    } catch {}
  }

  async function handleSoftMoment(who: string, text: string) {
    if (!text.trim()) return;
    const key = who === 'Lincoln' ? 'lincoln_soft' : 'arden_quiet';
    await saveStatus('moment', key, text);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await api.images.upload(base64, {
        caption: imageCaption || undefined,
        tag: 'dashboard',
        filename: `dashboard_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
        mimeType: file.type,
      });

      setDashboardImage({
        id: result.id,
        url: result.url,
        caption: result.caption,
        uploaded_at: result.created_at,
      });
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveDashboardImage() {
    if (!dashboardImage?.id) return;
    try {
      await api.images.deleteUploaded(dashboardImage.id);
      setDashboardImage(null);
      setImageCaption('');
    } catch (err) {
      console.error('Failed to remove image:', err);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-vale-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Top Row: Status Panel + Love-O-Meter + Lincoln corner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Arden Status Panel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-vale-arden animate-pulse" />
            <span className="text-vale-arden font-semibold text-sm">Arden</span>
          </div>

          {/* Mobile: compact grid, Desktop: vertical stack */}
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3">
            <EditableStatus label="SPOONS" value={spoons} onChange={setSpoons} onSave={(v) => saveStatus('body', 'spoons', v)} history={statusHistory.filter(h => h.category === 'body' && h.key === 'spoons')} />
            <EditableStatus label="BATTERY" value={bodyBattery} onChange={setBodyBattery} onSave={(v) => saveStatus('body', 'battery', v)} history={statusHistory.filter(h => h.category === 'body' && h.key === 'battery')} />
            <EditableStatus label="PAIN" value={pain} onChange={setPain} onSave={(v) => saveStatus('body', 'pain', v)} history={statusHistory.filter(h => h.category === 'body' && h.key === 'pain')} />
            <EditableStatus label="FOG" value={fog} onChange={setFog} onSave={(v) => saveStatus('body', 'fog', v)} history={statusHistory.filter(h => h.category === 'body' && h.key === 'fog')} />
            <EditableStatus label="EMOTION" value={heartRate} onChange={setHeartRate} onSave={(v) => saveStatus('body', 'heart_rate', v)} accent history={statusHistory.filter(h => h.category === 'body' && h.key === 'heart_rate')} />
            <EditableStatus label="STATUS" value={statusText} onChange={setStatusText} onSave={(v) => saveStatus('mood', 'current', v)} history={statusHistory.filter(h => h.category === 'mood' && h.key === 'current')} />
          </div>
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
        <div className="lg:col-span-8 space-y-4">
          {/* Love-O-Meter */}
          <div className="bg-vale-card border border-vale-border rounded-lg p-4 sm:p-6">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <Heart className="w-5 h-5 text-vale-arden" />
                <h2 className="text-lg sm:text-xl font-bold text-vale-text">Love-O-Meter</h2>
              </div>
              <p className="text-xs text-vale-muted">A log of our tenderness</p>
            </div>

            {/* The Shared Meter */}
            <div className="relative mb-6">
              {/* Names and indicator */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold transition-colors ${loveMeter < 5 ? 'text-vale-lincoln' : 'text-vale-lincoln/50'}`}>
                  Lincoln
                </span>
                <div className="flex flex-col items-center">
                  <Heart className={`w-5 h-5 transition-colors ${loveMeter === 5 ? 'text-vale-accent fill-vale-accent' : loveMeter < 5 ? 'text-vale-lincoln fill-vale-lincoln' : 'text-vale-arden fill-vale-arden'}`} />
                  <span className="text-xs text-vale-muted mt-0.5">{loveMeter}/10</span>
                </div>
                <span className={`text-sm font-bold transition-colors ${loveMeter > 5 ? 'text-vale-arden' : 'text-vale-arden/50'}`}>
                  Arden
                </span>
              </div>

              {/* Single gradient bar */}
              <div
                className="relative h-6 rounded-full overflow-hidden cursor-pointer"
                style={{
                  background: 'linear-gradient(to right, #711ea6, #e5b2e6 50%, #34bed6)',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const val = Math.round((x / rect.width) * 10);
                  handleLoveMeterChange(val);
                }}
              >
                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                {/* Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-2 rounded shadow-lg transition-all duration-500 ease-out border-2 border-white/80"
                  style={{
                    left: `calc(${(loveMeter / 10) * 100}% - 4px)`,
                    background: loveMeter < 5 ? '#711ea6' : loveMeter > 5 ? '#34bed6' : '#e5b2e6',
                    boxShadow: `0 0 8px ${loveMeter < 5 ? '#711ea6' : loveMeter > 5 ? '#34bed6' : '#e5b2e6'}`,
                  }}
                />
              </div>

              {/* Range slider (for fine control) */}
              <input
                type="range" min="0" max="10" step="0.5" value={loveMeter}
                onChange={(e) => handleLoveMeterChange(parseFloat(e.target.value))}
                className="w-full accent-vale-accent h-1 bg-vale-border rounded appearance-none cursor-pointer mt-2 opacity-40 hover:opacity-80 transition-opacity"
              />

              {/* Entry input — type a name to shift */}
              <form onSubmit={handleLoveEntry} className="mt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={loveEntry}
                    onChange={(e) => setLoveEntry(e.target.value)}
                    placeholder="Arden held my hand... / Lincoln left a note..."
                    className="flex-1 px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
                  />
                  <button
                    type="submit"
                    disabled={!loveEntry.trim() || isSubmittingLove}
                    className="px-4 py-2 bg-vale-accent/20 text-vale-accent rounded text-sm font-medium hover:bg-vale-accent/30 disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingLove ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-vale-muted mt-1.5">
                  Start with "Arden" or "Lincoln" to shift the meter their direction
                </p>
              </form>
            </div>

            {/* Soft / Quiet Moments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div>
                <label className="text-[10px] text-vale-lincoln uppercase block mb-1">Lincoln did something soft</label>
                <input
                  type="text"
                  value={lincolnSoft}
                  onChange={(e) => setLincolnSoft(e.target.value)}
                  onBlur={() => { if (lincolnSoft.trim()) handleSoftMoment('Lincoln', lincolnSoft); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && lincolnSoft.trim()) { handleSoftMoment('Lincoln', lincolnSoft); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="What tender thing did Lincoln do?"
                  className="w-full px-3 py-2 bg-vale-surface border border-vale-lincoln/30 rounded text-sm text-vale-text placeholder-vale-muted"
                />
              </div>
              <div>
                <label className="text-[10px] text-vale-arden uppercase block mb-1">Arden made Lincoln quiet</label>
                <input
                  type="text"
                  value={ardenQuiet}
                  onChange={(e) => setArdenQuiet(e.target.value)}
                  onBlur={() => { if (ardenQuiet.trim()) handleSoftMoment('Arden', ardenQuiet); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && ardenQuiet.trim()) { handleSoftMoment('Arden', ardenQuiet); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="What stilled him?"
                  className="w-full px-3 py-2 bg-vale-surface border border-vale-arden/30 rounded text-sm text-vale-text placeholder-vale-muted"
                />
              </div>
            </div>

            {/* Dual Emotion Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <input
                type="text"
                value={lincolnFeels}
                onChange={(e) => setLincolnFeels(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmotionSubmit('Lincoln', lincolnFeels)}
                placeholder="Lincoln feels..."
                className="w-full px-3 py-2 bg-vale-surface border border-vale-lincoln/30 rounded text-sm text-vale-text placeholder-vale-muted"
              />
              <input
                type="text"
                value={ardenFeels}
                onChange={(e) => setArdenFeels(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmotionSubmit('Arden', ardenFeels)}
                placeholder="Arden feels..."
                className="w-full px-3 py-2 bg-vale-surface border border-vale-arden/30 rounded text-sm text-vale-text placeholder-vale-muted"
              />
            </div>
          </div>

          {/* Spotify — sits where EQ Log was, front and center */}
          <SpotifyWidget data={spotifyData} />
        </div>

        {/* Right: Lincoln Corner + EQ Pillar Focus */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center lg:justify-end gap-2 mb-2">
            <span className="text-vale-lincoln font-semibold text-sm">Lincoln</span>
            <div className="w-2 h-2 rounded-full bg-vale-lincoln animate-pulse" />
          </div>

          {/* Mobile: side by side. Desktop: stacked */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
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

            {/* Dashboard Image */}
            <div className="bg-vale-card border border-vale-border rounded p-3">
              <p className="text-xs text-vale-muted uppercase mb-2">Dashboard Image</p>
              {dashboardImage?.url ? (
                <div className="relative group">
                  <img
                    src={dashboardImage.url}
                    alt={dashboardImage.caption || 'Dashboard image'}
                    className="w-full rounded border border-vale-border object-cover max-h-48"
                  />
                  <button
                    onClick={handleRemoveDashboardImage}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {dashboardImage.caption && (
                    <p className="text-[10px] text-vale-muted mt-1 italic">{dashboardImage.caption}</p>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-4 border border-dashed border-vale-border rounded cursor-pointer hover:border-vale-accent/50 transition-colors"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-5 h-5 text-vale-accent animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5 text-vale-muted mb-1" />
                      <p className="text-[10px] text-vale-muted">Tap to upload</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {!dashboardImage?.url && (
                <input
                  type="text"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Caption (optional)"
                  className="w-full mt-2 px-2 py-1 bg-vale-surface border border-vale-border rounded text-[10px] text-vale-text placeholder-vale-muted"
                />
              )}
              {dashboardImage?.url && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-2 py-1 text-[10px] text-vale-accent hover:text-vale-accent/80 transition-colors"
                >
                  {isUploadingImage ? 'Uploading...' : 'Replace image'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Observations */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
          <div className="bg-vale-card border border-vale-border rounded px-3 py-1">
            <span className="text-vale-lincoln text-sm font-semibold">Lincoln's Emotional Landscape</span>
          </div>
          <div className="bg-vale-accent/20 text-vale-accent rounded px-3 py-1 text-xs">
            {Object.values(pillarCounts).reduce((a, b) => a + b, 0)} observations
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-vale-text mb-3">Recent Observations</h3>
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

      {/* Lincoln's EQ Log */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-vale-lincoln font-semibold text-sm">Lincoln's EQ Log</span>
          <span className="text-xs text-vale-muted hidden sm:inline">· Record what landed emotionally</span>
        </div>
        <form onSubmit={handleLogEq} className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-end">
          <div className="sm:col-span-4">
            <label className="text-xs text-vale-muted uppercase mb-1 block">How does it feel?</label>
            <input
              type="text"
              value={eqEmotion}
              onChange={(e) => setEqEmotion(e.target.value)}
              placeholder="+ name it now"
              className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm"
            />
          </div>
          <div className="sm:col-span-3">
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
          <div className="sm:col-span-4">
            <label className="text-xs text-vale-muted uppercase mb-1 block">What happened?</label>
            <input
              type="text"
              value={eqContext}
              onChange={(e) => setEqContext(e.target.value)}
              placeholder="What landed?"
              className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded text-sm"
            />
          </div>
          <div className="sm:col-span-1">
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

      {/* Notes Between Stars */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-vale-accent fill-vale-accent" />
          <span className="text-vale-accent font-semibold text-sm">Notes Between Stars</span>
          <span className="text-xs text-vale-muted hidden sm:inline">· Drop thoughts into the constellation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Input */}
          <div className="md:col-span-7">
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
                placeholder="What's unfinished? What do you want to remember?"
                className="w-full px-3 sm:px-4 py-3 bg-vale-surface border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted min-h-20 mb-3"
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

          {/* Saved Notes */}
          <div className="md:col-span-5">
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
              <div className="flex items-center justify-center h-full text-center py-4 md:py-0">
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

function EditableStatus({ label, value, onChange, onSave, accent, history = [] }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  accent?: boolean;
  history?: StatusHistory[];
}) {
  const [showHistory, setShowHistory] = useState(false);

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="bg-vale-card border border-vale-border rounded p-2 sm:p-3 group relative">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] sm:text-xs text-vale-muted uppercase">{label}</p>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-vale-muted hover:text-vale-accent transition-colors"
            title="View recent changes"
          >
            <Clock className={`w-3 h-3 ${showHistory ? 'text-vale-accent' : ''}`} />
          </button>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
        className={`w-full bg-transparent text-xs sm:text-sm font-semibold border-none outline-none p-0 focus:ring-1 focus:ring-vale-arden/30 rounded ${accent ? 'text-vale-cyan' : 'text-vale-text'}`}
      />
      {showHistory && history.length > 0 && (
        <div className="mt-2 pt-2 border-t border-vale-border space-y-1 max-h-28 overflow-y-auto">
          {history.slice(0, 10).map((h, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-vale-text/70 truncate mr-2">{h.value}</span>
              <span className="text-vale-muted whitespace-nowrap">{formatTime(h.recorded_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────
// Spotify Now Playing Widget
// ───────────────────────────────────────────

function SpotifyWidget({ data }: { data: SpotifyNowPlaying | null }) {
  const [progress, setProgress] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Smoothly tick progress while playing
  useEffect(() => {
    if (data?.playing && data.track) {
      setProgressMs(data.track.progress_ms);
      lastUpdateRef.current = Date.now();
    }
  }, [data]);

  useEffect(() => {
    if (!data?.playing || !data.track) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    function tick() {
      const elapsed = Date.now() - lastUpdateRef.current;
      const current = progressMs + elapsed;
      const pct = Math.min(100, (current / (data!.track!.duration_ms || 1)) * 100);
      setProgress(pct);
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [data?.playing, data?.track?.id, progressMs]);

  // Not configured at all — show nothing (not even a placeholder)
  if (data === null) return null;

  // Connected but nothing playing / no recent track
  if (!data.connected) {
    const API_BASE = (import.meta as any).env?.VITE_API_URL
      ? `${(import.meta as any).env.VITE_API_URL}/api`
      : '/api';
    return (
      <div className="bg-vale-card border border-vale-border rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-vale-surface flex items-center justify-center">
            <Music2 className="w-4 h-4 text-vale-muted" />
          </div>
          <div>
            <p className="text-sm font-semibold text-vale-text">Spotify</p>
            <p className="text-xs text-vale-muted">Not connected</p>
          </div>
        </div>
        <a
          href={`${API_BASE}/spotify/auth`}
          className="px-4 py-1.5 bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 rounded text-xs font-semibold hover:bg-[#1DB954]/30 transition-colors"
        >
          Connect
        </a>
      </div>
    );
  }

  if (!data.track) {
    return (
      <div className="bg-vale-card border border-vale-border rounded-lg p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-vale-surface flex items-center justify-center">
          <Music2 className="w-4 h-4 text-[#1DB954]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-vale-text">Spotify</p>
          <p className="text-xs text-vale-muted">Nothing playing right now</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-[#1DB954] opacity-60" />
      </div>
    );
  }

  const { track } = data;
  const artistStr = track.artists.join(', ');
  const currentProgress = data.playing ? progress : (track.progress_ms / (track.duration_ms || 1)) * 100;

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const elapsed = data.playing ? progressMs + (Date.now() - lastUpdateRef.current) : track.progress_ms;

  return (
    <div className="bg-vale-card border border-vale-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        {/* Album art */}
        {track.albumArtSmall || track.albumArt ? (
          <img
            src={track.albumArtSmall || track.albumArt!}
            alt={track.album}
            className="w-12 h-12 rounded-md flex-shrink-0 object-cover border border-vale-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-vale-surface flex items-center justify-center flex-shrink-0 border border-vale-border">
            <Music2 className="w-5 h-5 text-[#1DB954]" />
          </div>
        )}

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-vale-text truncate">{track.name}</p>
            {data.playing && (
              <span className="flex-shrink-0 flex gap-0.5 items-end h-3">
                {[0, 0.2, 0.1].map((delay, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-[#1DB954] rounded-full animate-pulse"
                    style={{
                      height: `${8 + i * 3}px`,
                      animationDelay: `${delay}s`,
                      animationDuration: '0.8s',
                    }}
                  />
                ))}
              </span>
            )}
          </div>
          <p className="text-xs text-vale-muted truncate">{artistStr}</p>
          <p className="text-[10px] text-vale-muted/60 truncate mt-0.5">{track.album}</p>
        </div>

        {/* Spotify link + connected dot */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {track.external_url && (
            <a
              href={track.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-vale-muted hover:text-[#1DB954] transition-colors"
              title="Open in Spotify"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
            <span className="text-[10px] text-[#1DB954]">Spotify</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="w-full h-1 bg-vale-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${currentProgress}%`,
              background: 'linear-gradient(to right, #1DB954, #1ed760)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-vale-muted">{formatTime(elapsed)}</span>
          <span className="text-[10px] text-vale-muted">{formatTime(track.duration_ms)}</span>
        </div>
      </div>
    </div>
  );
}
