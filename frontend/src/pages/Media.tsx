import { useState, useEffect, useRef } from 'react';
import { Image, Mic, Play, Pause, Trash2, Volume2, Loader2 } from 'lucide-react';
import { api, VoiceNote, Voice } from '../services/api';

type TabType = 'images' | 'voice';

export default function Media() {
  const [activeTab, setActiveTab] = useState<TabType>('voice');

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-hearth-text mb-2">Media</h1>
        <p className="text-hearth-muted">Generate and manage images and voice notes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-hearth-border">
        {(['voice', 'images'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'border-b-2 border-hearth-accent text-hearth-accent'
                : 'text-hearth-muted hover:text-hearth-text'
            }`}
          >
            {tab === 'images' && <Image className="inline w-4 h-4 mr-2" />}
            {tab === 'voice' && <Mic className="inline w-4 h-4 mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-3xl">
        {activeTab === 'images' && <ImagesTab />}
        {activeTab === 'voice' && <VoiceTab />}
      </div>
    </div>
  );
}

function ImagesTab() {
  return (
    <div className="bg-hearth-card border border-hearth-border rounded-lg p-12 text-center">
      <Image className="w-16 h-16 text-hearth-border mx-auto mb-4 opacity-50" />
      <p className="text-hearth-muted mb-2">Image generation coming next</p>
      <p className="text-sm text-hearth-muted">
        Voice notes are live — image generation with DALL-E is up next.
      </p>
    </div>
  );
}

function VoiceTab() {
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [notesData, voicesData] = await Promise.all([
        api.voice.list({ limit: 50 }),
        api.voice.listVoices().catch(() => []),
      ]);
      setNotes(notesData);
      setVoices(voicesData);
    } catch (err) {
      console.error('Failed to load voice data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.voice.generate(text, {
        voice_id: selectedVoice || undefined,
      });
      setNotes((prev) => [result, ...prev]);
      setText('');
      setSuccess('Voice note generated!');
      setTimeout(() => setSuccess(null), 3000);

      // Auto-play the new note
      if (result.playback_url) {
        playAudio(result.id, result.playback_url);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate voice note');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.voice.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete voice note');
    }
  }

  async function handlePlay(note: VoiceNote) {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    try {
      // Fetch fresh signed URL
      const fresh = await api.voice.get(note.id);
      if (fresh.playback_url) {
        playAudio(note.id, fresh.playback_url);
      }
    } catch (err: any) {
      setError('Failed to play voice note');
    }
  }

  function playAudio(id: string, url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.play();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setError('Failed to play audio');
    };
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatSize(bytes?: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <div className="space-y-8">
      {/* Error / Success Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-400 hover:text-red-200">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300">
          {success}
        </div>
      )}

      {/* Generation Form */}
      <div className="bg-hearth-surface border border-hearth-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-hearth-text flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-hearth-accent" />
          Create Voice Note
        </h2>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-hearth-text mb-2">
              Text to speak
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type what you want the voice to say..."
              className="w-full px-4 py-3 bg-hearth-card border border-hearth-border rounded text-hearth-text placeholder-hearth-muted min-h-24 focus:outline-none focus:border-hearth-accent"
              disabled={isGenerating}
            />
          </div>

          {voices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-hearth-text mb-2">
                Voice
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-4 py-2 bg-hearth-card border border-hearth-border rounded text-hearth-text focus:outline-none focus:border-hearth-accent"
                disabled={isGenerating}
              >
                <option value="">Default voice</option>
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={!text.trim() || isGenerating}
            className="px-6 py-2 bg-hearth-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Generate Voice Note
              </>
            )}
          </button>
        </form>
      </div>

      {/* Voice Notes List */}
      <div>
        <h2 className="text-lg font-semibold text-hearth-text mb-4">
          Voice Notes {notes.length > 0 && `(${notes.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-hearth-accent mx-auto animate-spin" />
            <p className="text-hearth-muted mt-2">Loading voice notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-hearth-card border border-hearth-border rounded-lg p-12 text-center">
            <Mic className="w-16 h-16 text-hearth-border mx-auto mb-4 opacity-50" />
            <p className="text-hearth-muted mb-2">No voice notes yet</p>
            <p className="text-sm text-hearth-muted">
              Type some text above and generate your first voice note
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-hearth-card border border-hearth-border rounded-lg p-4 flex items-center gap-4 hover:border-hearth-accent/50 transition-colors"
              >
                {/* Play Button */}
                <button
                  onClick={() => handlePlay(note)}
                  className="w-10 h-10 rounded-full bg-hearth-accent/20 hover:bg-hearth-accent/40 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {playingId === note.id ? (
                    <Pause className="w-4 h-4 text-hearth-accent" />
                  ) : (
                    <Play className="w-4 h-4 text-hearth-accent ml-0.5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-hearth-text text-sm truncate">
                    {note.text_content}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-hearth-muted">
                      {formatDate(note.created_at)}
                    </span>
                    {note.media?.file_size_bytes && (
                      <span className="text-xs text-hearth-muted">
                        {formatSize(note.media.file_size_bytes)}
                      </span>
                    )}
                    {note.speaker_perspective && note.speaker_perspective !== 'default' && (
                      <span className="text-xs text-hearth-accent">
                        {note.speaker_perspective}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-2 text-hearth-muted hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete voice note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
