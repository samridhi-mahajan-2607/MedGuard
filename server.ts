import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Allow payloads up to 15MB for uploaded medication photos
app.use(express.json({ limit: '15mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Model Configuration: default to lightweight fast vision model with fallback candidates
const PRIMARY_VISION_MODEL =
  process.env.PRIMARY_VISION_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_VISION_MODELS = (
  process.env.FALLBACK_VISION_MODELS || 'gemini-flash-latest,gemini-3.8-flash'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Unique list of models to try in priority order
const MODEL_CANDIDATES = Array.from(
  new Set([PRIMARY_VISION_MODEL, ...FALLBACK_VISION_MODELS])
);

// Sleep helper for exponential backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface MedicineAnalysisResult {
  medicine_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string;
  confidence: number;
  extracted_text: string;
  needs_review: boolean;
  user_message?: string;
  // Legacy compatibility fields
  drugName?: string;
  dosage?: string;
  brandName?: string;
  rawDetectedText?: string;
}

const EXTRACTION_PROMPT = `You are a medical packaging OCR specialist for MedGuard, a medication safety and interaction checker.
Carefully examine this image of a medicine blister strip, bottle, box packaging, or prescription label.

SAFETY RULES (CRITICAL):
1. NEVER invent, hallucinate, or guess a medicine name.
2. If the text is blurry, truncated, or illegible, set "medicine_name" to "" and "needs_review" to true.
3. Only extract a medicine name if you can read it with high certainty from the visible packaging.
4. If this image does not appear to be medicine or pharmaceutical packaging at all, set "medicine_name" to "", "confidence" to 0, and "needs_review" to true.

FIELDS TO EXTRACT:
- "medicine_name": Primary active ingredient or commercial brand name (e.g., 'Aspirin', 'Warfarin', 'Ibuprofen', 'Metformin', 'Lithium', 'Digoxin', etc.). If illegible, leave empty string "".
- "strength": Visible dosage or concentration (e.g., '500 mg', '5 mg', '200 mg', '0.25 mg') or empty string if not visible.
- "dosage_form": Form if visible (e.g., 'Tablets', 'Capsules', 'Blister Strip', 'Oral Suspension', 'Injection') or empty string.
- "manufacturer": Brand or pharmaceutical company name if visible (e.g., 'Bayer', 'Pfizer', 'Lilly', 'Central Pharmacy') or empty string.
- "confidence": Integer 0 to 100 representing certainty in the extracted medicine name. High clarity = 85-100; partially obscured = 40-70; illegible/guessing = 0-30.
- "extracted_text": Key exact words or label lines visible on the packaging.
- "needs_review": Boolean. Set to true if confidence < 75, if the image is blurry/partially obscured, or if user should manually verify before interaction checking.
- "user_message": Concise explanation of what was read or advice to retake if unclear.`;

// Call Gemini API with exponential backoff retries per model
async function analyzeWithModel(
  modelName: string,
  base64Data: string,
  mimeType: string
): Promise<MedicineAnalysisResult> {
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Backoff: 600ms, then 1200ms
        const delay = 600 * Math.pow(2, attempt - 1);
        console.warn(
          `[MedGuard] Retrying model ${modelName} (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms...`
        );
        await sleep(delay);
      }

      console.log(`[MedGuard] Calling vision model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medicine_name: {
                type: Type.STRING,
                description:
                  'Clean canonical or brand medicine name, or empty string if not confident',
              },
              strength: {
                type: Type.STRING,
                description:
                  'Strength/dosage like 500 mg or 5 mg, or empty string',
              },
              dosage_form: {
                type: Type.STRING,
                description:
                  'Form like Tablets, Capsules, Blister pack, or empty string',
              },
              manufacturer: {
                type: Type.STRING,
                description:
                  'Pharmaceutical manufacturer or brand name, or empty string',
              },
              confidence: {
                type: Type.INTEGER,
                description: 'Confidence score from 0 to 100',
              },
              extracted_text: {
                type: Type.STRING,
                description: 'Actual readable text fragments from the label',
              },
              needs_review: {
                type: Type.BOOLEAN,
                description:
                  'True if blurry, partial, or medicine name is uncertain',
              },
              user_message: {
                type: Type.STRING,
                description: 'Short guidance message for the user',
              },
            },
            required: [
              'medicine_name',
              'confidence',
              'extracted_text',
              'needs_review',
            ],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 50;

      const medicineName = (parsed.medicine_name || '').trim();
      const needsReview =
        parsed.needs_review === true ||
        confidence < 75 ||
        medicineName.length === 0;

      return {
        medicine_name: medicineName,
        strength: (parsed.strength || '').trim(),
        dosage_form: (parsed.dosage_form || '').trim(),
        manufacturer: (parsed.manufacturer || '').trim(),
        confidence,
        extracted_text: (parsed.extracted_text || '').trim(),
        needs_review: needsReview,
        user_message: parsed.user_message || '',
        // Map to legacy fields for backward compatibility
        drugName: medicineName,
        dosage: (parsed.strength || '').trim(),
        brandName: (parsed.manufacturer || '').trim(),
        rawDetectedText: (parsed.extracted_text || '').trim(),
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(
        `[MedGuard] Error calling ${modelName} (attempt ${attempt + 1}):`,
        errMsg
      );

      // If it's not a temporary/rate-limit/overload error, don't keep retrying this model
      const isRetryable =
        errMsg.includes('503') ||
        errMsg.includes('429') ||
        errMsg.includes('high demand') ||
        errMsg.includes('Resource has been exhausted') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('timeout') ||
        errMsg.includes('ECONNRESET');

      if (!isRetryable) {
        break;
      }
    }
  }

  throw lastError;
}

// API endpoint for medication photo extraction with fallback architecture
app.post('/api/extract-medicine', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg' } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a medication image to scan.',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: GEMINI_API_KEY is missing.',
      });
    }

    // Strip data URL prefix if present
    const base64Data = image.includes('base64,')
      ? image.split('base64,')[1]
      : image;

    let result: MedicineAnalysisResult | null = null;
    let modelUsed: string = '';

    // Iterate through candidates (primary lightweight model first, then fallbacks)
    for (const modelCandidate of MODEL_CANDIDATES) {
      try {
        result = await analyzeWithModel(modelCandidate, base64Data, mimeType);
        modelUsed = modelCandidate;
        console.log(
          `[MedGuard] Successfully extracted with model: ${modelCandidate}`
        );
        break;
      } catch (modelErr: any) {
        console.warn(
          `[MedGuard] Model ${modelCandidate} failed, trying next fallback model...`
        );
      }
    }

    // If all models failed
    if (!result) {
      console.error(
        '[MedGuard] All vision model candidates exhausted without success.'
      );
      return res.status(503).json({
        success: false,
        error: 'Image analysis is temporarily busy. Please try again in a moment.',
      });
    }

    return res.json({
      success: true,
      modelUsed,
      result,
    });
  } catch (error: any) {
    console.error('[MedGuard] Fatal error in extract-medicine:', error);
    return res.status(500).json({
      success: false,
      error: 'Image analysis is temporarily busy. Please try again in a moment.',
    });
  }
});

// Setup dev server with Vite middlewares or static files for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(
      `MedGuard server running on http://localhost:${PORT} (Primary vision: ${PRIMARY_VISION_MODEL})`
    );
  });
}

startServer();
