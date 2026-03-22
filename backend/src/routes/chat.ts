import { Router } from 'express';
import { chatService } from '../services/chat.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Send a text message to Lincoln, get text response
// Optionally include an image: { data: base64string, mediaType: 'image/jpeg' }
router.post('/send', async (req: AuthenticatedRequest, res) => {
  try {
    const { message, generateVoice, voiceId, image } = req.body;

    if ((!message || !message.trim()) && !image) {
      throw new AppError(400, 'Missing required field: message or image');
    }

    // Validate image if provided
    let parsedImage: { data: string; mediaType: string } | undefined;
    if (image) {
      const { data, mediaType } = image;
      if (!data || !mediaType) throw new AppError(400, 'image must have data and mediaType');
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowed.includes(mediaType)) throw new AppError(400, `Unsupported image type: ${mediaType}`);
      // Strip data URI prefix if present
      const cleanData = data.replace(/^data:image\/[^;]+;base64,/, '');
      parsedImage = { data: cleanData, mediaType };
    }

    const result = await chatService.sendMessage(req.userId, (message || '').trim(), {
      generateVoice: generateVoice || false,
      voiceId,
      image: parsedImage,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Send a voice message — base64 audio → transcribe → Lincoln responds with voice
router.post('/voice', async (req: AuthenticatedRequest, res) => {
  try {
    const { audio, mimeType, voiceId } = req.body;

    if (!audio) {
      throw new AppError(400, 'Missing required field: audio (base64 encoded)');
    }

    // Decode base64 audio — handle data URIs with codecs like "data:audio/webm;codecs=opus;base64,"
    const audioClean = audio.replace(/^data:audio\/[^;]+;(codecs=[^;]+;)?base64,/, '');
    const audioBuffer = Buffer.from(audioClean, 'base64');
    console.log('[Chat/voice] Audio buffer size:', audioBuffer.length, 'bytes, mimeType:', mimeType);

    // Transcribe with Whisper
    const transcription = await chatService.transcribeAudio(audioBuffer, mimeType || 'audio/webm');

    if (!transcription.trim()) {
      return res.json({
        transcription: '',
        message: null,
        voice_url: null,
        error: 'Could not transcribe audio — try speaking more clearly',
      });
    }

    // Send transcribed text to Lincoln, get voice response
    const result = await chatService.sendMessage(req.userId, transcription, {
      generateVoice: true,
      voiceId,
    });

    res.json({
      transcription,
      message: result.message,
      voice_url: result.voice_url,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Get chat history
router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string | undefined;

    const messages = await chatService.getHistory(req.userId, limit, before);
    res.json(messages);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Clear chat history
router.delete('/history', async (req: AuthenticatedRequest, res) => {
  try {
    await chatService.clearHistory(req.userId);
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

export default router;
