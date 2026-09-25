// Generates resources/icon.png (and a 32px tray icon): a gold star in a gold
// ring on a dark rounded square. Run: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function png(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const star = [];
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 ? 0.16 : 0.36) * size;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    star.push([c + r * Math.cos(a), c + r * Math.sin(a)]);
  }
  const inStar = (x, y) => {
    let inside = false;
    for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
      const [xi, yi] = star[i], [xj, yj] = star[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const radius = size * 0.2;
  const S = 4; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const X = x + (sx + 0.5) / S, Y = y + (sy + 0.5) / S;
        const dx = Math.max(radius - X, 0, X - (size - radius)), dy = Math.max(radius - Y, 0, Y - (size - radius));
        if (dx * dx + dy * dy > radius * radius) continue;
        const d = Math.hypot(X - c, Y - c);
        let col = [17, 21, 28];
        if (Math.abs(d - size * 0.42) < size * 0.025 || inStar(X, Y)) col = [214, 178, 94];
        r += col[0]; g += col[1]; b += col[2]; a += 255;
      }
      const n = S * S, o = (y * size + x) * 4;
      const cov = a / n;
      px[o] = cov ? r / (a / 255) : 0; px[o + 1] = cov ? g / (a / 255) : 0; px[o + 2] = cov ? b / (a / 255) : 0; px[o + 3] = cov;
    }
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(__dirname, '..', 'resources');
fs.writeFileSync(path.join(out, 'icon.png'), png(256));
fs.writeFileSync(path.join(out, 'tray.png'), png(32));
console.log('wrote resources/icon.png and resources/tray.png');
