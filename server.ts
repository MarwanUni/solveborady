import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/recognize-math', async (req, res) => {
    try {
      const { imageBase64, mimeType, contextSymbols } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        contextSymbols?: string[];
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'No handwriting image provided.' });
        return;
      }

      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const safeMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/png';

      const safeContext = Array.isArray(contextSymbols)
        ? contextSymbols
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 20)
        : [];

      const ai = getAiClient();

      const promptLines = [
        'Transcribe all handwritten mathematical or electrical engineering equations and expressions in this image.',
        'Rules:',
        '- Ignore any terms, symbols, or lines that are crossed out or scribbled over.',
        '- If multiple lines form a single connected derivation, either keep each step as a separate item OR use \\begin{aligned}...\\end{aligned} cleanly when clearly aligned.',
        '- Return one entry per distinct equation or step.',
        '- For each entry provide:',
        '  * latex: clean standard LaTeX (do not wrap in $ or $$). Use \\frac, \\sqrt, \\omega, \\theta, \\Omega, \\mu, subscripts like V_1, R_1, etc.',
        '  * plain: clean plain-text ASCII/Unicode math version (e.g. (V1 - V2)/R1 = 0, sqrt(x^2 + y^2), R1 = 4.7k).',
        '  * title: optional short 2-4 word label only if the handwriting clearly includes a heading or label, otherwise empty string.',
      ];

      if (safeContext.length > 0) {
        promptLines.push(
          `- Notation context from earlier equations in this notebook (prefer matching these variable names when handwriting is ambiguous): ${safeContext.join(', ')}`
        );
      }

      promptLines.push('If the image is blank or unreadable, return an empty array.');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            {
              text: promptLines.join('\n'),
            },
          ],
        },
        config: {
          systemInstruction:
            'You are an accurate handwriting-to-LaTeX math and engineering equation recognizer. Transcribe faithfully without solving unless the solution is explicitly written.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              equations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    latex: { type: Type.STRING },
                    plain: { type: Type.STRING },
                    title: { type: Type.STRING },
                  },
                  required: ['latex', 'plain'],
                },
              },
            },
            required: ['equations'],
          },
        },
      });

      const rawText = (response.text ?? '{"equations":[]}').trim();
      const parsed = JSON.parse(rawText) as {
        equations?: Array<{ latex?: string; plain?: string; title?: string }>;
      };

      const equations = (parsed.equations ?? [])
        .filter((item) => item && (item.latex?.trim() || item.plain?.trim()))
        .map((item) => ({
          latex: (item.latex ?? item.plain ?? '').trim(),
          plain: (item.plain ?? item.latex ?? '').trim(),
          title: item.title?.trim() || '',
        }));

      res.json({ equations });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to convert handwriting.';
      console.error('Recognize math error:', message);
      res.status(500).json({ error: message });
    }
  });

  const httpServer = createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr:
          process.env.DISABLE_HMR === 'true'
            ? false
            : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Lecture Scratchpad listening on http://localhost:${PORT}`);
  });
}

startServer();
