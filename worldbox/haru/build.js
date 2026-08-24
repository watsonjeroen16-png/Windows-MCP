/* Injects Haru's sprite sheet (extracted from the character bible art) into the
   game template, producing a single self-contained index.html.
     node worldbox/haru/build.js
*/
const fs=require('fs'), path=require('path');
const dir=__dirname;
const tpl=fs.readFileSync(path.join(dir,'game.html'),'utf8');
const sprites=fs.readFileSync(path.join(dir,'sprites.json'),'utf8');
if(!tpl.includes('__HARU_SPRITES__'))throw new Error('template is missing the __HARU_SPRITES__ marker');
const out=tpl.replace('__HARU_SPRITES__',sprites);
fs.writeFileSync(path.join(dir,'index.html'),out);
console.log('built index.html —',(out.length/1024).toFixed(1),'KB');
