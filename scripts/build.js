const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
// Offline distribution intentionally removes optional web-font requests.
const css=fs.readFileSync(path.join(root,'web/style.css'),'utf8').replace(/^@import[^\r\n]*(?:\r?\n|$)/,'');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`);
for(const [src,file]of [['core.js','shared/core.js'],['input.js','web/input.js'],['pen-renderer.js','web/pen-renderer.js'],['app.js','web/app.js']])html=html.replace(`<script src="${src}"></script>`,()=>`<script>\n${fs.readFileSync(path.join(root,file),'utf8').replace(/<\/script/gi,'<\\/script')}\n</script>`);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/backbencher.html'),html);console.log('Built dist/backbencher.html — standalone offline game');
