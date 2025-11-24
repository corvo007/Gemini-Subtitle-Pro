import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { parseGeminiResponse, formatTime, decodeAudio, sliceAudioBuffer, transcribeAudio, timeToSeconds, blobToBase64 } from "./utils";
import { SubtitleItem, AppSettings, Genre } from "./types";

const PROOFREAD_BATCH_SIZE = 50; 
const TRANSLATION_BATCH_SIZE = 20;
const PROCESSING_CHUNK_DURATION = 300; // 5 minutes chunk

// --- RATE LIMIT HELPER ---

async function generateContentWithRetry(ai: GoogleGenAI, params: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (e: any) {
      // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
      const isRateLimit = e.status === 429 || e.message?.includes('429') || e.response?.status === 429;
      const isServerOverload = e.status === 503 || e.message?.includes('503');

      if ((isRateLimit || isServerOverload) && i < retries - 1) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000; // 2s, 4s, 8s + jitter
        console.warn(`Gemini API Busy (${e.status}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  throw new Error("Gemini API request failed after retries.");
}

// --- SCHEMAS ---

const REFINEMENT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      start: { type: Type.STRING, description: "HH:MM:SS,mmm" },
      end: { type: Type.STRING, description: "HH:MM:SS,mmm" },
      text: { type: Type.STRING, description: "Corrected original text" },
    },
    required: ["start", "end", "text"],
  },
};

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

// --- PROMPT GENERATORS ---

const getSystemInstruction = (genre: Genre, customPrompt?: string, mode: 'refinement' | 'translation' | 'proofreading' = 'translation'): string => {
  if (customPrompt && customPrompt.trim().length > 0) {
    return customPrompt;
  }

  // 1. Refinement Prompt (Flash 2.5)
  if (mode === 'refinement') {
    return `You are a professional Subtitle QA Specialist. 
    You will receive an audio chunk and a raw JSON transcription.
    
    YOUR TASKS:
    1. Listen to the audio to verify the transcription.
    2. FIX TIMESTAMPS: Ensure start/end times match the audio speech perfectly.
    3. FIX TRANSCRIPTION: Correct mishearings, typos, and proper nouns (names, terminology).
    4. SPLIT LINES: If a segment is too long (> 15 words or > 4 seconds) or contains multiple sentences, SPLIT it into multiple segments.
    5. REMOVE HALLUCINATIONS: Delete segments that have no corresponding speech in the audio.
    6. FORMAT: Return a valid JSON array of objects with "start", "end", and "text".
    
    Genre Context: ${genre}`;
  }

  // 2. Translation Prompt (Flash 2.5)
  if (mode === 'translation') {
    let genreContext = "";
    switch (genre) {
      case 'anime': genreContext = "Genre: Anime. Use casual, emotive tone. Preserve honorifics nuances."; break;
      case 'movie': genreContext = "Genre: Movie/TV. Natural dialogue, concise, easy to read."; break;
      case 'news': genreContext = "Genre: News. Formal, objective, standard terminology."; break;
      case 'tech': genreContext = "Genre: Tech. Precise terminology. Keep standard English acronyms."; break;
      default: genreContext = "Genre: General. Neutral and accurate."; break;
    }

    return `You are a professional translator. Translate the following subtitles to Simplified Chinese (zh-CN).
    RULES:
    - Translate "text" to "text_translated".
    - Maintain the "id" exactly.
    - Output valid JSON.
    ${genreContext}`;
  }

  // 3. Deep Proofreading Prompt (Pro 3)
  return `You are an expert Subtitle Quality Assurance Specialist using Gemini 3 Pro.
    Your goal is to perfect the subtitles by fixing timestamps, formatting, transcription errors, and translation errors.
    Return valid JSON matching input structure.`;
};

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
  settings: AppSettings,
  onProgress?: (msg: string) => void,
  onIntermediateResult?: (subs: SubtitleItem[]) => void
): Promise<SubtitleItem[]> => {
  
  const geminiKey = settings.geminiKey?.trim();
  const openaiKey = settings.openaiKey?.trim();

  if (!geminiKey) throw new Error("Gemini API Key is missing.");
  if (!openaiKey) throw new Error("OpenAI API Key is missing.");
  
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
  const totalChunks = Math.ceil(totalDuration / PROCESSING_CHUNK_DURATION);
  let allSubtitles: SubtitleItem[] = [];
  let globalIdCounter = 1;

  // 2. Pipeline Loop
  while (cursor < totalDuration) {
    const end = Math.min(cursor + PROCESSING_CHUNK_DURATION, totalDuration);
    onProgress?.(`Processing Chunk ${chunkIndex}/${totalChunks} (${formatTime(cursor)} - ${formatTime(end)})...`);
    
    // A. Slice Audio
    const wavBlob = await sliceAudioBuffer(audioBuffer, cursor, end);
    const base64Audio = await blobToBase64(wavBlob);

    // B. Step 1: OpenAI Transcription
    onProgress?.(`[Chunk ${chunkIndex}] 1/3 Transcribing (${settings.transcriptionModel})...`);
    let rawSegments: SubtitleItem[] = [];
    try {
      rawSegments = await transcribeAudio(wavBlob, openaiKey, settings.transcriptionModel);
    } catch (e: any) {
      console.warn(`Transcription warning on chunk ${chunkIndex}: ${e.message}`);
      throw new Error(`Transcription failed on chunk ${chunkIndex}: ${e.message}`);
    }

    // NOTE: We keep rawSegments timestamps relative (0-based) to the chunk audio
    // to ensure Gemini Refine aligns them correctly with the sliced audio.
    // We will add the cursor offset at the very end.

    // C. Step 2: Gemini Refine (2.5 Flash)
    let refinedSegments: SubtitleItem[] = [];
    if (rawSegments.length > 0) {
        onProgress?.(`[Chunk ${chunkIndex}] 2/3 Refining with Gemini 2.5 Flash (Audio Check)...`);
        
        const refineSystemInstruction = getSystemInstruction(settings.genre, undefined, 'refinement');
        const refinePrompt = `
        Refine this raw transcription based on the attached audio. 
        Raw Transcription: ${JSON.stringify(rawSegments.map(s => ({ start: s.startTime, end: s.endTime, text: s.original })))}
        `;

        try {
            const refineResponse = await generateContentWithRetry(ai, {
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: "audio/wav", data: base64Audio } },
                        { text: refinePrompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: REFINEMENT_SCHEMA,
                    systemInstruction: refineSystemInstruction,
                    safetySettings: SAFETY_SETTINGS,
                }
            });
            
            refinedSegments = parseGeminiResponse(refineResponse.text);
            
            // If refinement returns nothing, fallback to raw
            if (refinedSegments.length === 0) {
                 refinedSegments = [...rawSegments];
            }
        } catch (e) {
            console.error(`Refinement failed for chunk ${chunkIndex}, falling back to raw.`, e);
            refinedSegments = [...rawSegments];
        }
    }

    // D. Step 3: Gemini Translate (2.5 Flash)
    let finalChunkSubs: SubtitleItem[] = [];
    if (refinedSegments.length > 0) {
        onProgress?.(`[Chunk ${chunkIndex}] 3/3 Translating...`);
        
        // Prepare data for translation
        const toTranslate = refinedSegments.map((seg, idx) => ({
            id: idx + 1,
            original: seg.original, 
            start: seg.startTime,   // 0-based
            end: seg.endTime        // 0-based
        }));

        const translateSystemInstruction = getSystemInstruction(settings.genre, settings.customTranslationPrompt, 'translation');
        
        // Translate
        const translatedItems = await translateBatch(ai, toTranslate, translateSystemInstruction);
        
        // Map back to global IDs and Absolute Time
        finalChunkSubs = translatedItems.map(item => ({
            id: globalIdCounter++,
            startTime: formatTime(timeToSeconds(item.start) + cursor),
            endTime: formatTime(timeToSeconds(item.end) + cursor),
            original: item.original,
            translated: item.translated
        }));
    }

    // E. Update State (Streaming)
    allSubtitles = [...allSubtitles, ...finalChunkSubs];
    onIntermediateResult?.(allSubtitles);

    cursor += PROCESSING_CHUNK_DURATION;
    chunkIndex++;
  }

  return allSubtitles;
};

// --- HELPERS ---

async function translateBatch(ai: GoogleGenAI, items: any[], systemInstruction: string): Promise<any[]> {
  const result: any[] = [];
  
  for (let i = 0; i < items.length; i += TRANSLATION_BATCH_SIZE) {
    const batch = items.slice(i, i + TRANSLATION_BATCH_SIZE);
    const payload = batch.map(item => ({ id: item.id, text: item.original }));
    const prompt = `Translate to Simplified Chinese:\n${JSON.stringify(payload)}`;

    try {
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: TRANSLATION_SCHEMA,
          systemInstruction: systemInstruction,
          safetySettings: SAFETY_SETTINGS,
        }
      });

      const text = response.text || "[]";
      let translatedData: any[] = [];
      try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        translatedData = JSON.parse(clean);
        if (!Array.isArray(translatedData) && (translatedData as any).items) translatedData = (translatedData as any).items;
      } catch (e) {
        console.warn("Translation JSON parse error");
      }

      const transMap = new Map(translatedData.map((t: any) => [t.id, t.text_translated]));
      
      batch.forEach(item => {
        result.push({
          ...item,
          translated: transMap.get(item.id) || "" 
        });
      });

    } catch (e) {
      console.error("Translation batch failed", e);
      // Fallback: keep original only
      batch.forEach(item => {
        result.push({ ...item, translated: "" });
      });
    }
  }
  return result;
}

// --- PROOFREADING (Optional Step 4 - Gemini 3 Pro) ---

export const proofreadSubtitles = async (
  file: File,
  subtitles: SubtitleItem[],
  settings: AppSettings,
  onProgress?: (msg: string) => void
): Promise<SubtitleItem[]> => {
  const geminiKey = settings.geminiKey?.trim();
  if (!geminiKey) throw new Error("API Key is missing.");
  
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  
  onProgress?.("Loading audio for contextual proofreading...");
  let audioBuffer: AudioBuffer;
  try {
     audioBuffer = await decodeAudio(file);
  } catch(e) {
     console.warn("Could not decode audio for proofreading, falling back to text-only.");
     return proofreadTextOnly(subtitles, settings, ai, onProgress);
  }

  const totalBatches = Math.ceil(subtitles.length / PROOFREAD_BATCH_SIZE);
  let refinedSubtitles: SubtitleItem[] = [];
  let lastEndTime = "00:00:00,000";
  const systemInstruction = getSystemInstruction(settings.genre, settings.customProofreadingPrompt, 'proofreading');

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * PROOFREAD_BATCH_SIZE;
    const endIdx = startIdx + PROOFREAD_BATCH_SIZE;
    const batch = subtitles.slice(startIdx, endIdx);

    onProgress?.(`Proofreading batch ${i + 1}/${totalBatches} (Listening & Analyzing)...`);

    const batchStartStr = batch[0].startTime;
    const batchEndStr = batch[batch.length - 1].endTime;
    const startSec = timeToSeconds(batchStartStr);
    const endSec = timeToSeconds(batchEndStr);

    let base64Audio = "";
    try {
        const blob = await sliceAudioBuffer(audioBuffer, Math.max(0, startSec - 1), Math.min(audioBuffer.duration, endSec + 1));
        base64Audio = await blobToBase64(blob);
    } catch(e) {
        console.warn("Audio slice failed, sending text only.");
    }

    const payload = batch.map(s => ({
      id: s.id,
      start: s.startTime,
      end: s.endTime,
      text_original: s.original,
      text_translated: s.translated
    }));

    const prompt = `
      Batch ${i+1}/${totalBatches}.
      PREVIOUS END TIME: "${lastEndTime}".
      INSTRUCTIONS:
      1. Listen to the audio.
      2. Fix transcription errors (source).
      3. Fix translation errors (Chinese).
      4. SPLIT long lines if the audio has pauses.
      5. Adjust timestamps to match audio perfectly.
      6. Return valid JSON.
      Current Subtitles JSON:
      ${JSON.stringify(payload)}
    `;

    try {
      const parts: any[] = [{ text: prompt }];
      if (base64Audio) {
        parts.push({
            inlineData: {
                mimeType: "audio/wav",
                data: base64Audio
            }
        });
      }

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3-pro-preview',
        contents: { parts: parts },
        config: {
          responseMimeType: "application/json",
          systemInstruction: systemInstruction,
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

  return refinedSubtitles.map((s, i) => ({ ...s, id: i + 1 }));
};

async function proofreadTextOnly(subtitles: SubtitleItem[], settings: AppSettings, ai: GoogleGenAI, onProgress?: (msg: string) => void): Promise<SubtitleItem[]> {
    const systemInstruction = getSystemInstruction(settings.genre, settings.customProofreadingPrompt, 'proofreading');
    const totalBatches = Math.ceil(subtitles.length / PROOFREAD_BATCH_SIZE);
    let refined: SubtitleItem[] = [];

    for (let i = 0; i < totalBatches; i++) {
        const batch = subtitles.slice(i*PROOFREAD_BATCH_SIZE, (i+1)*PROOFREAD_BATCH_SIZE);
        onProgress?.(`Proofreading batch ${i+1}/${totalBatches} (Text Only)...`);
        
        try {
            const prompt = `Refine these subtitles:\n${JSON.stringify(batch)}`;
            const response = await generateContentWithRetry(ai, {
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json", systemInstruction }
            });
            const parsed = parseGeminiResponse(response.text);
            refined = [...refined, ...(parsed.length ? parsed : batch)];
        } catch(e) {
            refined = [...refined, ...batch];
        }
    }
    return refined;
}