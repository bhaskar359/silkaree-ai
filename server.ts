import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AIServiceError,
  analyzeSareeImage,
  extractInspirationIntentAndGrounding,
  extractTextSearchIntent,
  getConfiguredGemmaModel,
  SUPPORTED_GEMMA_MODELS,
} from './server/gemmaService.ts';
import { searchExternalInspiration } from './server/inspirationProvider.ts';
import { rankByTextIntent, rankByVisualAnalysis } from './server/matcher.ts';
import type { SareeItem, TextSearchIntent } from './src/types/saree.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SAMPLE_SWATCH_FILES: Record<string, { filePath: string; mimeType: string }> = {
  'sample-kanchipuram': {
    filePath: path.join(__dirname, 'public/assets/aistudio/Image_1_73f1d31a.jpeg'),
    mimeType: 'image/jpeg',
  },
  'sample-uppada': {
    filePath: path.join(__dirname, 'public/assets/aistudio/Image_2_dcd70d8a.jpeg'),
    mimeType: 'image/jpeg',
  },
  'sample-pochampally': {
    filePath: path.join(__dirname, 'public/assets/aistudio/Image_3_2b2a0e43.jpeg'),
    mimeType: 'image/jpeg',
  },
  'sample-mangalagiri': {
    filePath: path.join(__dirname, 'public/assets/aistudio/Image_4_11f94a90.jpeg'),
    mimeType: 'image/jpeg',
  },
};

const cataloguePath = path.join(__dirname, 'server/data/sarees.json');
const sareeCatalogue: SareeItem[] = JSON.parse(fs.readFileSync(cataloguePath, 'utf-8'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const apiKeyConfigured = Boolean(
      apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'MY_GEMINI_API_KEY'
    );
    const googleCseConfigured = Boolean(
      process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim()
    );

    let model = process.env.GEMMA_MODEL?.trim() || 'gemma-4-26b-a4b-it';
    let modelValid = true;
    try {
      model = getConfiguredGemmaModel();
    } catch {
      modelValid = false;
    }

    res.json({
      status: apiKeyConfigured && modelValid ? 'ok' : 'degraded',
      apiKeyConfigured,
      googleCseConfigured,
      model,
      supportedGemmaModels: SUPPORTED_GEMMA_MODELS,
      catalogueCount: sareeCatalogue.length,
    });
  });

  // 2. Catalogue endpoint (source of truth for product cards)
  app.get('/api/catalogue', (_req: Request, res: Response) => {
    res.json({
      sarees: sareeCatalogue,
      total: sareeCatalogue.length,
    });
  });

  // 3. Natural-language saree search endpoint
  app.post('/api/search/text', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      if (!rawQuery) {
        res.status(400).json({
          error: 'Please enter a saree description or search query.',
          code: 'EMPTY_QUERY',
        });
        return;
      }

      if (rawQuery.length > 500) {
        res.status(400).json({
          error: 'Search query is too long (maximum 500 characters).',
          code: 'QUERY_TOO_LONG',
        });
        return;
      }

      const { model, intent } = await extractTextSearchIntent(rawQuery);
      const { results, hasStrongMatch, matchQuality, matchSummaryNote } = rankByTextIntent(
        rawQuery,
        intent,
        sareeCatalogue
      );

      res.json({
        mode: 'text',
        model,
        query: rawQuery,
        intent,
        results,
        hasStrongMatch,
        matchQuality,
        matchSummaryNote,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. External saree inspiration search endpoint (Gemma 4 intent + grounding + image search provider)
  app.post('/api/search/inspiration', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      if (!rawQuery) {
        res.status(400).json({
          error: 'Please provide a search query to discover external saree designs.',
          code: 'EMPTY_QUERY',
        });
        return;
      }

      if (rawQuery.length > 500) {
        res.status(400).json({
          error: 'Search query is too long (maximum 500 characters).',
          code: 'QUERY_TOO_LONG',
        });
        return;
      }

      const optionalIntent: Partial<TextSearchIntent> | undefined =
        req.body?.intent && typeof req.body.intent === 'object'
          ? (req.body.intent as Partial<TextSearchIntent>)
          : undefined;

      const { model, inspirationIntent, groundingSources } =
        await extractInspirationIntentAndGrounding(rawQuery, optionalIntent);

      const providerOutcome = await searchExternalInspiration(inspirationIntent, rawQuery);

      res.json({
        mode: 'inspiration',
        model,
        originalQuery: rawQuery,
        searchQueryUsed: providerOutcome.searchQueryUsed,
        inspirationIntent,
        provider: providerOutcome.provider,
        groundingSources,
        results: providerOutcome.results,
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Image-based saree discovery endpoint (in-memory upload or verified sample photo)
  app.post(
    '/api/search/image',
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('image')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
              error: 'Uploaded image exceeds the 8 MB size limit. Please choose a smaller photograph.',
              code: 'FILE_TOO_LARGE',
            });
            return;
          }
          res.status(400).json({
            error: `Upload error: ${err.message}`,
            code: 'INVALID_UPLOAD',
          });
          return;
        }
        if (err) {
          next(err);
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        let imageBuffer: Buffer | null = null;
        let mimeType = '';

        if (req.file) {
          if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
            res.status(400).json({
              error: `Unsupported image type "${req.file.mimetype}". Please upload a JPEG, PNG, or WebP photograph.`,
              code: 'UNSUPPORTED_MIME_TYPE',
            });
            return;
          }
          if (req.file.size === 0) {
            res.status(400).json({
              error: 'Uploaded image file is empty.',
              code: 'EMPTY_FILE',
            });
            return;
          }
          imageBuffer = req.file.buffer;
          mimeType = req.file.mimetype;
        } else if (typeof req.body?.sampleId === 'string' && SAMPLE_SWATCH_FILES[req.body.sampleId]) {
          const sample = SAMPLE_SWATCH_FILES[req.body.sampleId];
          imageBuffer = fs.readFileSync(sample.filePath);
          mimeType = sample.mimeType;
        } else {
          res.status(400).json({
            error: 'Please upload a saree photograph (JPEG, PNG, or WebP) to run visual search.',
            code: 'MISSING_IMAGE',
          });
          return;
        }

        const { model, analysis } = await analyzeSareeImage(imageBuffer, mimeType);
        const { results, hasStrongMatch, matchSummaryNote } = rankByVisualAnalysis(
          analysis,
          sareeCatalogue
        );

        res.json({
          mode: 'image',
          model,
          analysis,
          results,
          hasStrongMatch,
          matchSummaryNote,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // API Error Handler (never leaks secrets)
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AIServiceError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    console.error('[Silkaree AI] Unhandled server error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      error: 'An unexpected server error occurred while processing your saree search. Please retry.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  // Frontend serving (Vite dev middleware in development, static dist in production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Silkaree AI] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Silkaree AI] Failed to start server:', err);
  process.exit(1);
});
