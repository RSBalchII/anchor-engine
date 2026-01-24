
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

// Config
const FRONTEND_URL = 'http://localhost:3000';
let mainWindow: BrowserWindow | null = null;
let engineProcess: ChildProcess | null = null;

function log(msg: string) {
    console.log(`[Electron] ${msg}`);
}

function startEngine() {
    log('Starting Sovereign Context Engine...');

    // Resolve paths relative to built main.js (in dist/)
    // desktop-overlay/dist/main.js -> desktop-overlay/ -> ECE_Core/
    const rootDir = path.resolve(__dirname, '../../');
    const engineScript = path.join(rootDir, 'engine/dist/index.js');

    // Spawn Node process
    engineProcess = spawn('node', [engineScript], {
        cwd: rootDir,
        stdio: 'pipe',
        env: { ...process.env, FORCE_COLOR: '1' } // Preserve colors
    });

    engineProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        process.stdout.write(`[Engine] ${str}`);

        // Check for startup success
        if (str.includes('Health check available')) {
            log('Engine is ready. Loading UI...');
            if (mainWindow) mainWindow.loadURL(FRONTEND_URL);
        }
    });

    engineProcess.stderr?.on('data', (data) => {
        process.stderr.write(`[Engine ERR] ${data.toString()}`);
    });

    engineProcess.on('close', (code) => {
        log(`Engine process exited with code ${code}`);
        engineProcess = null;
        if (code !== 0) {
            // Maybe show error dialog?
        }
    });
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: 1400, // Wider for Search/Chat
        height: 900,
        x: width - 1450,
        y: 50,
        frame: false, // Keep overlay style? Or standard window? User said "overlay".
        // Let's keep it semi-transparent/overlay style but bigger
        alwaysOnTop: false, // Don't force on top if it's the main interface now
        transparent: true,
        backgroundColor: '#00000000', // Transparent bg
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    // IPC Handlers for Title Bar
    ipcMain.on('window-minimize', () => mainWindow?.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.on('window-close', () => mainWindow?.close());

    // Instead of immediate load, we wait for Engine
    // But if Engine is already running (dev mode), we might want to try loading
    // Simple check:
    checkHealth().then(alive => {
        if (alive) {
            log('Engine already running. Connecting...');
            mainWindow?.loadURL(FRONTEND_URL);
        } else {
            startEngine();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function checkHealth(): Promise<boolean> {
    return new Promise(resolve => {
        const req = http.get(`${FRONTEND_URL}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

app.on('ready', createWindow);

app.on('will-quit', () => {
    if (engineProcess) {
        log('Killing Engine process...');
        engineProcess.kill();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
