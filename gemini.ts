import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { parseGeminiResponse, formatTime, extractAudioFromVideo, decodeAudio, sliceAudioBuffer, transcribeWithWhisper, timeToSeconds } from "./utils";
import { SubtitleItem } from "./types";

const PROOFREAD_BATCH_SIZE = 50; 
const TRANSLATION_BATCH_SIZE = 20;
const WHISPER_CHUNK_DURATION = 240; // 4 minutes per chunk (Approx 7.5MB WAV, safer for network stability)

// --- SCHEMAS ---

// Phase 2: Translation & Proofreading
const TRANSLATION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      text_original: { type: Type.STRING },
      text_translated: { type: Type.STRING, description: "Simplified Chinese translation" },
    },
    required: ["id", "text_translated"],
  },
};

// --- SYSTEM INSTRUCTIONS ---

const TRANSLATION_SYSTEM_INSTRUCTION = `
You are a professional subtitle translator.
Your task is to translate the provided subtitles into Simplified Chinese (Zh-CN).

RULES:
1. Translate "text" to "text_translated" (Simplified Chinese).
2. Keep the original meaning intact.
3. Output strictly valid JSON.
4. Maintain the "id" from the input.
5. **LENGTH LIMIT**: Chinese lines MUST be strictly ≤ 10 characters. Simplify, condense, or split lines to fit this limit. This is a hard constraint.
`;

const PROOFREAD_SYSTEM_INSTRUCTION = `
You are an expert Subtitle Quality Assurance Specialist using Gemini 3 Pro.
Your goal is to perfect the subtitles by fixing timestamps, formatting, transcription errors, and translation errors.

### TASKS:

1. **TIMESTAMP CALIBRATION**:
   - Ensure logical flow and fix segment resets.

2. **BILINGUAL CORRECTION**:
   - **Source Language**: Fix transcription errors, typos, homophones, and grammar.
   - **Target Language (Chinese)**: Fix mistranslations, unnatural phrasing, and ensure it matches the source tone.

3. **ENTITY & TERMINOLOGY CHECK (CRITICAL)**:
   - **Proper Nouns**: Correctly identify and standardize names of People, Places, Organizations, Game Terms, and Jargon.
   - **Consistency**: Ensure specific terms are translated identically throughout the file.

4. **FORMATTING RULES**:
   - **Chinese Length**: MUST be ≤ 10 characters per line.
   - Return valid JSON matching the input structure.
`;

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- MAIN FUNCTIONS ---

export const generateSubtitles = async (
  file: File, 
  duration: number,
  geminiKey: string, 
  openaiKey: string,
  onProgress?: (msg: string) => void
): Promise<SubtitleItem[]> => {
  
  if (!geminiKey) throw new Error("Gemini API Key is missing.");
  if (!openaiKey) throw new Error("OpenAI API Key is missing (Required for Whisper).");
  
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // 1. Decode Audio
  onProgress?.("Decoding audio track...");
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeAudio(file);
    onProgress?.(`Audio decoded. Duration: ${formatTime(audioBuffer.duration)}`);
  } catch (e) {
    throw new Error("Failed to decode audio. Please ensure the file is a valid video/audio format.");
  }

  const totalDuration = audioBuffer.duration;
  let cursor = 0;
  let chunkIndex = 1;
  const totalChunks = Math.ceil(totalDuration / WHISPER_CHUNK_DURATION);
  let allSubtitles: SubtitleItem[] = [];

  // 2. Loop: Slice -> Whisper -> Translate
  while (cursor < totalDuration) {
    const end = Math.min(cursor + WHISPER_CHUNK_DURATION, totalDuration);
    onProgress?.(`Processing Chunk ${chunkIndex}/${totalChunks} (${formatTime(cursor)} - ${formatTime(end)})...`);
    
    // A. Slice Audio (Client-side)
    const wavBlob = await sliceAudioBuffer(audioBuffer, cursor, end);
    
    // B. Transcribe with Whisper (OpenAI)
    onProgress?.(`[Chunk ${chunkIndex}] Transcribing with Whisper API...`);
    let chunkItems: SubtitleItem[] = [];
    try {
      chunkItems = await transcribeWithWhisper(wavBlob, openaiKey);
    } catch (e: any) {
      console.error(e);
      throw new Error(`Whisper Transcription failed on chunk ${chunkIndex}: ${e.message}`);
    }

    // C. Adjust Timestamps (Offset by cursor)
    if (cursor > 0) {
      chunkItems = chunkItems.map(item => {
        // Parse, add cursor, format back
        const startSec = timeToSeconds(item.startTime) + cursor;
        const endSec = timeToSeconds(item.endTime) + cursor;
        return {
          ...item,
          startTime: formatTime(startSec),
          endTime: formatTime(endSec)
        };
      });
    }

    // D. Translate with Gemini
    if (chunkItems.length > 0) {
      onProgress?.(`[Chunk ${chunkIndex}] Translating with Gemini...`);
      // Batch translation to avoid huge context
      const translatedChunk = await translateBatch(ai, chunkItems);
      allSubtitles = [...allSubtitles, ...translatedChunk];
    }

    cursor += WHISPER_CHUNK_DURATION;
    chunkIndex++;
  }

  // Renumber IDs
  return allSubtitles.map((s, i) => ({ ...s, id: i + 1 }));
};

// --- HELPERS ---

async function translateBatch(ai: GoogleGenAI, items: SubtitleItem[]): Promise<SubtitleItem[]> {
  const result: SubtitleItem[] = [];
  
  for (let i = 0; i < items.length; i += TRANSLATION_BATCH_SIZE) {
    const batch = items.slice(i, i + TRANSLATION_BATCH_SIZE);
    
    const payload = batch.map(item => ({
      id: item.id,
      text: item.original
    }));

    const prompt = `Translate the following subtitles to Simplified Chinese:\n${JSON.stringify(payload)}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: TRANSLATION_SCHEMA,
          systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS,
        }
      });

      const text = response.text || "[]";
      // Loose parse
      let translatedData: any[] = [];
      try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        translatedData = JSON.parse(clean);
        // Handle root array or object
        if (!Array.isArray(translatedData) && (translatedData as any).items) translatedData = (translatedData as any).items;
      } catch (e) {
        console.warn("Translation JSON parse error, skipping batch translation.");
      }

      // Merge
      const transMap = new Map(translatedData.map((t: any) => [t.id, t.text_translated]));
      
      batch.forEach(item => {
        result.push({
          ...item,
          translated: transMap.get(item.id) || "" // Fallback to empty if missing
        });
      });

    } catch (e) {
      console.error("Translation batch failed", e);
      // Fallback: append originals with empty translation
      result.push(...batch);
    }
  }
  return result;
}

// --- PROOFREADING ---

export const proofreadSubtitles = async (
  subtitles: SubtitleItem[],
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<SubtitleItem[]> => {
  if (!apiKey) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey });
  
  const totalBatches = Math.ceil(subtitles.length / PROOFREAD_BATCH_SIZE);
  let refinedSubtitles: SubtitleItem[] = [];
  let lastEndTime = "00:00:00,000";

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * PROOFREAD_BATCH_SIZE;
    const endIdx = startIdx + PROOFREAD_BATCH_SIZE;
    const batch = subtitles.slice(startIdx, endIdx);

    onProgress?.(`Proofreading batch ${i + 1}/${totalBatches}...`);

    const payload = batch.map(s => ({
      id: s.id,
      start: s.startTime,
      end: s.endTime,
      text_original: s.original,
      text_translated: s.translated
    }));

    const prompt = `
      Batch ${i+1}/${totalBatches}.
      CONTEXT: The previous batch ended at timestamp: "${lastEndTime}".
      Input JSON: ${JSON.stringify(payload)}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          systemInstruction: PROOFREAD_SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS,
        }
      });

      const text = response.text || "[]";
      const processedBatch = parseGeminiResponse(text);

      if (processedBatch.length > 0) {
        lastEndTime = processedBatch[processedBatch.length - 1].endTime;
        refinedSubtitles = [...refinedSubtitles, ...processedBatch];
      } else {
        refinedSubtitles = [...refinedSubtitles, ...batch];
      }

    } catch (e) {
      console.error(`Batch ${i+1} proofreading failed.`, e);
      refinedSubtitles = [...refinedSubtitles, ...batch];
      if (batch.length > 0) lastEndTime = batch[batch.length - 1].endTime;
    }
  }

  return refinedSubtitles;
};