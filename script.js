'use strict';
/* ══════════════════════════════════════
   CURSOR
══════════════════════════════════════ */
const cur = document.getElementById('cursor');
const curR = document.getElementById('cursor-ring');
document.addEventListener('mousemove', e => {
  cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px';
  curR.style.left = e.clientX + 'px'; curR.style.top = e.clientY + 'px';
});
document.addEventListener('mousedown', () => { cur.style.width='8px';cur.style.height='8px'; });
document.addEventListener('mouseup', () => { cur.style.width='12px';cur.style.height='12px'; });

function toggleCursor() {
  const on = document.getElementById('cursorOn')?.checked;
  cur.style.display = on ? '' : 'none';
  curR.style.display = on ? '' : 'none';
  document.body.style.cursor = on ? 'none' : '';
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let curPage = 'home', cardN = 0, deleted = null, undoT = null;
let playQs = [], playIdx = 0, playScore = 0, playTotalPts = 0, playEarnedPts = 0;
let playAnswered = false, playTI = null, playTLeft = 0;
let curQuizId = null;

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function go(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.npill').forEach(b => b.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  curPage = id;
  const b = btn || document.getElementById('nb-' + id);
  if (b) b.classList.add('on');

  // Show/hide footer (not on play/maker for clean focus)
  document.getElementById('site-footer').style.display =
    (id === 'home' || id === 'about' || id === 'library') ? '' : 'none';

  if (id === 'play') initPlay();
  if (id === 'library') { renderLibrary(); }
  if (id === 'home') updateHomeStats();
}

/* ══════════════════════════════════════
   THEMES
══════════════════════════════════════ */
const themes = ['dark','light','neon'], tIcons = ['🌙','☀️','💜'];
let tIdx = 0;
function cycleTheme() { tIdx=(tIdx+1)%3; setTheme(themes[tIdx]); }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  tIdx = themes.indexOf(t);
  document.getElementById('themeBtn').textContent = tIcons[tIdx];
  localStorage.setItem('qc-theme', t);
  closeModal('settingsModal');
}
(()=>{ const s=localStorage.getItem('qc-theme'); if(s){tIdx=themes.indexOf(s);if(tIdx<0)tIdx=0;setTheme(s);} })();

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function toast(msg, type='info', dur=3000) {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); t.classList.add('hiding'); setTimeout(()=>t.remove(),400); }, dur);
}

/* ══════════════════════════════════════
   SOUND
══════════════════════════════════════ */
const aCtx = window.AudioContext ? new AudioContext() : null;
function sfx(type) {
  const on = document.getElementById('sfxBtn')?.classList.contains('on') &&
             (document.getElementById('soundOn')?.checked ?? true);
  if (!aCtx || !on) return;
  if (aCtx.state==='suspended') aCtx.resume();
  if (type === 'fanfare') {
    [523,659,784,1047].forEach((f,i)=>{
      const o=aCtx.createOscillator(),g=aCtx.createGain();
      o.connect(g);g.connect(aCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(.15,aCtx.currentTime+i*.12);
      g.gain.exponentialRampToValueAtTime(.001,aCtx.currentTime+i*.12+.35);
      o.start(aCtx.currentTime+i*.12);o.stop(aCtx.currentTime+i*.12+.4);
    }); return;
  }
  const o=aCtx.createOscillator(),g=aCtx.createGain();
  o.connect(g);g.connect(aCtx.destination);
  g.gain.setValueAtTime(.18,aCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,aCtx.currentTime+.45);
  if(type==='correct'){o.frequency.setValueAtTime(440,aCtx.currentTime);o.frequency.setValueAtTime(880,aCtx.currentTime+.15);}
  else if(type==='wrong'){o.frequency.setValueAtTime(220,aCtx.currentTime);o.frequency.setValueAtTime(160,aCtx.currentTime+.18);}
  else{o.frequency.value=700;g.gain.setValueAtTime(.1,aCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,aCtx.currentTime+.1);}
  o.start();o.stop(aCtx.currentTime+.5);
}

/* ══════════════════════════════════════
   CONFETTI
══════════════════════════════════════ */
function confetti() {
  if (!document.getElementById('confOn')?.checked) return;
  const cv = document.getElementById('cfcanvas');
  const cx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const ps = Array.from({length:160},()=>({
    x:Math.random()*cv.width, y:-20,
    sz:Math.random()*10+4, spd:Math.random()*4+2,
    rot:Math.random()*8-4, ang:Math.random()*360,
    col:`hsl(${Math.random()*360},85%,60%)`
  }));
  let raf;
  function draw(){
    cx.clearRect(0,0,cv.width,cv.height);
    ps.forEach(p=>{p.y+=p.spd;p.ang+=p.rot;cx.save();cx.translate(p.x,p.y);cx.rotate(p.ang*Math.PI/180);cx.fillStyle=p.col;cx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz);cx.restore();});
    if(ps.some(p=>p.y<cv.height)) raf=requestAnimationFrame(draw);
    else cx.clearRect(0,0,cv.width,cv.height);
  }
  draw();
  setTimeout(()=>{cancelAnimationFrame(raf);cx.clearRect(0,0,cv.width,cv.height);},5000);
}

/* ══════════════════════════════════════
   MAKER — CARDS
══════════════════════════════════════ */
const getCW = () => document.getElementById('cardsWrap');
function updEmpty() {
  const e = document.getElementById('mkEmpty');
  if (e) e.style.display = getCW().children.length ? 'none' : 'block';
}
function updateTimerUI() {
  const on = document.getElementById('timerOn')?.checked;
  const sl = document.getElementById('timerSlider');
  if (sl) sl.disabled = !on;
}

function mkCard(type='mcq') {
  cardN++;
  const id='c'+cardN;
  const el=document.createElement('div');
  el.className='qcard-m'; el.id=id; el.dataset.type=type;
  el.draggable=true;
  el.addEventListener('dragstart',onDS);el.addEventListener('dragover',onDO);
  el.addEventListener('dragend',onDE);el.addEventListener('drop',onDrop);

  const qNum = getCW().children.length+1;
  el.innerHTML=`
    <div class="chead">
      <span class="dh" title="Drag to reorder">⠿</span>
      <span class="cnum">Q${qNum}</span>
      <select class="ctype" onchange="changeCType('${id}',this.value)">
        <option value="mcq"${type==='mcq'?' selected':''}>Multiple choice</option>
        <option value="truefalse"${type==='truefalse'?' selected':''}>True / False</option>
        <option value="text"${type==='text'?' selected':''}>Free text</option>
        <option value="ordering"${type==='ordering'?' selected':''}>Ordering</option>
      </select>
      <div class="chead-r">
        <select class="cdiff" onchange="updateDiff(this)">
          <option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option>
        </select>
        <input class="cpts" type="number" value="10" min="1" max="100" title="Points">
        <span class="pts-l">pts</span>
        <button class="c-img-btn" onclick="toggleImg('${id}')">🖼 Img</button>
        <button class="c-hint-btn" onclick="toggleHintM('${id}')">💡 Hint</button>
      </div>
    </div>
    <div class="cbody">
      <textarea class="qf" placeholder="Type your question…" rows="2"></textarea>
      <div class="img-row-m" id="imgrow-${id}">
        <input class="img-inp-m" type="url" placeholder="Image URL (https://…)" oninput="prevImg(this,'${id}')">
        <img class="img-prev" id="imgprev-${id}" alt="">
      </div>
      <div class="hint-row-m">
        <button class="hint-tog" onclick="toggleHintM('${id}')">💡 Add hint</button>
        <textarea class="hintf" id="hintf-${id}" placeholder="Hint for players…" rows="1"></textarea>
      </div>
      <div class="opts-area" id="opts-${id}"></div>
    </div>
    <div class="cfoot">
      <input class="ctags" placeholder="🏷 tags: maths, chapter-2…">
      <button class="cdel" onclick="delCard('${id}')">✕ Remove</button>
    </div>`;

  getCW().appendChild(el);
  buildOpts(id, type);
  updEmpty();
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
  renum();
  sfx('click');
}

function changeCType(id,t){document.getElementById(id).dataset.type=t;buildOpts(id,t);}
function updateDiff(sel){sel.className='cdiff diff-'+sel.value;}

function buildOpts(id,type){
  const a=document.getElementById('opts-'+id); a.innerHTML='';
  if(type==='mcq'){
    ['Option A','Option B','Option C','Option D'].forEach(p=>addOpt(id,p));
    const b=document.createElement('button');b.className='add-opt';b.textContent='+ Add option';
    b.onclick=()=>addOpt(id,'');a.appendChild(b);
  } else if(type==='truefalse'){
    addOpt(id,'True',true);addOpt(id,'False',true);
  } else if(type==='ordering'){
    ['First','Second','Third','Fourth'].forEach(p=>addOrderOpt(id,p));
    const b=document.createElement('button');b.className='add-opt';b.textContent='+ Add item';
    b.onclick=()=>addOrderOpt(id,'');a.appendChild(b);
  } else {
    a.innerHTML=`<div style="margin-top:12px"><span class="mlabel">Expected answer (auto-check)</span><textarea class="qf" placeholder="Model answer…" rows="2" style="margin-top:6px"></textarea></div>`;
  }
}

function addOpt(id,ph,noDel=false){
  const a=document.getElementById('opts-'+id),b=a.querySelector('.add-opt');
  const r=document.createElement('div');r.className='opt-row';
  if(!a.querySelector('.opt-row'))r.style.marginTop='12px';
  r.innerHTML=`<input type="radio" class="opt-radio-m" name="cr-${id}"><input class="opt-inp-m" type="text" placeholder="${ph||'Option…'}">
    ${noDel?'':'<button class="opt-del-m" onclick="this.parentElement.remove()">✕</button>'}`;
  if(b)a.insertBefore(r,b);else a.appendChild(r);
}

function addOrderOpt(id,ph){
  const a=document.getElementById('opts-'+id),b=a.querySelector('.add-opt');
  const r=document.createElement('div');r.className='opt-row';
  if(!a.querySelector('.opt-row'))r.style.marginTop='12px';
  const n=a.querySelectorAll('.opt-row').length+1;
  r.innerHTML=`<span style="color:var(--tx2);font-size:.78rem;min-width:16px">${n}</span>
    <input class="opt-inp-m" type="text" placeholder="${ph||'Item…'}" style="flex:1">
    <button class="opt-del-m" onclick="this.parentElement.remove()">✕</button>`;
  if(b)a.insertBefore(r,b);else a.appendChild(r);
}

function toggleHintM(id){
  const f=document.getElementById('hintf-'+id);
  f.classList.toggle('vis');
  const btn=f.closest('.cbody').querySelector('.hint-tog');
  btn.textContent=f.classList.contains('vis')?'💡 Hide hint':'💡 Add hint';
  if(f.classList.contains('vis'))f.focus();
}

function toggleImg(id){document.getElementById('imgrow-'+id).classList.toggle('vis');}
function prevImg(inp,id){
  const p=document.getElementById('imgprev-'+id);
  p.src=inp.value;p.onload=()=>p.classList.add('vis');p.onerror=()=>p.classList.remove('vis');
}

/* ─ DELETE & UNDO ─ */
function delCard(id){
  const el=document.getElementById(id);
  deleted={html:el.outerHTML,nextId:el.nextElementSibling?.id};
  el.style.transition='all .2s';el.style.opacity='0';el.style.transform='scale(.95)';
  setTimeout(()=>{el.remove();updEmpty();renum();},200);
  if(undoT)clearTimeout(undoT);
  document.getElementById('undoBar').classList.add('vis');
  undoT=setTimeout(()=>{document.getElementById('undoBar').classList.remove('vis');deleted=null;},6000);
}

function undoDelete(){
  if(!deleted)return;
  const tmp=document.createElement('div');tmp.innerHTML=deleted.html;
  const el=tmp.firstChild;
  el.addEventListener('dragstart',onDS);el.addEventListener('dragover',onDO);
  el.addEventListener('dragend',onDE);el.addEventListener('drop',onDrop);
  const cw=getCW(),nx=deleted.nextId?document.getElementById(deleted.nextId):null;
  if(nx)cw.insertBefore(el,nx);else cw.appendChild(el);
  updEmpty();renum();
  document.getElementById('undoBar').classList.remove('vis');
  deleted=null;toast('↩ Restored','success');
}

function renum(){document.querySelectorAll('.cnum').forEach((e,i)=>e.textContent=`Q${i+1}`);}

/* ─ DRAG ─ */
let dragSrc=null;
function onDS(){dragSrc=this;this.classList.add('dragging');}
function onDO(e){e.preventDefault();document.querySelectorAll('.qcard-m').forEach(c=>c.classList.remove('dragover'));this.classList.add('dragover');}
function onDE(){this.classList.remove('dragging');document.querySelectorAll('.qcard-m').forEach(c=>c.classList.remove('dragover'));}
function onDrop(e){
  e.preventDefault();
  if(dragSrc!==this){
    const cw=getCW(),all=[...cw.children],f=all.indexOf(dragSrc),t=all.indexOf(this);
    if(t<f)cw.insertBefore(dragSrc,this);else cw.insertBefore(dragSrc,this.nextSibling);
    renum();
  }
  this.classList.remove('dragover');
}

/* ─ SHUFFLE ─ */
function shuffleQs(){
  const cw=getCW(),cards=[...cw.children];
  for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));cw.appendChild(cards[j]);cards.splice(j,1);}
  renum();toast('🔀 Shuffled','info');
}

/* ─ RANDOM FILL ─ */
const SAMPLES=[
  {type:'mcq',q:'What is the capital of France?',opts:['Paris','London','Berlin','Madrid'],ans:0},
  {type:'mcq',q:'Which planet is called the Red Planet?',opts:['Mars','Venus','Jupiter','Saturn'],ans:0},
  {type:'truefalse',q:'The sun is a planet.',opts:['True','False'],ans:1},
  {type:'mcq',q:'Who wrote Romeo and Juliet?',opts:['Shakespeare','Dickens','Hemingway','Tolstoy'],ans:0},
  {type:'text',q:'What is the square root of 144?',ans:'12'},
  {type:'mcq',q:'How many sides does a hexagon have?',opts:['5','6','7','8'],ans:1},
  {type:'truefalse',q:'Water boils at 100°C at sea level.',opts:['True','False'],ans:0},
  {type:'mcq',q:'What does HTML stand for?',opts:['HyperText Markup Language','High Transfer Machine Link','Hyper Terminal Machine Language','HyperType Markup Logic'],ans:0},
];

function randFill(){
  SAMPLES.sort(()=>Math.random()-.5).slice(0,4).forEach(s=>{
    mkCard(s.type);
    const card=getCW().lastElementChild;
    card.querySelector('.qf').value=s.q;
    if(s.opts){
      const inps=card.querySelectorAll('.opt-inp-m'),rads=card.querySelectorAll('.opt-radio-m');
      s.opts.forEach((o,i)=>{if(inps[i])inps[i].value=o;});
      if(rads[s.ans])rads[s.ans].checked=true;
    } else {
      const fs=card.querySelectorAll('.qf');if(fs[1])fs[1].value=s.ans||'';
    }
  });
  toast('🎲 4 sample questions added!','success');
}

/* ─ CLEAR ─ */
function clearAll(){
  if(!getCW().children.length)return;
  if(!confirm('Remove all questions?'))return;
  getCW().innerHTML='';updEmpty();renum();toast('Cleared');
}

function newQuiz(){
  curQuizId=null;
  getCW().innerHTML='';
  document.getElementById('qTitle').value='';
  document.getElementById('qDesc').value='';
  document.getElementById('qCat').value='';
  updEmpty();
  go('maker',document.getElementById('nb-maker'));
}

/* ══════════════════════════════════════
   GET QUIZ DATA
══════════════════════════════════════ */
function getQuizData(){
  const qs=[];
  document.querySelectorAll('.qcard-m').forEach(card=>{
    const type=card.dataset.type;
    const qEl=card.querySelector('.qf');
    const q=qEl?qEl.value.trim():'';
    if(!q)return;
    const ds=card.querySelector('.cdiff');
    const pts=parseInt(card.querySelector('.cpts')?.value)||10;
    const hf=document.getElementById('hintf-'+card.id);
    const hint=hf?.value?.trim()||'';
    const ii=card.querySelector('.img-inp-m');
    const img=ii?.value?.trim()||'';
    const ti=card.querySelector('.ctags');
    const tags=ti?.value?.trim()||'';
    const obj={type,question:q,diff:ds?.value||'medium',points:pts,hint,img,tags,options:[],answer:-1};
    if(type==='mcq'||type==='truefalse'){
      const rads=[...card.querySelectorAll('.opt-radio-m')];
      const inps=[...card.querySelectorAll('.opt-inp-m')];
      inps.forEach((inp,i)=>{const t=inp.value.trim();if(t){obj.options.push(t);if(rads[i]?.checked)obj.answer=obj.options.length-1;}});
    } else if(type==='ordering'){
      const inps=[...card.querySelectorAll('.opt-inp-m')];
      obj.options=inps.map(i=>i.value.trim()).filter(Boolean);
      obj.answer=[...obj.options];
    } else {
      const fs=[...card.querySelectorAll('.qf')];
      obj.answer=fs[1]?.value?.trim()||'';
    }
    qs.push(obj);
  });
  return{
    id:curQuizId||Date.now().toString(),
    title:document.getElementById('qTitle').value||'Untitled Quiz',
    desc:document.getElementById('qDesc').value||'',
    category:document.getElementById('qCat').value||'',
    diff:document.getElementById('qDiff').value||'',
    timer:document.getElementById('timerOn')?.checked?parseInt(document.getElementById('timerSlider').value):0,
    shuffle:document.getElementById('shuffleOn')?.checked||false,
    sound:document.getElementById('soundOn')?.checked??true,
    questions:qs,
    savedAt:Date.now()
  };
}

/* ══════════════════════════════════════
   SAVE / LOAD
══════════════════════════════════════ */
function saveQuiz(){
  const data=getQuizData();
  if(!data.questions.length){toast('Add at least one question first','error');return;}
  const all=getAll();
  const ei=all.findIndex(q=>q.id===data.id);
  if(ei>=0)all[ei]=data;else all.push(data);
  localStorage.setItem('qc-quizzes',JSON.stringify(all));
  curQuizId=data.id;
  updateHomeStats();
  toast('✓ Quiz saved!','success');
}

function getAll(){try{return JSON.parse(localStorage.getItem('qc-quizzes')||'[]');}catch{return [];}}

function loadIntoMaker(id){
  const q=getAll().find(q=>q.id===id);if(!q)return;
  curQuizId=q.id;
  getCW().innerHTML='';
  document.getElementById('qTitle').value=q.title||'';
  document.getElementById('qDesc').value=q.desc||'';
  document.getElementById('qCat').value=q.category||'';
  if(q.timer){document.getElementById('timerOn').checked=true;document.getElementById('timerSlider').value=q.timer;document.getElementById('timerV').textContent=q.timer+'s';}
  if(q.shuffle)document.getElementById('shuffleOn').checked=true;
  updateTimerUI();
  q.questions.forEach(qs=>{
    mkCard(qs.type);
    const card=getCW().lastElementChild;
    card.querySelector('.qf').value=qs.question;
    if(qs.diff){const ds=card.querySelector('.cdiff');if(ds){ds.value=qs.diff;updateDiff(ds);}}
    if(qs.points){const pi=card.querySelector('.cpts');if(pi)pi.value=qs.points;}
    if(qs.hint){const hf=document.getElementById('hintf-'+card.id);if(hf){hf.value=qs.hint;toggleHintM(card.id);}}
    if(qs.img){const ir=card.querySelector('.img-row-m'),ii=card.querySelector('.img-inp-m');if(ir&&ii){ir.classList.add('vis');ii.value=qs.img;prevImg(ii,card.id);}}
    if(qs.tags){const ti=card.querySelector('.ctags');if(ti)ti.value=qs.tags;}
    if(qs.type==='mcq'||qs.type==='truefalse'){
      const rads=card.querySelectorAll('.opt-radio-m'),inps=card.querySelectorAll('.opt-inp-m');
      qs.options.forEach((o,i)=>{if(inps[i])inps[i].value=o;});
      if(qs.answer>=0&&rads[qs.answer])rads[qs.answer].checked=true;
    } else if(qs.type==='text'){
      const fs=card.querySelectorAll('.qf');if(fs[1])fs[1].value=qs.answer||'';
    }
  });
  updEmpty();renum();
  go('maker',document.getElementById('nb-maker'));
}

function delQuiz(id){
  if(!confirm('Delete this quiz?'))return;
  localStorage.setItem('qc-quizzes',JSON.stringify(getAll().filter(q=>q.id!==id)));
  const sc=JSON.parse(localStorage.getItem('qc-scores')||'{}');delete sc[id];
  localStorage.setItem('qc-scores',JSON.stringify(sc));
  renderLibrary();updateHomeStats();toast('Deleted','error');
}

/* ══════════════════════════════════════
   LIBRARY
══════════════════════════════════════ */
function renderLibrary(){
  const grid=document.getElementById('libGrid'),empty=document.getElementById('libEmpty');
  const search=document.getElementById('libSearch')?.value?.toLowerCase()||'';
  let quizzes=getAll();
  if(search)quizzes=quizzes.filter(q=>(q.title+q.category+q.desc).toLowerCase().includes(search));
  const sc=JSON.parse(localStorage.getItem('qc-scores')||'{}');
  if(!quizzes.length){grid.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  const emojis=['📘','🧠','🏆','🎯','⚡','🌍','🔬','🎨','📐','💡'];
  grid.innerHTML=quizzes.map((q,i)=>{
    const best=sc[q.id]?Math.round(sc[q.id].best*100)+'%':'—';
    const plays=sc[q.id]?.plays||0;
    const emoji=emojis[i%emojis.length];
    const dc=q.diff?`diff-${q.diff}`:'diff-';
    const dlbl=q.diff||'mixed';
    return`<div class="qcard">
      <div class="qcard-top">
        <div class="qcard-emoji">${emoji}</div>
        <div class="qcard-badges">
          <span class="qcard-diff ${dc}">${dlbl}</span>
          ${q.timer?`<span style="font-size:.68rem;color:var(--tx2)">⏱ ${q.timer}s</span>`:''}
        </div>
      </div>
      <div class="qcard-body">
        <div class="qcard-name">${q.title||'Untitled'}</div>
        ${q.desc?`<div class="qcard-desc">${q.desc}</div>`:''}
        <div class="qcard-meta">
          <span>📝 ${q.questions.length} q</span>
          ${q.category?`<span>📂 ${q.category}</span>`:''}
          <span>🎮 ${plays} play${plays!==1?'s':''}</span>
          <span>🏅 ${best}</span>
        </div>
      </div>
      <div class="qcard-footer">
        <button class="btn-sm primary" onclick="playFromLib('${q.id}')">▶ Play</button>
        <button class="btn-sm" onclick="loadIntoMaker('${q.id}')">✏ Edit</button>
        <button class="btn-sm danger" onclick="delQuiz('${q.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function playFromLib(id){
  const q=getAll().find(q=>q.id===id);if(!q)return;
  curQuizId=q.id;
  window._pq=q;
  go('play',document.getElementById('nb-play'));
}

/* ══════════════════════════════════════
   HOME STATS
══════════════════════════════════════ */
function updateHomeStats(){
  const all=getAll();
  const sc=JSON.parse(localStorage.getItem('qc-scores')||'{}');
  const totalQ=all.reduce((a,q)=>a+q.questions.length,0);
  const totalP=Object.values(sc).reduce((a,s)=>a+(s.plays||0),0);
  const bests=Object.values(sc).map(s=>(s.best||0)*100);
  const best=bests.length?Math.round(Math.max(...bests)):null;
  const s=id=>document.getElementById(id);
  if(s('sQuizzes'))s('sQuizzes').textContent=all.length;
  if(s('sQns'))s('sQns').textContent=totalQ;
  if(s('sPlays'))s('sPlays').textContent=totalP;
  if(s('sBest'))s('sBest').textContent=best!==null?best+'%':'—';
}

/* ══════════════════════════════════════
   EXPORT / IMPORT
══════════════════════════════════════ */
function exportJSON(){
  const d=getQuizData();
  document.getElementById('exportTA').value=JSON.stringify(d,null,2);
  openModal('exportModal');
}
function importQuiz(){document.getElementById('exportTA').value='';openModal('exportModal');}
function copyExport(){const ta=document.getElementById('exportTA');ta.select();document.execCommand('copy');toast('Copied!','success');}
function doImport(){
  try{
    const d=JSON.parse(document.getElementById('exportTA').value);
    if(!d.questions)throw 0;
    curQuizId=d.id||Date.now().toString();
    getCW().innerHTML='';
    document.getElementById('qTitle').value=d.title||'';
    document.getElementById('qDesc').value=d.desc||'';
    document.getElementById('qCat').value=d.category||'';
    d.questions.forEach(qs=>{
      mkCard(qs.type);
      const card=getCW().lastElementChild;
      card.querySelector('.qf').value=qs.question;
      if(qs.diff){const ds=card.querySelector('.cdiff');if(ds){ds.value=qs.diff;updateDiff(ds);}}
      if(qs.points){const pi=card.querySelector('.cpts');if(pi)pi.value=qs.points;}
      if(qs.hint){const hf=document.getElementById('hintf-'+card.id);if(hf){hf.value=qs.hint;toggleHintM(card.id);}}
      if(qs.type==='mcq'||qs.type==='truefalse'){
        const inps=card.querySelectorAll('.opt-inp-m'),rads=card.querySelectorAll('.opt-radio-m');
        qs.options.forEach((o,i)=>{if(inps[i])inps[i].value=o;});
        if(qs.answer>=0&&rads[qs.answer])rads[qs.answer].checked=true;
      } else if(qs.type==='text'){
        const fs=card.querySelectorAll('.qf');if(fs[1])fs[1].value=qs.answer||'';
      }
    });
    updEmpty();renum();
    closeModal('exportModal');
    go('maker',document.getElementById('nb-maker'));
    toast('Quiz imported!','success');
  } catch{toast('Invalid JSON','error');}
}

/* ══════════════════════════════════════
   PLAY ENGINE
══════════════════════════════════════ */
function loadDemo(){
  window._pq={
    id:'demo',title:'General Knowledge',category:'Trivia',timer:20,shuffle:false,
    questions:[
      {type:'mcq',question:'What is the capital of Japan?',options:['Tokyo','Seoul','Beijing','Bangkok'],answer:0,diff:'easy',points:10,hint:'Hosted the 2020 Olympics.'},
      {type:'truefalse',question:'The Great Wall of China is visible from space with the naked eye.',options:['True','False'],answer:1,diff:'medium',points:10,hint:'This is a common myth.'},
      {type:'mcq',question:'Which element has symbol "Au"?',options:['Silver','Copper','Gold','Aluminium'],answer:2,diff:'medium',points:15,hint:'A precious yellow metal.'},
      {type:'text',question:'What is 12 × 12?',answer:'144',diff:'easy',points:10,hint:'Think: 12 squared.'},
      {type:'mcq',question:'Who painted the Mona Lisa?',options:['Michelangelo','Da Vinci','Raphael','Botticelli'],answer:1,diff:'easy',points:10,hint:'Also designed flying machines.'},
    ]
  };
}

function initPlay(){
  clearInterval(playTI);playAnswered=false;
  let quiz=window._pq?window._pq:getQuizData();
  window._pq=null;
  let qs=[...quiz.questions];
  if(quiz.shuffle||document.getElementById('shuffleOn')?.checked)qs.sort(()=>Math.random()-.5);
  playQs=qs;playIdx=0;playScore=0;
  playTotalPts=qs.reduce((a,q)=>a+(q.points||10),0);
  playEarnedPts=0;
  document.getElementById('playName').textContent=quiz.title||'Quiz';
  document.getElementById('playMeta').textContent=`${qs.length} question${qs.length!==1?'s':''}${quiz.timer?' · ⏱ '+quiz.timer+'s each':''}${quiz.category?' · '+quiz.category:''}`;
  window._pt=quiz.timer||0;
  if(!qs.length){
    document.getElementById('playArea').innerHTML=`<div class="m-empty" style="border:1px dashed var(--bd2)"><div class="ei">🎯</div><h3>Nothing to play</h3><p>Add questions in the Maker tab, or load a quiz from the Library.</p></div>`;
    return;
  }
  renderPQ();
}

function renderPQ(){
  clearInterval(playTI);
  if(playIdx>=playQs.length){showScore();return;}
  const q=playQs[playIdx];playAnswered=false;playTLeft=window._pt||0;
  const pct=(playIdx/playQs.length)*100;
  const CIRC=2*Math.PI*28;
  const letters='ABCDEFGHIJ';

  let timerHTML='';
  if(playTLeft>0){
    timerHTML=`<div class="timer-wrap"><div class="t-ring" id="tring"><svg width="68" height="68"><circle class="t-track" cx="34" cy="34" r="28"/><circle class="t-fill" id="tfill" cx="34" cy="34" r="28" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg><span class="t-num" id="tnum">${playTLeft}</span></div></div>`;
  }

  let optsHTML='';
  if(q.type==='mcq'||q.type==='truefalse'){
    optsHTML=`<div class="play-opts">${q.options.map((o,i)=>`<button class="popt" onclick="choosePOpt(this,${i})"><span class="oletter">${letters[i]}</span>${o}</button>`).join('')}</div>
    <div class="kbhints">Press <kbd class="kbd">A</kbd> <kbd class="kbd">B</kbd> <kbd class="kbd">C</kbd> <kbd class="kbd">D</kbd> to answer · <kbd class="kbd">Enter</kbd> next</div>`;
  } else if(q.type==='ordering'){
    const sh=[...q.options].sort(()=>Math.random()-.5);
    optsHTML=`<div class="play-opts" id="ordList">${sh.map((o,i)=>`<div class="popt" draggable="true" data-v="${o}" style="cursor:grab"><span class="oletter">${i+1}</span>${o}</div>`).join('')}</div>
    <button class="btn-next" style="margin-top:12px" onclick="checkOrd()">Check order</button>`;
  } else {
    optsHTML=`<textarea class="play-tinp" id="ptinp" placeholder="Type your answer…" rows="3"></textarea>`;
  }

  const diffClass=`play-diff-b diff-${q.diff||'medium'}`;
  document.getElementById('playArea').innerHTML=`
    <div class="play-card">
      ${timerHTML}
      <div class="play-prog"><div class="play-prog-fill" style="width:${pct}%"></div></div>
      <div class="play-qmeta">
        <span class="play-qnum">Question ${playIdx+1} / ${playQs.length}</span>
        <span class="${diffClass}">${q.diff||'medium'}</span>
      </div>
      <div class="play-q">${q.question}</div>
      ${q.img?`<img class="play-img-q" src="${q.img}" alt="">`:''}
      ${q.hint?`<button class="play-hint-btn" onclick="revealHint()">💡 Hint</button><div class="play-hint-box" id="hintBox">${q.hint}</div>`:''}
      ${optsHTML}
      <div class="play-nav-row" id="playNav">
        <div class="play-fb" id="playFB"></div>
        <span class="pts-pop" id="ptsPop"></span>
        ${q.type!=='mcq'&&q.type!=='truefalse'&&q.type!=='ordering'
          ?`<button class="btn-next" onclick="submitText()">Submit</button>`
          :`<button class="btn-next" id="nextB" onclick="nextPQ()" disabled>${playIdx+1===playQs.length?'Finish →':'Next →'}</button>`}
      </div>
    </div>`;

  if(playTLeft>0){
    const tot=playTLeft;
    playTI=setInterval(()=>{
      playTLeft--;
      const tn=document.getElementById('tnum'),tf=document.getElementById('tfill'),tr=document.getElementById('tring');
      if(tn)tn.textContent=playTLeft;
      if(tf)tf.style.strokeDashoffset=CIRC*(1-playTLeft/tot);
      if(playTLeft<=5&&tr)tr.classList.add('urgent');
      if(playTLeft<=0){clearInterval(playTI);if(!playAnswered)timeoutPQ();}
    },1000);
  }
  if(q.type==='ordering')setupOrdDrag();
}

function setupOrdDrag(){
  const list=document.getElementById('ordList');if(!list)return;
  let drag=null;
  list.querySelectorAll('.popt').forEach(item=>{
    item.addEventListener('dragstart',()=>{drag=item;item.style.opacity='.4';});
    item.addEventListener('dragend',()=>{item.style.opacity='1';});
    item.addEventListener('dragover',e=>{e.preventDefault();list.insertBefore(drag,item);
      [...list.children].forEach((c,i)=>{const ol=c.querySelector('.oletter');if(ol)ol.textContent=i+1;});
    });
  });
}

function checkOrd(){
  const q=playQs[playIdx];
  const items=[...document.querySelectorAll('#ordList .popt')].map(i=>i.dataset.v);
  const correct=JSON.stringify(items)===JSON.stringify(q.answer||q.options);
  const pts=q.points||10;
  document.querySelectorAll('#ordList .popt').forEach(b=>b.setAttribute('draggable',false));
  if(correct){playScore++;playEarnedPts+=pts;sfx('correct');setFB(true,pts);}
  else{sfx('wrong');setFB(false,0,(q.answer||q.options).join(' → '));}
  playAnswered=true;
  const nav=document.getElementById('playNav');
  const nb=document.getElementById('nextB');
  if(!nb&&nav){const b=document.createElement('button');b.className='btn-next';b.textContent=playIdx+1===playQs.length?'Finish →':'Next →';b.onclick=nextPQ;nav.appendChild(b);}
  else if(nb)nb.disabled=false;
}

function revealHint(){const b=document.getElementById('hintBox');if(b){b.classList.add('vis');b.previousElementSibling.style.display='none';}}

function choosePOpt(btn,idx){
  if(playAnswered)return;
  clearInterval(playTI);playAnswered=true;
  const q=playQs[playIdx],all=[...document.querySelectorAll('.popt')];
  all.forEach(b=>b.disabled=true);
  const pts=q.points||10;
  if(idx===q.answer){btn.classList.add('correct');playScore++;playEarnedPts+=pts;sfx('correct');setFB(true,pts);}
  else{btn.classList.add('wrong');if(q.answer>=0&&all[q.answer])all[q.answer].classList.add('correct');sfx('wrong');setFB(false,0,q.options[q.answer]||'');}
  const nb=document.getElementById('nextB');if(nb)nb.disabled=false;
}

function submitText(){
  if(playAnswered){nextPQ();return;}
  clearInterval(playTI);playAnswered=true;
  const q=playQs[playIdx],inp=document.getElementById('ptinp');
  const val=inp?.value?.trim()||'',exp=(q.answer||'').toString().trim();
  const pts=q.points||10;
  const nb=document.querySelector('#playArea .btn-next');
  if(exp&&val.toLowerCase()===exp.toLowerCase()){
    if(inp)inp.classList.add('ok');playScore++;playEarnedPts+=pts;sfx('correct');setFB(true,pts);
  } else {
    if(inp)inp.classList.add('bad');sfx('wrong');setFB(false,0,exp||'Open-ended');
  }
  if(nb){nb.textContent=playIdx+1===playQs.length?'Finish →':'Next →';nb.onclick=nextPQ;}
}

function timeoutPQ(){
  if(playAnswered)return;playAnswered=true;
  const all=[...document.querySelectorAll('.popt')];
  all.forEach(b=>b.disabled=true);
  const q=playQs[playIdx];
  if((q.type==='mcq'||q.type==='truefalse')&&q.answer>=0&&all[q.answer])all[q.answer].classList.add('correct');
  sfx('wrong');
  const fb=document.getElementById('playFB');if(fb){fb.textContent='⏰ Time\'s up!';fb.className='play-fb bad';}
  const nb=document.getElementById('nextB');if(nb)nb.disabled=false;
}

function setFB(ok,pts,ans=''){
  const fb=document.getElementById('playFB'),pp=document.getElementById('ptsPop');
  if(fb){fb.textContent=ok?'✓ Correct!':ans?`✗ ${ans}`:'✗ Wrong';fb.className='play-fb '+(ok?'good':'bad');}
  if(pp&&ok){pp.textContent=`+${pts}pts`;pp.classList.add('show');}
}

function nextPQ(){playIdx++;renderPQ();}

/* ── SCORE ── */
function showScore(){
  clearInterval(playTI);
  const total=playQs.length,pct=total?Math.round(playScore/total*100):0;
  const msg=pct===100?'🎉 Perfect score!':pct>=80?'🌟 Excellent!':pct>=60?'👍 Well done!':pct>=40?'📚 Keep practising':'💪 Don\'t give up!';
  const qid=curQuizId||'unsaved';
  const sc=JSON.parse(localStorage.getItem('qc-scores')||'{}');
  if(!sc[qid])sc[qid]={plays:0,best:0,history:[]};
  sc[qid].plays++;sc[qid].best=Math.max(sc[qid].best,pct/100);
  sc[qid].history.push({pct,pts:playEarnedPts,ts:Date.now()});
  if(sc[qid].history.length>10)sc[qid].history.shift();
  localStorage.setItem('qc-scores',JSON.stringify(sc));
  updateHomeStats();

  const hist=sc[qid].history.slice().sort((a,b)=>b.pct-a.pct);
  const lbHTML=hist.slice(0,5).map((h,i)=>`<div class="lb-row"><span class="lb-rank">${['🥇','🥈','🥉','4.','5.'][i]}</span><span class="lb-name">Attempt ${i+1}</span><span class="lb-pts">${h.pts}pts</span><span class="lb-pct">${h.pct}%</span></div>`).join('');

  document.getElementById('playArea').innerHTML=`
    <div class="play-card score-screen">
      <div class="score-ring" style="--pct:${pct}">
        <div class="score-ring-in">
          <div class="sc-pct">${pct}%</div>
          <div class="sc-frac">${playScore} / ${total}</div>
        </div>
      </div>
      <div class="sc-msg">${msg}</div>
      <div class="sc-sub">${playEarnedPts} of ${playTotalPts} points</div>
      <div class="sc-bd">
        <div class="sbd-r"><span>✅ Correct</span><span class="sbd-v">${playScore}</span></div>
        <div class="sbd-r"><span>❌ Wrong</span><span class="sbd-v">${total-playScore}</span></div>
        <div class="sbd-r"><span>🎯 Accuracy</span><span class="sbd-v">${pct}%</span></div>
        <div class="sbd-r"><span>⭐ Points</span><span class="sbd-v">${playEarnedPts} / ${playTotalPts}</span></div>
      </div>
      ${hist.length>1?`<div class="lb-section"><div class="lb-label">🏆 Your history</div>${lbHTML}</div>`:''}
      <div class="sc-btns" style="margin-top:28px">
        <button class="btn-ac" onclick="initPlay()">↺ Play again</button>
        <button class="btn-out" onclick="go('library',document.getElementById('nb-library'))">📚 Library</button>
        <button class="btn-out" onclick="go('maker',document.getElementById('nb-maker'))">✏ Edit</button>
      </div>
    </div>`;

  sfx('fanfare');
  if(pct===100)confetti();
}

/* ══════════════════════════════════════
   MODALS
══════════════════════════════════════ */
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.moverlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});

/* ══════════════════════════════════════
   KEYBOARD
══════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  if(!document.getElementById('kbOn')?.checked)return;
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  const k=e.key.toLowerCase();
  if(k==='t'){cycleTheme();return;}
  if(k==='escape'){document.querySelectorAll('.moverlay.open').forEach(m=>m.classList.remove('open'));return;}
  if(curPage==='maker'){
    if(k==='n'){e.preventDefault();mkCard('mcq');}
    if(k==='s'){e.preventDefault();saveQuiz();}
  }
  if(curPage==='play'){
    const opts=[...document.querySelectorAll('.popt:not(:disabled)')];
    if(k==='1'||k==='a'){if(opts[0])opts[0].click();}
    if(k==='2'||k==='b'){if(opts[1])opts[1].click();}
    if(k==='3'||k==='c'){if(opts[2])opts[2].click();}
    if(k==='4'||k==='d'){if(opts[3])opts[3].click();}
    if(k==='enter'){const nb=document.getElementById('nextB');if(nb&&!nb.disabled)nb.click();}
    if(k==='h')revealHint();
  }
});

/* ══════════════════════════════════════
   CLEAR ALL DATA
══════════════════════════════════════ */
function clearAllData(){
  if(!confirm('Delete ALL saved quizzes and scores? This cannot be undone.'))return;
  localStorage.removeItem('qc-quizzes');localStorage.removeItem('qc-scores');
  closeModal('settingsModal');renderLibrary();updateHomeStats();toast('All data cleared','error');
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded',()=>{
  updEmpty();
  updateHomeStats();
  updateTimerUI();
  document.getElementById('site-footer').style.display='';
  // SFX toggle default off (must click to enable - browser autoplay policy)
  document.getElementById('sfxBtn')?.classList.remove('on');
});