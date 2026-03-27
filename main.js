const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron')
const path = require('path')
const https = require('https')

app.setName('Lull')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

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
      nodeIntegration: true,
      contextIsolation: false
    },
    vibrancy: 'hud',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    roundedCorners: true
  })

  mainWindow.loadFile('index.html')
  mainWindow.setVisibleOnAllWorkspaces(true)

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

function checkForUpdates() {
  const options = {
    hostname: 'api.github.com',
    path: '/repos/Olddsun/lull-app/releases/latest',
    headers: { 'User-Agent': 'Lull-App' }
  }
  https.get(options, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      try {
        const latest = JSON.parse(data).tag_name.replace(/^v/, '')
        const current = app.getVersion()
        if (latest !== current) {
          dialog.showMessageBox({
            type: 'info',
            title: 'Lull 有新版本',
            message: `新版本 v${latest} 已發布（目前 v${current}）`,
            detail: '點擊「下載」前往 GitHub 下載最新版本。',
            buttons: ['下載', '稍後']
          }).then(({ response }) => {
            if (response === 0) shell.openExternal('https://github.com/Olddsun/lull-app/releases/latest')
          })
        }
      } catch (_) {}
    })
  }).on('error', () => {})
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.dock.setIcon(path.join(__dirname, 'dock-icon.png'))

  checkForUpdates()
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
