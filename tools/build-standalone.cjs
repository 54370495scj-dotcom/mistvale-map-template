'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'dist/styles.css'),'utf8');
const scripts=['data.js','core.js','app.js'].map(file=>{
  let content=fs.readFileSync(path.join(root,'dist',file),'utf8');
  if(file==='data.js')for(const name of ['mistvale','starshore']){
    const svg=fs.readFileSync(path.join(root,'dist/assets',name+'.svg'),'utf8');
    content=content.replace('assets/'+name+'.svg','data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));
  }
  if(/<\/script/i.test(content))throw new Error('Unexpected script terminator');
  return content;
});
const hash=text=>"'sha256-"+crypto.createHash('sha256').update(text).digest('base64')+"'";
const csp=`default-src 'none'; script-src ${scripts.map(hash).join(' ')}; style-src ${hash(css)}; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,`<meta http-equiv="Content-Security-Policy" content="${csp}">`);
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>');
['data.js','core.js','app.js'].forEach((name,i)=>{html=html.replace('<script defer src="'+name+'"></script>','<script defer>'+scripts[i]+'</script>');});
// Inline classic scripts run immediately; move them after the DOM is present.
const inline=[...html.matchAll(/<script defer>[\s\S]*?<\/script>/g)].map(m=>m[0].replace('<script defer>','<script>'));
html=html.replace(/<script defer>[\s\S]*?<\/script>/g,'');
const first=fs.readFileSync(path.join(root,'dist/assets/mistvale.svg'));
html=html.replace('href="assets/mistvale.svg"','href="data:image/svg+xml;base64,'+first.toString('base64')+'"');
html=html.replace('</body>',inline.join('\n')+'\n</body>');
fs.writeFileSync(path.join(root,'preview.html'),html);
console.log('Built preview.html (self-contained, hash-based CSP)');
