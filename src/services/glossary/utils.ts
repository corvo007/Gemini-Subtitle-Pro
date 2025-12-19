import { AppSettings } from '@/types/settings';
import { GlossaryItem } from '@/types/glossary';

/**
 * Get terms from the active glossary
 * This is the canonical way to get glossary terms from settings
 */
export function getActiveGlossaryTerms(settings: AppSettings): GlossaryItem[] {
  if (!settings.glossaries || !settings.activeGlossaryId) {
    return [];
  }

  const activeGlossary = settings.glossaries.find((g) => g.id === settings.activeGlossaryId);
  return activeGlossary?.terms || [];
}

/**
 * Get the active glossary object
 */
export function getActiveGlossary(settings: AppSettings) {
  if (!settings.glossaries || !settings.activeGlossaryId) {
    return null;
  }

  return settings.glossaries.find((g) => g.id === settings.activeGlossaryId) || null;
}
