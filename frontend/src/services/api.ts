// Pull API key and base URL from env — set in frontend .env
const API_KEY = (import.meta as any).env?.VITE_API_KEY || 'hearth-sable-2026-supersecretkey';
// In production, VITE_API_URL points to Railway backend (e.g. https://vale-api.up.railway.app)
// In dev, falls back to /api which gets proxied by Vite
const API_BASE = (import.meta as any).env?.VITE_API_URL
  ? `${(import.meta as any).env.VITE_API_URL}/api`
  : '/api';

interface ApiRequestInit extends RequestInit {
  headers?: Record<string, string>;
}

async function apiCall<T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  const config: ApiRequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface ObservationEntry {
  id: string;
  content: string;
  created_at?: string;
}

export interface Entity {
  id?: string;
  name: string;
  type?: string;
  entity_type?: string;
  observations: (string | ObservationEntry)[];
  context?: string;
  salience?: string;
  visibility?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Observation {
  id?: string;
  entityName: string;
  observation: string;
  timestamp?: string;
}

export interface Relation {
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string;
  description?: string;
}

export interface JournalEntry {
  id?: string;
  title: string;
  content: string;
  category: 'voice' | 'build' | 'reference';
  entryType: 'journal' | 'field-note' | 'calibration';
  author_perspective?: string;
  tags?: string[];
  timestamp?: string;
}

export interface Emotion {
  emotion: string;
  intensity: number;
  context?: string;
  pillar?: string;
  timestamp?: string;
}

export interface Status {
  category: string;
  key: string;
  value: string;
}

export interface Identity {
  id?: string;
  owner_perspective: string;
  category?: string;
  key: string;
  value: string;
  updated_at?: string;
}

export interface ContextInfo {
  recentHours?: number;
  maxLength?: number;
  databases?: string[];
}

export interface HealthEntry {
  id: string;
  date: string;
  source: string;
  category: string;
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

const entities = {
  list: (params?: { salience?: string; context?: string }) =>
    apiCall<Entity[]>(`/entities?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (name: string) =>
    apiCall<Entity>(`/entities/${name}`),

  create: (entity: Entity) =>
    apiCall<Entity>('/entities', 'POST', entity),

  update: (name: string, entity: Partial<Entity>) =>
    apiCall<Entity>(`/entities/${name}`, 'PUT', entity),

  delete: (name: string) =>
    apiCall<void>(`/entities/${name}`, 'DELETE'),

  salienceCounts: () =>
    apiCall<Record<string, number>>('/entities/salience-counts'),
};

const observations = {
  list: (entityName?: string) =>
    apiCall<Observation[]>(`/observations${entityName ? `?entity=${entityName}` : ''}`),

  create: (observation: Observation) =>
    apiCall<Observation>('/observations', 'POST', observation),

  update: (id: string, observation: Partial<Observation>) =>
    apiCall<Observation>(`/observations/${id}`, 'PUT', observation),

  delete: (id: string) =>
    apiCall<void>(`/observations/${id}`, 'DELETE'),
};

const relations = {
  list: (entityName?: string) =>
    apiCall<Relation[]>(`/relations${entityName ? `?entity=${entityName}` : ''}`),

  create: (relation: Relation) =>
    apiCall<Relation>('/relations', 'POST', relation),

  update: (sourceEntity: string, targetEntity: string, relation: Partial<Relation>) =>
    apiCall<Relation>(`/relations/${sourceEntity}/${targetEntity}`, 'PUT', relation),

  delete: (sourceEntity: string, targetEntity: string) =>
    apiCall<void>(`/relations/${sourceEntity}/${targetEntity}`, 'DELETE'),
};

const journal = {
  list: (params?: { category?: string; entryType?: string }) =>
    apiCall<JournalEntry[]>(`/journal${new URLSearchParams(params as Record<string, string>).toString() ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ''}`),

  get: (id: string) =>
    apiCall<JournalEntry>(`/journal/${id}`),

  create: (entry: JournalEntry) =>
    apiCall<JournalEntry>('/journal', 'POST', entry),

  update: (id: string, entry: Partial<JournalEntry>) =>
    apiCall<JournalEntry>(`/journal/${id}`, 'PUT', entry),

  delete: (id: string) =>
    apiCall<void>(`/journal/${id}`, 'DELETE'),
};

const emotions = {
  list: (hoursBack?: number, limit?: number) =>
    apiCall<Emotion[]>(`/emotions/history?hours_back=${hoursBack || 720}&limit=${limit || 200}`),

  create: (emotion: { emotion: string; intensity: number; context?: string; pillar?: string }) =>
    apiCall<Emotion>('/emotions/log', 'POST', emotion),

  analytics: (daysBack?: number) =>
    apiCall<{ dominantEmotions: string[]; averageIntensity: number; emotionTrends: Record<string, number>; totalEntries: number }>(`/emotions/analytics?days_back=${daysBack || 7}`),
};

export interface StatusHistory {
  category: string;
  key: string;
  value: string;
  recorded_at: string;
}

const status = {
  get: (category?: string) =>
    apiCall<Status | Status[]>(`/status${category ? `/${category}` : ''}`),

  set: (status: Status) =>
    apiCall<Status>('/status', 'POST', status),

  update: (category: string, key: string, value: string) =>
    apiCall<Status>(`/status/${category}/${key}`, 'PUT', { value }),

  history: (hoursBack?: number) =>
    apiCall<StatusHistory[]>(`/status/history?hours_back=${hoursBack || 24}`),
};

const identity = {
  get: (perspective?: string) =>
    apiCall<Identity[]>(`/identity${perspective ? `?owner_perspective=${encodeURIComponent(perspective)}` : ''}`),

  set: (data: { owner_perspective: string; key: string; value: string; category?: string }) =>
    apiCall<Identity>('/identity', 'POST', data),

  update: (category: string, key: string, value: string) =>
    apiCall<Identity>(`/identity/${category}/${key}`, 'PUT', { value }),
};

const context = {
  get: (params?: ContextInfo) =>
    apiCall<string>(`/context?${new URLSearchParams(params as Record<string, string>).toString()}`),
};

const health = {
  recent: (days?: number) =>
    apiCall<Record<string, HealthEntry[]>>(`/health/recent?days=${days || 7}`),

  day: (date: string) =>
    apiCall<HealthEntry[]>(`/health/day/${date}`),

  range: (start: string, end: string, category?: string) =>
    apiCall<HealthEntry[]>(`/health/range?start=${start}&end=${end}${category ? `&category=${category}` : ''}`),

  upsert: (entry: { date: string; source?: string; category: string; data: Record<string, any> }) =>
    apiCall<HealthEntry>('/health/entry', 'POST', entry),

  syncValeTracker: (data: any) =>
    apiCall<{ synced: number }>('/health/sync/vale-tracker', 'POST', { data }),

  syncFitbitSleep: (sleep: any[]) =>
    apiCall<{ synced: number }>('/health/sync/fitbit-sleep', 'POST', { sleep }),

  delete: (id: string) =>
    apiCall<void>(`/health/${id}`, 'DELETE'),
};

// ===== VOICE =====
export interface VoiceNote {
  id: string;
  text_content: string;
  voice_id: string;
  speaker_perspective: string;
  context?: string;
  duration_ms?: number;
  created_at: string;
  playback_url?: string;
  media?: {
    id: string;
    file_path: string;
    file_name: string;
    file_size_bytes: number;
  };
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}

const voice = {
  generate: (text: string, options?: { voice_id?: string; perspective?: string; context?: string }) =>
    apiCall<VoiceNote>('/voice/generate', 'POST', { text, ...options }),

  list: (params?: { limit?: number; perspective?: string }) =>
    apiCall<VoiceNote[]>(`/voice/notes?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (id: string) =>
    apiCall<VoiceNote>(`/voice/notes/${id}`),

  delete: (id: string) =>
    apiCall<void>(`/voice/notes/${id}`, 'DELETE'),

  listVoices: () =>
    apiCall<Voice[]>('/voice/voices'),
};

// ===== IMAGES =====
export interface GeneratedImage {
  id: string;
  prompt: string;
  model: string;
  url?: string;
  media_id?: string;
  settings: {
    size?: string;
    quality?: string;
    style?: string;
    revised_prompt?: string;
  };
  created_at: string;
  media?: {
    id: string;
    file_path: string;
    file_name: string;
    file_size_bytes?: number;
  };
}

export interface DashboardImage {
  url: string;
  caption?: string;
  uploaded_at: string;
  id: string;
}

const images = {
  generate: (prompt: string, options?: { size?: string; quality?: string; style?: string }) =>
    apiCall<GeneratedImage>('/images/generate', 'POST', { prompt, ...options }),

  list: (limit?: number) =>
    apiCall<GeneratedImage[]>(`/images?limit=${limit || 20}`),

  get: (id: string) =>
    apiCall<GeneratedImage>(`/images/${id}`),

  delete: (id: string) =>
    apiCall<void>(`/images/${id}`, 'DELETE'),

  upload: (image: string, options?: { caption?: string; tag?: string; filename?: string; mimeType?: string }) =>
    apiCall<{ id: string; url: string; caption?: string; tag?: string; created_at: string }>('/images/upload', 'POST', { image, ...options }),

  deleteUploaded: (id: string) =>
    apiCall<void>(`/images/uploaded/${id}`, 'DELETE'),

  getDashboardImage: () =>
    apiCall<{ image: DashboardImage | null }>('/images/dashboard'),
};

// ===== DISCORD =====
export interface DiscordStatus {
  connected: boolean;
  username: string | null;
  guilds: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent: string | null;
}

export interface DiscordMessage {
  id: string;
  author: string;
  author_id: string;
  content: string;
  timestamp: string;
  attachments: { name: string; url: string; size: number }[];
}

const discord = {
  connect: (bot_token: string) =>
    apiCall<{ status: string; guilds: DiscordGuild[] }>('/discord/connect', 'POST', { bot_token }),

  disconnect: () =>
    apiCall<{ status: string }>('/discord/disconnect', 'POST'),

  reconnect: () =>
    apiCall<{ status: string; guilds: DiscordGuild[] }>('/discord/reconnect', 'POST'),

  status: () =>
    apiCall<DiscordStatus>('/discord/status'),

  send: (channel_id: string, content: string, reply_to?: string) =>
    apiCall<{ id: string; content: string; timestamp: string }>('/discord/send', 'POST', { channel_id, content, reply_to }),

  readMessages: (channelId: string, limit?: number) =>
    apiCall<DiscordMessage[]>(`/discord/messages/${channelId}?limit=${limit || 50}`),

  listGuilds: () =>
    apiCall<DiscordGuild[]>('/discord/guilds'),

  listChannels: (guildId: string) =>
    apiCall<DiscordChannel[]>(`/discord/channels/${guildId}`),

  react: (channel_id: string, message_id: string, emoji: string) =>
    apiCall<{ reacted: boolean }>('/discord/react', 'POST', { channel_id, message_id, emoji }),
};

// ===== CHAT =====
export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  voice_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChatResponse {
  message: ChatMessage;
  voice_url?: string;
}

export interface VoiceChatResponse {
  transcription: string;
  message: ChatMessage | null;
  voice_url: string | null;
  error?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const chat = {
  send: (message: string, generateVoice?: boolean, voiceId?: string, image?: { data: string; mediaType: string }, refreshContext?: boolean) =>
    apiCall<ChatResponse>('/chat/send', 'POST', { message, generateVoice, voiceId, ...(image ? { image } : {}), ...(refreshContext ? { refreshContext: true } : {}) }),

  sendVoice: (audio: string, mimeType?: string, voiceId?: string) =>
    apiCall<VoiceChatResponse>('/chat/voice', 'POST', { audio, mimeType, voiceId }),

  history: (limit?: number, before?: string, threadId?: string) =>
    apiCall<ChatMessage[]>(`/chat/history?limit=${limit || 50}${before ? '&before=' + before : ''}${threadId ? '&threadId=' + threadId : ''}`),

  clearHistory: (threadId?: string) =>
    apiCall<{ success: boolean }>(`/chat/history${threadId ? '?threadId=' + threadId : ''}`, 'DELETE'),

  threads: {
    list: () => apiCall<ChatThread[]>('/chat/threads'),
    create: (name?: string) => apiCall<ChatThread>('/chat/threads', 'POST', { name }),
    rename: (threadId: string, name: string) => apiCall<ChatThread>(`/chat/threads/${threadId}`, 'PATCH', { name }),
    delete: (threadId: string) => apiCall<{ ok: boolean }>(`/chat/threads/${threadId}`, 'DELETE'),
  },
};

// ===== LIBRARY =====
export interface LibraryBook {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  file_type: 'pdf' | 'epub' | 'txt';
  file_name: string;
  file_size_bytes: number;
  cover_color?: string;
  total_chapters: number;
  current_chapter: number;
  reading_progress: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BookChapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  created_at: string;
}

export interface BookDetail extends LibraryBook {
  chapters: { chapter_number: number; title: string; word_count: number }[];
}

const library = {
  list: () =>
    apiCall<LibraryBook[]>('/library'),

  get: (bookId: string) =>
    apiCall<BookDetail>(`/library/${bookId}`),

  upload: (file: string, options: { title: string; author?: string; filename: string; mimeType: string }) =>
    apiCall<LibraryBook>('/library/upload', 'POST', { file, ...options }),

  getChapter: (bookId: string, chapterNumber: number) =>
    apiCall<BookChapter>(`/library/${bookId}/chapters/${chapterNumber}`),

  updateProgress: (bookId: string, currentChapter: number) =>
    apiCall<LibraryBook>(`/library/${bookId}/progress`, 'PUT', { currentChapter }),

  delete: (bookId: string) =>
    apiCall<void>(`/library/${bookId}`, 'DELETE'),
};

// ===== SPOTIFY =====
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  albumArtSmall: string | null;
  duration_ms: number;
  progress_ms: number;
  external_url: string | null;
  context_type: string | null;
}

export interface SpotifyNowPlaying {
  connected: boolean;
  playing: boolean;
  track?: SpotifyTrack;
}

export interface SpotifySearchResult {
  uri: string;
  name: string;
  artists: string;
  album: string;
  duration_ms: number;
  external_url: string;
}

const spotify = {
  nowPlaying: () =>
    apiCall<SpotifyNowPlaying>('/spotify/now-playing'),

  status: () =>
    apiCall<{ connected: boolean }>('/spotify/status'),

  play: (opts?: { uri?: string; context_uri?: string; position_ms?: number }) =>
    apiCall<{ ok: boolean }>('/spotify/play', 'POST', opts || {}),

  pause: () =>
    apiCall<{ ok: boolean }>('/spotify/pause', 'POST'),

  next: () =>
    apiCall<{ ok: boolean }>('/spotify/next', 'POST'),

  previous: () =>
    apiCall<{ ok: boolean }>('/spotify/previous', 'POST'),

  seek: (position_ms: number) =>
    apiCall<{ ok: boolean }>('/spotify/seek', 'POST', { position_ms }),

  volume: (volume_percent: number) =>
    apiCall<{ ok: boolean }>('/spotify/volume', 'POST', { volume_percent }),

  search: (query: string, type?: string) =>
    apiCall<{ tracks: SpotifySearchResult[] }>('/spotify/search', 'POST', { query, type }),

  disconnect: () =>
    apiCall<{ ok: boolean }>('/spotify/disconnect', 'DELETE'),
};

// ===== LINCOLN'S DESK =====
export interface DeskItem {
  id: string;
  user_id: string;
  type: 'note' | 'song' | 'quote' | 'nudge' | 'observation' | 'question';
  title: string | null;
  content: string;
  metadata: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

const desk = {
  list: (unreadOnly?: boolean) =>
    apiCall<DeskItem[]>(`/desk${unreadOnly ? '?unread=true' : ''}`),

  unreadCount: () =>
    apiCall<{ count: number }>('/desk/unread-count'),

  markRead: (id: string) =>
    apiCall<DeskItem>(`/desk/${id}/read`, 'PATCH'),

  markAllRead: () =>
    apiCall<{ success: boolean }>('/desk/read-all', 'POST'),

  delete: (id: string) =>
    apiCall<{ success: boolean }>(`/desk/${id}`, 'DELETE'),
};

// ===== GAMES =====
export type GameType = 'tictactoe' | 'checkers' | 'chess';

export interface Game {
  id: string;
  user_id: string;
  game_type: GameType;
  board: (string | null)[];
  current_turn: 'lincoln' | 'arden';
  status: 'active' | 'won' | 'draw';
  winner: string | null;
  winning_line: number[] | null;
  metadata: any;
  move_history: { player: string; position?: number; from?: number; to?: number; mark?: string; piece?: string; algebraic?: string; captured?: any; check?: boolean; timestamp: string }[];
  created_at: string;
  updated_at: string;
}

const games = {
  list: () => apiCall<Game[]>('/games'),
  get: (id: string) => apiCall<Game>(`/games/${id}`),
  create: (game_type: GameType) => apiCall<Game>('/games', 'POST', { game_type }),
  move: (id: string, player: 'lincoln' | 'arden', moveData: { position?: number; from?: number; to?: number; promotion?: string }) =>
    apiCall<Game>(`/games/${id}/move`, 'POST', { player, ...moveData }),
  delete: (id: string) => apiCall<{ success: boolean }>(`/games/${id}`, 'DELETE'),
};

export const api = {
  entities,
  observations,
  relations,
  journal,
  emotions,
  status,
  identity,
  context,
  health,
  voice,
  images,
  discord,
  chat,
  library,
  spotify,
  desk,
  games,
};
