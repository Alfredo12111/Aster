// Generate the app's simple vector-like asterisk mark as a PNG-backed Windows icon.
import { deflateSync } from 'node:zlib';
import fs from 'node:fs/promises';
const size=256, data=Buffer.alloc(size*(size*4+1));
const distance=(x,y,ax,ay,bx,by)=>{const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay));};
const segments=[[128,42,128,214],[42,128,214,128],[67,67,189,189],[67,189,189,67]];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=Math.max(0,42-x,x-213),dy=Math.max(0,42-y,y-213);const inside=Math.hypot(dx,dy)<=42;
  const mark=segments.some(s=>distance(x,y,...s)<9);
  const rgb=mark?[230,187,120]:[23,25,27];const i=y*(size*4+1)+1+x*4;
  data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=inside?255:0;
}
const crc=buffer=>{let c=0xffffffff;for(const b of buffer){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(type,bytes)=>{const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(bytes.length);sum.writeUInt32BE(crc(Buffer.concat([name,bytes])));return Buffer.concat([size,name,bytes,sum]);};
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
await fs.mkdir('build',{recursive:true});await fs.writeFile('build/icon.ico',Buffer.concat([ico,png]));await fs.writeFile('public/icon.png',png);
