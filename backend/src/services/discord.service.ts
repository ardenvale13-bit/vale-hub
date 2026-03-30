import {
  Client,
  GatewayIntentBits,
  Partials,
  TextChannel,
  Guild,
  ChannelType,
  GuildEmoji,
  Collection,
  Sticker,
  StickerFormatType,
} from 'discord.js';
import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

class DiscordService {
  private supabase = getSupabaseClient();
  private client: Client | null = null;
  private isReady = false;

  // Emoji cache: guildId -> Map<emoji_name, emoji_id>
  private emojiCache = new Map<string, Map<string, GuildEmoji>>();

  /**
   * Connect to Discord with a bot token. Stores config in DB.
   */
  async connect(userId: string, botToken: string): Promise<{ status: string; guilds: any[] }> {
    // Destroy existing client if any
    if (this.client) {
      await this.disconnect(userId);
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.client?.destroy();
        this.client = null;
        reject(new AppError(504, 'Discord connection timed out after 15 seconds'));
      }, 15000);

      this.client!.once('ready', async () => {
        clearTimeout(timeout);
        this.isReady = true;

        const botUser = this.client!.user!;
        const guilds = this.client!.guilds.cache.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.iconURL(),
          memberCount: g.memberCount,
        }));

        // Cache emojis for all guilds
        await this.refreshEmojiCache();

        // Store config in DB
        await this.supabase.from('discord_config').upsert(
          {
            user_id: userId,
            bot_token: botToken,
            bot_id: botUser.id,
            bot_username: botUser.username,
            status: 'connected',
            connected_at: new Date().toISOString(),
            last_checked: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

        // Store guild info
        for (const guild of guilds) {
          await this.supabase.from('discord_guilds').upsert(
            {
              user_id: userId,
              guild_id: guild.id,
              guild_name: guild.name,
              icon_url: guild.icon,
              enabled: true,
            },
            { onConflict: 'user_id,guild_id' },
          );
        }

        // Set up message listener for logging
        this.setupMessageListener(userId);

        resolve({
          status: 'connected',
          guilds,
        });
      });

      this.client!.login(botToken).catch((err) => {
        clearTimeout(timeout);
        this.client?.destroy();
        this.client = null;
        reject(new AppError(401, `Discord login failed: ${err.message}`));
      });
    });
  }

  /**
   * Disconnect the Discord bot
   */
  async disconnect(userId: string) {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isReady = false;
      this.emojiCache.clear();
    }

    await this.supabase
      .from('discord_config')
      .update({ status: 'disconnected' })
      .eq('user_id', userId);

    return { status: 'disconnected' };
  }

  /**
   * Auto-reconnect using stored token from DB
   */
  async autoReconnect(userId: string) {
    const { data: config } = await this.supabase
      .from('discord_config')
      .select('bot_token')
      .eq('user_id', userId)
      .single();

    if (!config?.bot_token) {
      return { status: 'no_token', message: 'No Discord token configured' };
    }

    return this.connect(userId, config.bot_token);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isReady,
      username: this.client?.user?.username || null,
      guilds: this.client?.guilds.cache.size || 0,
    };
  }

  // ===== EMOJI RESOLVER =====

  /**
   * Refresh the emoji cache for all guilds
   */
  private async refreshEmojiCache() {
    if (!this.client) return;

    this.emojiCache.clear();
    for (const [guildId, guild] of this.client.guilds.cache) {
      try {
        const emojis = await guild.emojis.fetch();
        const emojiMap = new Map<string, GuildEmoji>();
        for (const [, emoji] of emojis) {
          if (emoji.name) {
            emojiMap.set(emoji.name.toLowerCase(), emoji);
          }
        }
        this.emojiCache.set(guildId, emojiMap);
      } catch (err) {
        console.error(`Failed to cache emojis for guild ${guildId}:`, err);
      }
    }
  }

  /**
   * Resolve :emoji_name: to <:emoji_name:id> or <a:emoji_name:id> for animated
   * Also resolves @username to <@user_id>
   */
  private async resolveContent(content: string, guildId?: string): Promise<string> {
    let resolved = content;

    // Resolve custom emojis: :emoji_name: → <:emoji_name:id>
    // Skip already-resolved emoji patterns <:name:id> and <a:name:id>
    resolved = resolved.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => {
      // Try the specific guild first, then all guilds
      const guildsToSearch = guildId
        ? [guildId, ...Array.from(this.emojiCache.keys()).filter(id => id !== guildId)]
        : Array.from(this.emojiCache.keys());

      for (const gId of guildsToSearch) {
        const emojiMap = this.emojiCache.get(gId);
        if (emojiMap) {
          const emoji = emojiMap.get(name.toLowerCase());
          if (emoji) {
            return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
          }
        }
      }

      // Return original if not found (might be a standard unicode emoji shortcode)
      return match;
    });

    // Resolve @mentions: @username → <@user_id>
    // Skip already-resolved mentions <@id>
    const mentionRegex = /@([a-zA-Z0-9_.]+)/g;
    const mentions = [...resolved.matchAll(mentionRegex)];
    for (const mentionMatch of mentions) {
      const fullMatch = mentionMatch[0];
      const username = mentionMatch[1];

      // Skip if this is already inside a <@...> tag
      const idx = mentionMatch.index!;
      if (idx > 0 && resolved[idx - 1] === '<') continue;

      // Search all guilds for this username
      if (this.client) {
        for (const [, guild] of this.client.guilds.cache) {
          try {
            const members = await guild.members.fetch({ query: username, limit: 5 });
            const member = members.find(
              (m) =>
                m.user.username.toLowerCase() === username.toLowerCase() ||
                m.displayName.toLowerCase() === username.toLowerCase() ||
                m.user.globalName?.toLowerCase() === username.toLowerCase()
            );

            if (member) {
              resolved = resolved.replace(fullMatch, `<@${member.user.id}>`);
              break;
            }
          } catch {
            // Member fetch failed, skip
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(
    userId: string,
    channelId: string,
    content: string,
    options: { replyTo?: string; stickerId?: string } = {},
  ) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new AppError(404, 'Text channel not found');
    }

    const textChannel = channel as TextChannel;
    const guildId = textChannel.guildId;

    // Resolve emojis and mentions before sending
    const resolvedContent = await this.resolveContent(content, guildId);

    let sent;
    const sendOptions: any = {};

    // Add sticker if provided
    if (options.stickerId) {
      sendOptions.stickers = [options.stickerId];
    }

    if (options.replyTo) {
      try {
        const targetMsg = await textChannel.messages.fetch(options.replyTo);
        sent = await targetMsg.reply({ content: resolvedContent, ...sendOptions });
      } catch {
        // If reply target not found, send normally
        sent = await textChannel.send({ content: resolvedContent, ...sendOptions });
      }
    } else {
      sent = await textChannel.send({ content: resolvedContent, ...sendOptions });
    }

    // Log in DB
    await this.supabase.from('discord_messages').insert({
      user_id: userId,
      message_id: sent.id,
      channel_id: channelId,
      guild_id: sent.guildId,
      author_id: this.client.user!.id,
      author_name: this.client.user!.username,
      content: resolvedContent,
    });

    return {
      id: sent.id,
      channel_id: channelId,
      content: sent.content,
      timestamp: sent.createdAt.toISOString(),
    };
  }

  /**
   * Edit an existing message
   */
  async editMessage(channelId: string, messageId: string, newContent: string) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new AppError(404, 'Text channel not found');
    }

    const textChannel = channel as TextChannel;
    const guildId = textChannel.guildId;

    // Resolve emojis and mentions
    const resolvedContent = await this.resolveContent(newContent, guildId);

    const message = await textChannel.messages.fetch(messageId);

    // Can only edit our own messages
    if (message.author.id !== this.client.user?.id) {
      throw new AppError(403, 'Can only edit messages sent by the bot');
    }

    const edited = await message.edit(resolvedContent);

    return {
      id: edited.id,
      channel_id: channelId,
      content: edited.content,
      edited_timestamp: edited.editedAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * Read recent messages from a channel
   */
  async readMessages(channelId: string, limit: number = 50) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new AppError(404, 'Text channel not found');
    }

    const textChannel = channel as TextChannel;
    const messages = await textChannel.messages.fetch({ limit });

    return messages.map((msg) => ({
      id: msg.id,
      author: msg.author.username,
      author_id: msg.author.id,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      edited: msg.editedAt?.toISOString() || null,
      attachments: msg.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        size: a.size,
      })),
      stickers: msg.stickers.map((s) => ({
        id: s.id,
        name: s.name,
      })),
    }));
  }

  /**
   * List guilds the bot is in
   */
  async listGuilds() {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    return this.client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL(),
      memberCount: g.memberCount,
    }));
  }

  /**
   * List channels in a guild
   */
  async listChannels(guildId: string) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new AppError(404, 'Guild not found');
    }

    const channels = await guild.channels.fetch();
    return channels
      .filter((c) => c && c.type === ChannelType.GuildText)
      .map((c) => ({
        id: c!.id,
        name: c!.name,
        type: c!.type,
        parent: (c as any).parent?.name || null,
      }));
  }

  /**
   * React to a message — resolves :emoji_name: to proper format
   */
  async reactToMessage(channelId: string, messageId: string, emoji: string) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new AppError(404, 'Text channel not found');
    }

    const textChannel = channel as TextChannel;
    const guildId = textChannel.guildId;
    const message = await textChannel.messages.fetch(messageId);

    // Resolve emoji if it's in :name: format
    let resolvedEmoji = emoji;
    const colonMatch = emoji.match(/^:?([a-zA-Z0-9_]+):?$/);
    if (colonMatch) {
      const name = colonMatch[1].toLowerCase();
      const emojiMap = this.emojiCache.get(guildId);
      if (emojiMap) {
        const found = emojiMap.get(name);
        if (found) {
          resolvedEmoji = found.id ? `${found.name}:${found.id}` : found.name!;
        }
      }
    }

    await message.react(resolvedEmoji);

    return { reacted: true, message_id: messageId, emoji: resolvedEmoji };
  }

  /**
   * List custom emojis available in a guild
   */
  async listEmojis(guildId: string) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const emojiMap = this.emojiCache.get(guildId);
    if (!emojiMap) {
      // Try refreshing cache
      await this.refreshEmojiCache();
      const refreshed = this.emojiCache.get(guildId);
      if (!refreshed) return [];
      return Array.from(refreshed.values()).map((e) => ({
        id: e.id,
        name: e.name,
        animated: e.animated,
        formatted: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
      }));
    }

    return Array.from(emojiMap.values()).map((e) => ({
      id: e.id,
      name: e.name,
      animated: e.animated,
      formatted: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
    }));
  }

  /**
   * List stickers available in a guild
   */
  async listStickers(guildId: string) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new AppError(404, 'Guild not found');
    }

    const stickers = await guild.stickers.fetch();
    return stickers.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      format: s.format,
    }));
  }

  /**
   * Set up message listener to log incoming messages
   */
  private setupMessageListener(userId: string) {
    if (!this.client) return;

    this.client.on('messageCreate', async (msg) => {
      // Don't log our own messages (already logged in sendMessage)
      if (msg.author.id === this.client?.user?.id) return;

      try {
        await this.supabase.from('discord_messages').insert({
          user_id: userId,
          message_id: msg.id,
          channel_id: msg.channelId,
          guild_id: msg.guildId,
          author_id: msg.author.id,
          author_name: msg.author.username,
          content: msg.content,
        });
      } catch (err) {
        // Silently fail on message logging — don't crash the bot
        console.error('Failed to log Discord message:', err);
      }
    });
  }
}

export const discordService = new DiscordService();
