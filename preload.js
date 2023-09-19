const { contextBridge, ipcRenderer } = require('electron');
const path = require('path')
contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
})

contextBridge.exposeInMainWorld('path', {
    dirname: (...args) => path.dirname(...args),
    basename: (...args) => path.basename(...args),
    resolve: (...args) => path.resolve(...args)
})

contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateTable: (callback) => ipcRenderer.on('table', callback),
    statistics: (callback) => ipcRenderer.on('statistics', callback),
    Progress: (callback) => ipcRenderer.on('Progress', callback),
    patterns: (callback) => ipcRenderer.on('patterns', callback),
})
contextBridge.exposeInMainWorld('electron', {
    openDialog: () => ipcRenderer.invoke('dialog')
  });