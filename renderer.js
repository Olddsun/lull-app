const { ipcRenderer } = require('electron')
const path = require('path')

// 音效設定
const soundConfig = {
  rain:  { file: 'rain.mp3',   defaultVol: 0.6 },
  wind:  { file: 'wind.mp3',   defaultVol: 0.3 },
  birds: { file: 'bird.mp3',   defaultVol: 0.2 },
  fire:  { file: 'fire.mp3',   defaultVol: 0.0 },
  waves: { file: 'ocean.mp3',  defaultVol: 0.3 },
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
    audio.src = path.join(__dirname, 'sounds', config.file)
    audio.loop = true
    audio.volume = config.defaultVol
    audioElements[key] = audio
  }
}

// 播放/暫停
function togglePlay() {
  isPlaying = !isPlaying
  ipcRenderer.send('play-state', isPlaying)
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
    btn.textContent = '⏸'
    btn.classList.add('playing')
    if (label) label.textContent = 'Playing'
  } else {
    for (const audio of Object.values(audioElements)) {
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
    ipcRenderer.send('resize-to-content', totalHeight)
  }
  setTimeout(sendResize, 0)

  // 移到不同螢幕時重新計算高度
  ipcRenderer.on('recalculate-size', sendResize)

  // 播放按鈕
  document.getElementById('playBtn').addEventListener('click', togglePlay)

  // 接收 tray 的播放/暫停指令
  ipcRenderer.on('toggle-play', () => togglePlay())

  // 關閉 / 最小化 / 縮小
  document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-app')
  })
  document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-app')
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
      ipcRenderer.send('collapse-window', fullHeight)
    } else {
      container.style.display = 'block'
      btn.textContent = '▲'
      ipcRenderer.send('expand-window')
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
})
