const { contextBridge, ipcRenderer } = require('electron')

const SEND_CHANNELS = ['play-state', 'resize-to-content', 'close-app', 'minimize-app', 'collapse-window', 'expand-window', 'trigger-purchase', 'restore-purchase']
const RECEIVE_CHANNELS = ['recalculate-size', 'toggle-play', 'unlock-pro']

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    if (SEND_CHANNELS.includes(channel)) ipcRenderer.send(channel, ...args)
  },
  on: (channel, callback) => {
    if (RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  invoke: (channel, ...args) => {
    const INVOKE_CHANNELS = ['open-file-dialog']
    if (INVOKE_CHANNELS.includes(channel)) return ipcRenderer.invoke(channel, ...args)
  }
})
