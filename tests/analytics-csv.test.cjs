/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function loadLib() {
  const filename = path.join(root, 'app/lib/analytics-csv.ts');
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, console, require, TextEncoder }, { filename });
  return mod.exports;
}

const analyticsCsv = loadLib();

test('parseCsv and detectAnalyticsCsv strict validation', async (t) => {
  await t.test('missing required headers or file returns actionable rejection error', () => {
    assert.throws(() => analyticsCsv.parseAnalyticsCsv(''), /required columns/i);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Session,Conversions\n10,2'), /required columns/i);
  });

  await t.test('exact normalized aliases not substring (sessions not users/session key event rate)', () => {
    const csv = 'Sessions,Key Events\n100,5';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 100);
    assert.equal(res.conversions, 5);
  });

  await t.test('counts finite nonnegative and never percent or currency', () => {
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Conversions\n$100,5'), /currency|nonnegative|invalid/i);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Conversions\n100%,5'), /percentage|nonnegative|invalid/i);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Conversions\n-10,5'), /negative|nonnegative/i);
  });

  await t.test('missing optional metrics are null, missing required sessions/conversions rejects', () => {
    const csv = 'Sessions,Conversions\n100,';
    assert.throws(() => analyticsCsv.parseAnalyticsCsv(csv), /conversions|required|missing|invalid/i);
  });

  await t.test('robust comma CSV quoted fields, escaped quotes, BOM, CRLF', () => {
    const csv = '\uFEFF"Session Count","Key Events"\r\n"1000","5"';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 1000);
    assert.equal(res.conversions, 5);
  });

  await t.test('fail malformed quotes, ragged rows, duplicate ambiguous headers', () => {
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Conversions\n"100,5'), /malformed/i);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Conversions\n100'), /ragged/i);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Sessions\n100,200'), /duplicate/i);
  });

  await t.test('skip GA-style comment or blank preamble lines', () => {
    const csv = '# GA4 export\n\nSessions,Conversions\n50,3';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 50);
    assert.equal(res.conversions, 3);
  });

  await t.test('support aggregate row and one session partition dimension without double count', () => {
    const csv = 'Default channel group,Sessions,Conversions\nTotal,150,10\nOrganic Search,100,6\nPaid Search,50,4';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 150);
    assert.equal(res.conversions, 10);
    assert.equal(res.channelPerformance.length, 2);
  });

  await t.test('weighted rates calculation', () => {
    const csv = 'Channel,Sessions,Conversions,Bounce Rate\nA,100,10,0.50\nB,300,30,0.30';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.bounceRate, 0.35);
  });

  await t.test('activeUsers are not summed across rows when no aggregate total row', () => {
    const csv = 'Channel,Sessions,Conversions,Active Users\nA,100,5,80\nB,200,10,150';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.activeUsers, null);
  });
});
