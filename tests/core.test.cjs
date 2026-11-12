'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');
const D = require('../dist/data.js');
const ids = xs => xs.map(x => x.id);
const filters = changes => ({region:'mistvale',query:'',categories:new Set(D.categories.map(c=>c.id)),favoritesOnly:false,hideCompleted:false,...changes});
const deepFreeze = value => { Object.freeze(value); for (const v of Object.values(value)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); return value; };

test('empty progress is schema-versioned, independent, and serializable', () => {
  const a=C.emptyProgress(), b=C.emptyProgress();
  assert.deepEqual(a,{schemaVersion:1,completed:[],favorites:[]});
  a.completed.push('mv-camp'); assert.deepEqual(b.completed,[]);
  assert.deepEqual(JSON.parse(JSON.stringify(b)),b);
});
test('valid progress supports both regions and independent completion/favorite flags',()=>{
  const p={schemaVersion:1,completed:['mv-camp','ss-camp'],favorites:['ss-camp','mv-jade']};
  assert.deepEqual(C.validateProgress(p,D.points),p);
  assert.deepEqual(C.validateProgress({schemaVersion:1,completed:ids(D.points),favorites:ids(D.points)},D.points).completed,ids(D.points));
});
test('validation deduplicates stably, strips extra metadata, and never mutates input',()=>{
  const p=deepFreeze({schemaVersion:1,completed:['ss-camp','mv-camp','ss-camp'],favorites:['mv-jade','mv-jade'],exportedAt:'example',extra:{anything:true}});
  const result=C.validateProgress(p,D.points);
  assert.deepEqual(result,{schemaVersion:1,completed:['ss-camp','mv-camp'],favorites:['mv-jade']});
  assert.notEqual(result.completed,p.completed); assert.notEqual(result.favorites,p.favorites);
});
test('validation rejects wrong versions and non-object envelopes',()=>{
  for(const value of [null,undefined,[],true,0,'{}',{}, {schemaVersion:'1'},{schemaVersion:0},{schemaVersion:2}]) assert.throws(()=>C.validateProgress(value,D.points));
});
test('validation rejects malformed, unknown, non-string, and overlong lists',()=>{
  for(const field of ['completed','favorites']) for(const bad of [undefined,null,{},'mv-camp',[null],[42],[{}],['unknown'],[''],['__proto__'],['constructor'],['<script>alert(1)</script>'],Array(D.points.length+1).fill('mv-camp')]) {
    assert.throws(()=>C.validateProgress({...C.emptyProgress(),[field]:bad},D.points));
  }
});
test('JSON prototype-like fields are stripped without changing prototypes',()=>{
  const p=JSON.parse('{"schemaVersion":1,"completed":[],"favorites":[],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  assert.deepEqual(C.validateProgress(p,D.points),C.emptyProgress()); assert.equal({}.polluted,undefined);
});
test('validation handles empty datasets and does not accept ids absent from them',()=>{
  assert.deepEqual(C.validateProgress(C.emptyProgress(),[]),C.emptyProgress());
  assert.throws(()=>C.validateProgress({schemaVersion:1,completed:['mv-camp'],favorites:[]},[]));
});
test('toggle is reversible, immutable, independent by field, and rejects other fields',()=>{
  for(const field of ['completed','favorites']) {
    const p=deepFreeze(C.emptyProgress()), next=C.toggle(p,field,'mv-camp');
    assert.deepEqual(next[field],['mv-camp']); assert.deepEqual(p,C.emptyProgress());
    assert.deepEqual(C.toggle(next,field,'mv-camp'),p);
  }
  for(const field of ['__proto__','constructor','schemaVersion','anything']) assert.throws(()=>C.toggle(C.emptyProgress(),field,'mv-camp'));
});
test('filters constrain region/categories and preserve dataset order',()=>{
  const p=C.emptyProgress();
  assert.deepEqual(ids(C.filterPoints(D.points,filters(),p)),ids(D.points.filter(x=>x.region==='mistvale')));
  assert.deepEqual(ids(C.filterPoints(D.points,filters({region:'starshore',categories:new Set(['treasure'])}),p)),['ss-shell','ss-compass']);
  assert.deepEqual(C.filterPoints(D.points,filters({categories:new Set()}),p),[]);
  assert.deepEqual(C.filterPoints(D.points,filters({region:'missing'}),p),[]);
});
test('search trims, ignores case, searches title and summary, and treats markup literally',()=>{
  const points=[{id:'a',region:'mistvale',category:'camp',title:'HELLO',summary:'Alpha clue'},{id:'b',region:'mistvale',category:'camp',title:'World',summary:'Beta clue'}];
  assert.deepEqual(ids(C.filterPoints(points,filters({query:'  hello  '}),C.emptyProgress())),['a']);
  assert.deepEqual(ids(C.filterPoints(points,filters({query:'BETA'}),C.emptyProgress())),['b']);
  for(const query of ['<script>','.*','[']) assert.deepEqual(C.filterPoints(points,filters({query}),C.emptyProgress()),[]);
  assert.deepEqual(ids(C.filterPoints(D.points,filters({query:'青玉'}),C.emptyProgress())),['mv-jade']);
});
test('favorite/completed flags combine with all filters without modifying data or progress',()=>{
  const points=deepFreeze(structuredClone(D.points));
  const progress=deepFreeze({schemaVersion:1,completed:['mv-camp','ss-shell'],favorites:['mv-camp','mv-jade','ss-shell']});
  assert.deepEqual(ids(C.filterPoints(points,filters({favoritesOnly:true,hideCompleted:true}),progress)),['mv-jade']);
  assert.deepEqual(ids(C.filterPoints(points,filters({favoritesOnly:true}),progress)),['mv-camp','mv-jade']);
  assert.equal(C.filterPoints(points,filters({hideCompleted:true}),progress).length,7);
});
test('routes stay stable across filters, progress changes, and repeated lookups',()=>{
  const before=structuredClone(D.routes);
  for(const region of D.regions) for(const query of ['', 'no match', '营地']) {
    C.filterPoints(D.points,filters({region:region.id,query}),C.toggle(C.emptyProgress(),'completed',D.points[0].id));
    assert.deepEqual(D.routes,before);
  }
  for(const route of D.routes) for(const id of route.points) assert.equal(C.parseHash('#point='+id,D).region,route.region);
});
test('fragment defaults and invalid ids fall back safely',()=>{
  for(const hash of ['', '#', '#region=invalid', '#point=invalid', '#region=__proto__', '#point=%3Cscript%3E', '#region=%E0%A4%A']) assert.deepEqual(C.parseHash(hash,D),{region:'mistvale',point:null});
  assert.deepEqual(C.parseHash('#region=starshore&point=missing',D),{region:'starshore',point:null});
});
test('fragment point is canonical, overrides mismatching region, and round trips all points',()=>{
  for(const point of D.points) {
    const params=new URLSearchParams({region:'invalid',point:point.id});
    assert.deepEqual(C.parseHash('#'+params,D),{region:point.region,point});
    assert.equal(C.parseHash(params.toString(),D).point,point);
  }
  assert.equal(C.parseHash('#point=%6D%76%2Dcamp&DROP=1',D).point.id,'mv-camp');
  assert.equal(C.parseHash('#point=mv-camp&point=ss-camp',D).point.id,'mv-camp');
});
test('camera clamp honors boundaries and import cap is small and positive',()=>{
  for(const [v,want] of [[-Infinity,0],[-1,0],[0,0],[5,5],[10,10],[11,10],[Infinity,10]]) assert.equal(C.clamp(v,0,10),want);
  assert.equal(C.MAX_IMPORT_BYTES,100000);
});
