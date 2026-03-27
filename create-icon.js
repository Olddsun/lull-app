// 用 canvas 產生 tray icon，執行一次就好
const { createCanvas } = require('canvas')
const fs = require('fs')

const size = 32
const canvas = createCanvas(size, size)
const ctx = canvas.getContext('2d')

// 背景圓
ctx.fillStyle = 'rgba(255,255,255,0.9)'
ctx.beginPath()
ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
ctx.fill()

// 文字 L
ctx.fillStyle = '#1a1a1a'
ctx.font = 'bold 20px Arial'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillText('L', size/2, size/2 + 1)

fs.writeFileSync('icon.png', canvas.toBuffer('image/png'))
console.log('icon.png 建立完成')
