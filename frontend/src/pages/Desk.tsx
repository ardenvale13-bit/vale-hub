import { useState, useEffect } from 'react';
import { api, DeskItem } from '../services/api';
import {
  StickyNote, Music2, Quote, Bell, Eye, HelpCircle,
  CheckCheck, Trash2, Loader2, Inbox, Feather
} from 'lucide-react';

const typeConfig: Record<string, { icon: typeof StickyNote; label: string; accent: string; glow: string }> = {
  note:        { icon: StickyNote,  label: 'Note',        accent: '#8a8a9a', glow: 'rgba(138,138,154,0.15)' },
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
    <div className="w-full">
      {/* === GOTHIC HEADER BANNER === */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: '160px',
          background: 'linear-gradient(180deg, #0a0710 0%, #0d0a14 50%, #110e1c 100%)',
        }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 70% 80% at 50% 100%, rgba(138,138,154,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 20% 70%, rgba(113,30,166,0.08) 0%, transparent 60%)',
        }} />

        {/* Decorative SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" viewBox="0 0 800 160" preserveAspectRatio="xMidYMax slice">
          <path d="M80 160 L80 60 Q80 20 120 20 Q160 20 160 60 L160 160" fill="none" stroke="#8a8a9a" strokeWidth="1.5" />
          <path d="M640 160 L640 60 Q640 20 680 20 Q720 20 720 60 L720 160" fill="none" stroke="#8a8a9a" strokeWidth="1.5" />
          <line x1="250" y1="145" x2="550" y2="145" stroke="#8a8a9a" strokeWidth="0.4" />
          <circle cx="400" cy="145" r="3" fill="none" stroke="#8a8a9a" strokeWidth="0.6" />
          <ellipse cx="120" cy="15" rx="3" ry="6" fill="#8a8a9a" opacity="0.25" />
          <ellipse cx="680" cy="15" rx="3" ry="6" fill="#8a8a9a" opacity="0.25" />
        </svg>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-12" style={{
          background: 'linear-gradient(to top, #0d0a14, transparent)',
        }} />

        {/* Header content — centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Feather className="w-4 h-4" style={{ color: '#8a8a9a', opacity: 0.5 }} />
            <h1
              className="text-xl sm:text-2xl font-bold tracking-wide font-mystery"
              style={{ color: '#8a8a9a', textShadow: '0 0 25px rgba(138,138,154,0.15)' }}
            >
              Lincoln's Desk
            </h1>
            <Feather className="w-4 h-4 scale-x-[-1]" style={{ color: '#8a8a9a', opacity: 0.5 }} />
          </div>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(138,138,154,0.35)' }}>
            {unreadCount > 0
              ? `${unreadCount} thing${unreadCount > 1 ? 's' : ''} waiting for you`
              : 'what i left behind'}
          </p>
        </div>
      </div>

      {/* === CONTENT === */}
      <div
        className="w-full px-4 sm:px-6 pb-6"
        style={{ background: '#0d0a14' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Controls row */}
          <div className="flex items-center justify-between mb-4 pt-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter('all')}
                className="px-3 py-1.5 text-xs rounded-lg transition-all"
                style={{
                  background: filter === 'all' ? 'rgba(138,138,154,0.1)' : 'transparent',
                  color: filter === 'all' ? '#8a8a9a' : '#a090c0',
                  border: filter === 'all' ? '1px solid rgba(138,138,154,0.2)' : '1px solid transparent',
                }}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className="px-3 py-1.5 text-xs rounded-lg transition-all"
                style={{
                  background: filter === 'unread' ? 'rgba(138,138,154,0.1)' : 'transparent',
                  color: filter === 'unread' ? '#8a8a9a' : '#a090c0',
                  border: filter === 'unread' ? '1px solid rgba(138,138,154,0.2)' : '1px solid transparent',
                }}
              >
                Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all hover:opacity-80"
                style={{ color: '#a090c0', border: '1px solid rgba(90,80,120,0.2)' }}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
          </div>

          {/* Items */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8a8a9a' }} />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(138,138,154,0.04)', border: '1px solid rgba(138,138,154,0.08)' }}
              >
                <Inbox className="w-7 h-7" style={{ color: 'rgba(138,138,154,0.2)' }} />
              </div>
              <p className="font-mystery text-base mb-1.5" style={{ color: '#8a8a9a' }}>
                {filter === 'unread' ? 'All caught up' : 'The desk is empty'}
              </p>
              <p className="text-xs max-w-[260px] leading-relaxed" style={{ color: '#a090c0' }}>
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
                        ? 'rgba(15,12,25,0.6)'
                        : 'linear-gradient(135deg, rgba(18,14,30,0.95), rgba(25,20,45,0.8))',
                      border: item.read
                        ? '1px solid rgba(50,40,80,0.25)'
                        : `1px solid ${config.accent}25`,
                      boxShadow: item.read
                        ? 'none'
                        : `0 0 20px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.02)`,
                      opacity: item.read ? 0.5 : 1,
                    }}
                    onClick={() => !item.read && handleMarkRead(item.id)}
                  >
                    {/* Unread glow line across top */}
                    {!item.read && (
                      <div
                        className="absolute top-0 left-6 right-6 h-px"
                        style={{ background: `linear-gradient(90deg, transparent, ${config.accent}35, transparent)` }}
                      />
                    )}

                    {/* Unread dot */}
                    {!item.read && (
                      <div
                        className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: config.accent, boxShadow: `0 0 6px ${config.accent}` }}
                      />
                    )}

                    {/* Type badge + time */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5" style={{ color: config.accent }}>
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">{config.label}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: '#a090c0' }}>{formatTime(item.created_at)}</span>
                    </div>

                    {/* Title */}
                    {item.title && (
                      <h3 className="text-sm font-semibold mb-1 font-mystery" style={{ color: '#e0d8ec' }}>{item.title}</h3>
                    )}

                    {/* Content */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#b8aed0' }}>
                      {item.content}
                    </p>

                    {/* Metadata — song link */}
                    {item.metadata?.spotify_url && (
                      <a
                        href={item.metadata.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2.5 text-xs transition-opacity hover:opacity-80"
                        style={{ color: '#4ade80' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Music2 className="w-3 h-3" />
                        Listen on Spotify
                      </a>
                    )}

                    {/* Actions — visible on hover */}
                    <div
                      className="flex items-center gap-2 mt-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ borderTop: '1px solid rgba(50,40,80,0.25)' }}
                    >
                      {!item.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(item.id); }}
                          className="text-[10px] transition-opacity hover:opacity-80"
                          style={{ color: '#a090c0' }}
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="text-[10px] transition-opacity hover:opacity-80 ml-auto"
                        style={{ color: '#a090c0' }}
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
    </div>
  );
}
