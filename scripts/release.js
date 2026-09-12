'use strict';
// This small dependency-free release tool is owned by this app repository.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function within(base, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative)) throw Error('Invalid release path: '+relative);
  const full = path.resolve(base, relative);
  if (!full.startsWith(base+path.sep)) throw Error('Path escapes root: '+relative);
  let current=base;
  for(const part of path.relative(base,full).split(path.sep)) {
    current=path.join(current,part);
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Linked path is not a release input: '+current);
  }
  return full;
}
function filesIn(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);
    if(e.isSymbolicLink())throw Error('Linked file in website: '+p);
    return e.isDirectory()?filesIn(p):[p];
  });
}
function checkTree(base) {
  base=path.resolve(base);
  const files=filesIn(base), errors=[];
  const names=new Set(files.map(f=>path.relative(base,f).split(path.sep).join('/')));
  let references=0, scripts=0;
  function reference(file,raw) {
    const ref=raw.trim();
    if(!ref||/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(ref)||ref.includes('${')||ref.includes('__'))return;
    if(ref.startsWith('/')){errors.push(`${file}: root-relative link ${ref}`);return;}
    let pathname;
    try{pathname=decodeURIComponent(ref.split(/[?#]/)[0]);}catch{errors.push(`${file}: malformed URL ${ref}`);return;}
    if(!pathname)return;
    const full=path.resolve(path.dirname(file),pathname);
    const relative=path.relative(base,full).split(path.sep).join('/');
    if(!full.startsWith(base+path.sep)||!names.has(relative))errors.push(`${file}: missing, case-mismatched or external file ${ref}`);
    references++;
  }
  function script(file,text) {try{new vm.Script(text,{filename:file});scripts++;}catch(e){errors.push(e.message);}}
  for(const file of files){
    const ext=path.extname(file);if(!['.html','.css','.js'].includes(ext))continue;
    const text=fs.readFileSync(file,'utf8');
    if(ext==='.js') {
      script(file,text);
      // The GCSE catalogue stores document-relative routes in JavaScript.
      if(path.relative(base,file).split(path.sep).join('/')==='landing/catalog.js') {
        try {
          const context={};vm.runInNewContext(text,context,{timeout:1000});
          for(const activity of Object.values(context.MASTERS_ACTIVITIES||{}))reference(path.join(base,'index.html'),activity.href);
        } catch(error){errors.push('Catalogue check: '+error.message);}
      }
    }
    if(ext==='.html'){
      const markup=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
      for(const m of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))reference(file,m[1]);
      for(const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
        const src=m[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        if(src)reference(file,src[1]);else if(!/type\s*=\s*["'](?:text\/plain|application\/json)/i.test(m[1]))script(file,m[2]);
      }
      for(const m of markup.matchAll(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/gi))reference(file,m[1]);
    }
    if(ext!=='.js')for(const m of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi))reference(file,m[1]);
  }
  if(!names.has('index.html'))errors.push('Missing index.html');
  if(errors.length)throw Error(errors.join('\n'));
  return {files:files.length,references,scripts};
}
function manifest() {
  const data=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
  if(!Array.isArray(data.files)||!Array.isArray(data.activities)||new Set(data.files).size!==data.files.length)throw Error('Invalid release manifest');
  for(const name of ['index.html','.nojekyll'])if(!data.files.includes(name))throw Error('Missing release entry: '+name);
  for(const f of data.files){
    within(path.join(root,'src'),f);
    if(/(?:^|\/)(?:node_modules|drafts|context|scripts|mastery-src)(?:\/|$)|\.md$|(?:^|\/)questions\.json$|(?:^|\/)mastery\.html$/i.test(f))throw Error('Source-only file in release: '+f);
    const activity=f.match(/^activities\/([^/]+)\//)?.[1];
    if(activity&&!data.activities.includes(activity))throw Error('Unapproved activity: '+activity);
  }
  for(const activity of data.activities)if(!data.files.includes(`activities/${activity}/index.html`))throw Error('Activity entry missing: '+activity);
  return data;
}
function removeOutput(full) {
  // Only fixed app-owned build folders can be removed, never src or an arbitrary argument.
  if(!['dist','.release-build'].includes(path.basename(full))||path.dirname(full)!==root)throw Error('Unsafe build output');
  if(fs.existsSync(full)){
    if(fs.lstatSync(full).isSymbolicLink()||fs.realpathSync(full)!==path.join(fs.realpathSync(root),path.basename(full)))throw Error('Redirected build output');
    fs.rmSync(full,{recursive:true,maxRetries:5,retryDelay:200});
  }
}
function build() {
  const data=manifest(), staging=path.join(root,'.release-build'), out=path.join(root,'dist');
  removeOutput(staging);fs.mkdirSync(staging);
  try {
    for(const f of data.files){const from=within(path.join(root,'src'),f),to=within(staging,f);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
    const result=checkTree(staging);
    removeOutput(out);fs.renameSync(staging,out);
    console.log(`Built ${data.name}: ${JSON.stringify(result)} -> dist/`);
  } catch(error){removeOutput(staging);throw error;}
}
function check() {
  const data=manifest(),out=path.join(root,'dist');
  const actual=filesIn(out).map(f=>path.relative(out,f).split(path.sep).join('/')).sort();
  if(JSON.stringify(actual)!==JSON.stringify([...data.files].sort()))throw Error('Release contents do not match release.json; rebuild.');
  for(const f of data.files)if(!fs.readFileSync(within(out,f)).equals(fs.readFileSync(within(path.join(root,'src'),f))))throw Error('Stale release: '+f);
  console.log(`Checked ${data.name}: ${JSON.stringify(checkTree(out))}`);
}
if(require.main===module){try{const command=process.argv[2];if(command==='build')build();else if(command==='check')check();else throw Error('Usage: node scripts/release.js build|check');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={within,filesIn,checkTree,build,check};
