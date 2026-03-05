import OpenAI from 'openai';
import { getSupabaseClient } from '../config/supabase.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const supabase = getSupabaseClient();

export interface GeneratedImage {
  id: string;
  prompt: string;
  model: string;
  url: string;
  media_id?: string;
  settings: Record<string, any>;
  created_at: string;
}

export interface ImageListItem {
  id: string;
  prompt: string;
  model: string;
  settings: Record<string, any>;
  created_at: string;
  media?: {
    id: string;
    file_path: string;
    file_name: string;
    file_size_bytes?: number;
  };
  url?: string;
}

export class ImageService {
  private getClient(): OpenAI {
    const env = getEnv();
    if (!env.OPENAI_API_KEY) {
      throw new AppError(503, 'OpenAI API key not configured. Set OPENAI_API_KEY in environment.');
    }
    return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Generate an image with DALL-E and store it in Supabase Storage.
   */
  async generateImage(
    userId: string,
    prompt: string,
    options: {
      model?: string;
      size?: string;
      quality?: string;
      style?: string;
    } = {},
  ): Promise<GeneratedImage> {
    try {
      if (!prompt || !prompt.trim()) {
        throw new AppError(400, 'Image prompt cannot be empty');
      }

      const openai = this.getClient();
      const model = options.model || 'dall-e-3';
      const size = (options.size || '1024x1024') as '1024x1024' | '1024x1792' | '1792x1024';
      const quality = (options.quality || 'standard') as 'standard' | 'hd';
      const style = (options.style || 'vivid') as 'vivid' | 'natural';

      // Generate with OpenAI
      const response = await openai.images.generate({
        model,
        prompt: prompt.trim(),
        n: 1,
        size,
        quality,
        style,
        response_format: 'url',
      });

      const imageUrl = response.data[0]?.url;
      const revisedPrompt = response.data[0]?.revised_prompt;

      if (!imageUrl) {
        throw new AppError(500, 'OpenAI returned no image URL');
      }

      // Download the image and upload to Supabase Storage
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new AppError(500, 'Failed to download generated image from OpenAI');
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const timestamp = Date.now();
      const fileName = `gen_${timestamp}.png`;
      const filePath = `images/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, imageBuffer, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) {
        // If storage bucket doesn't exist or upload fails, still return the temp URL
        console.error('Storage upload failed:', uploadError.message);
      }

      // Create media record
      let mediaId: string | undefined;
      if (!uploadError) {
        const { data: mediaRecord, error: mediaError } = await supabase
          .from('media')
          .insert({
            user_id: userId,
            media_type: 'image',
            file_path: filePath,
            file_name: fileName,
            file_size_bytes: imageBuffer.length,
            mime_type: 'image/png',
            source: 'generated',
            source_data: { model, prompt: prompt.trim(), revised_prompt: revisedPrompt },
            description: prompt.trim().slice(0, 200),
          })
          .select('id')
          .single();

        if (!mediaError && mediaRecord) {
          mediaId = mediaRecord.id;
        }
      }

      // Record in image_generations table
      const settings = { size, quality, style, revised_prompt: revisedPrompt };
      const { data: genRecord, error: genError } = await supabase
        .from('image_generations')
        .insert({
          user_id: userId,
          prompt: prompt.trim(),
          media_id: mediaId || null,
          model,
          settings,
        })
        .select('*')
        .single();

      if (genError) {
        console.error('Failed to record generation:', genError.message);
      }

      // Get a signed URL for the stored image, or fall back to the temp OpenAI URL
      let serveUrl = imageUrl;
      if (!uploadError) {
        const { data: signedData } = await supabase.storage
          .from('media')
          .createSignedUrl(filePath, 3600); // 1 hour

        if (signedData?.signedUrl) {
          serveUrl = signedData.signedUrl;
        }
      }

      return {
        id: genRecord?.id || 'temp-' + timestamp,
        prompt: prompt.trim(),
        model,
        url: serveUrl,
        media_id: mediaId,
        settings,
        created_at: genRecord?.created_at || new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new AppError(500, `Image generation failed: ${msg}`);
    }
  }

  /**
   * List previous image generations.
   */
  async listImages(
    userId: string,
    limit = 20,
  ): Promise<ImageListItem[]> {
    try {
      const { data: generations, error: genError } = await supabase
        .from('image_generations')
        .select('id, prompt, model, settings, media_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (genError) throw genError;
      if (!generations || generations.length === 0) return [];

      // Get media records for those with media_id
      const mediaIds = generations.filter((g: any) => g.media_id).map((g: any) => g.media_id);

      let mediaMap: Record<string, any> = {};
      if (mediaIds.length > 0) {
        const { data: mediaRecords } = await supabase
          .from('media')
          .select('id, file_path, file_name, file_size_bytes')
          .in('id', mediaIds);

        for (const m of mediaRecords || []) {
          mediaMap[m.id] = m;
        }
      }

      // Build signed URLs for each image
      const results: ImageListItem[] = [];
      for (const gen of generations) {
        const media = gen.media_id ? mediaMap[gen.media_id] : null;
        let url: string | undefined;

        if (media?.file_path) {
          const { data: signedData } = await supabase.storage
            .from('media')
            .createSignedUrl(media.file_path, 3600);
          url = signedData?.signedUrl;
        }

        results.push({
          id: gen.id,
          prompt: gen.prompt,
          model: gen.model,
          settings: gen.settings,
          created_at: gen.created_at,
          media: media ? {
            id: media.id,
            file_path: media.file_path,
            file_name: media.file_name,
            file_size_bytes: media.file_size_bytes,
          } : undefined,
          url,
        });
      }

      return results;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new AppError(500, `Failed to list images: ${msg}`);
    }
  }

  /**
   * Get a single image generation with fresh signed URL.
   */
  async getImage(
    userId: string,
    imageId: string,
  ): Promise<ImageListItem> {
    try {
      const { data: gen, error: genError } = await supabase
        .from('image_generations')
        .select('*')
        .eq('user_id', userId)
        .eq('id', imageId)
        .single();

      if (genError || !gen) {
        throw new AppError(404, `Image not found: ${imageId}`);
      }

      let media: any;
      let url: string | undefined;

      if (gen.media_id) {
        const { data: mediaRecord } = await supabase
          .from('media')
          .select('id, file_path, file_name, file_size_bytes')
          .eq('id', gen.media_id)
          .single();

        if (mediaRecord?.file_path) {
          media = mediaRecord;
          const { data: signedData } = await supabase.storage
            .from('media')
            .createSignedUrl(mediaRecord.file_path, 3600);
          url = signedData?.signedUrl;
        }
      }

      return {
        id: gen.id,
        prompt: gen.prompt,
        model: gen.model,
        settings: gen.settings,
        created_at: gen.created_at,
        media,
        url,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new AppError(500, `Failed to get image: ${msg}`);
    }
  }

  /**
   * Delete an image generation and its stored file.
   */
  async deleteImage(
    userId: string,
    imageId: string,
  ): Promise<void> {
    try {
      // Get the generation record
      const { data: gen } = await supabase
        .from('image_generations')
        .select('media_id')
        .eq('user_id', userId)
        .eq('id', imageId)
        .single();

      if (gen?.media_id) {
        // Get file path for storage deletion
        const { data: media } = await supabase
          .from('media')
          .select('file_path')
          .eq('id', gen.media_id)
          .single();

        if (media?.file_path) {
          await supabase.storage.from('media').remove([media.file_path]);
        }

        // Delete media record
        await supabase.from('media').delete().eq('id', gen.media_id);
      }

      // Delete generation record
      await supabase.from('image_generations').delete().eq('id', imageId).eq('user_id', userId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new AppError(500, `Failed to delete image: ${msg}`);
    }
  }
}

export const imageService = new ImageService();
