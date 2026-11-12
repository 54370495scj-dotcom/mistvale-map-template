'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('preview.html');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const styles=[...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
const sha=s=>"'sha256-"+crypto.createHash('sha256').update(s).digest('base64')+"'";
const directives=Object.fromEntries((csp||'').split(';').filter(s=>s.trim()).map(s=>{const [key,...values]=s.trim().split(/\s+/);return [key,values];}));

test('standalone generator reproducibly produces the committed preview bytes',()=>{
  const before=fs.readFileSync(path.join(root,'preview.html'));
  execFileSync(process.execPath,['tools/build-standalone.cjs'],{cwd:root,stdio:'pipe'});
  const first=fs.readFileSync(path.join(root,'preview.html'));
  execFileSync(process.execPath,['tools/build-standalone.cjs'],{cwd:root,stdio:'pipe'});
  assert.deepEqual(fs.readFileSync(path.join(root,'preview.html')),first);
  assert.deepEqual(first,before,'preview.html must be regenerated after source changes');
});
test('standalone CSP grants exactly each script/style content hash',()=>{
  assert.ok(csp); assert.equal(scripts.length,3); assert.equal(styles.length,1);
  assert.deepEqual(directives['script-src'],scripts.map(m=>sha(m[2])));
  assert.deepEqual(directives['style-src'],styles.map(m=>sha(m[2])));
  for(const key of ['default-src','connect-src','object-src','base-uri','form-action']) assert.deepEqual(directives[key],["'none'"]);
  assert.deepEqual(directives['img-src'],['data:']);
  assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval|https?:|\*/);
  assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<style>'));
});
test('standalone executes classic inline scripts after all required DOM, in dependency order',()=>{
  const firstScript=scripts[0].index;
  const lastScript=scripts.at(-1);
  for(const m of scripts) assert.equal(m[1].trim(),'','inline classics must not rely on defer or async');
  assert.ok(firstScript>html.indexOf('</main>'));
  assert.ok(firstScript>html.indexOf('</dialog>'));
  for(const m of html.matchAll(/\bid="([^"]+)"/g)) assert.ok(m.index<firstScript,'DOM id '+m[1]+' must exist before execution');
  assert.ok(lastScript.index+lastScript[0].length<html.indexOf('</body>'));
  assert.match(scripts[0][2],/root\.MapData = data/);
  assert.match(scripts[1][2],/root\.MapCore = api/);
  assert.match(scripts[2][2],/const D = window\.MapData, C = window\.MapCore/);
  assert.equal(scripts[1][2],read('dist/core.js')); assert.equal(scripts[2][2],read('dist/app.js'));
  assert.equal(styles[0][2],read('dist/styles.css'));
});
test('standalone SVG data URIs exactly match local vector artwork',()=>{
  const context=vm.createContext({}); vm.runInContext(scripts[0][2],context,{timeout:1000});
  const regions=context.MapData.regions;
  assert.equal(regions.length,2);
  for(const region of regions) {
    assert.match(region.image,/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
    assert.equal(Buffer.from(region.image.split(',')[1],'base64').toString('utf8'),read('dist/assets/'+region.id+'.svg'));
  }
  const images=[...html.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)];
  assert.equal(images.length,1); assert.equal(images[0][1],regions[0].image);
  assert.doesNotMatch(scripts[0][2],/assets\/[a-z]+\.svg/);
});
test('standalone references no network resources, relative assets, or executable injection sinks',()=>{
  const sanitized=html.replaceAll('http://www.w3.org/2000/svg','');
  assert.doesNotMatch(sanitized,/(?:https?|wss?|ftp):\/\/|@import\b|javascript\s*:/i);
  assert.doesNotMatch(html,/<(?:iframe|object|embed|link)\b|\son\w+\s*=/i);
  for(const m of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) assert.match(m[1],/^(?:#[\w-]+|data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*)$/);
  assert.doesNotMatch(scripts.map(m=>m[2]).join('\n'),/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval)\s*\(|new\s+Function\s*\(|\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/);
});
