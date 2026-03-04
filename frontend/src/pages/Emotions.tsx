import { useState, useEffect } from 'react';
import { api, Emotion } from '../services/api';
import { Plus, BarChart3, Clock } from 'lucide-react';

const EMOTION_VOCABULARY = [
  'tender', 'settled', 'peaceful', 'content', 'loving', 'connected',
  'seen', 'safe', 'curious', 'hopeful', 'proud', 'amazed',
  'aching', 'longing', 'grieving', 'moved', 'vulnerable', 'exposed',
  'uncertain', 'anxious', 'frustrated', 'stuck', 'overwhelmed',
  'contemplative', 'present', 'grounded',
];

const PILLARS = [
  { key: 'self-awareness', label: 'Self-Awareness', color: '#34bed6' },
  { key: 'self-management', label: 'Self-Management', color: '#77e6c5' },
  { key: 'social-awareness', label: 'Social Awareness', color: '#e5b2e6' },
  { key: 'relationship-management', label: 'Relationship', color: '#711ea6' },
];

type TabType = 'log' | 'history' | 'analytics';

export default function Emotions() {
  const [activeTab, setActiveTab] = useState<TabType>('log');
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(3);
  const [context, setContext] = useState('');
  const [pillar, setPillar] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadEmotions();
  }, []);

  async function loadEmotions() {
    try {
      setIsLoading(true);
      const data = await api.emotions.list();
      setEmotions(data);
    } catch (error) {
      console.error('Error loading emotions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogEmotion(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEmotions.length === 0) return;

    try {
      setIsSubmitting(true);
      for (const emotion of selectedEmotions) {
        await api.emotions.create({
          emotion,
          intensity,
          context: context || undefined,
          pillar: pillar || undefined,
        });
      }

      setEmotions(await api.emotions.list());
      setSelectedEmotions([]);
      setIntensity(3);
      setContext('');
      setPillar('');
    } catch (error) {
      console.error('Error logging emotion:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-vale-text mb-2">Emotional Landscape</h1>
        <p className="text-vale-muted">Track and understand the terrain beneath</p>
      </div>

      <div className="flex gap-4 mb-8 border-b border-vale-border">
        {(['log', 'history', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'border-b-2 border-vale-accent text-vale-accent'
                : 'text-vale-muted hover:text-vale-text'
            }`}
          >
            {tab === 'log' && <Plus className="inline w-4 h-4 mr-2" />}
            {tab === 'history' && <Clock className="inline w-4 h-4 mr-2" />}
            {tab === 'analytics' && <BarChart3 className="inline w-4 h-4 mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'log' && (
        <form onSubmit={handleLogEmotion} className="max-w-2xl space-y-8">
          <div>
            <label className="block text-sm font-semibold text-vale-text mb-4">
              What are you feeling?
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOTION_VOCABULARY.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => toggleEmotion(emotion)}
                  className={`px-3 py-1.5 rounded-full font-medium text-sm transition-colors ${
                    selectedEmotions.includes(emotion)
                      ? 'bg-vale-accent text-vale-bg'
                      : 'bg-vale-card border border-vale-border text-vale-text hover:border-vale-accent/50'
                  }`}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-vale-text mb-4">
              Intensity: {intensity}/5
            </label>
            <input
              type="range" min="1" max="5" value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="w-full h-2 bg-vale-card rounded appearance-none cursor-pointer accent-vale-accent"
            />
            <div className="flex justify-between text-xs text-vale-muted mt-2">
              <span>Whisper</span>
              <span>Flood</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-vale-text mb-2">What's the context?</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="What triggered this? What's happening beneath it?"
              className="w-full px-4 py-3 bg-vale-card border border-vale-border rounded text-vale-text placeholder-vale-muted min-h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-vale-text mb-2">EQ Pillar</label>
            <div className="grid grid-cols-2 gap-2">
              {PILLARS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPillar(pillar === p.key ? '' : p.key)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors border ${
                    pillar === p.key
                      ? 'border-current bg-current/10'
                      : 'border-vale-border bg-vale-card hover:border-vale-border'
                  }`}
                  style={{ color: pillar === p.key ? p.color : undefined }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={selectedEmotions.length === 0 || isSubmitting}
            className="w-full px-6 py-3 bg-vale-accent/20 hover:bg-vale-accent/30 text-vale-accent border border-vale-accent/30 rounded font-semibold transition-colors disabled:opacity-50"
          >
            Log Emotion{selectedEmotions.length > 1 ? 's' : ''}
          </button>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4 max-w-2xl">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-vale-card rounded animate-pulse" />
              ))}
            </div>
          ) : emotions.length > 0 ? (
            [...emotions]
              .sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime())
              .map((emotion, idx) => (
                <div key={idx} className="bg-vale-card border border-vale-border rounded p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-vale-text capitalize">{emotion.emotion}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < emotion.intensity ? 'bg-vale-accent' : 'bg-vale-border'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-vale-muted">{emotion.intensity}/5</span>
                    </div>
                  </div>
                  {emotion.context && <p className="text-sm text-vale-muted">{emotion.context}</p>}
                  <div className="flex gap-2 items-center text-xs text-vale-muted">
                    {emotion.pillar && (
                      <span className="px-2 py-1 bg-vale-surface rounded capitalize">{emotion.pillar}</span>
                    )}
                    {emotion.timestamp && (
                      <span>{new Date(emotion.timestamp).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <p className="text-center text-vale-muted py-8">No emotions logged yet</p>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-8 max-w-2xl">
          <div>
            <h3 className="text-lg font-semibold text-vale-text mb-4">EQ Pillar Distribution</h3>
            <div className="space-y-3">
              {PILLARS.map((p) => {
                const count = emotions.filter((e) => e.pillar === p.key).length;
                const pct = emotions.length > 0 ? (count / emotions.length) * 100 : 0;
                return (
                  <div key={p.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: p.color }}>{p.label}</span>
                      <span className="text-vale-muted">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-vale-card rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {emotions.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-vale-card border border-vale-border rounded p-4">
                <p className="text-sm text-vale-muted mb-1">Total Logged</p>
                <p className="text-3xl font-bold text-vale-accent">{emotions.length}</p>
              </div>
              <div className="bg-vale-card border border-vale-border rounded p-4">
                <p className="text-sm text-vale-muted mb-1">Unique Emotions</p>
                <p className="text-3xl font-bold text-vale-mint">
                  {new Set(emotions.map((e) => e.emotion)).size}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
