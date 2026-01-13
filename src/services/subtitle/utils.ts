/**
 * Sanitizes a speaker name for use in ASS style names.
 * ASS style names should only contain alphanumeric, underscore, and safe Unicode chars.
 * This function MUST be used consistently in:
 * - Style definition (generator.ts)
 * - Dialogue event style reference (generator.ts)
 * - Color import mapping (parser.ts, useFileOperations.ts)
 */
export const sanitizeSpeakerForStyle = (speaker: string): string => {
  return speaker
    .replace(/[\s,;:[\](){}\\/&]+/g, '_') // Replace whitespace and special chars with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
};
