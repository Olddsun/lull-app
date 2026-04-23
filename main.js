const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

app.setName('Lull')

// Dev: hot reload on file change
try { require('electron-reloader')(module) } catch {}


let mainWindow
let tray
let isPlaying = false
let isAlwaysOnTop = true

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: isPlaying ? '⏸  Pause' : '▶  Play',
      click: () => {
        mainWindow.webContents.send('toggle-play')
      }
    },
    { type: 'separator' },
    {
      label: 'Show / Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: (item) => {
        isAlwaysOnTop = item.checked
        mainWindow.setAlwaysOnTop(isAlwaysOnTop)
      }
    },
    {
      label: 'Opacity',
      submenu: [
        { label: '100%', type: 'radio', checked: true, click: () => mainWindow.setOpacity(1.0) },
        { label: '90%',  type: 'radio', click: () => mainWindow.setOpacity(0.9) },
        { label: '80%',  type: 'radio', click: () => mainWindow.setOpacity(0.8) },
        { label: '70%',  type: 'radio', click: () => mainWindow.setOpacity(0.7) }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit Lull',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])
}

function updateTrayMenu() {
  tray.setContextMenu(buildTrayMenu())
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon@2x.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Lull')
  tray.setContextMenu(buildTrayMenu())

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 400,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    vibrancy: 'hud',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    roundedCorners: true
  })

  mainWindow.loadFile('index.html')

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('moved', () => {
    mainWindow.webContents.send('recalculate-size')
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.dock.setIcon(path.join(__dirname, 'dock-icon.png'))
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', (e) => {
  if (!app.isQuitting) e.preventDefault()
})

app.on('activate', () => {
  mainWindow.show()
  mainWindow.focus()
})

// 同步播放狀態給 tray 選單
ipcMain.on('play-state', (event, playing) => {
  isPlaying = playing
  updateTrayMenu()
})

ipcMain.on('close-app', () => {
  mainWindow.hide()
})

ipcMain.on('minimize-app', () => {
  mainWindow.minimize()
})

// 自訂音效：沙盒安全的檔案存取
const customSoundsDir = path.join(app.getPath('userData'), 'custom-sounds')

ipcMain.handle('get-custom-sounds-dir', () => customSoundsDir)

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    if (!fs.existsSync(customSoundsDir)) {
      fs.mkdirSync(customSoundsDir, { recursive: true })
    }
    const srcPath = result.filePaths[0]
    const originalName = path.basename(srcPath)
    const storedName = `${Date.now()}-${originalName}`
    fs.copyFileSync(srcPath, path.join(customSoundsDir, storedName))
    return { name: originalName, storedName }
  }
  return null
})

ipcMain.handle('delete-custom-sound', (event, storedName) => {
  const filePath = path.join(customSoundsDir, storedName)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
})

// IAP placeholder — 之後換成真實 inAppPurchase API
ipcMain.on('trigger-purchase', () => {
  // TODO: 串接 Apple inAppPurchase API
  // 購買成功後送 unlock-pro 回 renderer
  // mainWindow.webContents.send('unlock-pro')
})

ipcMain.on('restore-purchase', () => {
  // TODO: 串接 Apple inAppPurchase restoreCompletedTransactions
})

ipcMain.on('resize-to-content', (event, contentHeight) => {
  const [width] = mainWindow.getSize()
  mainWindow.setSize(width, contentHeight, false)
})

ipcMain.on('collapse-window', (event, contentHeight) => {
  mainWindow.collapseHeight = contentHeight
  const [width] = mainWindow.getSize()
  mainWindow.setSize(width, 40, true)
})

ipcMain.on('expand-window', () => {
  const [width] = mainWindow.getSize()
  mainWindow.setSize(width, mainWindow.collapseHeight || 400, true)
})
