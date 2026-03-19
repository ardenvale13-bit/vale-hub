import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const supabase = getSupabaseClient();

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  file_type: 'pdf' | 'epub' | 'txt';
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  cover_color?: string;
  total_chapters: number;
  current_chapter: number;
  reading_progress: number; // 0-100
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BookChapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  created_at: string;
}

// Soft pastel cover colors for books without covers
const COVER_COLORS = [
  '#4A6FA5', '#6B5B95', '#88B04B', '#955251', '#B565A7',
  '#009B77', '#DD4124', '#D65076', '#45B8AC', '#EFC050',
  '#5B5EA6', '#9B2335', '#BC70A4', '#BFD641', '#2A4B7C',
];

class LibraryService {
  /**
   * Upload a book file (base64) to Supabase Storage and create records.
   * Extracts chapters on upload for fast reading later.
   */
  async uploadBook(
    userId: string,
    base64Data: string,
    options: {
      title: string;
      author?: string;
      filename: string;
      mimeType: string;
    },
  ): Promise<Book> {
    try {
      // Determine file type
      const fileType = this.getFileType(options.filename, options.mimeType);

      // Strip data URI prefix if present
      const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Clean, 'base64');

      const timestamp = Date.now();
      const safeFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `books/${userId}/${timestamp}_${safeFilename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, fileBuffer, {
          contentType: options.mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new AppError(500, `Storage upload failed: ${uploadError.message}`);
      }

      // Pick a cover color
      const coverColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];

      // Extract text content from the file
      const textContent = await this.extractText(fileBuffer, fileType, options.mimeType);

      // Split into chapters
      const chapters = this.splitIntoChapters(textContent, fileType);

      // Create book record
      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: options.title,
          author: options.author || null,
          file_type: fileType,
          file_path: filePath,
          file_name: options.filename,
          file_size_bytes: fileBuffer.length,
          cover_color: coverColor,
          total_chapters: chapters.length,
          current_chapter: 1,
          reading_progress: 0,
          metadata: {
            total_words: chapters.reduce((sum, c) => sum + c.wordCount, 0),
          },
        })
        .select('*')
        .single();

      if (bookError) {
        // Clean up storage on failure
        await supabase.storage.from('media').remove([filePath]);
        throw new AppError(500, `Failed to create book record: ${bookError.message}`);
      }

      // Insert chapters
      if (chapters.length > 0) {
        const chapterRows = chapters.map((ch, idx) => ({
          book_id: book.id,
          chapter_number: idx + 1,
          title: ch.title,
          content: ch.content,
          word_count: ch.wordCount,
        }));

        // Insert in batches of 50 to avoid payload limits
        for (let i = 0; i < chapterRows.length; i += 50) {
          const batch = chapterRows.slice(i, i + 50);
          const { error: chapError } = await supabase
            .from('book_chapters')
            .insert(batch);

          if (chapError) {
            console.error('Failed to insert chapters batch:', chapError.message);
          }
        }
      }

      console.log(`[Library] Uploaded "${options.title}" — ${chapters.length} chapters, ${fileBuffer.length} bytes`);

      return book;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new AppError(500, `Book upload failed: ${msg}`);
    }
  }

  /**
   * List all books for a user
   */
  async listBooks(userId: string): Promise<Book[]> {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new AppError(500, `Failed to list books: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single book with chapter list (titles only, not content)
   */
  async getBook(userId: string, bookId: string): Promise<Book & { chapters: { chapter_number: number; title: string; word_count: number }[] }> {
    const { data: book, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .eq('id', bookId)
      .single();

    if (error || !book) {
      throw new AppError(404, `Book not found: ${bookId}`);
    }

    const { data: chapters } = await supabase
      .from('book_chapters')
      .select('chapter_number, title, word_count')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true });

    return { ...book, chapters: chapters || [] };
  }

  /**
   * Get a specific chapter's content
   */
  async getChapter(bookId: string, chapterNumber: number): Promise<BookChapter> {
    const { data, error } = await supabase
      .from('book_chapters')
      .select('*')
      .eq('book_id', bookId)
      .eq('chapter_number', chapterNumber)
      .single();

    if (error || !data) {
      throw new AppError(404, `Chapter ${chapterNumber} not found in book ${bookId}`);
    }

    return data;
  }

  /**
   * Update reading progress
   */
  async updateProgress(
    userId: string,
    bookId: string,
    currentChapter: number,
  ): Promise<Book> {
    // Get total chapters to calculate percentage
    const { data: book } = await supabase
      .from('books')
      .select('total_chapters')
      .eq('id', bookId)
      .eq('user_id', userId)
      .single();

    if (!book) {
      throw new AppError(404, `Book not found: ${bookId}`);
    }

    const progress = Math.round((currentChapter / book.total_chapters) * 100);

    const { data, error } = await supabase
      .from('books')
      .update({
        current_chapter: currentChapter,
        reading_progress: Math.min(progress, 100),
      })
      .eq('id', bookId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new AppError(500, `Failed to update progress: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a book and all its chapters + storage file
   */
  async deleteBook(userId: string, bookId: string): Promise<void> {
    const { data: book } = await supabase
      .from('books')
      .select('file_path')
      .eq('id', bookId)
      .eq('user_id', userId)
      .single();

    if (book?.file_path) {
      await supabase.storage.from('media').remove([book.file_path]);
    }

    // Chapters cascade-delete via FK
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(500, `Failed to delete book: ${error.message}`);
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private getFileType(filename: string, mimeType: string): 'pdf' | 'epub' | 'txt' {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
    if (ext === 'epub' || mimeType === 'application/epub+zip') return 'epub';
    return 'txt';
  }

  /**
   * Extract plain text from file buffer.
   * For PDF: basic text extraction (no external dependency needed for most PDFs)
   * For EPUB: extract from HTML content files
   * For TXT: direct decode
   */
  private async extractText(buffer: Buffer, fileType: string, _mimeType: string): Promise<string> {
    switch (fileType) {
      case 'txt':
        return buffer.toString('utf-8');

      case 'pdf':
        return this.extractPdfText(buffer);

      case 'epub':
        return this.extractEpubText(buffer);

      default:
        return buffer.toString('utf-8');
    }
  }

  /**
   * Basic PDF text extraction — parses the PDF structure to find text streams.
   * Works for most text-based PDFs. For scanned PDFs, content may be limited.
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      // Use a simple approach: find all text between BT/ET markers in the PDF
      // This works for most modern PDFs without needing pdf-parse
      const pdfString = buffer.toString('latin1');
      const textChunks: string[] = [];

      // Method 1: Extract text from stream objects
      const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
      let match;

      while ((match = streamRegex.exec(pdfString)) !== null) {
        const streamContent = match[1];

        // Look for text showing operators: Tj, TJ, ', "
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
          const text = this.decodePdfString(tjMatch[1]);
          if (text.trim()) textChunks.push(text);
        }

        // TJ array operator — contains text segments
        const tjArrayRegex = /\[((?:\([^)]*\)|[^])*?)\]\s*TJ/g;
        let tjArrMatch;
        while ((tjArrMatch = tjArrayRegex.exec(streamContent)) !== null) {
          const innerRegex = /\(([^)]*)\)/g;
          let innerMatch;
          const parts: string[] = [];
          while ((innerMatch = innerRegex.exec(tjArrMatch[1])) !== null) {
            parts.push(this.decodePdfString(innerMatch[1]));
          }
          if (parts.length > 0) textChunks.push(parts.join(''));
        }
      }

      // If we got meaningful text, return it
      const fullText = textChunks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (fullText.length > 100) {
        return fullText;
      }

      // Fallback: try to find any readable text content
      const readableRegex = /\(([A-Za-z][A-Za-z0-9 .,!?;:'"()-]{5,})\)/g;
      const fallbackChunks: string[] = [];
      let fbMatch;
      while ((fbMatch = readableRegex.exec(pdfString)) !== null) {
        fallbackChunks.push(fbMatch[1]);
      }

      return fallbackChunks.join('\n').trim() || '[PDF text extraction limited — this PDF may be image-based or encrypted]';
    } catch (err) {
      console.error('[Library] PDF extraction error:', err);
      return '[Could not extract text from this PDF]';
    }
  }

  private decodePdfString(str: string): string {
    // Handle basic PDF escape sequences
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Basic EPUB text extraction — EPUBs are ZIP files containing XHTML.
   * We extract text from the HTML content files.
   */
  private async extractEpubText(buffer: Buffer): Promise<string> {
    try {
      // EPUB is a ZIP file. We need to find and extract XHTML content.
      // Basic ZIP parsing — find local file headers and extract content files
      const textParts: string[] = [];
      let offset = 0;

      while (offset < buffer.length - 4) {
        // Local file header signature: PK\x03\x04
        if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4B &&
            buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {

          const compMethod = buffer.readUInt16LE(offset + 8);
          const compSize = buffer.readUInt32LE(offset + 18);
          const uncompSize = buffer.readUInt32LE(offset + 22);
          const nameLen = buffer.readUInt16LE(offset + 26);
          const extraLen = buffer.readUInt16LE(offset + 28);

          const fileName = buffer.toString('utf-8', offset + 30, offset + 30 + nameLen);
          const dataStart = offset + 30 + nameLen + extraLen;

          // Only process uncompressed XHTML/HTML/XML content files
          if (compMethod === 0 && uncompSize > 0 &&
              (fileName.endsWith('.xhtml') || fileName.endsWith('.html') || fileName.endsWith('.htm')) &&
              !fileName.includes('toc') && !fileName.includes('nav')) {

            const content = buffer.toString('utf-8', dataStart, dataStart + uncompSize);
            // Strip HTML tags to get plain text
            const text = content
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();

            if (text.length > 50) {
              textParts.push(text);
            }
          }

          offset = dataStart + compSize;
        } else {
          offset++;
        }
      }

      return textParts.join('\n\n') || '[Could not extract text from this EPUB — it may use compressed content]';
    } catch (err) {
      console.error('[Library] EPUB extraction error:', err);
      return '[Could not extract text from this EPUB]';
    }
  }

  /**
   * Split extracted text into chapters.
   * Uses common chapter heading patterns, or falls back to splitting by size.
   */
  private splitIntoChapters(text: string, _fileType: string): { title: string; content: string; wordCount: number }[] {
    if (!text || text.startsWith('[')) {
      // Extraction failed — return single chapter
      return [{
        title: 'Full Text',
        content: text || 'No text content available.',
        wordCount: text ? text.split(/\s+/).length : 0,
      }];
    }

    // Try to split by common chapter patterns
    const chapterPatterns = [
      /(?:^|\n)\s*(Chapter\s+\d+[^\n]*)/gi,
      /(?:^|\n)\s*(CHAPTER\s+[IVXLCDM]+[^\n]*)/gi,
      /(?:^|\n)\s*(Part\s+\d+[^\n]*)/gi,
      /(?:^|\n)\s*(PART\s+[IVXLCDM]+[^\n]*)/gi,
      /(?:^|\n)\s*(\d+\.\s+[A-Z][^\n]{3,})/g,
    ];

    for (const pattern of chapterPatterns) {
      const splits = this.splitByPattern(text, pattern);
      if (splits.length >= 2) {
        return splits;
      }
    }

    // No chapter markers found — split by paragraph count (~2000 words per chunk)
    const words = text.split(/\s+/);
    const CHUNK_SIZE = 2000;

    if (words.length <= CHUNK_SIZE * 1.5) {
      return [{
        title: 'Chapter 1',
        content: text,
        wordCount: words.length,
      }];
    }

    const chapters: { title: string; content: string; wordCount: number }[] = [];
    let start = 0;
    let chapterNum = 1;

    while (start < words.length) {
      let end = Math.min(start + CHUNK_SIZE, words.length);

      // Try to break at a paragraph boundary
      if (end < words.length) {
        const slice = words.slice(start, end).join(' ');
        const lastParagraph = slice.lastIndexOf('\n\n');
        if (lastParagraph > slice.length * 0.5) {
          end = start + slice.substring(0, lastParagraph).split(/\s+/).length;
        }
      }

      const chapterWords = words.slice(start, end);
      const content = chapterWords.join(' ');

      chapters.push({
        title: `Section ${chapterNum}`,
        content,
        wordCount: chapterWords.length,
      });

      start = end;
      chapterNum++;
    }

    return chapters;
  }

  private splitByPattern(text: string, pattern: RegExp): { title: string; content: string; wordCount: number }[] {
    const matches: { index: number; title: string }[] = [];
    let match;

    // Reset regex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      matches.push({ index: match.index, title: match[1].trim() });
    }

    if (matches.length < 2) return [];

    const chapters: { title: string; content: string; wordCount: number }[] = [];

    // Add preface content if substantial
    if (matches[0].index > 200) {
      const preface = text.substring(0, matches[0].index).trim();
      chapters.push({
        title: 'Preface',
        content: preface,
        wordCount: preface.split(/\s+/).length,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.substring(start, end).trim();

      chapters.push({
        title: matches[i].title,
        content,
        wordCount: content.split(/\s+/).length,
      });
    }

    return chapters;
  }
}

export const libraryService = new LibraryService();
