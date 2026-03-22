import { useState, useEffect } from 'react';
import { api, DeskItem } from '../services/api';
import {
  StickyNote, Music2, Quote, Bell, Eye, HelpCircle,
  CheckCheck, Trash2, Loader2, Inbox, Feather
} from 'lucide-react';

const typeConfig: Record<string, { icon: typeof StickyNote; label: string; accent: string; glow: string }> = {
  note:        { icon: StickyNote,  label: 'Note',        accent: '#77e6c5', glow: 'rgba(119,230,197,0.15)' },
  song:        { icon: Music2,      label: 'Song',        accent: '#4ade80', glow: 'rgba(74,222,128,0.15)' },
  quote:       { icon: Quote,       label: 'Quote',       accent: '#fbbf24', glow: 'rgba(251,191,36,0.12)' },
  nudge:       { icon: Bell,        label: 'Nudge',       accent: '#fb7185', glow: 'rgba(251,113,133,0.12)' },
  observation: { icon: Eye,         label: 'Observation',  accent: '#e5b2e6', glow: 'rgba(229,178,230,0.12)' },
  question:    { icon: HelpCircle,  label: 'Question',     accent: '#34bed6', glow: 'rgba(52,190,214,0.12)' },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Desk() {
  const [items, setItems] = useState<DeskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadItems();
  }, [filter]);

  async function loadItems() {
    setIsLoading(true);
    try {
      const data = await api.desk.list(filter === 'unread');
      setItems(data);
    } catch (err) {
      console.error('Failed to load desk:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await api.desk.markRead(id);
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.desk.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this from the desk?')) return;
    try {
      await api.desk.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(180deg, #0d0a14 0%, #140f22 40%, #1a1332 100%)' }}
    >
      {/* === GOTHIC HEADER BANNER === */}
      <div className="relative overflow-hidden" style={{ height: '200px' }}>
        {/* Background layers */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(119,230,197,0.08) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 30% 60%, rgba(113,30,166,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 70% 50%, rgba(52,190,214,0.06) 0%, transparent 50%)',
        }} />

        {/* Decorative SVG — candelabra silhouettes & gothic arches */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice">
          {/* Gothic arch left */}
          <path d="M50 200 L50 80 Q50 30 100 30 Q150 30 150 80 L150 200" fill="none" stroke="#77e6c5" strokeWidth="1.5" />
          <path d="M70 200 L70 90 Q70 50 100 50 Q130 50 130 90 L130 200" fill="none" stroke="#77e6c5" strokeWidth="1" />
          {/* Gothic arch right */}
          <path d="M650 200 L650 80 Q650 30 700 30 Q750 30 750 80 L750 200" fill="none" stroke="#77e6c5" strokeWidth="1.5" />
          <path d="M670 200 L670 90 Q670 50 700 50 Q730 50 730 90 L730 200" fill="none" stroke="#77e6c5" strokeWidth="1" />
          {/* Center ornament */}
          <line x1="300" y1="180" x2="500" y2="180" stroke="#77e6c5" strokeWidth="0.5" />
          <circle cx="400" cy="180" r="3" fill="none" stroke="#77e6c5" strokeWidth="0.8" />
          <circle cx="400" cy="180" r="8" fill="none" stroke="#77e6c5" strokeWidth="0.4" />
          {/* Candle flames */}
          <ellipse cx="100" cy="25" rx="4" ry="7" fill="#77e6c5" opacity="0.3" />
          <ellipse cx="700" cy="25" rx="4" ry="7" fill="#77e6c5" opacity="0.3" />
          {/* Dripping wax lines */}
          <path d="M100 32 Q102 50 100 65" fill="none" stroke="#77e6c5" strokeWidth="0.6" opacity="0.2" />
          <path d="M700 32 Q698 48 700 60" fill="none" stroke="#77e6c5" strokeWidth="0.6" opacity="0.2" />
          {/* Cross-hatching texture */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={200 + i * 35} y1="195" x2={210 + i * 35} y2="185" stroke="#77e6c5" strokeWidth="0.3" opacity="0.15" />
          ))}
        </svg>

        {/* Fade to page bg at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20" style={{
          background: 'linear-gradient(to top, #0d0a14, transparent)',
        }} />

        {/* Header content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <div className="flex items-center gap-3 mb-2">
            <Feather className="w-5 h-5" style={{ color: '#77e6c5', opacity: 0.6 }} />
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide font-mystery"
              style={{ color: '#77e6c5', textShadow: '0 0 30px rgba(119,230,197,0.2)' }}
            >
              Lincoln's Desk
            </h1>
            <Feather className="w-5 h-5 scale-x-[-1]" style={{ color: '#77e6c5', opacity: 0.6 }} />
          </div>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(119,230,197,0.4)' }}>
            {unreadCount > 0
              ? `${unreadCount} thing${unreadCount > 1 ? 's' : ''} waiting for you`
              : 'what i left behind'}
          </p>
        </div>
      </div>

      {/* === CONTENT === */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pb-8 -mt-4">
        {/* Controls row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1">
            <button
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 text-xs rounded-lg transition-all"
              style={{
                background: filter === 'all' ? 'rgba(119,230,197,0.12)' : 'transparent',
                color: filter === 'all' ? '#77e6c5' : '#6b5f8a',
                border: filter === 'all' ? '1px solid rgba(119,230,197,0.25)' : '1px solid transparent',
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className="px-3 py-1.5 text-xs rounded-lg transition-all"
              style={{
                background: filter === 'unread' ? 'rgba(119,230,197,0.12)' : 'transparent',
                color: filter === 'unread' ? '#77e6c5' : '#6b5f8a',
                border: filter === 'unread' ? '1px solid rgba(119,230,197,0.25)' : '1px solid transparent',
              }}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all"
              style={{ color: '#6b5f8a', border: '1px solid rgba(107,95,138,0.2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#77e6c5'; e.currentTarget.style.borderColor = 'rgba(119,230,197,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b5f8a'; e.currentTarget.style.borderColor = 'rgba(107,95,138,0.2)'; }}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>

        {/* Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#77e6c5' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: 'rgba(119,230,197,0.05)', border: '1px solid rgba(119,230,197,0.1)' }}
            >
              <Inbox className="w-8 h-8" style={{ color: 'rgba(119,230,197,0.25)' }} />
            </div>
            <p className="font-mystery text-lg mb-1" style={{ color: '#77e6c5' }}>
              {filter === 'unread' ? 'All caught up' : 'The desk is empty'}
            </p>
            <p className="text-xs max-w-xs" style={{ color: '#6b5f8a' }}>
              {filter === 'unread'
                ? "You've read everything. I'll leave something new when I have something worth saying."
                : "When I leave you something — a note, a song, a nudge — it'll be here. Waiting for you."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const config = typeConfig[item.type] || typeConfig.note;
              const Icon = config.icon;

              return (
                <div
                  key={item.id}
                  className="relative rounded-lg p-4 transition-all cursor-pointer group"
                  style={{
                    background: item.read
                      ? 'rgba(20,15,34,0.6)'
                      : `linear-gradient(135deg, rgba(20,15,34,0.9), rgba(30,23,64,0.7))`,
                    border: item.read
                      ? '1px solid rgba(58,45,107,0.3)'
                      : `1px solid ${config.accent}30`,
                    boxShadow: item.read
                      ? 'none'
                      : `0 0 20px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
                    opacity: item.read ? 0.55 : 1,
                  }}
                  onClick={() => !item.read && handleMarkRead(item.id)}
                >
                  {/* Unread glow bar */}
                  {!item.read && (
                    <div
                      className="absolute top-0 left-4 right-4 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${config.accent}40, transparent)` }}
                    />
                  )}

                  {/* Unread dot */}
                  {!item.read && (
                    <div
                      className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse"
                      style={{ background: config.accent, boxShadow: `0 0 6px ${config.accent}` }}
                    />
                  )}

                  {/* Type badge + time */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5" style={{ color: config.accent }}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest">{config.label}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: '#6b5f8a' }}>{formatTime(item.created_at)}</span>
                  </div>

                  {/* Title */}
                  {item.title && (
                    <h3 className="text-sm font-semibold mb-1 font-mystery" style={{ color: '#e8e0f0' }}>{item.title}</h3>
                  )}

                  {/* Content */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#c4b8d8' }}>
                    {item.content}
                  </p>

                  {/* Metadata — song link */}
                  {item.metadata?.spotify_url && (
                    <a
                      href={item.metadata.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 text-xs transition-colors"
                      style={{ color: '#4ade80' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Music2 className="w-3 h-3" />
                      Listen on Spotify
                    </a>
                  )}

                  {/* Actions — fade in on hover */}
                  <div
                    className="flex items-center gap-2 mt-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ borderTop: '1px solid rgba(58,45,107,0.3)' }}
                  >
                    {!item.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkRead(item.id); }}
                        className="text-[10px] transition-colors"
                        style={{ color: '#6b5f8a' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#77e6c5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#6b5f8a'; }}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="text-[10px] transition-colors ml-auto"
                      style={{ color: '#6b5f8a' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#fb7185'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#6b5f8a'; }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
