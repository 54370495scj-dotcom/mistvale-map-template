'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const D=require('../dist/data.js');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const walk=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
const unique=xs=>assert.equal(new Set(xs).size,xs.length);

test('fictional dataset identifiers, relationships and coordinates are valid',()=>{
  assert.equal(D.schemaVersion,1); assert.equal(D.points.length,16); assert.equal(D.regions.length,2);
  for(const collection of [D.categories,D.regions,D.points,D.routes]) {unique(collection.map(x=>x.id)); for(const x of collection) assert.match(x.id,/^[a-z][a-z0-9-]*$/);}
  for(const p of D.points) {
    assert.ok(D.regions.some(r=>r.id===p.region)); assert.ok(D.categories.some(c=>c.id===p.category));
    assert.ok(Number.isFinite(p.x)&&p.x>=0&&p.x<=1100); assert.ok(Number.isFinite(p.y)&&p.y>=0&&p.y<=700);
    for(const text of [p.title,p.summary,p.note,...p.guide]) {assert.equal(typeof text,'string'); assert.ok(text.trim()); assert.doesNotMatch(text,/[<>]|https?:\/\//i);}
    assert.ok(p.guide.length>=2);
  }
  for(const r of D.regions) {assert.match(r.image,/^assets\/[a-z]+\.svg$/); assert.ok(fs.existsSync(path.join(root,'dist',r.image))); assert.equal(D.routes.filter(x=>x.region===r.id).length,1);}
  for(const route of D.routes) {unique(route.points); assert.ok(route.points.length>=2); for(const id of route.points) assert.equal(D.points.find(p=>p.id===id)?.region,route.region);}
});
test('distribution contains exactly the intended local static assets',()=>{
  assert.deepEqual(walk('dist').sort(),['dist/app.js','dist/assets/mistvale.svg','dist/assets/starshore.svg','dist/core.js','dist/data.js','dist/index.html','dist/styles.css'].sort());
  for(const file of walk('dist')) assert.ok(fs.statSync(path.join(root,file)).size<200000, file+' is unexpectedly large');
});
test('package has no dependencies, lifecycle installers, or external build steps',()=>{
  const pkg=JSON.parse(read('package.json'));
  for(const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) assert.equal(Object.keys(pkg[key]||{}).length,0);
  assert.deepEqual(Object.keys(pkg.scripts).sort(),['start','test']);
  assert.equal(pkg.scripts.test,'node --test tests/*.test.cjs');
  assert.match(pkg.scripts.start,/--bind 127\.0\.0\.1 --directory dist$/);
});
test('public artifacts contain no external URLs except inert SVG namespace',()=>{
  for(const file of walk('dist')) {
    const source=read(file).replaceAll('http://www.w3.org/2000/svg','');
    assert.doesNotMatch(source,/(?:https?|wss?|ftp):\/\/|(?:src|href)\s*=\s*["']\/\//i,file);
    assert.doesNotMatch(source,/@import\b|javascript\s*:|data\s*:\s*(?:text\/html|application\/javascript)/i,file);
  }
});
test('public artifacts have no credential signatures, telemetry or dynamic code',()=>{
  for(const file of walk('dist')) {
    const s=read(file);
    assert.doesNotMatch(s,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{20,})\b/,file);
    assert.doesNotMatch(s,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval|importScripts)\s*\(|new\s+Function\s*\(|navigator\.serviceWorker/i,file);
    assert.doesNotMatch(s,/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/,file);
  }
});
test('HTML has restrictive CSP, no remote/inline scripts and unique DOM ids',()=>{
  const html=read('dist/index.html');
  for(const directive of ["script-src 'self'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'"]) assert.ok(html.includes(directive));
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|\son\w+\s*=/i);
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,3);
  assert.deepEqual(scripts.map(m=>m[1].match(/src="([^"]+)"/)[1]),['data.js','core.js','app.js']);
  for(const m of scripts) {assert.equal(m[2].trim(),''); assert.match(m[1],/\bdefer\b/);}
  unique([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
});
test('SVG maps are self-contained authored vector shapes, without executable or linked payloads',()=>{
  for(const r of D.regions) {
    const svg=read('dist/'+r.image);
    assert.match(svg,/viewBox="0 0 1100 700"/);
    assert.doesNotMatch(svg,/<(?:script|foreignObject|image|iframe|audio|video)\b|\son\w+\s*=|(?:xlink:)?href\s*=|<!ENTITY|<!DOCTYPE|<\?xml-stylesheet/i);
    for(const url of svg.matchAll(/url\(([^)]+)\)/g)) assert.match(url[1],/^#[a-zA-Z][\w-]*$/);
  }
});
test('app import validates before replacement and bounds file size before reading',()=>{
  const app=read('dist/app.js');
  const start=app.indexOf("$('import-file').addEventListener('change'");
  const end=app.indexOf("$('clear-progress').addEventListener",start);
  const handler=app.slice(start,end);
  const cap=handler.indexOf('file.size > C.MAX_IMPORT_BYTES'), readAt=handler.indexOf('await file.text()'), valid=handler.indexOf('C.validateProgress'), confirmAt=handler.indexOf('if (!confirm'), replace=handler.indexOf('progress = imported');
  assert.ok(cap>=0&&cap<readAt); assert.ok(valid>=0&&valid<confirmAt&&confirmAt<replace);
  assert.match(app,/node\.textContent = text/);
  assert.match(app,/URL\.revokeObjectURL\(url\)/);
});
test('original-fictional provenance is visible and dataset uses only new fictional regions',()=>{
  assert.deepEqual(D.regions.map(r=>r.id),['mistvale','starshore']);
  assert.equal(D.title,'雾川行记');
  assert.match(read('dist/data.js'),/Original fictional content\. No game map, article, or player record is included/);
  const html=read('dist/index.html');
  assert.match(html,/非真实游戏资料/); assert.match(html,/所有地形、地名与攻略均为原创虚构示例/); assert.match(html,/替换素材前，请确认相应使用权/);
  // This detects accidental attribution/identity additions; provenance still requires human review.
  for(const file of walk('dist')) assert.doesNotMatch(read(file),/github\.com|gitlab\.com|@[A-Za-z0-9_.-]+\.[A-Za-z]{2,}|(?:author|copyright)\s*[:=]\s*["'][^"']+["']/i,file);
});
