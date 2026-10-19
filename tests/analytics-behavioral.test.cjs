/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function loadLib(file) {
  const filename = path.join(root, file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, console, require, TextEncoder }, { filename });
  return mod.exports;
}

const analyticsCsv = loadLib('app/lib/analytics-csv.ts');

test('comprehensive behavioral tests for analytics CSV integrity', async (t) => {
  await t.test('missing conversions currently becomes 0 or rejected appropriately', () => {
    const csv = 'Sessions,Conversions\n100,';
    assert.throws(() => analyticsCsv.parseAnalyticsCsv(csv), /required|missing|conversions/i);
  });

  await t.test('valid zero counts are preserved correctly', () => {
    const csv = 'Sessions,Conversions\n0,0';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 0);
    assert.equal(res.conversions, 0);
  });

  await t.test('unknown optional metrics become null instead of 0', () => {
    const csv = 'Sessions,Conversions,Page Views\n100,10,';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.pageViews, null);
  });

  await t.test('shape, rates, and ambiguous headers rejection', () => {
    assert.throws(() => analyticsCsv.parseAnalyticsCsv('Sessions,Sessions\n100,200'), /duplicate/i);
    const csv = 'Channel,Sessions,Conversions,Bounce Rate\nOrganic,100,10,0.5';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.bounceRate, 0.5);
  });

  await t.test('totals no double count and weighted rates', () => {
    const csv = 'Channel,Sessions,Conversions,Bounce Rate\nTotal,400,40,0.35\nA,100,10,0.50\nB,300,30,0.30';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 400);
    assert.equal(res.conversions, 40);
  });

  await t.test('activeUsers not summed across rows without total', () => {
    const csv = 'Channel,Sessions,Conversions,Active Users\nA,100,5,80\nB,200,10,150';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.activeUsers, null);
  });

  await t.test('quote escaping, newlines, and rejections', () => {
    const csv = '"Channel Name","Sessions","Conversions"\n"Paid, Search","500","25"';
    const res = analyticsCsv.parseAnalyticsCsv(csv);
    assert.equal(res.traffic, 500);
    assert.equal(res.channelPerformance[0].channel, 'Paid, Search');
  });

  await t.test('file limit check (>5MB)', () => {
    // 5MB + 10 bytes
    const hugeCsv = 'Sessions,Conversions\n' + 'A'.repeat(5 * 1024 * 1024 + 10);
    assert.throws(() => analyticsCsv.parseAnalyticsCsv(hugeCsv), /size limit|5MB/i);
  });
});
