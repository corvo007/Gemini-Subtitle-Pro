import { SubtitleItem } from './subtitle';

export interface WorkspaceHistory {
  id: string;
  filePath: string;
  fileName: string;
  subtitles: SubtitleItem[];
  savedAt: string;
}
