const { contextBridge, ipcRenderer } = require('electron')

const SEND_CHANNELS = ['play-state', 'resize-to-content', 'close-app', 'minimize-app', 'collapse-window', 'expand-window']
const RECEIVE_CHANNELS = ['recalculate-size', 'toggle-play']

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    if (SEND_CHANNELS.includes(channel)) ipcRenderer.send(channel, ...args)
  },
  on: (channel, callback) => {
    if (RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  }
})
