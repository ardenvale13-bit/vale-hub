import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

class VoiceService {
  private supabase = getSupabaseClient();

  /**
   * Generate speech from text using ElevenLabs API, store audio in Supabase Storage,
   * and log metadata in voice_notes + media tables.
   */
  async generateVoiceNote(
    userId: string,
    text: string,
    options: {
      voiceId?: string;
      perspective?: string;
      context?: string;
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
    } = {},
  ) {
    const env = getEnv();

    if (!env.ELEVENLABS_API_KEY) {
      throw new AppError(400, 'ELEVENLABS_API_KEY is not configured');
    }

    const voiceId = options.voiceId || env.ELEVENLABS_DEFAULT_VOICE_ID;
    if (!voiceId) {
      throw new AppError(400, 'No voice ID provided and no default voice configured');
    }

    const modelId = options.modelId || 'eleven_multilingual_v2';

    // Call ElevenLabs TTS API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
            style: options.style ?? 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new AppError(
        response.status,
        `ElevenLabs API error: ${response.statusText} — ${errBody}`,
      );
    }

    // Get audio as buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const timestamp = Date.now();
    const fileName = `voice_${timestamp}.mp3`;
    const storagePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('voice-notes')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new AppError(500, `Failed to upload voice note: ${uploadError.message}`);
    }

    // Create media record
    const { data: mediaRecord, error: mediaError } = await this.supabase
      .from('media')
      .insert({
        user_id: userId,
        media_type: 'voice',
        file_path: storagePath,
        file_name: fileName,
        file_size_bytes: audioBuffer.length,
        mime_type: 'audio/mpeg',
        source: 'elevenlabs',
        source_data: { voice_id: voiceId, model_id: modelId },
        description: text.substring(0, 200),
      })
      .select('*')
      .single();

    if (mediaError) {
      throw new AppError(500, `Failed to create media record: ${mediaError.message}`);
    }

    // Create voice_notes record
    const { data: voiceNote, error: vnError } = await this.supabase
      .from('voice_notes')
      .insert({
        user_id: userId,
        text_content: text,
        voice_id: voiceId,
        media_id: mediaRecord.id,
        speaker_perspective: options.perspective || 'default',
        context: options.context || null,
        duration_ms: null, // ElevenLabs doesn't return duration in the TTS response
      })
      .select('*')
      .single();

    if (vnError) {
      throw new AppError(500, `Failed to create voice note record: ${vnError.message}`);
    }

    // Get a signed URL for playback (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await this.supabase.storage
      .from('voice-notes')
      .createSignedUrl(storagePath, 3600);

    return {
      ...voiceNote,
      media: mediaRecord,
      playback_url: signedUrlData?.signedUrl || null,
    };
  }

  /**
   * List voice notes for a user
   */
  async listVoiceNotes(
    userId: string,
    options: { limit?: number; offset?: number; perspective?: string } = {},
  ) {
    let query = this.supabase
      .from('voice_notes')
      .select('*, media(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    if (options.perspective) {
      query = query.eq('speaker_perspective', options.perspective);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to list voice notes: ${error.message}`);
    return data;
  }

  /**
   * Get a single voice note with a fresh signed URL for playback
   */
  async getVoiceNote(userId: string, voiceNoteId: string) {
    const { data, error } = await this.supabase
      .from('voice_notes')
      .select('*, media(*)')
      .eq('id', voiceNoteId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError(404, 'Voice note not found');
    }

    // Generate fresh signed URL
    if (data.media?.file_path) {
      const { data: signedUrlData } = await this.supabase.storage
        .from('voice-notes')
        .createSignedUrl(data.media.file_path, 3600);

      return { ...data, playback_url: signedUrlData?.signedUrl || null };
    }

    return { ...data, playback_url: null };
  }

  /**
   * Delete a voice note and its associated media/storage
   */
  async deleteVoiceNote(userId: string, voiceNoteId: string) {
    // Get the voice note first to find storage path
    const { data: voiceNote, error: fetchError } = await this.supabase
      .from('voice_notes')
      .select('*, media(*)')
      .eq('id', voiceNoteId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !voiceNote) {
      throw new AppError(404, 'Voice note not found');
    }

    // Delete from storage
    if (voiceNote.media?.file_path) {
      await this.supabase.storage.from('voice-notes').remove([voiceNote.media.file_path]);
    }

    // Delete media record
    if (voiceNote.media_id) {
      await this.supabase.from('media').delete().eq('id', voiceNote.media_id);
    }

    // Delete voice note record
    await this.supabase.from('voice_notes').delete().eq('id', voiceNoteId);

    return { deleted: true, id: voiceNoteId };
  }

  /**
   * List available ElevenLabs voices
   */
  async listVoices() {
    const env = getEnv();
    if (!env.ELEVENLABS_API_KEY) {
      throw new AppError(400, 'ELEVENLABS_API_KEY is not configured');
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    });

    if (!response.ok) {
      throw new AppError(response.status, `Failed to fetch voices: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices?.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels,
      preview_url: v.preview_url,
    })) || [];
  }
}

export const voiceService = new VoiceService();
