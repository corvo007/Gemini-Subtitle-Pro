import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import squirrelStartup from 'electron-squirrel-startup';
import fs from 'fs';
import {
    extractAudioFromVideo,
    readAudioBuffer,
    cleanupTempAudio,
    getAudioInfo
} from './services/ffmpegAudioExtractor.ts';
import type {
    AudioExtractionOptions,
    AudioExtractionProgress
} from './services/ffmpegAudioExtractor.ts';
import { spawn, ChildProcess } from 'child_process';
import {
    findAvailablePort,
    checkServerHealth,
    validateModelFile,
    ERROR_MESSAGES
} from './whisper-utils.ts';
import { storageService } from './services/storage.ts';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
    app.quit();
}

// Global state for Whisper Server
let whisperServerProcess: ChildProcess | null = null;
let serverStatus: 'stopped' | 'running' | 'error' = 'stopped';
let currentPort: number | null = null;
let restartAttempts: number = 0;
const MAX_RESTART_ATTEMPTS = 3;
const DEFAULT_PORT = 8080;

// Start Whisper Server
function startWhisperServer(modelPath: string): Promise<any> {
    return new Promise(async (resolve) => {
        // 1. Validate model file
        const validation = validateModelFile(modelPath);
        if (!validation.valid) {
            serverStatus = 'error';
            resolve({ status: 'error', message: ERROR_MESSAGES[validation.error || 'ENOENT'] });
            return;
        }

        // 2. Find binary
        // 2. Find binary
        const binaryName = process.platform === 'win32' ? 'whisper-server.exe' : 'whisper-server';

        // Check multiple locations:
        // 1. Standard resources path (Installer version)
        // 2. Executable directory (Portable version)
        const possiblePaths = [
            path.join(process.resourcesPath || app.getAppPath(), binaryName),
            path.join(path.dirname(app.getPath('exe')), binaryName),
            path.join(path.dirname(app.getPath('exe')), 'resources', binaryName)
        ];

        let binaryPath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                binaryPath = p;
                break;
            }
        }

        if (!binaryPath) {
            serverStatus = 'error';
            resolve({ status: 'error', message: ERROR_MESSAGES['BINARY_NOT_FOUND'] });
            return;
        }

        // 3. Find available port
        const availablePort = await findAvailablePort(DEFAULT_PORT);
        if (!availablePort) {
            serverStatus = 'error';
            resolve({ status: 'error', message: '无法找到可用端口' });
            return;
        }
        currentPort = availablePort;

        // 4. Start process
        try {
            whisperServerProcess = spawn(binaryPath, [
                '-m', modelPath,
                '-p', currentPort.toString(),
                '--convert',
                '-t', '4'
            ]);

            whisperServerProcess.on('error', (error: any) => {
                console.error('Whisper Server Error:', error);
                serverStatus = 'error';
            });

            whisperServerProcess.on('exit', (code) => {
                if (serverStatus === 'running' && code !== 0 && restartAttempts < MAX_RESTART_ATTEMPTS) {
                    restartAttempts++;
                    setTimeout(() => startWhisperServer(modelPath), 2000);
                }
            });

            whisperServerProcess.stdout?.on('data', (data) => console.log(`Whisper: ${data}`));
            whisperServerProcess.stderr?.on('data', (data) => console.error(`Whisper Error: ${data}`));
        } catch (error: any) {
            serverStatus = 'error';
            resolve({ status: 'error', message: '启动失败' });
            return;
        }

        // 5. Health check
        let attempts = 0;
        const checkInterval = setInterval(async () => {
            attempts++;
            const healthy = await checkServerHealth(currentPort!);

            if (healthy) {
                clearInterval(checkInterval);
                serverStatus = 'running';
                restartAttempts = 0;
                resolve({ status: 'running', port: currentPort });
            } else if (attempts >= 10) {
                clearInterval(checkInterval);
                stopWhisperServer();
                serverStatus = 'error';
                resolve({ status: 'error', message: ERROR_MESSAGES['ETIMEDOUT'] });
            }
        }, 500);
    });
}

// Stop Whisper Server
function stopWhisperServer(): void {
    if (whisperServerProcess) {
        whisperServerProcess.kill();
        whisperServerProcess = null;
        serverStatus = 'stopped';
        currentPort = null;
        restartAttempts = 0;
    }
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../resources/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, path.basename(__dirname) === 'dist-electron' ? 'preload.cjs' : '../dist-electron/preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // In production, load the index.html of the app.
    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        // In development, load the URL of the dev server.
        mainWindow.loadURL('http://localhost:3000');

        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    }
};

const createMenu = () => {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: '文件',
            submenu: [
                {
                    label: '退出',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: '窗口',
            submenu: [
                { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
                { label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close' }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        dialog.showMessageBox({
                            title: '关于',
                            message: 'Gemini Subtitle Pro',
                            detail: '智能字幕生成与翻译工具'
                        });
                    }
                }
            ]
        }
    ];

    // 在开发模式下添加开发者工具菜单
    if (!app.isPackaged) {
        template.push({
            label: '开发',
            submenu: [
                { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                { type: 'separator' },
                { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createMenu();
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC Handler: Read audio file
ipcMain.handle('read-audio-file', async (_event, filePath: string) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer.buffer;
    } catch (error) {
        console.error('Failed to read audio file:', error);
        throw error;
    }
});

// IPC Handler: Save subtitle with system dialog
ipcMain.handle('save-subtitle-dialog', async (_event, defaultName: string, content: string, format: string) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            title: '保存字幕文件',
            defaultPath: defaultName,
            filters: [
                { name: format.toUpperCase(), extensions: [format] },
                { name: '所有文件', extensions: ['*'] }
            ]
        });

        if (filePath) {
            // Add BOM for UTF-8 and normalize line endings for Windows
            const windowsContent = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
            const bom = '\uFEFF';
            await fs.promises.writeFile(filePath, bom + windowsContent, 'utf-8');
            return { success: true, path: filePath };
        }
        return { success: false };
    } catch (error) {
        console.error('Failed to save subtitle:', error);
        throw error;
    }
});

// IPC Handler: Select Whisper Model
ipcMain.handle('select-whisper-model', async () => {
    const result = await dialog.showOpenDialog({
        title: '选择 Whisper 模型文件',
        message: '请选择 GGML 格式的 .bin 模型文件',
        filters: [
            { name: 'Whisper 模型', extensions: ['bin'] },
            { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const validation = validateModelFile(result.filePaths[0]);
        if (!validation.valid) {
            dialog.showErrorBox(
                '无效的模型文件',
                ERROR_MESSAGES[validation.error || 'INVALID_MODEL']
            );
            return null;
        }
        return result.filePaths[0];
    }
    return null;
});

// IPC Handler: Update Whisper Config
ipcMain.handle('update-whisper-config', async (_, config: { enabled: boolean, modelPath: string }) => {
    stopWhisperServer();

    if (config.enabled && config.modelPath) {
        return await startWhisperServer(config.modelPath);
    } else {
        return { status: 'stopped' };
    }
});

// IPC Handler: Get Whisper Status
ipcMain.handle('get-whisper-status', () => {
    return {
        status: serverStatus,
        port: currentPort || undefined
    };
});

// Cleanup on quit
app.on('before-quit', () => {
    stopWhisperServer();
});

// IPC Handler: 提取音频（带进度回调）
ipcMain.handle(
    'extract-audio-ffmpeg',
    async (event, videoPath: string, options: AudioExtractionOptions) => {
        try {
            const audioPath = await extractAudioFromVideo(
                videoPath,
                options,
                (progress: AudioExtractionProgress) => {
                    // 向渲染进程发送进度更新
                    event.sender.send('audio-extraction-progress', progress);
                }
            );
            return { success: true, audioPath };
        } catch (error: any) {
            console.error('FFmpeg audio extraction failed:', error);
            return { success: false, error: error.message };
        }
    }
);

// IPC Handler: 读取提取的音频文件
ipcMain.handle('read-extracted-audio', async (_event, audioPath: string) => {
    try {
        const buffer = await readAudioBuffer(audioPath);
        return buffer.buffer;
    } catch (error) {
        console.error('Failed to read extracted audio:', error);
        throw error;
    }
});

// IPC Handler: 清理临时音频文件
ipcMain.handle('cleanup-temp-audio', async (_event, audioPath: string) => {
    await cleanupTempAudio(audioPath);
});

// IPC Handler: Get Audio Info
ipcMain.handle('get-audio-info', async (_event, videoPath: string) => {
    try {
        const info = await getAudioInfo(videoPath);
        return { success: true, info };
    } catch (error: any) {
        console.error('Failed to get audio info:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler: Storage
ipcMain.handle('storage-get', async () => {
    return await storageService.readSettings();
});

ipcMain.handle('storage-set', async (_event, data: any) => {
    return await storageService.saveSettings(data);
});

