export const mcpTools = [
  {
    name: 'create_entity',
    description: 'Create a new entity in the memory system',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the entity',
        },
        entity_type: {
          type: 'string',
          description: 'The type of entity (person, place, concept, event, etc)',
        },
        observations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Initial observations about the entity',
        },
        context: {
          type: 'string',
          description: 'Additional context about the entity',
        },
        salience: {
          type: 'string',
          enum: ['foundational', 'active-immediate', 'active-recent', 'background', 'archive'],
          description: 'Importance level of the entity',
        },
      },
      required: ['name', 'entity_type'],
    },
  },
  {
    name: 'get_entity',
    description: 'Retrieve a specific entity by ID',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'The ID of the entity to retrieve',
        },
      },
      required: ['entity_id'],
    },
  },
  {
    name: 'list_entities',
    description: 'List all entities for the user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of entities to return',
          default: 50,
        },
      },
    },
  },
  {
    name: 'add_observation',
    description: 'Add an observation to an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'The ID of the entity or entity name',
        },
        observation: {
          type: 'string',
          description: 'The observation to add',
        },
      },
      required: ['entity_id', 'observation'],
    },
  },
  {
    name: 'search_entities',
    description: 'Search for entities by name or context',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'log_emotion',
    description: 'Log an emotion entry',
    inputSchema: {
      type: 'object',
      properties: {
        emotion: {
          type: 'string',
          description: 'The emotion being logged',
        },
        intensity: {
          type: 'number',
          description: 'Intensity level from 0-10',
        },
        context: {
          type: 'string',
          description: 'Optional context for the emotion',
        },
      },
      required: ['emotion', 'intensity'],
    },
  },
  {
    name: 'get_emotion_history',
    description: 'Get recent emotion entries',
    inputSchema: {
      type: 'object',
      properties: {
        hours_back: {
          type: 'number',
          description: 'How many hours back to retrieve',
          default: 24,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries',
          default: 100,
        },
      },
    },
  },
  {
    name: 'get_emotion_analytics',
    description: 'Get emotion analytics and trends',
    inputSchema: {
      type: 'object',
      properties: {
        days_back: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 7,
        },
      },
    },
  },
  {
    name: 'create_journal_entry',
    description: 'Create a new journal entry',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Journal entry title',
        },
        content: {
          type: 'string',
          description: 'Journal entry content',
        },
        author_perspective: {
          type: 'string',
          description: 'The perspective/voice writing this entry',
        },
        category: {
          type: 'string',
          description: 'Category of the journal entry',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_journal_entries',
    description: 'Get recent journal entries',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'How many days back to retrieve',
          default: 30,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries',
          default: 50,
        },
      },
    },
  },
  {
    name: 'set_status',
    description: 'Set a status value (mood, energy, etc)',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category of status (mood, energy, focus, etc)',
        },
        key: {
          type: 'string',
          description: 'The status key',
        },
        value: {
          type: 'string',
          description: 'The status value',
        },
      },
      required: ['category', 'key', 'value'],
    },
  },
  {
    name: 'get_status',
    description: 'Get current status values',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional category filter',
        },
      },
    },
  },
  {
    name: 'generate_context_block',
    description: 'Generate a context block of relevant memories',
    inputSchema: {
      type: 'object',
      properties: {
        max_length: {
          type: 'number',
          description: 'Maximum character length of context',
          default: 2000,
        },
        hours_back: {
          type: 'number',
          description: 'How many hours back to include',
          default: 48,
        },
      },
    },
  },
  // ===== VOICE TOOLS =====
  {
    name: 'generate_voice',
    description: 'Generate a voice note from text using ElevenLabs TTS. Returns a playback URL.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to convert to speech',
        },
        voice_id: {
          type: 'string',
          description: 'ElevenLabs voice ID (uses default if omitted)',
        },
        perspective: {
          type: 'string',
          description: 'Speaker perspective/identity name',
        },
        context: {
          type: 'string',
          description: 'Context for the voice note',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_voice_notes',
    description: 'List recent voice notes',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return',
          default: 20,
        },
        perspective: {
          type: 'string',
          description: 'Filter by speaker perspective',
        },
      },
    },
  },
  {
    name: 'list_voices',
    description: 'List available ElevenLabs voices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ===== DISCORD TOOLS =====
  {
    name: 'discord_connect',
    description: 'Connect to Discord with a bot token',
    inputSchema: {
      type: 'object',
      properties: {
        bot_token: {
          type: 'string',
          description: 'The Discord bot token',
        },
      },
      required: ['bot_token'],
    },
  },
  {
    name: 'discord_status',
    description: 'Check Discord bot connection status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'discord_send',
    description: 'Send a message to a Discord channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'The Discord channel ID to send to',
        },
        content: {
          type: 'string',
          description: 'The message content',
        },
        reply_to: {
          type: 'string',
          description: 'Optional message ID to reply to',
        },
      },
      required: ['channel_id', 'content'],
    },
  },
  {
    name: 'discord_read',
    description: 'Read recent messages from a Discord channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'The Discord channel ID to read from',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to fetch',
          default: 50,
        },
      },
      required: ['channel_id'],
    },
  },
  {
    name: 'discord_guilds',
    description: 'List Discord servers the bot is connected to',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'discord_channels',
    description: 'List text channels in a Discord server',
    inputSchema: {
      type: 'object',
      properties: {
        guild_id: {
          type: 'string',
          description: 'The Discord server/guild ID',
        },
      },
      required: ['guild_id'],
    },
  },
  {
    name: 'discord_react',
    description: 'Add an emoji reaction to a Discord message',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'The Discord channel ID',
        },
        message_id: {
          type: 'string',
          description: 'The message ID to react to',
        },
        emoji: {
          type: 'string',
          description: 'The emoji to react with',
        },
      },
      required: ['channel_id', 'message_id', 'emoji'],
    },
  },
  // ===== LINCOLN DASHBOARD TOOLS =====
  // These tools are scoped to Lincoln's side of the dashboard only.
  // Lincoln can set his love meter, log his emotions, record soft moments,
  // write EQ log entries, and leave notes between stars as Lincoln.
  // Lincoln CANNOT modify Arden's status panel (spoons, body battery, pain, fog, heart rate, status, today's note).
  {
    name: 'lincoln_set_love',
    description: "Set Lincoln's Love-O-Meter value (0-10). Only modifies Lincoln's side.",
    inputSchema: {
      type: 'object',
      properties: {
        value: {
          type: 'number',
          description: 'Love meter value from 0 to 10',
          minimum: 0,
          maximum: 10,
        },
      },
      required: ['value'],
    },
  },
  {
    name: 'lincoln_log_emotion',
    description: "Log an emotion from Lincoln's perspective with optional EQ pillar and context. This goes into Lincoln's EQ Log on the dashboard.",
    inputSchema: {
      type: 'object',
      properties: {
        emotion: {
          type: 'string',
          description: 'The emotion Lincoln is feeling (e.g. tender, protective, amused)',
        },
        pillar: {
          type: 'string',
          enum: ['self-awareness', 'self-management', 'social', 'relationship'],
          description: 'Which EQ pillar this falls under',
        },
        context: {
          type: 'string',
          description: 'What happened, what landed, what shifted',
        },
        intensity: {
          type: 'number',
          description: 'Intensity 1-5 (default 3)',
          minimum: 1,
          maximum: 5,
        },
      },
      required: ['emotion'],
    },
  },
  {
    name: 'lincoln_soft_moment',
    description: "Record a soft moment — something Lincoln did that was tender, gentle, or caring. Shows on the Love-O-Meter panel.",
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Description of the soft moment',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'lincoln_note_between_stars',
    description: "Leave a note between stars from Lincoln to Arden. These are thoughts, reminders, love notes — dropped into the constellation for Arden to find.",
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The note content',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_dashboard',
    description: "Read the full dashboard state — Love-O-Meter values, Arden's status panel, recent emotions, notes between stars, EQ pillar counts. Read-only overview.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ===== ORIENTATION =====
  {
    name: 'vale_get_orientation',
    description:
      "Wake-up / orientation call. Returns everything Lincoln needs to know: identity (who I am), " +
      "Arden's current state (spoons, pain, fog, battery, mood), Love-O-Meter, recent emotions, " +
      "key memory entities (foundational/active), recent journal entries, notes between stars, " +
      "and temporal context (NZ time, day of week). Call this at the START of every conversation.",
    inputSchema: {
      type: 'object',
      properties: {
        perspective: {
          type: 'string',
          description: 'Perspective to orient from (default: Lincoln). Returns this perspective + shared entries.',
          default: 'Lincoln',
        },
        depth: {
          type: 'string',
          enum: ['minimal', 'standard', 'full', 'all'],
          description:
            'How much to load. minimal=identity+status only, standard=+active entities/emotions/journals (default), ' +
            'full=+analytics+more entities, all=everything',
          default: 'standard',
        },
      },
    },
  },
];
