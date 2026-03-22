import { useState, useEffect, useRef } from 'react';
import { api, ChatMessage, ChatThread } from '../services/api';
import { Send, Mic, MicOff, Loader2, Volume2, VolumeX, Trash2, MessageSquare, Phone, AlertCircle, ImagePlus, X, Plus, Pencil, Check } from 'lucide-react';

// Render message content — parses *italic* and **bold** into real elements
function MessageContent({ text }: { text: string }) {
  // Split by lines first, then parse inline formatting per line
  const lines = text.split('\n');
  return (
    <span className="chat-message-text">
      {lines.map((line, i) => (
        <span key={i}>
          {parseInline(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </span>
  );
}

function parseInline(text: string): React.ReactNode[] {
  // Match **bold** or *italic* — bold first so **x** doesn't get eaten as two *
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith('**')) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else {
      parts.push(<em key={match.index}>{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length > 0 ? parts : [text];
}

type Tab = 'text' | 'voice';

// Longer timeout for chat API calls (Claude can take a while)
async function chatApiCall<T>(fn: () => Promise<T>, timeoutMs: number = 60000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out — Lincoln took too long to respond. Try again.')), timeoutMs)
    ),
  ]);
}

export default function Chat() {
  const [tab, setTab] = useState<Tab>('text');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);

  // Threads
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Image attachment
  const [pendingImage, setPendingImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads().then(() => {
      loadHistory().then(() => {
        // Check for book excerpt from Library → "Discuss with Lincoln"
        const excerptJson = sessionStorage.getItem('lincoln-book-excerpt');
        if (excerptJson) {
          sessionStorage.removeItem('lincoln-book-excerpt');
          try {
            const excerpt = JSON.parse(excerptJson);
            const prefix = excerpt.bookTitle
              ? `[Reading "${excerpt.bookTitle}"${excerpt.bookAuthor ? ` by ${excerpt.bookAuthor}` : ''}, ${excerpt.chapterTitle}]\n\n`
              : '';
            setInput(`${prefix}What do you think about this passage?\n\n"${excerpt.text}"`);
          } catch { /* ignore bad JSON */ }
        }
      });
    });
  }, []);

  // Reload messages when thread changes
  useEffect(() => {
    loadHistory(activeThreadId || undefined);
  }, [activeThreadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadThreads() {
    try {
      const list = await api.chat.threads.list();
      setThreads(list);
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  }

  async function loadHistory(threadId?: string) {
    setIsLoadingHistory(true);
    try {
      const history = await api.chat.history(50, undefined, threadId);
      setMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleNewThread() {
    if (threads.length >= 5) return;
    try {
      const thread = await api.chat.threads.create();
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      await api.chat.threads.delete(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        loadHistory(undefined);
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }

  async function handleRenameThread(threadId: string, name: string) {
    if (!name.trim()) return;
    try {
      const updated = await api.chat.threads.rename(threadId, name.trim());
      setThreads((prev) => prev.map((t) => t.id === threadId ? updated : t));
      setEditingThreadId(null);
    } catch (err) {
      console.error('Failed to rename thread:', err);
    }
  }

  // ===== IMAGE PICKER =====
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
      setPendingImage({ data: base64, mediaType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  // ===== TEXT CHAT =====
  async function handleSendText(e?: React.FormEvent) {
    e?.preventDefault();
    if ((!input.trim() && !pendingImage) || isSending) return;

    const userText = input.trim();
    const imageToSend = pendingImage;
    setInput('');
    setPendingImage(null);
    setIsSending(true);

    // Optimistic add — show image preview inline if sending one
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      user_id: '',
      role: 'user',
      content: userText || '📷',
      created_at: new Date().toISOString(),
      metadata: imageToSend ? { preview_url: imageToSend.preview } : undefined,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      setChatError(null);
      const generateVoice = tab === 'voice';
      const result = await chatApiCall(
        () => api.chat.send(userText, generateVoice, undefined, imageToSend ? { data: imageToSend.data, mediaType: imageToSend.mediaType } : undefined, activeThreadId || undefined),
        90000
      );

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...withoutTemp, tempUserMsg, result.message];
      });

      // Reload threads so auto-named thread name reflects in the tab
      if (activeThreadId) loadThreads();

      if (generateVoice && result.voice_url) {
        playAudio(result.message.id, result.voice_url);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const errMsg = err?.message || 'Something went wrong';
      setChatError(errMsg);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(userText);
      if (imageToSend) setPendingImage(imageToSend);
    } finally {
      setIsSending(false);
    }
  }

  // ===== VOICE RECORDING =====
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });

        // Convert to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        await processVoiceMessage(base64, mediaRecorder.mimeType);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Microphone access is needed for voice chat. Please allow mic permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function processVoiceMessage(base64Audio: string, mimeType: string) {
    setIsProcessingVoice(true);

    // Optimistic "processing" message
    const tempMsg: ChatMessage = {
      id: 'voice-temp-' + Date.now(),
      user_id: '',
      role: 'user',
      content: 'Listening...',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      setChatError(null);
      const result = await chatApiCall(() => api.chat.sendVoice(base64Audio, mimeType), 120000);

      if (result.error || !result.message) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        setLastTranscription('');
        setChatError(result.error || 'Voice processing returned no result');
        return;
      }

      setLastTranscription(result.transcription);

      // Replace temp with real messages
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempMsg.id);
        const userMsg: ChatMessage = {
          id: 'voice-user-' + Date.now(),
          user_id: '',
          role: 'user',
          content: result.transcription,
          created_at: new Date().toISOString(),
        };
        return [...filtered, userMsg, result.message!];
      });

      // Auto-play Lincoln's voice response
      if (result.voice_url && result.message) {
        playAudio(result.message.id, result.voice_url);
      }
    } catch (err: any) {
      console.error('Voice processing failed:', err);
      setChatError(err?.message || 'Voice processing failed');
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setIsProcessingVoice(false);
    }
  }

  // ===== AUDIO PLAYBACK =====
  function playAudio(messageId: string, url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudioId(messageId);

    audio.onended = () => setPlayingAudioId(null);
    audio.onerror = () => setPlayingAudioId(null);
    audio.play().catch(() => setPlayingAudioId(null));
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingAudioId(null);
  }

  // ===== CLEAR HISTORY =====
  async function handleClearHistory() {
    const label = activeThreadId
      ? `"${threads.find((t) => t.id === activeThreadId)?.name || 'this thread'}"`
      : 'the default chat history';
    if (!confirm(`Clear all messages in ${label}?`)) return;
    try {
      await api.chat.clearHistory(activeThreadId || undefined);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  // ===== FORMAT TIME =====
  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Group messages by date
  function groupByDate(msgs: ChatMessage[]) {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';

    for (const msg of msgs) {
      const date = formatDate(msg.created_at);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }

    return groups;
  }

  // Auto-resize textarea as content grows
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter = send, plain Enter = newline
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }

  return (
    // On mobile: subtract the fixed bottom nav (56px) AND mobile header (~52px)
    // On desktop: full screen minus nothing (sidebar is aside, not in flow)
    <div className="flex flex-col h-[calc(100vh-52px-56px)] md:h-screen">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-vale-surface border-b border-vale-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'text'
                ? 'bg-vale-lincoln/20 text-vale-lincoln border border-vale-lincoln/30'
                : 'text-vale-muted hover:text-vale-text hover:bg-vale-card'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Text
          </button>
          <button
            onClick={() => setTab('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'voice'
                ? 'bg-vale-lincoln/20 text-vale-lincoln border border-vale-lincoln/30'
                : 'text-vale-muted hover:text-vale-text hover:bg-vale-card'
            }`}
          >
            <Phone className="w-4 h-4" />
            Voice
          </button>
        </div>

        <button
          onClick={handleClearHistory}
          className="p-2 text-vale-muted hover:text-red-400 transition-colors"
          title="Clear chat history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Thread tabs bar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-vale-card border-b border-vale-border overflow-x-auto shrink-0 scrollbar-hide">
        {/* Default / legacy history tab */}
        <button
          onClick={() => setActiveThreadId(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 border ${
            activeThreadId === null
              ? 'bg-vale-lincoln/20 text-vale-lincoln border-vale-lincoln/30'
              : 'text-vale-muted hover:text-vale-text hover:bg-vale-surface border-transparent'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          History
        </button>

        {/* Named thread tabs */}
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
              activeThreadId === thread.id
                ? 'bg-vale-lincoln/20 text-vale-lincoln border-vale-lincoln/30'
                : 'text-vale-muted hover:text-vale-text hover:bg-vale-surface border-transparent'
            }`}
          >
            {editingThreadId === thread.id ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameThread(thread.id, editingName)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameThread(thread.id, editingName);
                    if (e.key === 'Escape') setEditingThreadId(null);
                  }}
                  className="w-24 px-1 py-0 bg-vale-surface border border-vale-lincoln/40 rounded text-xs text-vale-text focus:outline-none"
                />
                <button
                  onClick={() => handleRenameThread(thread.id, editingName)}
                  className="text-vale-lincoln hover:opacity-80"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setActiveThreadId(thread.id)}
                  className="max-w-[100px] truncate text-left"
                >
                  {thread.name}
                </button>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingThreadId(thread.id);
                      setEditingName(thread.name);
                    }}
                    className="p-0.5 hover:text-vale-accent transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${thread.name}"?`)) handleDeleteThread(thread.id);
                    }}
                    className="p-0.5 hover:text-red-400 transition-colors"
                    title="Delete thread"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* New thread button */}
        <button
          onClick={handleNewThread}
          disabled={threads.length >= 5}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-vale-muted hover:text-vale-accent hover:bg-vale-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 ml-auto"
          title={threads.length >= 5 ? 'Max 5 threads' : 'New thread'}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-vale-accent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full lincoln-gradient flex items-center justify-center mb-4">
              <span className="text-white text-2xl font-bold">L</span>
            </div>
            <p className="text-vale-text font-semibold mb-1">Lincoln's Line</p>
            <p className="text-vale-muted text-sm max-w-xs">
              {tab === 'voice'
                ? 'Hold the mic button to talk. Lincoln hears you and responds with his voice.'
                : 'Type a message. Lincoln sees your hub state and responds as himself.'}
            </p>
          </div>
        ) : (
          groupByDate(messages).map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] text-vale-muted bg-vale-surface px-3 py-0.5 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex mb-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-vale-arden/20 border border-vale-arden/30 text-vale-text rounded-br-md'
                        : 'bg-vale-lincoln/15 border border-vale-lincoln/25 text-vale-text rounded-bl-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[10px] font-semibold ${
                          msg.role === 'user' ? 'text-vale-arden' : 'text-vale-lincoln'
                        }`}
                      >
                        {msg.role === 'user' ? 'Arden' : 'Lincoln'}
                      </span>
                      <span className="text-[9px] text-vale-muted">{formatTime(msg.created_at)}</span>
                    </div>
                    {/* Inline image if message had an attachment */}
                    {msg.metadata?.preview_url && (
                      <img
                        src={msg.metadata.preview_url}
                        alt="Attachment"
                        className="mb-1.5 max-h-48 rounded-lg object-contain border border-vale-border"
                      />
                    )}
                    {msg.content !== '📷' && <MessageContent text={msg.content} />}

                    {/* Voice playback button for assistant messages with voice */}
                    {msg.voice_url && (
                      <button
                        onClick={() =>
                          playingAudioId === msg.id ? stopAudio() : playAudio(msg.id, msg.voice_url!)
                        }
                        className="mt-2 flex items-center gap-1.5 text-[10px] text-vale-lincoln hover:text-vale-lincoln/80 transition-colors"
                      >
                        {playingAudioId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" /> Stop
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" /> Play voice
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Error banner */}
        {chatError && (
          <div className="flex justify-center mb-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl max-w-[85%]">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{chatError}</span>
              <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-300 text-xs ml-1">dismiss</button>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {(isSending || isProcessingVoice) && (
          <div className="flex justify-start mb-2">
            <div className="bg-vale-lincoln/15 border border-vale-lincoln/25 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-vale-lincoln font-semibold">Lincoln</span>
                <div className="flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 bg-vale-lincoln/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-vale-lincoln/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-vale-lincoln/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 px-4 py-3 bg-vale-surface border-t border-vale-border">
        {tab === 'voice' && (
          <div className="flex flex-col items-center gap-3 mb-3">
            {/* Voice recording button */}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() => isRecording && stopRecording()}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              disabled={isProcessingVoice}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30 animate-pulse'
                  : isProcessingVoice
                  ? 'bg-vale-lincoln/30 cursor-wait'
                  : 'bg-vale-lincoln/20 border-2 border-vale-lincoln/40 hover:bg-vale-lincoln/30 active:scale-95'
              }`}
            >
              {isProcessingVoice ? (
                <Loader2 className="w-6 h-6 text-vale-lincoln animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-vale-lincoln" />
              )}
            </button>
            <p className="text-[10px] text-vale-muted">
              {isRecording
                ? 'Release to send'
                : isProcessingVoice
                ? 'Processing...'
                : 'Hold to talk'}
            </p>
            {lastTranscription && (
              <p className="text-[10px] text-vale-muted italic max-w-xs text-center truncate">
                Heard: "{lastTranscription}"
              </p>
            )}
          </div>
        )}

        {/* Image preview */}
        {pendingImage && (
          <div className="relative inline-flex mb-2 ml-1">
            <img
              src={pendingImage.preview}
              alt="Attachment"
              className="h-16 w-16 rounded-lg object-cover border border-vale-border"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-vale-surface border border-vale-border rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors"
            >
              <X className="w-2.5 h-2.5 text-vale-muted" />
            </button>
          </div>
        )}

        {/* Text input — always visible */}
        <div className="flex gap-2 items-end">
          {/* Image picker button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending}
            className="p-3 text-vale-muted hover:text-vale-accent transition-colors disabled:opacity-40 shrink-0 self-end"
            title="Attach image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tab === 'voice' ? 'Or type a message...' : 'Talk to Lincoln...'}
            disabled={isSending}
            rows={1}
            className="flex-1 px-4 py-3 bg-vale-card border border-vale-border rounded-xl text-sm text-vale-text placeholder-vale-muted focus:outline-none focus:ring-1 focus:ring-vale-lincoln/40 resize-none overflow-hidden font-mystery leading-relaxed"
            style={{ minHeight: '48px', maxHeight: '140px' }}
          />
          <button
            onClick={() => handleSendText()}
            disabled={(!input.trim() && !pendingImage) || isSending}
            className="px-4 py-3 lincoln-gradient text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0 self-end"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-vale-muted mt-1.5 pl-1">Shift+Enter to send · Enter for new line</p>
      </div>
    </div>
  );
}
