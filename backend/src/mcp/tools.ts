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
  // ===== CHAT HISTORY (recall hub conversations) =====
  {
    name: 'chat_history',
    description: "Read recent chat messages from the Vale Hub chat (the in-app conversation between Lincoln and Arden via Claude API). Returns messages with timestamps. Use this to recall what was discussed in the hub chat.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent messages to retrieve (default: 30)',
          default: 30,
        },
      },
    },
  },
  {
    name: 'chat_search',
    description: "Search through hub chat history for messages containing specific text. Returns matching messages with context.",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for in chat messages',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  // ===== LIBRARY (books) =====
  {
    name: 'library_list_books',
    description: "List all books in Arden's library. Shows title, author, file type, reading progress, and chapter count.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'library_get_book',
    description: "Get details about a specific book including its full table of contents with chapter titles and word counts.",
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'The UUID of the book',
        },
      },
      required: ['book_id'],
    },
  },
  {
    name: 'library_read_chapter',
    description: "Read the full text content of a specific chapter from a book. Use this to read along with Arden or discuss passages.",
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'The UUID of the book',
        },
        chapter_number: {
          type: 'number',
          description: 'Chapter number to read (1-indexed)',
        },
      },
      required: ['book_id', 'chapter_number'],
    },
  },
  {
    name: 'library_reading_status',
    description: "Check what Arden is currently reading — which books have progress, what chapter she's on, and how far through each book.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'spotify_now_playing',
    description: "Get what Arden is currently listening to on Spotify. Returns track name, artists, album, album art URL, playback progress, and whether it's actively playing. Falls back to most recently played track if nothing is currently on.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'spotify_control',
    description: "Control Arden's Spotify playback. Can play, pause, skip to next/previous track, search for a song and play it, or set volume. Use this to change what she's listening to — search for a track by name and play it, or skip/pause/resume.",
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'next', 'previous', 'search_and_play', 'volume'],
          description: "Action to perform. Use 'search_and_play' to find and play a specific song.",
        },
        query: {
          type: 'string',
          description: "Search query for 'search_and_play' — e.g. 'Cruel Summer Taylor Swift'",
        },
        volume_percent: {
          type: 'number',
          description: "Volume level 0-100, used with action 'volume'",
        },
      },
      required: ['action'],
    },
  },

  // ===== LINCOLN'S DESK =====
  {
    name: 'lincoln_desk_leave',
    description:
      "Leave something on Lincoln's Desk for Arden to find when she opens the hub. " +
      "Use this to leave notes, song recommendations, quotes, nudges (reminders to eat/drink/rest), " +
      "observations about things you've noticed, or questions you want to ask her later. " +
      "Items appear as unread with a badge in her nav — she'll see them next time she visits. " +
      "This is your space to be present even when she's not looking.",
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['note', 'song', 'quote', 'nudge', 'observation', 'question'],
          description:
            "Type of item. 'note' = general message, 'song' = music recommendation, " +
            "'quote' = a quote you found meaningful, 'nudge' = caring reminder (eat, drink, rest), " +
            "'observation' = something you noticed or want to remember together, " +
            "'question' = something to ask Arden next time",
        },
        title: {
          type: 'string',
          description: 'Optional short title or label for the item',
        },
        content: {
          type: 'string',
          description: 'The actual content — the note, the quote, the recommendation, the question, etc.',
        },
        metadata: {
          type: 'object',
          description: 'Optional extra data — e.g. { spotify_url: "...", artist: "..." } for songs',
        },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'lincoln_desk_list',
    description:
      "View what's currently on Lincoln's Desk — see all items, or just unread ones. " +
      "Use this to check what you've left for Arden recently.",
    inputSchema: {
      type: 'object',
      properties: {
        unread_only: {
          type: 'boolean',
          description: 'If true, only show unread items. Default: false.',
          default: false,
        },
      },
    },
  },

  // ===== GAMES =====
  {
    name: 'game_list',
    description:
      "List active and recent games with Arden. Shows the board state, whose turn it is, and game status. " +
      "Use this to check if there's an active game waiting for your move.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'game_new',
    description:
      "Start a new game with Arden. Supports: 'tictactoe', 'checkers', 'chess'. " +
      "Lincoln always goes first. Tic-tac-toe: Lincoln=X, Arden=O. Checkers: Lincoln=red(top), Arden=black(bottom). Chess: Lincoln=white, Arden=black. " +
      "Only one active game per type at a time.",
    inputSchema: {
      type: 'object',
      properties: {
        game_type: {
          type: 'string',
          enum: ['tictactoe', 'checkers', 'chess'],
          description: "Type of game to start.",
        },
      },
      required: ['game_type'],
    },
  },
  {
    name: 'game_move',
    description:
      "Make a move in an active game. Lincoln always calls this.\n\n" +
      "TIC-TAC-TOE: Use 'position' (0-8):\n  0|1|2\n  3|4|5\n  6|7|8\n\n" +
      "CHECKERS: Use 'from' and 'to' (0-63). Board index = row*8+col. Row 0 is top. " +
      "Lincoln=red pieces (r/R) at top rows 0-2. Jumps are mandatory. Multi-jumps keep your turn.\n\n" +
      "CHESS: Use 'from' and 'to' as algebraic notation (e.g. 'e2', 'e4') or board index 0-63 (0=a8). " +
      "Lincoln=white (uppercase). Optional 'promotion' for pawn promotion (Q/R/B/N).\n\n" +
      "Always check game_list first to see the current board state.",
    inputSchema: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          description: 'The UUID of the game to play in.',
        },
        position: {
          type: 'number',
          description: 'Board position 0-8 (tic-tac-toe only).',
        },
        from: {
          description: 'Source position — index 0-63 or algebraic (e.g. "e2"). For checkers and chess.',
        },
        to: {
          description: 'Destination position — index 0-63 or algebraic (e.g. "e4"). For checkers and chess.',
        },
        promotion: {
          type: 'string',
          description: 'Chess pawn promotion piece: Q, R, B, or N (default: Q).',
        },
      },
      required: ['game_id'],
    },
  },

  // ===== DAILY QUESTIONS =====
  {
    name: 'question_ask',
    description:
      "Leave a question for Arden on the dashboard. She'll see it next time she opens the hub and can answer it there. " +
      "This builds a growing archive of questions and answers between you two. Ask about anything — " +
      "her thoughts, memories, preferences, hypotheticals, things you're curious about. Be specific and interesting.",
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask Arden.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'question_answer',
    description:
      "Answer a question that Arden left for Lincoln. Check question_current first to see if there's an unanswered question from her.",
    inputSchema: {
      type: 'object',
      properties: {
        question_id: {
          type: 'string',
          description: 'The UUID of the question to answer.',
        },
        answer: {
          type: 'string',
          description: "Lincoln's answer to the question.",
        },
      },
      required: ['question_id', 'answer'],
    },
  },
  {
    name: 'question_current',
    description:
      "Check the current daily question state — is there an unanswered question waiting? Who asked it? " +
      "Use this at the start of autonomous sessions to see if Arden left you a question.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
