/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const file = path.join(__dirname, '../app/lib/analytics-csv.ts');
const mod = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,TextEncoder});
const parse = mod.exports.parseAnalyticsCsv;

test('aggregate source preserves observed optional counts and explicit zero measurements', () => {
  const r=parse('Sessions,Conversions,Views,Active users,Bounce rate\n0,0,0,0,0%');
  assert.equal(r.pageViews,0);assert.equal(r.activeUsers,0);assert.equal(r.bounceRate,0);
  assert.equal(parse('Sessions,Conversions,Active users\n458,39,377').activeUsers,377);
});

test('CSV fails closed for ambiguous layouts, conflicting totals, headers and numeric syntax', async t => {
  const cases=[
    ['users are not sessions','Total users,Conversions\n100,5'],
    ['session alias ambiguity','Sessions,Session count,Conversions\n100,900,5'],
    ['conversion alias ambiguity','Sessions,Conversions,Key events\n100,5,90'],
    ['conflicting total','Device,Sessions,Conversions\nTotal,900,40\ndesktop,100,10\nmobile,300,30'],
    ['conflicting total rate','Device,Sessions,Conversions,Bounce rate\nTotal,400,40,90%\ndesktop,100,10,50%\nmobile,300,30,30%'],
    ['multiple totals','Device,Sessions,Conversions\nTotal,400,40\nGrand total,400,40'],
    ['event rows overlap sessions','Event name,Sessions,Conversions\ncall,100,10\nform,100,20'],
    ['page path is not landing page','Page path,Sessions,Conversions\n/a,100,10\n/b,100,20'],
    ['mixed dimensions','Channel,Device,Sessions,Conversions\nOrganic,mobile,100,10'],
    ['multiple summary rows','Sessions,Conversions\n100,10\n300,30'],
    ['duplicate partition','Device,Sessions,Conversions\nmobile,100,10\nmobile,300,30'],
    ['blank dimension','Device,Sessions,Conversions\n,100,10'],
    ['hex count','Sessions,Conversions\n0x10,2'],
    ['bad thousands grouping','Sessions,Conversions\n"1,2",2'],
    ['currency in rate','Sessions,Conversions,Bounce rate\n100,2,$0.5'],
    ['misplaced percent','Sessions,Conversions,Bounce rate\n100,2,5%0'],
    ['quote inside unquoted field','Device,Sessions,Conversions\nmo"bile",100,2'],
    ['text after closing quote','Device,Sessions,Conversions\n"mobile"x,100,2'],
  ];
  for(const [name,csv] of cases) await t.test(name,()=>assert.throws(()=>parse(csv), /./));
});

test('partial optional metrics remain unknown instead of reporting partial totals or rates',()=>{
 const r=parse('Device,Sessions,Conversions,Views,Bounce rate,Active users\ndesktop,100,10,20,20%,90\nmobile,300,30,,,280');
 assert.equal(r.pageViews,null);assert.equal(r.bounceRate,null);assert.equal(r.activeUsers,null);
});

test('quoted multiline dimension and escaped quotes remain data',()=>{
 const r=parse('Device,Sessions,Conversions\n"mobile, \"\"large\"\"\nscreen",100,10');
 assert.equal(r.devicePerformance[0].device,'mobile, "large"\nscreen');
});

test('a total may occur after the metric columns and must not be double-counted',()=>{
 const r=parse('Sessions,Device,Conversions\n400,Total,40\n100,desktop,10\n300,mobile,30');
 assert.equal(r.traffic,400);assert.equal(r.conversions,40);assert.equal(r.devicePerformance.length,2);
});

test('file and row limits are enforced before unbounded parsing',()=>{
 assert.throws(()=>parse('Device,Sessions,Conversions\n'+'x,1,1\n'.repeat(10001)),/limit|rows/i);
 assert.throws(()=>parse('Sessions,Conversions\n1,1\n#'+'é'.repeat(3*1024*1024)),/size|5MB/i);
});
