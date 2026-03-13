import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Lock,
  Wifi,
  WifiOff,
  Send,
  Hash,
  Server,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { api, DiscordStatus, DiscordGuild, DiscordChannel, DiscordMessage } from '../services/api';

export default function Discord() {
  const [token, setToken] = useState('');
  const [botStatus, setBotStatus] = useState<DiscordStatus>({
    connected: false,
    username: null,
    guilds: 0,
  });
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<DiscordChannel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function checkStatus() {
    try {
      const status = await api.discord.status();
      setBotStatus(status);
      if (status.connected) {
        const guildList = await api.discord.listGuilds();
        setGuilds(guildList);
      }
    } catch {
      // Bot not connected, that's fine
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;

    setIsConnecting(true);
    setError(null);

    try {
      const result = await api.discord.connect(token);
      setBotStatus({ connected: true, username: null, guilds: result.guilds.length });
      setGuilds(result.guilds);
      setToken('');
      setSuccess('Bot connected!');
      setTimeout(() => setSuccess(null), 3000);
      // Refresh status to get username
      const status = await api.discord.status();
      setBotStatus(status);
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Check your token.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await api.discord.disconnect();
      setBotStatus({ connected: false, username: null, guilds: 0 });
      setGuilds([]);
      setChannels([]);
      setMessages([]);
      setSelectedGuild(null);
      setSelectedChannel(null);
      setSuccess('Bot disconnected.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  }

  async function handleReconnect() {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await api.discord.reconnect();
      if (result.status === 'no_token') {
        setError('No saved token found. Enter a bot token to connect.');
      } else {
        setBotStatus({ connected: true, username: null, guilds: result.guilds?.length || 0 });
        if (result.guilds) setGuilds(result.guilds);
        const status = await api.discord.status();
        setBotStatus(status);
        setSuccess('Reconnected!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reconnect');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSelectGuild(guild: DiscordGuild) {
    setSelectedGuild(guild);
    setSelectedChannel(null);
    setMessages([]);
    try {
      const channelList = await api.discord.listChannels(guild.id);
      setChannels(channelList);
    } catch (err: any) {
      setError(err.message || 'Failed to load channels');
    }
  }

  async function handleSelectChannel(channel: DiscordChannel) {
    setSelectedChannel(channel);
    setIsLoadingMessages(true);
    try {
      const msgs = await api.discord.readMessages(channel.id, 50);
      setMessages(msgs.reverse()); // Show oldest first
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !selectedChannel) return;

    setIsSending(true);
    try {
      const result = await api.discord.send(selectedChannel.id, messageInput);
      setMessages((prev) => [
        ...prev,
        {
          id: result.id,
          author: botStatus.username || 'Bot',
          author_id: '',
          content: messageInput,
          timestamp: result.timestamp,
          attachments: [],
        },
      ]);
      setMessageInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function refreshMessages() {
    if (!selectedChannel) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await api.discord.readMessages(selectedChannel.id, 50);
      setMessages(msgs.reverse());
    } catch (err: any) {
      setError(err.message || 'Failed to refresh');
    } finally {
      setIsLoadingMessages(false);
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-vale-text mb-2">Discord</h1>
        <p className="text-vale-muted text-sm sm:text-base">Connect and control your Discord bot</p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 mb-6">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-400 hover:text-red-200">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300 mb-6">
          {success}
        </div>
      )}

      {/* Bot Status + Connection */}
      <div className="bg-vale-card border border-vale-border rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-vale-text">Bot Status</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {botStatus.connected ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-green-400">
                    {botStatus.username || 'Connected'} — {botStatus.guilds} server{botStatus.guilds !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1 text-sm bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <WifiOff className="w-4 h-4 text-vale-muted" />
                <span className="text-sm text-vale-muted">Disconnected</span>
                <button
                  onClick={handleReconnect}
                  disabled={isConnecting}
                  className="px-3 py-1 text-sm bg-vale-accent/20 text-vale-accent rounded hover:bg-vale-accent/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${isConnecting ? 'animate-spin' : ''}`} />
                  Reconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {!botStatus.connected && (
          <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vale-muted" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your Discord bot token"
                className="w-full pl-10 pr-4 py-3 bg-vale-surface border border-vale-border rounded text-vale-text placeholder-vale-muted focus:outline-none focus:border-vale-accent"
                disabled={isConnecting}
              />
            </div>
            <button
              type="submit"
              disabled={!token.trim() || isConnecting}
              className="px-6 py-3 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              Connect
            </button>
          </form>
        )}
      </div>

      {/* Main Interface — Only show when connected */}
      {botStatus.connected && (
        <div className="flex flex-col md:grid md:grid-cols-12 gap-4 h-auto md:h-[600px]">
          {/* Sidebar: Guilds + Channels */}
          <div className="md:col-span-4 lg:col-span-3 bg-vale-card border border-vale-border rounded-lg overflow-hidden flex flex-col max-h-60 md:max-h-none">
            {/* Guilds */}
            <div className="p-3 border-b border-vale-border">
              <h3 className="text-xs font-semibold text-vale-muted uppercase tracking-wider flex items-center gap-1">
                <Server className="w-3 h-3" />
                Servers
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {guilds.map((guild) => (
                <div key={guild.id}>
                  <button
                    onClick={() => handleSelectGuild(guild)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                      selectedGuild?.id === guild.id
                        ? 'bg-vale-accent/20 text-vale-accent'
                        : 'text-vale-text hover:bg-vale-surface'
                    }`}
                  >
                    <span className="truncate mr-2">{guild.name}</span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  </button>

                  {/* Channels under selected guild */}
                  {selectedGuild?.id === guild.id && channels.length > 0 && (
                    <div className="bg-vale-surface/50">
                      {channels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => handleSelectChannel(channel)}
                          className={`w-full text-left px-5 py-2 text-sm transition-colors flex items-center gap-2 ${
                            selectedChannel?.id === channel.id
                              ? 'bg-vale-accent/10 text-vale-accent'
                              : 'text-vale-muted hover:text-vale-text hover:bg-vale-surface'
                          }`}
                        >
                          <Hash className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-8 lg:col-span-9 bg-vale-card border border-vale-border rounded-lg overflow-hidden flex flex-col min-h-[400px] md:min-h-0">
            {/* Channel Header */}
            <div className="px-4 py-3 border-b border-vale-border flex items-center justify-between">
              {selectedChannel ? (
                <>
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-vale-muted" />
                    <span className="font-medium text-vale-text">{selectedChannel.name}</span>
                    {selectedChannel.parent && (
                      <span className="text-xs text-vale-muted">in {selectedChannel.parent}</span>
                    )}
                  </div>
                  <button
                    onClick={refreshMessages}
                    disabled={isLoadingMessages}
                    className="p-1.5 text-vale-muted hover:text-vale-text transition-colors"
                    title="Refresh messages"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </>
              ) : (
                <span className="text-vale-muted text-sm">Select a channel to start chatting</span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {!selectedChannel ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-vale-border mx-auto mb-3 opacity-50" />
                    <p className="text-vale-muted">Pick a server and channel from the sidebar</p>
                  </div>
                </div>
              ) : isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-vale-accent animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-vale-muted text-sm">No messages in this channel</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-vale-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-vale-accent">
                      {msg.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-vale-text text-sm">{msg.author}</span>
                        <span className="text-xs text-vale-muted">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-vale-text/80 break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {selectedChannel && (
              <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-vale-border flex gap-2 items-end">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={`Message #${selectedChannel.name} (Shift+Enter for new line)`}
                  className="flex-1 px-4 py-2 bg-vale-surface border border-vale-border rounded text-vale-text placeholder-vale-muted focus:outline-none focus:border-vale-accent text-sm resize-none min-h-[40px] max-h-[160px]"
                  disabled={isSending}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
                  }}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="px-4 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Getting Started — Only show when disconnected */}
      {!botStatus.connected && (
        <div className="bg-vale-card border border-vale-border rounded p-6">
          <h3 className="font-semibold text-vale-text mb-3">How to get a bot token</h3>
          <p className="text-sm text-vale-muted leading-relaxed">
            Go to the Discord Developer Portal, create a new application, add a bot under the "Bot" section,
            and copy the token. Then invite the bot to your server using the OAuth2 URL Generator with
            the "bot" scope and "Send Messages", "Read Message History", and "Add Reactions" permissions.
            Paste the token above and hit Connect.
          </p>
        </div>
      )}
    </div>
  );
}
