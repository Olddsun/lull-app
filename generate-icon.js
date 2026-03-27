const zlib = require('zlib')
const fs = require('fs')

const SIZE = 22

// CRC32
function crc32(buf) {
  let c = 0xffffffff
  const table = []
  for (let i = 0; i < 256; i++) {
    let v = i
    for (let j = 0; j < 8; j++) v = (v & 1) ? 0xedb88320 ^ (v >>> 1) : v >>> 1
    table[i] = v
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

// 畫素陣列 (RGBA)
const pixels = new Uint8Array(SIZE * SIZE * 4)

function setPixel(x, y, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = a
}

// 畫波浪線 ~~ （象徵白噪音/聲音）
const wave = [
  [4,11],[5,10],[6,9],[7,9],[8,10],[9,11],[10,12],[11,12],[12,11],[13,10],[14,9],[15,9],[16,10],[17,11],
  [4,13],[5,12],[6,11],[7,11],[8,12],[9,13],[10,14],[11,14],[12,13],[13,12],[14,11],[15,11],[16,12],[17,13],
]

wave.forEach(([x, y]) => {
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      setPixel(x + dx, y + dy, dx === 0 && dy === 0 ? 255 : 80)
})

// 壓縮成 PNG
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0
  for (let x = 0; x < SIZE; x++) {
    const s = (y * SIZE + x) * 4
    const d = y * (1 + SIZE * 4) + 1 + x * 4
    raw[d] = pixels[s]; raw[d+1] = pixels[s+1]
    raw[d+2] = pixels[s+2]; raw[d+3] = pixels[s+3]
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6

const sig = Buffer.from([137,80,78,71,13,10,26,10])
const idat = chunk('IDAT', zlib.deflateSync(raw))
const png = Buffer.concat([sig, chunk('IHDR', ihdr), idat, chunk('IEND', Buffer.alloc(0))])

fs.writeFileSync('icon.png', png)
console.log('icon.png 建立完成！')
