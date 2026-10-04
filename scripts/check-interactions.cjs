// Lightweight regression for shared product landing and floating navigation.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('PRODUCT_DETAILS'));
function element() {
  return { textContent: '', attributes: {}, classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, focus() {}, replaceChildren() {}, append() {}, setAttribute(k,v) { this.attributes[k]=v; }, removeAttribute(k) { delete this.attributes[k]; }, getAttribute(k) { return this.attributes[k]; }, showModal() { this.open = true; }, close() { this.open = false; }, scrollIntoView() {}, getBoundingClientRect() { return { top: 1000 }; } };
}
function run(product) {
  const nodes = new Map();
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const ids = ['top','process','products','share-tools'];
  const nav = ids.map(id => { const e=element(); e.setAttribute('href','#'+id); return e; });
  const handlers = {};
  const document = { querySelector:get, querySelectorAll(s) { return s === '.floating-nav-item' ? nav : []; }, getElementById(id) { return get('#'+id); }, createElement:element };
  const window = { innerHeight:844, addEventListener(k,f) { handlers[k]=f; }, matchMedia() { return { matches:true }; }, clearInterval() {}, setInterval() {}, setTimeout() {} };
  const context = vm.createContext({ document, window, URLSearchParams, location:{ search:product ? '?product='+product : '' }, requestAnimationFrame:f=>f() });
  vm.runInContext(script, context);
  return { get, nav, handlers };
}
for (const [id,title] of [['director','四大四小产品组合'],['cofounder','联合创始人产品包'],['member','会员体验产品包']]) {
  const r=run(id);
  assert.equal(r.get('#productDetailDialog').open,true);
  assert.equal(r.get('#productDetailTitle').textContent,title);
}
for (const invalid of ['', 'unknown', '__proto__']) assert.notEqual(run(invalid).get('#productDetailDialog').open,true);
const r=run('');
r.get('#products').getBoundingClientRect=()=>({top:50});
r.handlers.hashchange();
assert.equal(r.nav.find(n=>n.attributes['aria-current']==='location').getAttribute('href'),'#products');
r.get('#share-tools').getBoundingClientRect=()=>({top:50});
r.handlers.hashchange();
assert.equal(r.nav.filter(n=>n.attributes['aria-current']==='location').length,1);
assert.equal(r.nav[3].attributes['aria-current'],'location');
console.log('Passed: 3 product deep links, invalid inputs, navigation state. Browser/device QA still required.');
