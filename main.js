const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, inAppPurchase } = require('electron')
const path = require('path')
const fs = require('fs')

app.setName('Drzzl')

// Dev: hot reload on file change
try { require('electron-reloader')(module) } catch {}

// ── IAP ──────────────────────────────────────────────
const PRODUCT_ID = 'com.olddsun.drzzl.pro'

// 在 MAS 環境下，啟動時就開始監聽交易更新
// process.mas 只在 Mac App Store 建置時為 true
if (process.mas) {
  inAppPurchase.on('transactions-updated', (_event, transactions) => {
    for (const t of transactions) {
      switch (t.transactionState) {
        case 'purchasing':
          // 購買進行中，等待
          break

        case 'purchased':
        case 'restored':
          // 購買成功或恢復 → 解鎖 Pro
          if (mainWindow) mainWindow.webContents.send('unlock-pro')
          inAppPurchase.finishAllTransactions()
          break

        case 'failed':
          // 取消或失敗 → 結束交易，不做任何事
          inAppPurchase.finishAllTransactions()
          break

        case 'deferred':
          // 等待家長核准，暫不處理
          break
      }
    }
  })
}


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
      label: 'Quit Drzzl',
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
  tray.setToolTip('Drzzl')
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

// IAP：觸發購買
ipcMain.on('trigger-purchase', async () => {
  // 非 MAS 建置（開發模式）不處理
  if (!process.mas) return
  if (!inAppPurchase.canMakePayments()) return

  try {
    const products = await inAppPurchase.getProducts([PRODUCT_ID])
    if (!products || products.length === 0) {
      console.error('[IAP] Product not found:', PRODUCT_ID)
      return
    }
    // 發起購買，結果透過 transactions-updated 事件回傳
    await inAppPurchase.purchaseProduct(PRODUCT_ID, 1)
  } catch (err) {
    console.error('[IAP] Purchase error:', err)
  }
})

// IAP：恢復購買（使用者重裝 app 時使用）
ipcMain.on('restore-purchase', () => {
  if (!process.mas) return
  if (inAppPurchase.canMakePayments()) {
    // 恢復結果同樣透過 transactions-updated 事件回傳
    inAppPurchase.restoreCompletedTransactions()
  }
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
