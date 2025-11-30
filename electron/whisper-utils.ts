import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';

// Error messages mapping
export const ERROR_MESSAGES: Record<string, string> = {
    'ENOENT': '模型文件未找到，请重新选择有效的 .bin 文件',
    'EACCES': '无权限访问模型文件或执行 whisper-server',
    'EADDRINUSE': '端口已被占用，正在尝试其他端口...',
    'ETIMEDOUT': '服务器启动超时，请检查系统资源',
    'INVALID_MODEL': '模型文件格式不正确，请下载 GGML 格式的 .bin 文件',
    'SERVER_CRASHED': '服务器异常退出，请检查模型文件完整性',
    'BINARY_NOT_FOUND': 'whisper-server 可执行文件未找到，请重新安装应用',
    'CONNECTION_REFUSED': '无法连接到 Whisper 服务器，请稍后重试'
};

// Port detection
export function checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

// Find available port
export async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number | null> {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        const available = await checkPortAvailable(port);
        if (available) return port;
    }
    return null;
}

// Health check
export async function checkServerHealth(port: number, timeout: number = 3000): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Validate model file
export function validateModelFile(filePath: string): { valid: boolean; error?: string } {
    // Check existence
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'ENOENT' };
    }

    // Check extension
    if (!filePath.endsWith('.bin')) {
        return { valid: false, error: 'INVALID_MODEL' };
    }

    // Check size (at least 50MB)
    try {
        const stats = fs.statSync(filePath);
        if (stats.size < 50 * 1024 * 1024) {
            return { valid: false, error: 'INVALID_MODEL' };
        }
    } catch (error) {
        return { valid: false, error: 'EACCES' };
    }

    return { valid: true };
}
