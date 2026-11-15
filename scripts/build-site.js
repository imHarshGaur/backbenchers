// Build a directly hosted edition with local gameplay and no unavailable room controls.
const fs=require('node:fs');
const path=require('node:path');
require('./build');
const directory=path.join(__dirname,'..','dist');
const html=fs.readFileSync(path.join(directory,'backbencher.html'),'utf8');
fs.writeFileSync(path.join(directory,'index.html'),html.replace('<script>', '<script>globalThis.BACKBENCHER_LOCAL_ONLY=true;</script>\n<script>'));
console.log('Built dist/index.html — hosted bots and pass-and-play edition');
