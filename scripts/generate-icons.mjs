import {deflateSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
// Render the existing Form mark directly, without image tooling or dependencies.
const destination=new URL('../public/icons/',import.meta.url);
await mkdir(destination,{recursive:true});
function crc(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)}return(value^0xffffffff)>>>0}
function chunk(type,data){const tag=Buffer.from(type);const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,sum])}
for(const size of [180,192,512]){
  const pixels=Buffer.alloc((size*3+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size,py=(y+.5)/size;
    const top=py>=.29&&py<.46&&px>=.28&&px<.76-(py-.29)*.48;
    const bottom=py>=.54&&py<.71&&px>=.28&&px<.62-(py-.54)*.48;
    const color=top||bottom?[19,21,18]:[198,243,107];
    const offset=y*(size*3+1)+1+x*3;pixels.set(color,offset);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(new URL(`form-${size}.png`,destination),png);
}
