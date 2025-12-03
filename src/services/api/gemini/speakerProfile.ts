import { GoogleGenAI, Type } from "@google/genai";
import { blobToBase64 } from "@/services/audio/converter";
import { logger } from "@/services/utils/logger";

export const SPEAKER_PROFILE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        speakerCount: { type: Type.INTEGER },
        profiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    characteristics: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, nullable: true },
                            gender: { type: Type.STRING, enum: ["male", "female", "unknown"] },
                            pitch: { type: Type.STRING, enum: ["low", "medium", "high"] },
                            speed: { type: Type.STRING, enum: ["slow", "normal", "fast"] },
                            accent: { type: Type.STRING },
                            tone: { type: Type.STRING }
                        },
                        required: ["gender", "pitch", "speed", "accent", "tone"]
                    },
                    inferredIdentity: { type: Type.STRING, nullable: true },
                    sampleQuotes: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    confidence: { type: Type.NUMBER }
                },
                required: ["id", "characteristics", "sampleQuotes", "confidence"]
            }
        }
    },
    required: ["speakerCount", "profiles"]
};

export interface SpeakerProfile {
    id: string;
    characteristics: {
        gender: 'male' | 'female' | 'unknown';
        name?: string;
        pitch: 'low' | 'medium' | 'high';
        speed: 'slow' | 'normal' | 'fast';
        accent: string;
        tone: string;
    };
    inferredIdentity?: string;
    sampleQuotes: string[];
    confidence: number;
}

export interface SpeakerProfileSet {
    profiles: SpeakerProfile[];
    extractedAt: Date;
    audioDuration: number;
    modelVersion: string;
}

/**
 * Extracts speaker profiles from audio using Gemini 3.0 Pro.
 * 
 * @param ai GoogleGenAI instance
 * @param audioBlob Sampled audio blob
 * @param audioDuration Exact duration of the audio blob in seconds
 * @param genre Content genre/context
 * @param timeout Timeout in milliseconds
 */
export async function extractSpeakerProfiles(
    ai: GoogleGenAI,
    audioBlob: Blob,
    audioDuration: number,
    genre: string,
    timeout: number = 300000
): Promise<SpeakerProfileSet> {
    const base64Audio = await blobToBase64(audioBlob);

    const prompt = `
**TASK**: Extract comprehensive speaker profiles from audio samples for downstream voice matching.

**CONTEXT**:
- Genre: ${genre}
- Audio: Representative samples from different time periods
- Purpose: Create voice fingerprint database for Gemini 2.5 Flash to identify speakers
- **Tools Available**: Google Search (use to verify public figures if names are mentioned)

**SPEAKER PROFILE EXTRACTION**:
1. Identify ALL distinct speakers (missing a speaker is critical failure)
2. For each speaker, document:
   - Voice characteristics (gender, name, pitch, speed, accent, tone)
   - Inferred identity/role (if mentioned in dialogue)
   - 2-3 representative quotes (exact transcriptions)
   - Confidence score (0.0-1.0)

**OUTPUT FORMAT** (JSON):
\`\`\`json
{
  "speakerCount": <integer>,
  "profiles": [
    {
      "id": "Speaker 1",
      "characteristics": {
        "name": "<name if mentioned, in source language (e.g., '田中' not 'Tanaka')>",
        "gender": "male" | "female" | "unknown",
        "pitch": "low" | "medium" | "high",
        "speed": "slow" | "normal" | "fast",
        "accent": "<English description>",
        "tone": "<English description, e.g., calm, energetic>"
      },
      "inferredIdentity": "<role/name if identifiable>",
      "sampleQuotes": ["<quote 1>", "<quote 2>"],
      "confidence": <0.0-1.0>
    }
  ]
}
\`\`\`

**QUALITY CONSTRAINTS**:
- Use confidence >0.8 ONLY for very distinct voices
- If uncertain between 2-3 speakers, list all (better over-identify than miss)
- Include background speakers if they speak ≥3 sentences
- Describe accents/tone in English for consistency

**EXAMPLE OUTPUT**:
\`\`\`json
{
  "speakerCount": 2,
  "profiles": [
    {
      "id": "Speaker 1",
      "characteristics": {
        "name": "John",
        "gender": "male",
        "pitch": "low",
        "speed": "fast",
        "accent": "American English",
        "tone": "Professional, News Anchor"
      },
      "inferredIdentity": "Host",
      "sampleQuotes": ["Welcome to the show tonight.", "Let's bring in our guest."],
      "confidence": 0.95
    },
    {
      "id": "Speaker 2",
      "characteristics": {
        "name": "田中美咲",
        "gender": "female",
        "pitch": "high",
        "speed": "normal",
        "accent": "Japanese (Kansai dialect)",
        "tone": "Energetic, Friendly"
      },
      "inferredIdentity": "Guest A",
      "sampleQuotes": ["こんにちは！田中です！", "大阪の食べ物は最高です！"],
      "confidence": 0.88
    }
  ]
}
\`\`\`
`;

    logger.debug("Speaker Profile Request:", { promptLength: prompt.length, audioSize: base64Audio.length });

    const response = await ai.models.generateContent({
        model: 'gemini-3.0-pro-preview', // Ensure consistency
        contents: {
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: "audio/wav",
                        data: base64Audio
                    }
                }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: SPEAKER_PROFILE_SCHEMA,
            // temperature: default (1.0),
            maxOutputTokens: 8192,
            tools: [{ googleSearch: {} }], // Enable Search Grounding
            thinkingConfig: {
                thinkingLevel: "high" as any // Cast to any to avoid enum error if type definition is missing
            }
        }
    });

    const text = response.text || "{}";
    logger.debug("Speaker Profile Response:", text);

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        logger.error("Failed to parse speaker profile JSON", e);
        // Fallback to empty profile set
        data = { profiles: [] };
    }

    return {
        profiles: data.profiles || [],
        extractedAt: new Date(),
        audioDuration: audioDuration,
        modelVersion: "gemini-3.0-pro-preview"
    };
}
