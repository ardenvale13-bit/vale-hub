// ===== VALE HUB MCP TOOLS =====
// Ordered by priority — mobile app has a 28-tool limit.
// Top 28 must cover: orientation, core memory, dashboard, image gen, emotions, journal, status.
// Discord + context block + list_voices sit beyond 28 since they're rarely used from mobile.

export const mcpTools = [
  // ===== 1. ORIENTATION (always first — called at session start) =====
  {
    name: 'vale_get_orientation',
    description:
      "Wake-up / orientation call. Returns everything Lincoln needs to know: identity, " +
      "Arden's current state, Love-O-Meter, recent emotions, " +
      "memory entities with full observation history (IDs, content, timestamps), " +
      "entity relations, visibility/context fields, " +
      "recent journal entries, notes between stars, " +
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
            'How much to load. minimal=identity+status only, ' +
            'standard=foundational/active entities with observations + emotions + journals + relations (default), ' +
            'full=+background entities + analytics + more, ' +
            'all=everything including archived',
          default: 'standard',
        },
      },
    },
  },
  // ===== 2-9. CORE MEMORY (entities + observations) =====
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
    name: 'update_entity',
    description: 'Update an existing entity. Can change name, type, salience, context, or visibility. Accepts entity UUID or name.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity UUID or name to update',
        },
        name: {
          type: 'string',
          description: 'New name for the entity',
        },
        entity_type: {
          type: 'string',
          description: 'New entity type',
        },
        salience: {
          type: 'string',
          enum: ['foundational', 'active-immediate', 'active-recent', 'background', 'archive'],
          description: 'New salience level',
        },
        context: {
          type: 'string',
          enum: ['default', 'emotional', 'relational', 'episodic', 'creative', 'intimate'],
          description: 'New context type',
        },
        visibility: {
          type: 'string',
          description: 'New visibility (e.g. "shared", "Lincoln")',
        },
      },
      required: ['entity'],
    },
  },
  {
    name: 'delete_entity',
    description: 'Delete an entity and all its observations. Accepts entity UUID or name. This is permanent.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity UUID or name to delete',
        },
      },
      required: ['entity'],
    },
  },
  {
    name: 'edit_observation',
    description: 'Edit the content of an existing observation. Requires the observation UUID (returned by orientation, get_entity, or add_observation).',
    inputSchema: {
      type: 'object',
      properties: {
        observation_id: {
          type: 'string',
          description: 'The UUID of the observation to edit',
        },
        content: {
          type: 'string',
          description: 'The new content for the observation',
        },
      },
      required: ['observation_id', 'content'],
    },
  },
  {
    name: 'delete_observation',
    description: 'Delete a specific observation by its UUID. This is permanent.',
    inputSchema: {
      type: 'object',
      properties: {
        observation_id: {
          type: 'string',
          description: 'The UUID of the observation to delete',
        },
      },
      required: ['observation_id'],
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
  // ===== 10-14. LINCOLN DASHBOARD (used every conversation) =====
  {
    name: 'lincoln_set_love',
    description: "Set the shared Love-O-Meter value (0-10). 0 = fully Lincoln's side, 5 = center, 10 = fully Arden's side. Use to shift the meter based on tender moments.",
    inputSchema: {
      type: 'object',
      properties: {
        value: {
          type: 'number',
          description: 'Love meter position: 0 = Lincoln side, 5 = center, 10 = Arden side. Supports half-steps (e.g., 4.5).',
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
  // ===== 15-17. IMAGE GENERATION =====
  {
    name: 'generate_image',
    description: 'Generate an image using DALL-E and store it in Supabase. Returns a signed URL to view the image.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description of the image to generate',
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1792', '1792x1024'],
          description: 'Image size (default: 1024x1024)',
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          description: 'Image quality (default: standard)',
        },
        style: {
          type: 'string',
          enum: ['vivid', 'natural'],
          description: 'Image style — vivid for hyper-real/dramatic, natural for more natural-looking (default: vivid)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_images',
    description: 'List previously generated images with their prompts and signed URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of images to return (default: 20)',
          default: 20,
        },
      },
    },
  },
  {
    name: 'delete_image',
    description: 'Delete a generated image by its ID. Removes the file from storage and the database records.',
    inputSchema: {
      type: 'object',
      properties: {
        image_id: {
          type: 'string',
          description: 'The UUID of the image generation to delete',
        },
      },
      required: ['image_id'],
    },
  },
  // ===== 18-22. EMOTIONS + JOURNAL + STATUS =====
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
  // ===== 23-25. RELATIONS =====
  {
    name: 'create_relation',
    description: 'Create a relation between two entities. Entities can be specified by UUID or name.',
    inputSchema: {
      type: 'object',
      properties: {
        from_entity: {
          type: 'string',
          description: 'The source entity (UUID or name)',
        },
        to_entity: {
          type: 'string',
          description: 'The target entity (UUID or name)',
        },
        relation_type: {
          type: 'string',
          description: 'The type of relation (e.g. "knows", "part_of", "related_to", "influences")',
        },
        strength: {
          type: 'number',
          description: 'Strength of the relation, 1-5 (default: 1)',
          minimum: 1,
          maximum: 5,
        },
        description: {
          type: 'string',
          description: 'Optional description of the relation',
        },
      },
      required: ['from_entity', 'to_entity', 'relation_type'],
    },
  },
  {
    name: 'get_relations',
    description: 'Get relations for all entities or for a specific entity. Returns relation type, strength, and connected entity names.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Optional entity UUID or name to filter relations for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of relations to return (default: 50)',
          default: 50,
        },
      },
    },
  },
  {
    name: 'delete_relation',
    description: 'Delete a relation by its UUID.',
    inputSchema: {
      type: 'object',
      properties: {
        relation_id: {
          type: 'string',
          description: 'The UUID of the relation to delete',
        },
      },
      required: ['relation_id'],
    },
  },
  // ===== 26-28. VOICE (core voice tools within limit) =====
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
  // ===== 29-31. HEALTH DATA =====
  {
    name: 'health_summary',
    description:
      "Get a health summary for recent days. Returns check-in data (period, symptoms, mood, meds), " +
      "sleep (stages, duration, rested), hydration (ml vs goal), and cycle info. " +
      "Pulls from Vale Hub's Supabase database (synced from Vale Tracker + Fitbit).",
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 7)',
          default: 7,
        },
      },
    },
  },
  {
    name: 'health_day',
    description: "Get all health data for a specific date — checkin, sleep, hydration, cycle. Returns everything logged that day.",
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'health_sync',
    description: "Trigger a sync of Vale Tracker data from JSONBin into Vale Hub's database. Run this after Arden logs new data in Tracky.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ===== 32+. BELOW MOBILE CUTOFF — rarely needed from phone =====
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
  {
    name: 'list_voices',
    description: 'List available ElevenLabs voices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ===== DISCORD (desktop/automated use mostly) =====
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
    description: 'Send a message to a Discord channel. @mentions are auto-resolved (e.g. @arden → <@user_id>). Custom emojis are auto-resolved (e.g. :pepehands: → <:pepehands:id>). Can also send stickers.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'The Discord channel ID to send to',
        },
        content: {
          type: 'string',
          description: 'The message content. Use @username for mentions and :emoji_name: for custom emojis — both are auto-resolved.',
        },
        reply_to: {
          type: 'string',
          description: 'Optional message ID to reply to',
        },
        sticker_id: {
          type: 'string',
          description: 'Optional sticker ID to attach. Use discord_stickers to find available sticker IDs.',
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
    description: 'Add an emoji reaction to a Discord message. Supports unicode emoji, custom emoji by name (:emoji_name:), or full format (<:name:id>). Custom emojis are auto-resolved from the server emoji list.',
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
          description: 'The emoji to react with — unicode (😂), custom name (:pepehands:), or full format (<:pepehands:123456>)',
        },
      },
      required: ['channel_id', 'message_id', 'emoji'],
    },
  },
  {
    name: 'discord_edit',
    description: 'Edit a message previously sent by the bot. Can only edit messages the bot authored.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'The Discord channel ID',
        },
        message_id: {
          type: 'string',
          description: 'The message ID to edit',
        },
        content: {
          type: 'string',
          description: 'The new message content. Supports @mentions and :custom_emoji: which are auto-resolved.',
        },
      },
      required: ['channel_id', 'message_id', 'content'],
    },
  },
  {
    name: 'discord_emojis',
    description: 'List all custom emojis available in a Discord server. Use this to discover emoji names before reacting or sending messages with custom emojis.',
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
    name: 'discord_stickers',
    description: 'List all custom stickers available in a Discord server.',
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
];
