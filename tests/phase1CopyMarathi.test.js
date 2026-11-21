'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.join(__dirname, '../views/admin/translations/editor.ejs'), 'utf8');
const fnStart = editor.indexOf('  function copyFromMarathi(targetCode) {');
const fnEnd = editor.indexOf('  function showTranslationTab(code) {', fnStart);
assert.ok(fnStart > 0 && fnEnd > fnStart, 'copy helper is present');
const fn = editor.slice(fnStart, fnEnd);
function field(name, value, stale) {
  return { name, value, dataset:{translationStale:stale?'true':'false'}, events:[], dispatchEvent(e){this.events.push(e.type);} };
}
function form(action, fields) {
  return {action, inputs: fields, getAttribute(name) { return name==='action'?this.action:null; }, querySelectorAll(selector) {
    assert.equal(selector,'textarea[name]'); return this.inputs;
  }};
}
function setup({confirmResult=false, srcName='राजेश पाटील', hiName='', hiAddr='', stale=false}={}){
  const src = [
    form('/admin/translations/CUSTOMER/13',[field('translations[name]',srcName,stale)]),
    form('/admin/translations/CUSTOMER_ADDRESS/9',[field('translations[addressLine]','चक्की नाका, डोंबिवली')]),
    form('/admin/translations/CUSTOMER_ADDRESS/10',[field('translations[addressLine]','कल्याण पूर्व')]),
  ];
  const dst = [
    form('/admin/translations/CUSTOMER/13',[field('translations[name]',hiName)]),
    form('/admin/translations/CUSTOMER_ADDRESS/9',[field('translations[addressLine]',hiAddr)]),
    form('/admin/translations/CUSTOMER_ADDRESS/10',[field('translations[addressLine]','')]),
  ];
  function panel(code, forms) {return {dataset:{panel:code},querySelectorAll(sel){assert.equal(sel,'form');return forms;}};}
  const marathi=panel('mr',src),hindi=panel('hi',dst);
  const info={textContent:'',classList:{remove(cls){assert.equal(cls,'hidden');}}};
  let confirmCount=0;
  const context={
    document:{querySelector(selector){if(selector==='.translation-panel[data-panel="mr"]')return marathi;if(selector==='#copy-feedback-hi')return info;return null;},querySelectorAll(selector){if(selector==='.translation-panel')return [marathi,hindi];return []},getElementById(id){return id==='copy-feedback-hi'?info:null;}},
    window:{confirm(){confirmCount++;return confirmResult;},alert(){throw Error('feedback exists');}},
    Event:class Event {constructor(type){this.type=type;}},
  };
  vm.runInNewContext(fn+'\ncopyFromMarathi("hi");',context);
  return {src,dst,info,confirmCount};
}
test('Hindi editor has a non-submit Copy from Marathi button',()=>{
  assert.match(editor,/lang\.code === 'hi'/);
  assert.match(editor,/onclick="copyFromMarathi\('hi'\)"/);
  assert.match(editor,/type="button" onclick="copyFromMarathi/);
});
test('Copies Marathi name and each saved address to matching Hindi field without cross-wiring records',()=>{
  const {dst,src,info}=setup();
  assert.equal(dst[0].inputs[0].value,'राजेश पाटील');
  assert.equal(dst[1].inputs[0].value,'चक्की नाका, डोंबिवली');
  assert.equal(dst[2].inputs[0].value,'कल्याण पूर्व');
  assert.equal(src[0].inputs[0].value,'राजेश पाटील');
  assert.match(info.textContent,/3 Hindi field\(s\) filled/);
});
test('Keeps existing Hindi values when overwrite declined, but fills blank fields',()=>{
  const {dst,confirmCount,info}=setup({hiName:'राजेश',hiAddr:'चक्की नाका'});
  assert.equal(confirmCount,1);
  assert.equal(dst[0].inputs[0].value,'राजेश');
  assert.equal(dst[1].inputs[0].value,'चक्की नाका');
  assert.equal(dst[2].inputs[0].value,'कल्याण पूर्व');
  assert.match(info.textContent,/2 existing Hindi field\(s\) kept/);
});
test('Allows confirmed overwrite of existing Hindi fields',()=>{
  const {dst,confirmCount}=setup({hiName:'पुराना',hiAddr:'पुराना पत्ता',confirmResult:true});
  assert.equal(confirmCount,1);
  assert.equal(dst[0].inputs[0].value,'राजेश पाटील');
  assert.equal(dst[1].inputs[0].value,'चक्की नाका, डोंबिवली');
});
test('Skips stale Marathi translation when original source changed',()=>{
  const {dst,info}=setup({stale:true});
  assert.equal(dst[0].inputs[0].value,'');
  assert.equal(dst[1].inputs[0].value,'चक्की नाका, डोंबिवली');
  assert.match(info.textContent,/1 outdated Marathi field\(s\) skipped/);
});
