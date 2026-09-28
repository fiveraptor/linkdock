import fs from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
const table=Array.from({length:256},(_,value)=>{
 for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;
 return value>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function filesIn(root,prefix=''){
 const result=[];
 for(const entry of fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const source=path.join(root,entry.name), name=prefix+entry.name;
  if(entry.isDirectory())result.push(...filesIn(source,name+'/'));
  else if(entry.isFile())result.push({name,data:fs.readFileSync(source)});
  else throw Error('Refusing to package a non-regular file');
 }
 return result;
}
export function zip(destination,files){
 const chunks=[],central=[];let offset=0;
 for(const {name,data} of files){
  if(name.startsWith('/')||name.split('/').includes('..'))throw Error('Invalid archive path');
  const filename=Buffer.from(name),compressed=deflateRawSync(data),crc=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);
  header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  chunks.push(header,filename,compressed);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);
  record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
  central.push(record,filename);offset+=header.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 fs.writeFileSync(destination,Buffer.concat([...chunks,directory,end]));
}
