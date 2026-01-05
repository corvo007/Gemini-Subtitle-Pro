import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Write content to a temporary file.
 *
 * @param content The string content to write
 * @param extension File extension (e.g., 'json', 'txt')
 * @param useBom Whether to prepend a Byte Order Mark (BOM) for Windows compatibility (default: false)
 * @returns Object containing success status and file path or error
 */
export async function writeTempFile(
  content: string,
  extension: string,
  useBom: boolean = false
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const tempDir = app.getPath('temp');
    // Sanitized extension - remove leading dots
    const cleanExt = extension.replace(/^\.+/, '');
    const fileName = `gemini_temp_${Date.now()}_${Math.random().toString(36).slice(2)}.${cleanExt}`;
    const filePath = path.join(tempDir, fileName);

    const fileContent = useBom ? '\uFEFF' + content : content;

    await fs.promises.writeFile(filePath, fileContent, 'utf-8');
    return { success: true, path: filePath };
  } catch (error: any) {
    console.error('[FileUtils] Failed to write temp file:', error);
    return { success: false, error: error.message };
  }
}
