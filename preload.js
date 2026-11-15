const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('notesApi', {
  load: () => ipcRenderer.invoke('notes:load'),
  save: (data) => ipcRenderer.invoke('notes:save', data),
  getDataPath: () => ipcRenderer.invoke('notes:getDataPath'),
  setTitleBarTheme: (theme) => ipcRenderer.invoke('notes:setTitleBarTheme', theme),
  exportData: (data) => ipcRenderer.invoke('notes:export', data),
  importData: () => ipcRenderer.invoke('notes:import'),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || file.path || '';
    } catch {
      return file?.path || '';
    }
  },
  getFileInfo: (filePath) => ipcRenderer.invoke('notes:getFileInfo', filePath),
  copyFileToClipboard: (filePath) => ipcRenderer.invoke('notes:copyFileToClipboard', filePath),
  showFileInFolder: (filePath) => ipcRenderer.invoke('notes:showFileInFolder', filePath),
  pickFiles: () => ipcRenderer.invoke('notes:pickFiles')
});
