// Dependency-free regression checks. Run: node --test tests/scene-regression.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../Retro_Corner_V0.97.html'),'utf8');
class Classes{
  constructor(s=''){this.set=new Set(s.split(/\s+/).filter(Boolean));}
  add(s){this.set.add(s)} remove(s){this.set.delete(s)} contains(s){return this.set.has(s)}
  toggle(s,force){const on=force??!this.set.has(s);on?this.add(s):this.remove(s);return on;}
}
function harness(){
  const elements=new Map(),raf=new Map(),storage=new Map();let rafId=0,now=0,denied=false;
  const ctx={createImageData:()=>({data:new Uint8ClampedArray(256*240*4)}),putImageData(){}};
  class El{
    constructor(tag='div',id='',cls=''){this.tagName=tag.toUpperCase();this.id=id;this.classList=new Classes(cls);this.style={};this.attributes={};this.handlers={};this.children=[];this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.validity={valid:true};this.dataset={};this.rect={left:0,top:0,right:100,bottom:100,width:100,height:100};}
    set innerHTML(v){this.html=v;this.children=[];} get innerHTML(){return this.html||''}
    setAttribute(k,v){this.attributes[k]=String(v)} getAttribute(k){return this.attributes[k]??null}
    addEventListener(n,f){(this.handlers[n]??=[]).push(f)}
    async fire(n,e={}){e={target:this,currentTarget:this,key:'',button:0,preventDefault(){this.defaultPrevented=true},stopPropagation(){},...e};for(const f of this.handlers[n]||[])await f(e);return e;}
    appendChild(el){this.children.push(el)}
    querySelector(s){this.sub??={};return this.sub[s]??=new El(s==='img'?'img':'span')}
    getContext(){return ctx} focus(){document.activeElement=this} blur(){document.activeElement=document.body}
    closest(s){if(s.includes('button')&&(this.tagName==='BUTTON'||this.attributes.role==='button'))return this;if(s.includes('input')&&['INPUT','SELECT','TEXTAREA'].includes(this.tagName))return this;return null;}
    getBoundingClientRect(){return this.rect} setPointerCapture(){} releasePointerCapture(){}
  }
  for(const m of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){
    const cls=/\bclass="([^"]+)"/.exec(m[0])?.[1]||'';elements.set(m[2],new El(m[1],m[2],cls));
  }
  const gamepads=[...html.matchAll(/data-nes-key="([^"]+)"/g)].map(m=>{const e=new El('button');e.dataset.nesKey=m[1];return e;});
  const document=new El('document');document.body=new El('body');document.activeElement=document.body;document.hidden=false;
  document.getElementById=id=>{assert(elements.has(id),'Missing element '+id);return elements.get(id)};
  document.createElement=tag=>new El(tag);
  document.querySelectorAll=s=>s==='[data-nes-key]'?gamepads:s==='.page'?[elements.get('picker'),elements.get('play')]:[];
  const window=new El('window');
  const localStorage={getItem:k=>{if(denied)throw new Error('SecurityError');return storage.get(k)??null},setItem:(k,v)=>{if(denied)throw new Error('QuotaExceededError');storage.set(k,String(v))}};
  const sandbox={document,window,Element:El,console,crypto:webcrypto,TextEncoder,Uint8Array,Uint8ClampedArray,Uint32Array,localStorage,performance:{now:()=>now},matchMedia:()=>({matches:true}),requestAnimationFrame:f=>{raf.set(++rafId,f);return rafId},cancelAnimationFrame:id=>raf.delete(id),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
  const context=vm.createContext(sandbox);
  for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],context);
  const run=source=>vm.runInContext(source,context);
  function frames(count,hz=60){for(let i=0;i<count;i++){now+=1000/hz;const pending=[...raf.values()];raf.clear();for(const f of pending)f(now);}}
  return {run,frames,raf,storage,e:id=>elements.get(id),document,window,gamepads,deny:()=>denied=true};
}
const h=harness();
function room(){h.run("showPage('play');setNesOpen(true)");}
function empty(){h.run("if(playing)stopGame();if(insertedGameId)ejectCartridge();showPage('play');setNesOpen(true)");}

test('unsupported consoles stay on picker; NES enters the room',()=>{
 h.run("showPage('picker');selectConsole(2);enterSelectedConsole()");assert.equal(h.run('currentPage'),'picker');assert.match(h.e('pickerStatus').textContent,/coming soon/);
 h.run('selectConsole(0);enterSelectedConsole()');assert.equal(h.run('currentPage'),'play');
});
test('all five cartridges insert, boot, reset, power off and eject',()=>{
 for(const id of ['tetris','zelda','mario','punchout','contra']){empty();h.run(`insertCartridge('${id}');powerOnNes()`);assert.equal(h.run('playing'),true,id);h.frames(3);h.run('resetNes()');assert.equal(h.run('insertedGameId'),id);h.run('stopGame();setNesOpen(true);ejectCartridge()');assert.equal(h.run('insertedGameId'),null);assert.equal(h.e('spine-'+id).classList.contains('hidden'),false);}
});
test('closed bay and powered-on interlocks prevent cartridge changes',()=>{
 empty();h.run("setNesOpen(false);insertCartridge('tetris')");assert.equal(h.run('insertedGameId'),null);h.run("setNesOpen(true);insertCartridge('tetris');powerOnNes();toggleCartridgeBay();ejectCartridge()");assert.equal(h.run('cartridgeBayOpen'),false);assert.equal(h.run('insertedGameId'),'tetris');
});
test('display refresh rate does not change emulator speed',()=>{
 const counts=[];for(const hz of [60,120,144]){empty();h.run("insertCartridge('tetris');powerOnNes();globalThis.frameCount=0;nes.frame=()=>frameCount++");h.frames(hz,hz);counts.push(h.run('frameCount'));h.run('stopGame()');}
 for(const n of counts)assert.ok(n>=59&&n<=61,JSON.stringify(counts));
});
test('repeat room visits do not leak animation loops; picker stops static',()=>{
 empty();for(let i=0;i<10;i++)h.run("showPage('play');staticLoop();showPage('picker')");h.frames(1);assert.equal(h.raf.size,0);
});
test('navigation cancels a drag and restores the shelf cartridge',async()=>{
 empty();await h.e('spine-tetris').fire('pointerdown',{pointerId:12,clientX:10,clientY:10});assert.equal(h.run('draggingGameId'),'tetris');h.run("showPage('picker')");assert.equal(h.run('draggingGameId'),null);assert.equal(h.e('spine-tetris').classList.contains('hidden'),false);
});
test('cancelled removal restores the inserted cartridge',async()=>{
 empty();h.run("insertCartridge('tetris')");await h.e('insertedCart').fire('pointerdown',{pointerId:13});assert.equal(h.e('insertedCart').classList.contains('visible'),false);await h.window.fire('pointercancel',{pointerId:13});assert.equal(h.e('insertedCart').classList.contains('visible'),true);assert.equal(h.run('insertedGameId'),'tetris');
});
test('blur releases controls without losing other simultaneous inputs',async()=>{
 empty();h.run("insertCartridge('tetris');powerOnNes();setControl('keyboard','BUTTON_A',true);setControl('touch','BUTTON_A',true);setControl('keyboard',null,false)");assert.equal(h.run('nes.controllers[1].state[0]'),0x41);await h.window.fire('blur');assert.equal(h.run('nes.controllers[1].state[0]'),0x40);assert.equal(h.run('heldControls.size'),0);
});
test('text fields do not navigate out of the game or send game keys',async()=>{
 room();await h.document.fire('keydown',{key:'Backspace',target:h.e('loginUser')});assert.equal(h.run('currentPage'),'play');
});
test('gamepads release on pointer cancellation',async()=>{
 empty();h.run("insertCartridge('tetris');powerOnNes()");const b=h.gamepads.find(x=>x.dataset.nesKey==='BUTTON_B');await b.fire('pointerdown',{pointerId:15});assert.equal(h.run('nes.controllers[1].state[1]'),0x41);await b.fire('pointercancel',{pointerId:15});assert.equal(h.run('nes.controllers[1].state[1]'),0x40);
});
test('quick taps last through one emulated frame and then release',()=>{
 empty();h.run("insertCartridge('mario');powerOnNes();setControl('tap','BUTTON_START',true);setControl('tap',null,false)");
 assert.equal(h.run('nes.controllers[1].state[3]'),0x41);
 h.frames(3,144);assert.equal(h.run('nes.controllers[1].state[3]'),0x40);assert.equal(h.run('heldControls.size'),0);
});
test('battery saves survive power cycles and reject corrupt data',()=>{
 empty();h.run("activeSaveUser='save-test';insertCartridge('zelda');powerOnNes();nes.cpu.mem[0x6000]=173;stopGame();powerOnNes()");assert.equal(h.run('nes.cpu.mem[0x6000]'),173);h.storage.set('rc_sram_save-test_zelda','abc');assert.equal(h.run("loadSRAM('zelda')"),false);
});
test('legacy login migrates password and aliases without leaking keys to picker',async()=>{
 h.run("showPage('picker');currentPage='login'");h.storage.set('retroCornerAccounts',JSON.stringify({sam:{username:'sam',email:'sam@example.test',password:'legacy123'},'sam@example.test':{username:'sam',email:'sam@example.test',password:'legacy123'}}));h.e('loginUser').value='sam@example.test';h.e('loginPass').value='legacy123';const event=await h.e('loginPass').fire('keydown',{key:'Enter'});assert.equal(event.defaultPrevented,true);
 while(h.e('loginSubmit').disabled)await new Promise(setImmediate);
 const a=JSON.parse(h.storage.get('retroCornerAccounts'));assert.ok(a.sam.hash);assert.equal(a.sam.password,undefined);assert.deepEqual(a.sam,a['sam@example.test']);assert.equal(h.run('activeSaveUser'),'sam');assert.equal(h.run('currentPage'),'picker');
});
test('email-keyed legacy saves follow the canonical account',()=>{
 empty();h.storage.delete('rc_sram_sam_zelda');
 const data=Buffer.alloc(8192);data[0]=197;h.storage.set('rc_sram_sam@example.test_zelda',data.toString('base64'));
 h.run("insertCartridge('zelda');powerOnNes()");assert.equal(h.run('nes.cpu.mem[0x6000]'),197);h.run('stopGame()');
});
test('wrong password cannot log in and forgot password does not mutate credentials',async()=>{
 h.run("currentPage='login'");h.e('loginUser').value='sam';h.e('loginPass').value='wrong';await h.e('loginSubmit').fire('click');assert.equal(h.run('currentPage'),'login');assert.match(h.e('loginStatus').textContent,/Incorrect/);const original=h.storage.get('retroCornerAccounts');await h.e('forgotPassword').fire('click');assert.equal(h.storage.get('retroCornerAccounts'),original);
});
test('signup validates matching passwords, duplicates and stores only a salted hash',async()=>{
 h.e('caEmail').value='new@example.test';h.e('caUsername').value='newuser';h.e('caPassword').value='testpass123';h.e('caConfirm').value='mismatch';h.e('caTerms').checked=true;await h.e('createAccountForm').fire('submit');assert.match(h.e('createAccountStatus').textContent,/match/);h.e('caConfirm').value='testpass123';await h.e('createAccountForm').fire('submit');const a=JSON.parse(h.storage.get('retroCornerAccounts'));assert.ok(a.newuser.hash);assert.equal(a.newuser.password,undefined);assert.deepEqual(a.newuser,a['new@example.test']);await h.e('createAccountForm').fire('submit');assert.match(h.e('createAccountStatus').textContent,/already registered/);
});
test('save ownership remains fixed if another tab changes its session',()=>{
 h.run("activeSaveUser='newuser'");h.storage.set('retroCornerSession','another-account');assert.equal(h.run("sramKey('zelda')"),'rc_sram_newuser_zelda');
});
test('unavailable browser storage reports an error instead of throwing',async()=>{
 h.deny();h.e('loginUser').value='newuser';h.e('loginPass').value='testpass123';await h.e('loginSubmit').fire('click');assert.match(h.e('loginStatus').textContent,/storage/);assert.equal(h.e('loginSubmit').disabled,false);
});
