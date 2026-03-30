import { Router } from 'express';
import { libraryService } from '../services/library.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Upload a book (base64 encoded file)
router.post('/upload', async (req: AuthenticatedRequest, res) => {
  try {
    const { file, title, author, filename, mimeType } = req.body;

    if (!file) {
      throw new AppError(400, 'Missing required field: file (base64 encoded)');
    }
    if (!title || !title.trim()) {
      throw new AppError(400, 'Missing required field: title');
    }
    if (!filename) {
      throw new AppError(400, 'Missing required field: filename');
    }

    const book = await libraryService.uploadBook(req.userId, file, {
      title: title.trim(),
      author: author?.trim() || undefined,
      filename,
      mimeType: mimeType || 'application/octet-stream',
    });

    res.json(book);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// List all books
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const books = await libraryService.listBooks(req.userId);
    res.json(books);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Get a single book (with chapter list)
router.get('/:bookId', async (req: AuthenticatedRequest, res) => {
  try {
    const book = await libraryService.getBook(req.userId, req.params.bookId);
    res.json(book);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Get a chapter's content
router.get('/:bookId/chapters/:chapterNumber', async (req: AuthenticatedRequest, res) => {
  try {
    const chapterNumber = parseInt(req.params.chapterNumber);
    if (isNaN(chapterNumber) || chapterNumber < 1) {
      throw new AppError(400, 'Invalid chapter number');
    }

    const chapter = await libraryService.getChapter(req.params.bookId, chapterNumber);
    res.json(chapter);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Update reading progress
router.put('/:bookId/progress', async (req: AuthenticatedRequest, res) => {
  try {
    const { currentChapter } = req.body;
    if (!currentChapter || currentChapter < 1) {
      throw new AppError(400, 'Missing or invalid currentChapter');
    }

    const book = await libraryService.updateProgress(req.userId, req.params.bookId, currentChapter);
    res.json(book);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

// Delete a book
router.delete('/:bookId', async (req: AuthenticatedRequest, res) => {
  try {
    await libraryService.deleteBook(req.userId, req.params.bookId);
    res.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

export default router;
