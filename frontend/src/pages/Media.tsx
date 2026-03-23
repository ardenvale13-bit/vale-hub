import { useState, useEffect, useRef } from 'react';
import { Image, Mic, Play, Pause, Trash2, Volume2, Loader2, Download, X, Sparkles, BookOpen, Upload, ChevronLeft, ChevronRight, MessageSquare, FileText, List } from 'lucide-react';
import { api, VoiceNote, Voice, GeneratedImage, LibraryBook, BookDetail, BookChapter } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Discord from './Discord';

type TabType = 'images' | 'voice' | 'library' | 'discord';

export default function Media() {
  const [activeTab, setActiveTab] = useState<TabType>('voice');

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-vale-text mb-2">Media</h1>
        <p className="text-vale-muted">Voice, images, library, and Discord — all in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-vale-border">
        {(['voice', 'images', 'library', 'discord'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'border-b-2 border-vale-accent text-vale-accent'
                : 'text-vale-muted hover:text-vale-text'
            }`}
          >
            {tab === 'images' && <Image className="inline w-4 h-4 mr-2" />}
            {tab === 'voice' && <Mic className="inline w-4 h-4 mr-2" />}
            {tab === 'library' && <BookOpen className="inline w-4 h-4 mr-2" />}
            {tab === 'discord' && <MessageSquare className="inline w-4 h-4 mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={activeTab === 'library' || activeTab === 'discord' ? '' : 'max-w-3xl'}>
        {activeTab === 'images' && <ImagesTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'discord' && <Discord />}
      </div>
    </div>
  );
}

function ImagesTab() {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('standard');
  const [style, setStyle] = useState('vivid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    setIsLoading(true);
    try {
      const data = await api.images.list(50);
      setImages(data);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.images.generate(prompt, { size, quality, style });
      setImages((prev) => [result, ...prev]);
      setPrompt('');
      setSuccess('Image generated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.images.delete(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (lightboxImage?.id === id) setLightboxImage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete image');
    }
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
      <div className="bg-vale-surface border border-vale-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-vale-text flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-vale-accent" />
          Generate Image
        </h2>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-vale-text mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              className="w-full px-4 py-3 bg-vale-card border border-vale-border rounded text-vale-text placeholder-vale-muted min-h-24 focus:outline-none focus:border-vale-accent"
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-vale-muted mb-1">Size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm focus:outline-none focus:border-vale-accent"
                disabled={isGenerating}
              >
                <option value="1024x1024">Square (1024×1024)</option>
                <option value="1024x1792">Portrait (1024×1792)</option>
                <option value="1792x1024">Landscape (1792×1024)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-vale-muted mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm focus:outline-none focus:border-vale-accent"
                disabled={isGenerating}
              >
                <option value="standard">Standard</option>
                <option value="hd">HD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-vale-muted mb-1">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm focus:outline-none focus:border-vale-accent"
                disabled={isGenerating}
              >
                <option value="vivid">Vivid</option>
                <option value="natural">Natural</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="px-6 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Image
              </>
            )}
          </button>
        </form>
      </div>

      {/* Image Gallery */}
      <div>
        <h2 className="text-lg font-semibold text-vale-text mb-4">
          Gallery {images.length > 0 && `(${images.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-vale-accent mx-auto animate-spin" />
            <p className="text-vale-muted mt-2">Loading images...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="bg-vale-card border border-vale-border rounded-lg p-12 text-center">
            <Image className="w-16 h-16 text-vale-border mx-auto mb-4 opacity-50" />
            <p className="text-vale-muted mb-2">No images yet</p>
            <p className="text-sm text-vale-muted">
              Enter a prompt above and generate your first image
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="bg-vale-card border border-vale-border rounded-lg overflow-hidden group hover:border-vale-accent/50 transition-colors"
              >
                {/* Image */}
                {img.url ? (
                  <div
                    className="aspect-square bg-vale-surface cursor-pointer relative"
                    onClick={() => setLightboxImage(img)}
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-sm font-medium">View</span>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square bg-vale-surface flex items-center justify-center">
                    <Image className="w-8 h-8 text-vale-border opacity-50" />
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <p className="text-vale-text text-xs line-clamp-2 mb-2" title={img.prompt}>
                    {img.prompt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-vale-muted">{formatDate(img.created_at)}</span>
                    <div className="flex gap-1">
                      {img.url && (
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-vale-muted hover:text-vale-accent transition-colors"
                          title="Open in new tab"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="p-1.5 text-vale-muted hover:text-red-400 transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {lightboxImage.url && (
              <img
                src={lightboxImage.url}
                alt={lightboxImage.prompt}
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
              />
            )}
            <div className="mt-4 bg-vale-card rounded-lg p-4 max-w-xl">
              <p className="text-vale-text text-sm">{lightboxImage.prompt}</p>
              <div className="flex gap-3 mt-2 text-xs text-vale-muted">
                <span>{lightboxImage.settings?.size || '1024×1024'}</span>
                <span>{lightboxImage.settings?.quality || 'standard'}</span>
                <span>{lightboxImage.settings?.style || 'vivid'}</span>
                <span>{formatDate(lightboxImage.created_at)}</span>
              </div>
              {lightboxImage.settings?.revised_prompt && (
                <p className="text-vale-muted text-xs mt-2 italic">
                  Revised: {lightboxImage.settings.revised_prompt}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
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
      <div className="bg-vale-surface border border-vale-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-vale-text flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-vale-accent" />
          Create Voice Note
        </h2>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-vale-text mb-2">
              Text to speak
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type what you want the voice to say..."
              className="w-full px-4 py-3 bg-vale-card border border-vale-border rounded text-vale-text placeholder-vale-muted min-h-24 focus:outline-none focus:border-vale-accent"
              disabled={isGenerating}
            />
          </div>

          {voices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-vale-text mb-2">
                Voice
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-4 py-2 bg-vale-card border border-vale-border rounded text-vale-text focus:outline-none focus:border-vale-accent"
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
            className="px-6 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
        <h2 className="text-lg font-semibold text-vale-text mb-4">
          Voice Notes {notes.length > 0 && `(${notes.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-vale-accent mx-auto animate-spin" />
            <p className="text-vale-muted mt-2">Loading voice notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-vale-card border border-vale-border rounded-lg p-12 text-center">
            <Mic className="w-16 h-16 text-vale-border mx-auto mb-4 opacity-50" />
            <p className="text-vale-muted mb-2">No voice notes yet</p>
            <p className="text-sm text-vale-muted">
              Type some text above and generate your first voice note
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-vale-card border border-vale-border rounded-lg p-4 flex items-center gap-4 hover:border-vale-accent/50 transition-colors"
              >
                {/* Play Button */}
                <button
                  onClick={() => handlePlay(note)}
                  className="w-10 h-10 rounded-full bg-vale-accent/20 hover:bg-vale-accent/40 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {playingId === note.id ? (
                    <Pause className="w-4 h-4 text-vale-accent" />
                  ) : (
                    <Play className="w-4 h-4 text-vale-accent ml-0.5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-vale-text text-sm truncate">
                    {note.text_content}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-vale-muted">
                      {formatDate(note.created_at)}
                    </span>
                    {note.media?.file_size_bytes && (
                      <span className="text-xs text-vale-muted">
                        {formatSize(note.media.file_size_bytes)}
                      </span>
                    )}
                    {note.speaker_perspective && note.speaker_perspective !== 'default' && (
                      <span className="text-xs text-vale-accent">
                        {note.speaker_perspective}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-2 text-vale-muted hover:text-red-400 transition-colors flex-shrink-0"
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

// ===== LIBRARY TAB =====

function LibraryTab() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reader state
  const [activeBook, setActiveBook] = useState<BookDetail | null>(null);
  const [activeChapter, setActiveChapter] = useState<BookChapter | null>(null);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    setIsLoading(true);
    try {
      const data = await api.library.list();
      setBooks(data);
    } catch (err: any) {
      console.error('Failed to load books:', err);
      setError(err.message || 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !uploadTitle.trim()) return;

    setIsUploading(true);
    setError(null);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Strip data URI prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const book = await api.library.upload(base64, {
        title: uploadTitle.trim(),
        author: uploadAuthor.trim() || undefined,
        filename: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
      });

      setBooks((prev) => [book, ...prev]);
      setUploadTitle('');
      setUploadAuthor('');
      setSelectedFile(null);
      setShowUpload(false);
    } catch (err: any) {
      setError(err.message || 'Failed to upload book');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(bookId: string) {
    try {
      await api.library.delete(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      if (activeBook?.id === bookId) {
        setActiveBook(null);
        setActiveChapter(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete book');
    }
  }

  async function openBook(bookId: string) {
    try {
      setIsLoadingChapter(true);
      const detail = await api.library.get(bookId);
      setActiveBook(detail);

      // Load the current chapter
      const chapter = await api.library.getChapter(bookId, detail.current_chapter);
      setActiveChapter(chapter);
    } catch (err: any) {
      setError(err.message || 'Failed to open book');
    } finally {
      setIsLoadingChapter(false);
    }
  }

  async function loadChapter(chapterNumber: number) {
    if (!activeBook) return;
    setIsLoadingChapter(true);
    setShowToc(false);

    try {
      const chapter = await api.library.getChapter(activeBook.id, chapterNumber);
      setActiveChapter(chapter);

      // Update reading progress
      await api.library.updateProgress(activeBook.id, chapterNumber);
      setActiveBook((prev) => prev ? { ...prev, current_chapter: chapterNumber } : prev);

      // Update book in list
      setBooks((prev) =>
        prev.map((b) =>
          b.id === activeBook.id
            ? { ...b, current_chapter: chapterNumber, reading_progress: Math.round((chapterNumber / activeBook.total_chapters) * 100) }
            : b
        )
      );

      // Scroll to top of reader
      readerRef.current?.scrollTo(0, 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load chapter');
    } finally {
      setIsLoadingChapter(false);
    }
  }

  function handleTextSelection() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText('');
    }
  }

  function discussWithLincoln() {
    if (!selectedText || !activeBook || !activeChapter) return;

    // Store the excerpt in sessionStorage so Chat page can pick it up
    const excerpt = {
      text: selectedText.substring(0, 1000), // Cap at 1000 chars
      bookTitle: activeBook.title,
      bookAuthor: activeBook.author,
      chapterTitle: activeChapter.title,
      chapterNumber: activeChapter.chapter_number,
    };
    sessionStorage.setItem('lincoln-book-excerpt', JSON.stringify(excerpt));
    navigate('/chat');
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const fileTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return 'PDF';
      case 'epub': return 'EPUB';
      default: return 'TXT';
    }
  };

  // ===== READER VIEW =====
  if (activeBook && activeChapter) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Reader Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setActiveBook(null); setActiveChapter(null); setSelectedText(''); }}
            className="flex items-center gap-2 text-vale-muted hover:text-vale-text transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Library
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowToc(!showToc)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vale-card border border-vale-border rounded hover:border-vale-accent/50 transition-colors text-vale-muted hover:text-vale-text"
            >
              <List className="w-4 h-4" />
              Chapters
            </button>
          </div>
        </div>

        {/* Book Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-vale-text">{activeBook.title}</h2>
          {activeBook.author && <p className="text-vale-muted mt-1">by {activeBook.author}</p>}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-vale-muted">
              Chapter {activeChapter.chapter_number} of {activeBook.total_chapters}
            </span>
            <span className="text-xs text-vale-muted">
              {activeChapter.word_count.toLocaleString()} words
            </span>
            {/* Progress bar */}
            <div className="flex-1 max-w-48 h-1.5 bg-vale-card rounded-full overflow-hidden">
              <div
                className="h-full bg-vale-accent rounded-full transition-all"
                style={{ width: `${Math.round((activeBook.current_chapter / activeBook.total_chapters) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Table of Contents Dropdown */}
        {showToc && (
          <div className="mb-6 bg-vale-surface border border-vale-border rounded-lg p-4 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-semibold text-vale-text mb-3">Table of Contents</h3>
            <div className="space-y-1">
              {activeBook.chapters.map((ch) => (
                <button
                  key={ch.chapter_number}
                  onClick={() => loadChapter(ch.chapter_number)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    ch.chapter_number === activeChapter.chapter_number
                      ? 'bg-vale-accent/20 text-vale-accent'
                      : 'text-vale-muted hover:text-vale-text hover:bg-vale-card'
                  }`}
                >
                  <span className="font-medium">{ch.chapter_number}.</span> {ch.title}
                  <span className="text-xs ml-2 opacity-60">{ch.word_count.toLocaleString()} words</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chapter Content */}
        <div
          ref={readerRef}
          className="bg-vale-surface border border-vale-border rounded-lg p-8 md:p-12 max-h-[calc(100vh-320px)] overflow-y-auto"
          onMouseUp={handleTextSelection}
        >
          {isLoadingChapter ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 text-vale-accent mx-auto animate-spin" />
              <p className="text-vale-muted mt-3">Loading chapter...</p>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-vale-text mb-6 font-mystery">{activeChapter.title}</h3>
              <div className="text-vale-text leading-relaxed whitespace-pre-wrap text-[15px] selection:bg-vale-accent/30 font-mystery">
                {activeChapter.content}
              </div>
            </>
          )}
        </div>

        {/* Selected Text Floating Bar */}
        {selectedText && (
          <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-vale-card border border-vale-accent/50 rounded-lg shadow-lg p-4 max-w-md z-40 animate-in fade-in slide-in-from-bottom-4">
            <p className="text-xs text-vale-muted mb-2 line-clamp-2">"{selectedText.substring(0, 120)}..."</p>
            <div className="flex gap-2">
              <button
                onClick={discussWithLincoln}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vale-accent text-white text-sm rounded hover:bg-opacity-90 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Discuss with Lincoln
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(selectedText); setSelectedText(''); }}
                className="px-3 py-1.5 text-vale-muted text-sm border border-vale-border rounded hover:text-vale-text transition-colors"
              >
                Copy
              </button>
              <button
                onClick={() => setSelectedText('')}
                className="px-2 py-1.5 text-vale-muted hover:text-vale-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Chapter Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => loadChapter(activeChapter.chapter_number - 1)}
            disabled={activeChapter.chapter_number <= 1 || isLoadingChapter}
            className="flex items-center gap-2 px-4 py-2 bg-vale-card border border-vale-border rounded-lg text-vale-text hover:border-vale-accent/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-sm text-vale-muted">
            {activeChapter.chapter_number} / {activeBook.total_chapters}
          </span>

          <button
            onClick={() => loadChapter(activeChapter.chapter_number + 1)}
            disabled={activeChapter.chapter_number >= activeBook.total_chapters || isLoadingChapter}
            className="flex items-center gap-2 px-4 py-2 bg-vale-card border border-vale-border rounded-lg text-vale-text hover:border-vale-accent/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ===== LIBRARY GRID VIEW =====
  return (
    <div className="max-w-4xl space-y-8">
      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-400 hover:text-red-200">x</button>
        </div>
      )}

      {/* Upload Form */}
      {showUpload ? (
        <div className="bg-vale-surface border border-vale-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-vale-text flex items-center gap-2">
              <Upload className="w-5 h-5 text-vale-accent" />
              Add a Book
            </h2>
            <button onClick={() => setShowUpload(false)} className="text-vale-muted hover:text-vale-text">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vale-text mb-2">Title *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Book title..."
                className="w-full px-4 py-2 bg-vale-card border border-vale-border rounded text-vale-text placeholder-vale-muted focus:outline-none focus:border-vale-accent"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vale-text mb-2">Author</label>
              <input
                type="text"
                value={uploadAuthor}
                onChange={(e) => setUploadAuthor(e.target.value)}
                placeholder="Author name..."
                className="w-full px-4 py-2 bg-vale-card border border-vale-border rounded text-vale-text placeholder-vale-muted focus:outline-none focus:border-vale-accent"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vale-text mb-2">File (PDF, EPUB, or TXT) *</label>
              <input
                type="file"
                accept=".pdf,.epub,.txt,.text"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    // Auto-fill title from filename if empty
                    if (!uploadTitle) {
                      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
                      setUploadTitle(name);
                    }
                  }
                }}
                className="w-full text-vale-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-vale-accent/20 file:text-vale-accent hover:file:bg-vale-accent/30"
                disabled={isUploading}
              />
              {selectedFile && (
                <p className="text-xs text-vale-muted mt-1">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!selectedFile || !uploadTitle.trim() || isUploading}
              className="px-6 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Book
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowUpload(true)}
          className="w-full py-4 border-2 border-dashed border-vale-border rounded-lg text-vale-muted hover:text-vale-accent hover:border-vale-accent/50 transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Add a Book
        </button>
      )}

      {/* Book Grid */}
      <div>
        <h2 className="text-lg font-semibold text-vale-text mb-4">
          Your Library {books.length > 0 && `(${books.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-vale-accent mx-auto animate-spin" />
            <p className="text-vale-muted mt-2">Loading library...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="bg-vale-card border border-vale-border rounded-lg p-12 text-center">
            <BookOpen className="w-16 h-16 text-vale-border mx-auto mb-4 opacity-50" />
            <p className="text-vale-muted mb-2">Your library is empty</p>
            <p className="text-sm text-vale-muted">
              Upload a PDF, EPUB, or text file to start reading together
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="group bg-vale-card border border-vale-border rounded-lg overflow-hidden hover:border-vale-accent/50 transition-colors cursor-pointer"
                onClick={() => openBook(book.id)}
              >
                {/* Book Cover (colored placeholder) */}
                <div
                  className="aspect-[2/3] flex flex-col items-center justify-center p-4 relative"
                  style={{ backgroundColor: book.cover_color || '#4A6FA5' }}
                >
                  <FileText className="w-8 h-8 text-white/40 mb-2" />
                  <p className="text-white text-center text-sm font-semibold leading-tight line-clamp-3 px-2">
                    {book.title}
                  </p>
                  {book.author && (
                    <p className="text-white/70 text-xs mt-1 text-center line-clamp-1">{book.author}</p>
                  )}

                  {/* File type badge */}
                  <span className="absolute top-2 right-2 bg-black/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {fileTypeIcon(book.file_type)}
                  </span>

                  {/* Reading progress */}
                  {book.reading_progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div
                        className="h-full bg-white/80"
                        style={{ width: `${book.reading_progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-vale-muted">{book.total_chapters} ch.</span>
                    <span className="text-xs text-vale-muted">{formatFileSize(book.file_size_bytes)}</span>
                  </div>
                  {book.reading_progress > 0 && (
                    <p className="text-xs text-vale-accent mt-1">{book.reading_progress}% read</p>
                  )}
                  {/* Delete button — only visible on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }}
                    className="mt-2 w-full py-1 text-xs text-vale-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
