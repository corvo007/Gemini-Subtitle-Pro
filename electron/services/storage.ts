import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const SETTINGS_FILE = 'settings.json';

export class StorageService {
    private filePath: string;

    constructor() {
        this.filePath = path.join(app.getPath('userData'), SETTINGS_FILE);
    }

    async saveSettings(data: any): Promise<boolean> {
        try {
            await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    async readSettings(): Promise<any | null> {
        try {
            if (!fs.existsSync(this.filePath)) {
                return null;
            }
            const data = await fs.promises.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Failed to read settings:', error);
            return null;
        }
    }
}

export const storageService = new StorageService();
