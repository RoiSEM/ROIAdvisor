/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');const path = require('node:path');const vm = require('node:vm');const ts = require('typescript');
const root=path.join(__dirname,'..');
function harness(){
 const slots=[];let cursor=0;const requests=[];
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useMemo:fn=>fn(),useEffect(){}};
 const globals={Response,TextEncoder,console:{error(){},warn(){}},fetch:async(url,init)=>{requests.push({url,body:init?.body?JSON.parse(init.body):null});return Response.json(url==='/api/reports'?{report:{id:'report'}}:{summary:'fixture'});}};
 function load(file){const mod={exports:{}};const filename=path.join(root,file);vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,...globals,require(name){if(name==='react')return hooks;if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};if(name==='next/navigation')return {useRouter:()=>({refresh(){},push(){}})};if(name==='@/components/calendar')return {ReportDatePicker(){}};if(name==='@/components/service-cta')return {default(){},__esModule:true};if(name.startsWith('@/lib/'))return load('app/lib/'+name.slice(6)+'.ts');return require(name);}});return mod.exports;}
 const Form=load('app/components/report-form.tsx').default;
 const render=()=>{cursor=0;return Form({clientId:'client'});};
 function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);if(!node||typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
 function text(node){if(Array.isArray(node))return node.map(text).join(' ');if(node&&typeof node==='object')return text(node.props?.children);return node==null?'':String(node);}
 return {requests,render,nodes,text,async choose(content,name='file.csv',size){const input=nodes(render()).find(n=>n.type==='input'&&n.props.type==='file');return input.props.onChange({target:{files:[{name,size:size??Buffer.byteLength(typeof content==='string'?content:''),text:async()=>typeof content==='string'?content:await content}],value:name}});},async submit(){return render().props.onSubmit({preventDefault(){}});},number(index){return nodes(render()).filter(n=>n.type==='input'&&n.props.type==='number')[index];}};
}

test('real form preserves zero in preview while optional missing metrics remain blank',async()=>{
 const h=harness();await h.choose('Sessions,Conversions\n0,0');assert.equal(h.number(0).props.value,'0');assert.equal(h.number(1).props.value,'');assert.equal(h.number(5).props.value,'0');
 await h.submit();assert.equal(h.requests[0].body.uploaded_analytics.pageViews,null);
});

test('invalid replacement clears old data and blocks silent fallback to GA sync',async()=>{
 const h=harness();await h.choose('Sessions,Conversions\n100,10','old.csv');await h.choose('Sessions,Views\n100,20','invalid.csv');
 assert.doesNotMatch(h.text(h.render()),/old.csv/);await h.submit();assert.equal(h.requests.length,0);
});

test('submission is blocked while a replacement file is being read',async()=>{
 const h=harness();await h.choose('Sessions,Conversions\n100,10');let resolve;const slow=new Promise(r=>{resolve=r});const pending=h.choose(slow,'slow.csv');
 await h.submit();assert.equal(h.requests.length,0);resolve('Sessions,Conversions\n200,20');await pending;
});

test('late file reads cannot overwrite a newer invalid selection',async()=>{
 const h=harness();let resolve;const pending=h.choose(new Promise(r=>{resolve=r}),'old-slow.csv');await h.choose('Sessions\n100','new-invalid.csv');resolve('Sessions,Conversions\n200,20');await pending;
 assert.doesNotMatch(h.text(h.render()),/old-slow.csv/);await h.submit();assert.equal(h.requests.length,0);
});

test('invalid manual percentage cannot be submitted as a valid upload',async()=>{
 const h=harness();await h.choose('Sessions,Conversions\n100,10');h.number(3).props.onChange({target:{value:'150'}});await h.submit();assert.equal(h.requests.length,0);
});

test('blank required manual field remains unknown and blocks generation',async()=>{
 const h=harness();await h.choose('Sessions,Conversions\n100,10');h.number(5).props.onChange({target:{value:''}});assert.equal(h.number(5).props.value,'');await h.submit();assert.equal(h.requests.length,0);
});
