/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');const path = require('node:path');const vm = require('node:vm');const ts = require('typescript');
const React = require('react');const {renderToStaticMarkup} = require('react-dom/server');
const root=path.join(__dirname,'..');
function render(markdown){
 const filename=path.join(root,'app/components/report-markdown.tsx');
 assert.ok(fs.existsSync(filename), 'The shared safe report renderer must exist.');
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require,URL,console});
 return renderToStaticMarkup(React.createElement(mod.exports.default,{markdown}));
}

test('report links allow only safe navigation and preserve labels when blocked', async t=>{
 for(const href of ['javascript:alert(1)','data:text/html;base64,PHNjcmlwdD4=','vbscript:msgbox(1)','//tracker.example/x','irc:chat.example','https://user:pass@example.com']){
  await t.test(href,()=>{
   const html=render(`[Keep this label](${href})`);
   assert.match(html,/Keep this label/);assert.doesNotMatch(html,/<a\b[^>]*href=/i);
  });
 }
 for(const href of ['https://example.com/help','http://example.com/help','mailto:help@example.com','/contact','../help','#next','?view=report']){
  const html=render(`[Safe link](${href})`);assert.match(html,/<a\b[^>]*href=/);assert.match(html,/rel="noopener noreferrer nofollow"/);
 }
});

test('report content cannot load remote images or tracking pixels',()=>{
 const html=render('![Tracking pixel](https://tracker.example/pixel.png)\n\n![Inline data](data:image/svg+xml;base64,PHN2Zz4=)');
 assert.doesNotMatch(html,/<img\b|<link\b|\bsrc=/i);
});

test('normal report formatting, tables, entities and literal code survive safe rendering',()=>{
 const html=render('## What is working\n\n**Strong** and *clear* &amp; useful.\n\n- First\n- Second\n\n> Evidence\n\n| Metric | Result |\n| --- | --- |\n| Leads | 39 |\n\n~~Old~~\n\n`<script>not executable</script>`');
 for(const tag of ['h2','strong','em','ul','li','blockquote','table','th','td','del','code']) assert.match(html,new RegExp('<'+tag+'[ >]'));
 assert.match(html,/&amp; useful/);assert.match(html,/&lt;script&gt;not executable&lt;\/script&gt;/);assert.doesNotMatch(html,/<script\b/i);
});

test('screen and print views route every Markdown fragment through the shared safe component',()=>{
 for(const file of ['app/clients/[id]/page.tsx','app/reports/[id]/print/page.tsx']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.match(source,/import ReportMarkdown from ["']@\/components\/report-markdown["']/);
  assert.doesNotMatch(source,/dangerouslySetInnerHTML|\bmarked\s*\(/);
  assert.equal((source.match(/<ReportMarkdown\b/g)||[]).length,2);
  assert.match(source,/markdown=\{remainder\}/);assert.match(source,/markdown=\{summaryMarkdown\}/);
 }
});

test('encoded protocols and raw embedded content cannot become active report elements',async t=>{
 const links=['jav&#x61;script:alert(1)','javascript&#58;alert(1)','java&#10;script:alert(1)','data&#58;text/html,evil','JaVaScRiPt:alert(1)','file:///etc/passwd'];
 for(const href of links) await t.test(href,()=>assert.doesNotMatch(render(`[Blocked](${href})`),/<a\b[^>]*href=/i));
 const raw=['<svg onload="alert(1)"><a href="javascript:alert(1)">x</a></svg>','<math><mtext><img src=x onerror=alert(1)></mtext></math>','<iframe srcdoc="<script>alert(1)</script>"></iframe>','<style>body{display:none}</style>','<form action="https://evil.example"><input autofocus onfocus=alert(1)></form>','<object data="data:text/html,evil"></object><embed src="https://evil.example">','<a href="javascript:alert(1)" onclick="alert(1)">Raw link</a>'];
 for(const value of raw) await t.test(value.slice(0,40),()=>assert.doesNotMatch(render(value),/<(?:svg|math|img|iframe|script|style|form|input|object|embed|a)\b/i));
});

test('report rendering excludes executable raw HTML',()=>{
 const html=render('<img src=x onerror="window.renderProbe=true"><script>window.renderProbe=true</script>');
 assert.doesNotMatch(html,/<img\b|<script\b|onerror\s*=/i);
});
