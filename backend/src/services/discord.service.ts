import {
  Client,
  GatewayIntentBits,
  Partials,
  TextChannel,
  Guild,
  ChannelType,
} from 'discord.js';
import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

class DiscordService {
  private supabase = getSupabaseClient();
  private client: Client | null = null;
  private isReady = false;

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

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(
    userId: string,
    channelId: string,
    content: string,
    options: { replyTo?: string } = {},
  ) {
    if (!this.client || !this.isReady) {
      throw new AppError(400, 'Discord bot is not connected');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new AppError(404, 'Text channel not found');
    }

    const textChannel = channel as TextChannel;

    let sent;
    if (options.replyTo) {
      try {
        const targetMsg = await textChannel.messages.fetch(options.replyTo);
        sent = await targetMsg.reply(content);
      } catch {
        // If reply target not found, send normally
        sent = await textChannel.send(content);
      }
    } else {
      sent = await textChannel.send(content);
    }

    // Log in DB
    await this.supabase.from('discord_messages').insert({
      user_id: userId,
      message_id: sent.id,
      channel_id: channelId,
      guild_id: sent.guildId,
      author_id: this.client.user!.id,
      author_name: this.client.user!.username,
      content: content,
    });

    return {
      id: sent.id,
      channel_id: channelId,
      content: sent.content,
      timestamp: sent.createdAt.toISOString(),
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
      attachments: msg.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        size: a.size,
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
   * React to a message
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
    const message = await textChannel.messages.fetch(messageId);
    await message.react(emoji);

    return { reacted: true, message_id: messageId, emoji };
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
