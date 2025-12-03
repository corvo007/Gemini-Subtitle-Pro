import { sliceAudioBuffer, mergeAudioBuffers, extractBufferSlice, audioBufferToWav } from "./processor";
import { logger } from "@/services/utils/logger";

interface AudioSample {
    startTime: number;
    endTime: number;
    duration: number;
    hasVoice: boolean;
    energyLevel: number;
}

/**
 * Intelligent audio sampling for speaker profile extraction.
 * Selects representative segments from different parts of the audio.
 * 
 * @param audioBuffer Full audio buffer
 * @param targetDuration Target total duration in seconds (default: 300s / 5min)
 * @param sampleCount Number of samples to extract (default: 8)
 * @returns Object containing the merged audio blob and its duration
 */
export async function intelligentAudioSampling(
    audioBuffer: AudioBuffer,
    targetDuration: number = 300,
    sampleCount: number = 8
): Promise<{ blob: Blob, duration: number }> {
    logger.info(`Starting intelligent audio sampling (Target: ${targetDuration}s, Count: ${sampleCount})`);

    // 1. Detect voice activity (Simulated for now, replacing with actual VAD later if needed)
    const segments = await analyzeAudioSegments(audioBuffer);

    // 2. Filter valid segments (>= 5 seconds)
    const validSegments = segments.filter(s => s.duration >= 5);

    if (validSegments.length === 0) {
        logger.warn("No valid voice segments found, falling back to uniform sampling");
        // Fallback: slice the first 'targetDuration' seconds
        const duration = Math.min(audioBuffer.duration, targetDuration);
        const blob = await sliceAudioBuffer(audioBuffer, 0, duration);
        return { blob, duration };
    }

    // 3. Select representative samples from different zones
    const selectedSamples = selectRepresentativeSamples(
        validSegments,
        audioBuffer.duration,
        sampleCount
    );

    logger.info(`Selected ${selectedSamples.length} samples for profile extraction`);

    // 4. Extract and merge segments
    const buffers: AudioBuffer[] = [];

    for (const sample of selectedSamples) {
        const sampleBuffer = extractBufferSlice(audioBuffer, sample.startTime, sample.endTime);
        buffers.push(sampleBuffer);
    }

    // Merge all buffers
    const mergedBuffer = mergeAudioBuffers(buffers, audioBuffer.sampleRate);

    // Convert final merged buffer to Blob
    return {
        blob: audioBufferToWav(mergedBuffer),
        duration: mergedBuffer.duration
    };
}

/**
 * Analyzes audio to find segments with potential voice activity.
 * Currently uses a simplified energy-based approach.
 */
async function analyzeAudioSegments(audioBuffer: AudioBuffer): Promise<AudioSample[]> {
    const segments: AudioSample[] = [];
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = sampleRate * 1; // 1 second window

    // Simple energy analysis
    for (let i = 0; i < channelData.length; i += windowSize) {
        let sum = 0;
        const end = Math.min(i + windowSize, channelData.length);
        for (let j = i; j < end; j++) {
            sum += Math.abs(channelData[j]);
        }
        const avgEnergy = sum / (end - i);

        // Threshold for "voice" (very rough heuristic)
        if (avgEnergy > 0.01) {
            segments.push({
                startTime: i / sampleRate,
                endTime: end / sampleRate,
                duration: (end - i) / sampleRate,
                hasVoice: true,
                energyLevel: avgEnergy
            });
        }
    }

    // Merge adjacent segments
    return mergeAdjacentSegments(segments);
}

function mergeAdjacentSegments(segments: AudioSample[]): AudioSample[] {
    if (segments.length === 0) return [];

    const merged: AudioSample[] = [];
    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
        const next = segments[i];
        // If adjacent (within 0.1s), merge
        if (next.startTime - current.endTime < 0.1) {
            current.endTime = next.endTime;
            current.duration += next.duration;
            current.energyLevel = (current.energyLevel + next.energyLevel) / 2;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}

function selectRepresentativeSamples(
    segments: AudioSample[],
    totalDuration: number,
    count: number
): AudioSample[] {
    const zones = [
        { start: 0, end: totalDuration * 0.2, samples: Math.ceil(count * 0.2) },      // Start 20%
        { start: totalDuration * 0.2, end: totalDuration * 0.8, samples: Math.ceil(count * 0.6) }, // Middle 60%
        { start: totalDuration * 0.8, end: totalDuration, samples: Math.ceil(count * 0.2) }       // End 20%
    ];

    const selected: AudioSample[] = [];

    zones.forEach(zone => {
        const zoneSegments = segments.filter(
            s => s.startTime >= zone.start && s.endTime <= zone.end
        );

        // Sort by energy (proxy for clarity) and pick top ones
        const sorted = zoneSegments.sort((a, b) => b.energyLevel - a.energyLevel);
        selected.push(...sorted.slice(0, zone.samples));
    });

    return selected.sort((a, b) => a.startTime - b.startTime);
}
