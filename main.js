const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function resolveDataFilePath() {
  let baseDir;
  if (app.isPackaged) {
    const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
    baseDir = path.join(exeDir, 'LocalNotes-Data');
  } else {
    baseDir = path.join(__dirname, 'data');
  }

  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.accessSync(baseDir, fs.constants.W_OK);
  } catch {
    baseDir = app.getPath('userData');
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return path.join(baseDir, 'notes-data.json');
}

function createInitialData() {
  const now = Date.now();
  return {
    version: 1,
    theme: 'light',
    selectedCategoryId: 'cat_work',
    selectedProjectId: 'proj_daily',
    categories: [
      {
        id: 'cat_work',
        name: '工作',
        projects: [
          {
            id: 'proj_daily',
            name: '每日待办',
            entries: [
              {
                id: 'entry_1',
                text: '双击任意条目即可直接编辑纯文本内容。\n按 Ctrl+Enter 或点击空白处自动保存，Esc 取消本次修改。',
                updatedAt: now
              },
              {
                id: 'entry_2',
                text: '支持拖拽排序：按住左侧拖拽把手即可调整分类、项目或条目的顺序。',
                updatedAt: now
              },
              {
                id: 'entry_3',
                text: '按下 Ctrl+F 可随时唤起全局快速搜索框，跨分类检索所有内容并一键跳转。',
                updatedAt: now
              }
            ]
          },
          {
            id: 'proj_memo',
            name: '长期备忘',
            entries: [
              {
                id: 'entry_memo_1',
                text: '只放一条记录就是一对一，继续点击右上角“新增条目”就是一对多。\n\n双击这里即可开始编辑。',
                updatedAt: now
              }
            ]
          }
        ]
      },
      {
        id: 'cat_life',
        name: '生活随笔',
        projects: [
          {
            id: 'proj_ideas',
            name: '灵感记录',
            entries: [
              {
                id: 'entry_life_1',
                text: '周末整理书桌与电子文档。',
                updatedAt: now
              }
            ]
          }
        ]
      }
    ]
  };
}

function loadNotesData() {
  const filePath = resolveDataFilePath();
  if (!fs.existsSync(filePath)) {
    const initial = createInitialData();
    saveNotesData(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid data structure');
    }
    return parsed;
  } catch {
    const backupPath = `${filePath}.corrupted-${Date.now()}.bak`;
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch {
      // ignore backup failure
    }
    const initial = createInitialData();
    saveNotesData(initial);
    return initial;
  }
}

function saveNotesData(data) {
  const filePath = resolveDataFilePath();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 740,
    minWidth: 800,
    minHeight: 520,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#f6f7f9',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f6f7f9',
      symbolColor: '#374151',
      height: 44
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('notes:load', () => loadNotesData());
  ipcMain.handle('notes:save', (_event, data) => saveNotesData(data));
  ipcMain.handle('notes:getDataPath', () => resolveDataFilePath());

  ipcMain.handle('notes:setTitleBarTheme', (_event, theme) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (theme === 'dark') {
      mainWindow.setTitleBarOverlay({
        color: '#181a1f',
        symbolColor: '#d1d5db',
        height: 44
      });
    } else {
      mainWindow.setTitleBarOverlay({
        color: '#f6f7f9',
        symbolColor: '#374151',
        height: 44
      });
    }
  });

  ipcMain.handle('notes:export', async (_event, data) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出记事本备份',
      defaultPath: `LocalNotes-备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('notes:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入记事本备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) {
      throw new Error('备份文件格式不正确');
    }
    saveNotesData(parsed);
    return { canceled: false, data: parsed };
  });

  ipcMain.handle('notes:getFileInfo', (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return { exists: false };
    const parsed = path.parse(filePath);
    const baseInfo = {
      path: filePath,
      name: parsed.base || path.basename(filePath),
      ext: (parsed.ext || '').replace(/^\./, '').toUpperCase() || 'FILE',
      drive: parsed.root || '',
      dir: parsed.dir || path.dirname(filePath)
    };
    try {
      const stat = fs.statSync(filePath);
      return {
        ...baseInfo,
        exists: stat.isFile(),
        size: stat.size,
        mtime: stat.mtimeMs
      };
    } catch {
      return {
        ...baseInfo,
        exists: false,
        size: 0,
        mtime: 0
      };
    }
  });

  ipcMain.handle('notes:copyFileToClipboard', (_event, filePath) => {
    return new Promise((resolve) => {
      if (!filePath || !fs.existsSync(filePath)) {
        resolve({ ok: false, error: '原位置找不到该文件，可能已被移动或删除' });
        return;
      }
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        '$col = New-Object System.Collections.Specialized.StringCollection;',
        '[void]$col.Add($env:COPY_FILE_PATH);',
        '[System.Windows.Forms.Clipboard]::SetFileDropList($col)'
      ].join(' ');
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Sta', '-WindowStyle', 'Hidden', '-Command', psScript],
        { env: { ...process.env, COPY_FILE_PATH: filePath }, windowsHide: true },
        (err) => {
          if (err) {
            resolve({ ok: false, error: '复制到剪贴板失败' });
          } else {
            resolve({ ok: true });
          }
        }
      );
    });
  });

  ipcMain.handle('notes:showFileInFolder', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return { ok: false };
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { ok: true };
    }
    const parentDir = path.dirname(filePath);
    if (parentDir && fs.existsSync(parentDir)) {
      await shell.openPath(parentDir);
      return { ok: true };
    }
    return { ok: false, error: '原路径与所在目录均不存在' };
  });

  ipcMain.handle('notes:pickFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择要关联的文件（保持原路径）',
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || !result.filePaths.length) {
      return [];
    }
    return result.filePaths;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
