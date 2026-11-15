const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function sdRoundedBox(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r;
  const dy = Math.abs(py - cy) - hh + r;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function blendPixel(buf, idx, r, g, b, a) {
  if (a <= 0) return;
  const inv = 1 - a;
  const br = buf[idx];
  const bg = buf[idx + 1];
  const bb = buf[idx + 2];
  const ba = buf[idx + 3] / 255;
  const outA = a + ba * inv;
  if (outA <= 0) return;
  buf[idx] = Math.round((r * a + br * ba * inv) / outA);
  buf[idx + 1] = Math.round((g * a + bg * ba * inv) / outA);
  buf[idx + 2] = Math.round((b * a + bb * ba * inv) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

// Shared geometry for the editable SVG and dependency-free PNG/ICO exports.
// Normalized coordinates keep the two drawer fronts and handles readable at 16px.
const shapes = [
  [0.06,0.06,0.88,0.88,0.20,'#eee5f6'],
  [0.22,0.20,0.56,0.64,0.07,'#b7a1ca'],
  [0.20,0.16,0.60,0.64,0.07,'#655274'],
  [0.25,0.21,0.50,0.235,0.035,'#fff8ee'],
  [0.415,0.305,0.17,0.045,0.022,'#a17c52'],
  [0.25,0.49,0.50,0.13,0.025,'#3e3549'],
  [0.22,0.545,0.56,0.07,0.025,'#bca6cf'],
  [0.18,0.59,0.64,0.235,0.045,'#fff8ee'],
  [0.405,0.68,0.19,0.05,0.025,'#a17c52']
];
function renderIcon(size) {
  const rgba=Buffer.alloc(size*size*4),aa=1.1/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,idx=(y*size+x)*4;
    for(const [left,top,w,h,r,color] of shapes){
      const d=sdRoundedBox(u,v,left+w/2,top+h/2,w/2,h/2,r);
      const alpha=clamp01(.5-d/aa);
      if(alpha>0)blendPixel(rgba,idx,parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16),alpha);
    }
  }
  return encodePng(size,size,rgba);
}
function renderSvg(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="抽屉"><title>抽屉</title>'+shapes.map(([x,y,w,h,r,fill])=>'<rect x="'+x*512+'" y="'+y*512+'" width="'+w*512+'" height="'+h*512+'" rx="'+r*512+'" fill="'+fill+'"/>').join('')+'</svg>\n';
}

function buildIco(sizes) {
  const images = sizes.map((sz) => ({ size: sz, png: renderIcon(sz) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.size >= 256 ? 0 : img.size;
    entry[1] = img.size >= 256 ? 0 : img.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += img.png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map((i) => i.png)]);
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), buildIco([16, 24, 32, 48, 64, 128, 256]));
fs.writeFileSync(path.join(outDir, 'icon.png'), renderIcon(512));
fs.writeFileSync(path.join(outDir, 'icon.svg'), renderSvg());
console.log('Generated drawer icon: SVG, PNG and multi-size ICO');
