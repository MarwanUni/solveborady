import { GoogleGenAI, Type } from '@google/genai';

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the Vercel environment.');
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const { imageBase64, mimeType, contextSymbols } = (req.body ?? {}) as {
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
          .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)
          .slice(0, 20)
      : [];

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

    const response = await getAiClient().models.generateContent({
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

    res.status(200).json({ equations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to convert handwriting.';
    console.error('Recognize math error:', message);
    res.status(500).json({ error: message });
  }
}