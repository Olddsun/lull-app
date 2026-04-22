const ipc = window.electronAPI

// ── Pro 狀態 ──
let isPro = localStorage.getItem('lull_pro') === 'true'

function applyProState() {
  const autoLabel = document.querySelector('.auto-toggle')
  const autoBox   = document.getElementById('autoMode')
  const autoSpan  = autoLabel.querySelector('span')

  if (isPro) {
    autoLabel.classList.remove('pro-locked')
    autoBox.disabled = false
    document.querySelectorAll('.lock-badge').forEach(el => el.remove())
  } else {
    autoLabel.classList.add('pro-locked')
    autoBox.disabled = true
    addLockBadge(autoSpan)
  }
}

function addLockBadge(el) {
  if (!el || el.querySelector('.lock-badge')) return
  const badge = document.createElement('span')
  badge.className = 'lock-badge'
  badge.innerHTML = `<svg viewBox="0 0 10 12" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="5" width="7" height="6" rx="1.5"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5"/></svg>`
  el.appendChild(badge)
}

function showProSheet() {
  document.getElementById('proSheet').classList.add('visible')
}

function hideProSheet() {
  document.getElementById('proSheet').classList.remove('visible')
}

function unlockPro() {
  isPro = true
  localStorage.setItem('lull_pro', 'true')
  applyProState()
  hideProSheet()
}

// ── 自訂音效 ──
let customSounds = JSON.parse(localStorage.getItem('lull_custom_sounds') || '[]')
const customAudioElements = {}

function saveCustomSounds() {
  localStorage.setItem('lull_custom_sounds', JSON.stringify(customSounds))
}

function shortName(filePath) {
  const base = filePath.split('/').pop().split('\\').pop()
  const noExt = base.replace(/\.[^/.]+$/, '')
  return noExt.length > 8 ? noExt.slice(0, 7) + '…' : noExt
}

function createCustomSoundRow(sound) {
  const row = document.createElement('div')
  row.className = 'sound-row custom-sound-row'
  row.dataset.customId = sound.id
  row.innerHTML = `
    <span class="sound-icon">
      <svg viewBox="0 0 12 12" fill="none" stroke-width="1.4" stroke-linecap="round">
        <path d="M1 6 L2.5 3.5 L4 7.5 L5.5 4 L7 7 L8.5 5 L10 6"/>
      </svg>
    </span>
    <span class="custom-sound-name" title="${sound.name}">${shortName(sound.path)}</span>
    <div class="slider-wrap">
      <div class="slider-track-bg"></div>
      <div class="slider-fill" id="cs-${sound.id}-fill" style="width:50%"></div>
      <input type="range" class="slider" id="cs-${sound.id}-slider" min="0" max="100" value="50">
    </div>
    <span class="vol-num" id="cs-${sound.id}-vol">50</span>
    <button class="delete-sound-btn" title="Remove" data-id="${sound.id}">✕</button>
  `

  // 建立 Audio
  const audio = new Audio()
  audio.src = sound.path
  audio.loop = true
  audio.volume = 0.5
  customAudioElements[sound.id] = audio

  // 滑桿事件
  const slider = row.querySelector(`#cs-${sound.id}-slider`)
  const volNum = row.querySelector(`#cs-${sound.id}-vol`)
  const fill   = row.querySelector(`#cs-${sound.id}-fill`)
  slider.addEventListener('input', () => {
    const val = parseInt(slider.value)
    volNum.textContent = val
    fill.style.width = val + '%'
    audio.volume = val / 100
    if (isPlaying && val > 0) audio.play().catch(() => {})
    else if (val === 0) audio.pause()
  })

  // 刪除按鈕
  row.querySelector('.delete-sound-btn').addEventListener('click', () => {
    removeCustomSound(sound.id)
  })

  return row
}

function renderCustomSounds() {
  const list   = document.getElementById('mySoundsList')
  const empty  = document.getElementById('emptySounds')
  // 清除舊的 rows（保留 empty state）
  list.querySelectorAll('.custom-sound-row').forEach(el => el.remove())

  if (customSounds.length === 0) {
    empty.style.display = 'block'
  } else {
    empty.style.display = 'none'
    customSounds.forEach(sound => {
      list.appendChild(createCustomSoundRow(sound))
    })
  }
  // 重新計算視窗高度
  setTimeout(() => ipc.send('resize-to-content', document.body.scrollHeight), 0)
}

function addCustomSound(filePath) {
  const id = Date.now().toString()
  const name = filePath.split('/').pop().split('\\').pop()
  customSounds.push({ id, name, path: filePath })
  saveCustomSounds()
  renderCustomSounds()
}

function removeCustomSound(id) {
  if (customAudioElements[id]) {
    customAudioElements[id].pause()
    delete customAudioElements[id]
  }
  customSounds = customSounds.filter(s => s.id !== id)
  saveCustomSounds()
  renderCustomSounds()
}

function applyProStateMysounds() {
  const section = document.getElementById('mySoundsSection')
  const addBtn  = document.getElementById('addSoundBtn')
  const label   = document.getElementById('mySoundsLabel')
  if (isPro) {
    section.classList.remove('pro-locked')
    addBtn.disabled = false
    document.querySelectorAll('#mySoundsLabel .lock-badge').forEach(el => el.remove())
  } else {
    section.classList.add('pro-locked')
    addBtn.disabled = true
    addLockBadge(label)
  }
}

// ── 音效設定
const soundConfig = {
  rain:  { file: 'rain.mp3',   defaultVol: 0.6 },
  wind:  { file: 'wind.mp3',   defaultVol: 0.3 },
  birds: { file: 'bird.mp3',   defaultVol: 0.2 },
  fire:  { file: 'fire.mp3',   defaultVol: 0.0 },
  waves: { file: 'ocean.mp3',  defaultVol: 0.1 },
  cafe:  { file: 'coffee.mp3', defaultVol: 0.0 }
}

// 預設場景
const presets = {
  forest: { rain: 20, wind: 40, birds: 70, fire: 0,  waves: 0,  cafe: 0  },
  rain:   { rain: 80, wind: 30, birds: 0,  fire: 0,  waves: 0,  cafe: 0  },
  cafe:   { rain: 0,  wind: 0,  birds: 0,  fire: 0,  waves: 0,  cafe: 80 },
  beach:  { rain: 0,  wind: 50, birds: 30, fire: 0,  waves: 80, cafe: 0  }
}

const audioElements = {}
let isPlaying = false
let autoModeInterval = null

// 初始化音效
function initAudio() {
  for (const [key, config] of Object.entries(soundConfig)) {
    const audio = new Audio()
    audio.src = `sounds/${config.file}`
    audio.loop = true
    audio.volume = config.defaultVol
    audioElements[key] = audio
  }
}

// 播放/暫停
function togglePlay() {
  isPlaying = !isPlaying
  ipc.send('play-state', isPlaying)
  const btn = document.getElementById('playBtn')

  const label = document.getElementById('playLabel')
  if (isPlaying) {
    for (const [key, audio] of Object.entries(audioElements)) {
      const vol = getSliderValue(key)
      if (vol > 0) {
        audio.volume = vol / 100
        audio.play().catch(() => {})
      }
    }
    for (const [id, audio] of Object.entries(customAudioElements)) {
      const slider = document.getElementById(`cs-${id}-slider`)
      const vol = slider ? parseInt(slider.value) : 0
      if (vol > 0) {
        audio.volume = vol / 100
        audio.play().catch(() => {})
      }
    }
    btn.textContent = '⏸'
    btn.classList.add('playing')
    if (label) label.textContent = 'Playing'
  } else {
    for (const audio of Object.values(audioElements)) {
      audio.pause()
    }
    for (const audio of Object.values(customAudioElements)) {
      audio.pause()
    }
    btn.textContent = '▶'
    btn.classList.remove('playing')
    if (label) label.textContent = 'Play'
  }
}

// 取得滑桿數值
function getSliderValue(key) {
  const slider = document.getElementById(`${key}-slider`)
  return slider ? parseInt(slider.value) : 0
}

// 設定音量（含滑桿 UI 更新）
function setVolume(key, value) {
  value = Math.max(0, Math.min(100, Math.round(value)))
  const slider = document.getElementById(`${key}-slider`)
  const volNum = document.getElementById(`${key}-vol`)
  if (slider) slider.value = value
  if (volNum) volNum.textContent = value
  const fill = document.getElementById(`${key}-fill`)
  if (fill) fill.style.width = value + '%'

  if (audioElements[key]) {
    audioElements[key].volume = value / 100
    if (isPlaying && value > 0) {
      audioElements[key].play().catch(() => {})
    } else if (value === 0) {
      audioElements[key].pause()
    }
  }
}

// 套用預設場景
function applyPreset(presetName) {
  const preset = presets[presetName]
  if (!preset) return

  for (const [key, value] of Object.entries(preset)) {
    setVolume(key, value)
  }

  document.querySelectorAll('.preset').forEach(btn => btn.classList.remove('active'))
  document.querySelector(`[data-preset="${presetName}"]`)?.classList.add('active')
}

// 自動調整模式：每 8 秒緩慢隨機調整各聲音
function startAutoMode() {
  autoModeInterval = setInterval(() => {
    const sounds = Object.keys(soundConfig)
    const target = sounds[Math.floor(Math.random() * sounds.length)]
    const current = getSliderValue(target)
    const delta = (Math.random() - 0.5) * 30
    setVolume(target, current + delta)
  }, 8000)
}

function stopAutoMode() {
  if (autoModeInterval) {
    clearInterval(autoModeInterval)
    autoModeInterval = null
  }
}

// 初始化事件
document.addEventListener('DOMContentLoaded', () => {
  initAudio()

  // 自動調整視窗高度配合內容（等 layout 完全渲染後再量）
  function sendResize() {
    const totalHeight = document.body.scrollHeight
    ipc.send('resize-to-content', totalHeight)
  }
  setTimeout(sendResize, 0)

  // 移到不同螢幕時重新計算高度
  ipc.on('recalculate-size', sendResize)

  // 播放按鈕
  document.getElementById('playBtn').addEventListener('click', togglePlay)

  // 接收 tray 的播放/暫停指令
  ipc.on('toggle-play', () => togglePlay())

  // 關閉 / 最小化 / 縮小
  document.getElementById('closeBtn').addEventListener('click', () => {
    ipc.send('close-app')
  })
  document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipc.send('minimize-app')
  })

  let isCollapsed = false
  const fullHeight = document.body.scrollHeight
  document.getElementById('collapseBtn').addEventListener('click', () => {
    isCollapsed = !isCollapsed
    const btn = document.getElementById('collapseBtn')
    const container = document.querySelector('.container')
    if (isCollapsed) {
      container.style.display = 'none'
      btn.textContent = '▼'
      ipc.send('collapse-window', fullHeight)
    } else {
      container.style.display = 'block'
      btn.textContent = '▲'
      ipc.send('expand-window')
    }
  })

  // 滑桿即時更新
  for (const key of Object.keys(soundConfig)) {
    const slider = document.getElementById(`${key}-slider`)
    const volNum = document.getElementById(`${key}-vol`)
    if (slider) {
      slider.addEventListener('input', () => {
        const val = parseInt(slider.value)
        if (volNum) volNum.textContent = val
        const fill = document.getElementById(`${key}-fill`)
        if (fill) fill.style.width = val + '%'
        if (audioElements[key]) {
          audioElements[key].volume = val / 100
          if (isPlaying && val > 0) {
            audioElements[key].play().catch(() => {})
          } else if (val === 0) {
            audioElements[key].pause()
          }
        }
      })
    }
  }

  // 預設場景按鈕
  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset)
    })
  })

  // 自動模式
  document.getElementById('autoMode').addEventListener('change', (e) => {
    if (e.target.checked) {
      startAutoMode()
    } else {
      stopAutoMode()
    }
  })

  // Pro 狀態初始化
  applyProState()
  applyProStateMysounds()
  renderCustomSounds()

  // 鎖定功能點擊 → 顯示 Pro sheet
  document.querySelector('.auto-toggle').addEventListener('click', (e) => {
    if (!isPro) {
      e.preventDefault()
      showProSheet()
    }
  })


  // Pro sheet 按鈕
  document.getElementById('proSheetClose').addEventListener('click', hideProSheet)

  document.getElementById('proBuyBtn').addEventListener('click', () => {
    ipc.send('trigger-purchase')
  })

  document.getElementById('proRestoreBtn').addEventListener('click', () => {
    ipc.send('restore-purchase')
  })

  // 購買成功（main.js 觸發）
  ipc.on('unlock-pro', () => {
    unlockPro()
    applyProStateMysounds()
  })

  // My Sounds — 匯入按鈕
  document.getElementById('addSoundBtn').addEventListener('click', async () => {
    if (!isPro) { showProSheet(); return }
    const filePath = await ipc.invoke('open-file-dialog')
    if (filePath) addCustomSound(filePath)
  })

  // My Sounds — 鎖定點擊
  document.getElementById('mySoundsSection').addEventListener('click', (e) => {
    if (!isPro) showProSheet()
  })
})
