/* =====================================================================
   ParFi Éditeur — logique du back-office visuel (prototype, 100% front).
   Édite le site dans l'iframe (même origine) via accès DOM direct.
   État = { html (slots), theme } ; undo/redo ; autosave ; versions.
===================================================================== */
(function(){
"use strict";
var $=function(s,c){return (c||document).querySelector(s);};
var $$=function(s,c){return [].slice.call((c||document).querySelectorAll(s));};

var frame=$('#frame'), stage=$('#stage');
var doc=null, win=null, selected=null;
var history=[], hi=-1, versions=[];
var suppress=false, snapTimer=null, dirty=false;
var curFont='open', curSpace='normal', edRules={font:'',space:''};
var LS_STATE='parfi-ed-state', LS_VERS='parfi-ed-versions';
var PAGES=[{id:'index',label:'Accueil',file:'site/index.html'},{id:'services',label:'Services',file:'site/services.html'},{id:'apropos',label:'À propos',file:'site/apropos.html'},{id:'contact',label:'Contact',file:'site/contact.html'}];
var currentPage='index';
function stateKey(){ return LS_STATE+':'+currentPage; }
function versKey(){ return LS_VERS+':'+currentPage; }

var PALETTE=['#23346B','#00BAE5','#6EC1E4','#0784a0','#212121','#4A4A4A','#3d4451','#ffffff','#f3f9fd'];
var THEMEVARS=[{v:'--navy',label:'Navy'},{v:'--cyan',label:'Cyan'},{v:'--sky',label:'Bleu clair'}];
var FONTS={
  open:{body:'"Open Sans"',head:'"Open Sans"',link:''},
  lexend:{body:'"Source Sans 3"',head:'"Lexend"',link:'Lexend:wght@500;600;700&family=Source+Sans+3:wght@400;600'},
  archivo:{body:'"Inter"',head:'"Archivo"',link:'Archivo:wght@600;700;800&family=Inter:wght@400;500;600'},
  fraunces:{body:'"Inter"',head:'"Fraunces"',link:'Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600'}
};
var SPACE={compact:'.section{padding:56px 0}.section--tight{padding:44px 0}',normal:'',airy:'.section{padding:120px 0}.section--tight{padding:92px 0}'};

/* ---------------------------------------------------------------- init */
frame.addEventListener('load', init);
function init(){
  doc=frame.contentDocument; win=frame.contentWindow;
  injectStyles();
  markEditable();
  bindCanvas();
  versions=load(versKey())||[];
  var saved=load(stateKey());
  if(saved){ applyState(saved,true); }
  renderPages(); renderSections(); renderTheme(); renderComponents(); renderMedia(); renderVersions(); renderSEO();
  loadPagesRegistry(renderPages);
  resetHistory();
  setInterval(autosave, 5000);
  if(!window.__edUnload){ window.__edUnload=1; window.addEventListener('beforeunload',function(){ if(dirty) autosave(); }); window.addEventListener('pagehide',function(){ if(dirty) autosave(); }); }   /* FIX P2: flush au déchargement */
  setSave(true);
  var demo=new URLSearchParams(location.search).get('demo'); if(demo) setTimeout(function(){ runDemo(demo); },500);
}
function runDemo(kind){
  function clk(el){ if(el) el.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true})); }
  if(kind==='text'){ clk(doc.querySelector('.hero h1')); }
  else if(kind==='image'){ clk(doc.querySelector('.card__ic img')); }
  else if(kind==='blocks'){ var t=$('#ltabs button[data-t="components"]'); if(t) t.click(); }
  else if(kind==='theme'){ var t=$('#ltabs button[data-t="theme"]'); if(t) t.click(); var ins=$$('#themeColors input[type=color]'); if(ins[0]){ ins[0].value='#0e5a6e'; ins[0].dispatchEvent(new Event('input')); } if(ins[1]){ ins[1].value='#17b8c2'; ins[1].dispatchEvent(new Event('input')); } }
  else if(kind==='publish'){ $('#publish').click(); }
}

function injectStyles(){
  if(doc.getElementById('ed-style')) return;
  var s=doc.createElement('style'); s.id='ed-style'; s.textContent=
    '[data-ed]{cursor:pointer}'+
    '.ed-hover{outline:2px solid rgba(43,138,239,.4)!important;outline-offset:2px}'+
    '.ed-sel{outline:2px solid #2b8aef!important;outline-offset:2px}'+
    '[contenteditable="true"]{cursor:text;outline:2px solid #00BAE5!important;outline-offset:3px}'+
    '.ed-hidden{display:none!important}';
  doc.head.appendChild(s);
  var b=doc.createElement('style'); b.id='ed-blocks'; b.textContent=
    '.twocol .wrap{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}.twocol img{border-radius:14px;width:100%}'+
    '.tmoi-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.tmoi-card{background:#f3f9fd;border-radius:14px;padding:28px}.tmoi-card p{font-size:16px;line-height:1.7;color:#2c3550;margin:0 0 14px}.tmoi-card b{color:var(--navy)}.tmoi-card span{color:#6b7488;font-size:13px}'+
    '.gal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.gal-grid img{width:100%;height:200px;object-fit:cover;border-radius:12px}'+
    '.contactblk .wrap{display:grid;grid-template-columns:1fr 1fr;gap:40px}.cfield{display:block;width:100%;padding:13px 16px;border:1px solid #dfe5ef;border-radius:10px;margin-bottom:12px;font:inherit}'+
    '@media(max-width:880px){.twocol .wrap,.tmoi-grid,.contactblk .wrap{grid-template-columns:1fr}.gal-grid{grid-template-columns:1fr 1fr}}';
  doc.head.appendChild(b);
  var t=doc.createElement('style'); t.id='ed-theme'; doc.head.appendChild(t);
}

function markEditable(){
  $$('h1,h2,h3,.hero__sub,.services__lead,.card p,.pillar p,.about__col p,.faq__head p,.cta p,.news p,.ft__brand p',doc)
    .forEach(function(el){ if(!el.closest('.faq__a')&&!el.closest('[data-ed]')) el.setAttribute('data-ed','text'); });
  $$('.faq__q',doc).forEach(function(el){ el.setAttribute('data-ed','text'); el.setAttribute('data-ed-q','1'); });
  $$('.btn',doc).forEach(function(el){ el.setAttribute('data-ed','button'); });
  $$('.link-more,.nav a,.ft__col a,.drawer a',doc).forEach(function(el){ el.setAttribute('data-ed','link'); });
  $$('img',doc).forEach(function(el){ el.setAttribute('data-ed','image'); });
  $$('main > section',doc).forEach(function(el,i){ if(!el.id) el.id='sec-'+i; });
}

/* ------------------------------------------------------- canvas events */
function bindCanvas(){
  doc.addEventListener('mouseover',function(e){ var el=ed(e); clearHover(); if(el&&el!==selected) el.classList.add('ed-hover'); },true);
  doc.addEventListener('mouseout',clearHover,true);
  doc.addEventListener('click',onClick,true);
  doc.addEventListener('input',function(e){ if(e.target.isContentEditable){ scheduleSnap(); } });
  doc.addEventListener('paste',function(e){ if(e.target.isContentEditable){ e.preventDefault(); var t=(e.clipboardData||win.clipboardData).getData('text/plain'); doc.execCommand('insertText',false,t); } });
  doc.addEventListener('keydown',function(e){
    if(e.target.isContentEditable&&e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); flushSnap(); e.target.blur(); }
    handleKeys(e);
  });
  doc.addEventListener('focusout',function(e){ if(e.target.getAttribute&&e.target.isContentEditable===false){} });
}
function ed(e){ return e.target.closest? e.target.closest('[data-ed]') : null; }
function clearHover(){ $$('.ed-hover',doc).forEach(function(x){x.classList.remove('ed-hover');}); }
function onClick(e){
  var el=ed(e), a=e.target.closest('a'), btn=e.target.closest('button');
  if(el){ e.preventDefault(); e.stopPropagation(); select(el); }
  else { if(a||btn){ e.preventDefault(); e.stopPropagation(); } deselect(); }
}

/* ------------------------------------------------------- selection */
function select(el){
  flushSnap();
  if(selected&&selected!==el){ selected.classList.remove('ed-sel'); if(selected.isContentEditable) selected.contentEditable='false'; }
  selected=el; el.classList.add('ed-sel'); clearHover();
  var type=el.getAttribute('data-ed');
  if(type==='text'&&!el.getAttribute('data-ed-q')&&/^(H1|H2|H3|P)$/.test(el.tagName)) inlineEdit(el);
  inspect(type,el);
  syncSectionSel(el);
}
function deselect(){
  flushSnap();
  if(selected){ selected.classList.remove('ed-sel'); if(selected.isContentEditable) selected.contentEditable='false'; }
  selected=null; emptyInspector(); syncSectionSel(null);
}
function inlineEdit(el){ el.contentEditable='true'; el.focus(); var r=doc.createRange(); r.selectNodeContents(el); r.collapse(false); var s=win.getSelection(); s.removeAllRanges(); s.addRange(r); }

/* ------------------------------------------------------- inspector */
function emptyInspector(){
  $('#insp').innerHTML='<div class="insp__empty"><div class="big"><svg class="ico" viewBox="0 0 24 24" style="width:24px;height:24px"><path d="m13 2-3 7h6l-3 7"/><path d="M4 14h4M16 14h4M9 21h6"/></svg></div><b>Rien de sélectionné</b><p class="hint" style="margin-top:6px">Clique sur un texte, une image ou un bouton du site pour le modifier ici.</p></div>';
}
function inspect(type,el){
  var H='';
  var titles={text:'Texte',button:'Bouton',link:'Lien',image:'Image'};
  H+='<div class="insp__head">'+icon(type)+' '+(titles[type]||'Élément')+'</div>';
  H+='<div class="insp__type">'+el.tagName.toLowerCase()+(el.className?' · '+String(el.className).split(' ')[0]:'')+'</div>';
  if(type==='text') H+=textFields(el);
  else if(type==='button') H+=buttonFields(el);
  else if(type==='link') H+=linkFields(el);
  else if(type==='image') H+=imageFields(el);
  $('#insp').innerHTML=H;
  bindInspector(type,el);
}
function icon(t){ return '<svg class="ico" viewBox="0 0 24 24" style="color:var(--cyan)"><circle cx="12" cy="12" r="9"/></svg>'; }

function textFields(el){
  var sz=parseInt(win.getComputedStyle(el).fontSize)||16;
  var H='<div class="fieldrow"><label>Couleur du texte</label><div class="swatches" id="fColor"></div></div>';
  H+='<div class="fieldrow"><label>Taille — '+sz+'px</label><div class="stepper"><button data-step="-1">−</button><span id="fSize">'+sz+'px</span><button data-step="1">+</button></div></div>';
  H+='<div class="fieldrow"><label>Graisse</label><div class="choices" id="fWeight"><button data-w="400">Normal</button><button data-w="600">Semi</button><button data-w="700">Gras</button></div></div>';
  H+='<div class="fieldrow"><label>Alignement</label><div class="choices" id="fAlign"><button data-a="left">Gauche</button><button data-a="center">Centre</button><button data-a="right">Droite</button></div></div>';
  return H;
}
function buttonFields(el){
  var H='<div class="fieldrow"><label>Libellé</label><input type="text" id="bText" value="'+esc(el.textContent.trim())+'"></div>';
  H+='<div class="fieldrow"><label>Style</label><div class="choices" id="bStyle"><button data-s="btn--navy">Plein</button><button data-s="btn--ghost-navy">Contour</button><button data-s="btn--ghost-white">Clair</button></div></div>';
  H+='<div class="fieldrow"><label>Lien (destination)</label><input type="url" id="bHref" value="'+esc(el.getAttribute('href')||'')+'" placeholder="#contact ou https://…"></div>';
  return H;
}
function linkFields(el){
  var H='<div class="fieldrow"><label>Libellé</label><input type="text" id="lText" value="'+esc(el.textContent.trim())+'"></div>';
  H+='<div class="fieldrow"><label>Destination</label><input type="url" id="lHref" value="'+esc(el.getAttribute('href')||'')+'" placeholder="#section ou https://…"></div>';
  return H;
}
function imageFields(el){
  var rad=parseInt(el.style.borderRadius)||0, hasSh=!!el.style.boxShadow;
  var H='<button class="btn-full btn-out" id="iReplace" style="margin-bottom:14px">↺ Remplacer l\'image</button>';
  H+='<div class="fieldrow"><label>Coins arrondis — '+rad+'px</label><input type="range" class="range" id="iRad" min="0" max="40" value="'+rad+'"></div>';
  H+='<div class="toggle"><b>Ombre portée</b><div class="sw-toggle'+(hasSh?' on':'')+'" id="iShadow"></div></div>';
  H+='<div class="fieldrow" style="margin-top:14px"><label>Texte alternatif (SEO)</label><input type="text" id="iAlt" value="'+esc(el.getAttribute('alt')||'')+'" placeholder="Décrivez l\'image"></div>';
  return H;
}

function bindInspector(type,el){
  if(type==='text'){
    var sw=$('#fColor'); PALETTE.forEach(function(c){ var b=doc1(c,el.style.color); var d=document.createElement('div'); d.className='sw'+(b?' on':''); d.style.background=c; d.title=c; d.onclick=function(){ el.style.color=c; $$('#fColor .sw').forEach(function(x){x.classList.remove('on');}); d.classList.add('on'); commit(); }; sw.appendChild(d); });
    $$('#fWeight button',document).forEach(function(b){ if(b.dataset.w===String(win.getComputedStyle(el).fontWeight)) b.classList.add('on'); b.onclick=function(){ $$('#fWeight button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); el.style.fontWeight=b.dataset.w; commit(); }; });
    var al=el.style.textAlign||win.getComputedStyle(el).textAlign;
    $$('#fAlign button',document).forEach(function(b){ if(b.dataset.a===al||(al==='start'&&b.dataset.a==='left')) b.classList.add('on'); b.onclick=function(){ $$('#fAlign button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); el.style.textAlign=b.dataset.a; commit(); }; });
    $$('.stepper button',document).forEach(function(b){ b.onclick=function(){ var s=parseInt(win.getComputedStyle(el).fontSize)||16; s=Math.max(10,Math.min(80,s+parseInt(b.dataset.step))); el.style.fontSize=s+'px'; $('#fSize').textContent=s+'px'; b.closest('.fieldrow').querySelector('label').textContent='Taille — '+s+'px'; commit(); }; });
  }
  else if(type==='button'){
    $('#bText').oninput=function(){ setBtnText(el,this.value); markDirty(); }; $('#bText').onchange=commit;
    $('#bHref').onchange=function(){ el.setAttribute('href',this.value); commit(); };
    var classes=['btn--navy','btn--ghost-navy','btn--ghost-white'];
    $$('#bStyle button',document).forEach(function(b){ if(el.classList.contains(b.dataset.s)) b.classList.add('on'); b.onclick=function(){ classes.forEach(function(c){el.classList.remove(c);}); el.classList.add(b.dataset.s); $$('#bStyle button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); commit(); }; });
  }
  else if(type==='link'){
    $('#lText').oninput=function(){ setBtnText(el,this.value); markDirty(); }; $('#lText').onchange=commit;
    $('#lHref').onchange=function(){ el.setAttribute('href',this.value); commit(); };
  }
  else if(type==='image'){
    $('#iReplace').onclick=function(){ pickImage(function(url){ el.src=url; commit(); }); };
    $('#iRad').oninput=function(){ el.style.borderRadius=this.value+'px'; this.closest('.fieldrow').querySelector('label').textContent='Coins arrondis — '+this.value+'px'; markDirty(); };
    $('#iRad').onchange=commit;
    $('#iShadow').onclick=function(){ this.classList.toggle('on'); el.style.boxShadow=this.classList.contains('on')?'0 22px 50px rgba(20,40,80,.18)':''; commit(); };
    $('#iAlt').onchange=function(){ el.setAttribute('alt',this.value); commit(); };
  }
}
function doc1(c,cur){ return cur&&rgbToHex(cur).toLowerCase()===c.toLowerCase(); }
function setBtnText(el,v){ // remplace le texte en gardant d'éventuels enfants inline (ex: span)
  var done=false; [].forEach.call(el.childNodes,function(n){ if(!done&&n.nodeType===3){ n.nodeValue=v; done=true; } });
  if(!done) el.insertBefore(doc.createTextNode(v), el.firstChild);
}

/* ------------------------------------------------------- THEME */
function renderTheme(){
  var box=$('#themeColors'); box.innerHTML='';
  THEMEVARS.forEach(function(t){
    var val=rgbToHex(win.getComputedStyle(doc.documentElement).getPropertyValue(t.v).trim()||'#000');
    var row=document.createElement('div'); row.className='colorline';
    row.innerHTML='<input type="color" value="'+val+'"><span>'+t.label+'</span><code>'+val+'</code>';
    var inp=row.querySelector('input');
    inp.oninput=function(){ doc.documentElement.style.setProperty(t.v,this.value); row.querySelector('code').textContent=this.value; markDirty(); };
    inp.onchange=commit;
    box.appendChild(row);
  });
  $('#fontSel').value=curFont;
  $('#fontSel').onchange=function(){ applyFont(this.value); commit(); };
  $$('#spaceSel button').forEach(function(b){ b.classList.toggle('on',b.dataset.s===curSpace); b.onclick=function(){ applySpace(b.dataset.s); $$('#spaceSel button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); commit(); }; });
}
function applyFont(p){ curFont=p; var f=FONTS[p]; var l=doc.getElementById('ed-font'); if(!l){ l=doc.createElement('link'); l.id='ed-font'; l.rel='stylesheet'; doc.head.appendChild(l); } l.href=f.link?('https://fonts.googleapis.com/css2?family='+f.link+'&display=swap'):''; edRules.font=f.body!=='"Open Sans"'||f.head!=='"Open Sans"'?('body{font-family:'+f.body+',system-ui,sans-serif}h1,h2,h3{font-family:'+f.head+',system-ui,sans-serif}'):''; recompose(); }
function applySpace(s){ curSpace=s; edRules.space=SPACE[s]||''; recompose(); }
function recompose(){ doc.getElementById('ed-theme').textContent=edRules.font+edRules.space; }

/* ------------------------------------------------------- PAGES (multi-pages) */
function renderPages(){
  var box=$('#pageList'); if(!box) return; box.innerHTML='';
  PAGES.forEach(function(p){
    var row=document.createElement('div'); row.className='row'+(p.id===currentPage?' sel':'');
    row.innerHTML='<span class="row__grip">'+(p.id==='index'?'⌂':'▸')+'</span><span class="row__name">'+p.label+'</span>'+(p.id===currentPage?'<span style="color:var(--cyan);font-size:11px;font-weight:700;white-space:nowrap">● en cours</span>':'');
    row.onclick=function(){ switchPage(p.id); };
    box.appendChild(row);
  });
}
function switchPage(id){
  if(id===currentPage) return;
  if(dirty) autosave();
  deselect();
  currentPage=id;
  var p=PAGES.filter(function(x){ return x.id===id; })[0];
  setSave(true);
  frame.removeAttribute('srcdoc');   /* sinon srcdoc (page tout juste créée) a la priorité sur src */
  frame.src=p.file+'?edit=1';        /* le load déclenche init() → ré-initialisation complète pour la nouvelle page */
}

/* ------------------------------------------------------- SECTIONS */
function renderSections(){
  var list=$('#secList'); list.innerHTML='';
  $$('main > section',doc).forEach(function(sec,i){
    var row=document.createElement('div'); row.className='row'; row.draggable=true; row.dataset.id=sec.id;
    row.innerHTML='<span class="row__grip">⠿</span><span class="row__name">'+esc(secName(sec))+'</span>'+
      '<span class="row__act">'+
      '<button data-act="up" title="Monter">▲</button>'+
      '<button data-act="down" title="Descendre">▼</button>'+
      '<button data-act="dup" title="Dupliquer">⧉</button>'+
      '<button data-act="hide" title="'+(sec.classList.contains('ed-hidden')?'Afficher':'Masquer')+'">'+(sec.classList.contains('ed-hidden')?'◉':'👁')+'</button>'+
      '<button data-act="del" title="Supprimer">🗑</button></span>';
    row.querySelector('.row__name').onclick=function(){ sec.scrollIntoView({behavior:'smooth',block:'start'}); };
    row.querySelectorAll('[data-act]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); secAction(b.dataset.act,sec); }; });
    bindDnd(row,sec);
    list.appendChild(row);
  });
}
function secName(sec){ var h=sec.querySelector('h1,h2,h3'); return (h?h.textContent.trim():sec.id)||'Section'; }
function secAction(a,sec){
  if(a==='up'){ var p=sec.previousElementSibling; if(p&&p.tagName==='SECTION') sec.parentNode.insertBefore(sec,p); }
  else if(a==='down'){ var n=sec.nextElementSibling; if(n&&n.tagName==='SECTION') sec.parentNode.insertBefore(n,sec); }
  else if(a==='dup'){ endInlineEdit(); var c=sec.cloneNode(true); [].forEach.call(c.querySelectorAll('.ed-sel,[contenteditable]'),function(x){ x.classList.remove('ed-sel'); x.removeAttribute('contenteditable'); }); c.id=uniqueId(sec.id+'-copie'); [].forEach.call(c.querySelectorAll('[id]'),function(n){ n.id=uniqueId(n.id); }); sec.parentNode.insertBefore(c,sec.nextSibling); }
  else if(a==='hide'){ sec.classList.toggle('ed-hidden'); }
  else if(a==='del'){ confirmModal('Supprimer cette section ?','« '+secName(sec)+' » sera retirée de la page.',function(){ sec.remove(); finishStructural(); }); return; }
  finishStructural();
}
function finishStructural(){ markEditable(); renderSections(); commit(); }
function syncSectionSel(el){ var sec=el?el.closest('main > section'):null; $$('#secList .row').forEach(function(r){ r.classList.toggle('sel',sec&&r.dataset.id===sec.id); }); }

/* drag & drop réordonnancement */
var dragRow=null;
function bindDnd(row,sec){
  row.ondragstart=function(){ dragRow=sec; row.classList.add('dragging'); };
  row.ondragend=function(){ row.classList.remove('dragging'); $$('#secList .row').forEach(function(r){r.classList.remove('drag-over');}); };
  row.ondragover=function(e){ e.preventDefault(); row.classList.add('drag-over'); };
  row.ondragleave=function(){ row.classList.remove('drag-over'); };
  row.ondrop=function(e){ e.preventDefault(); if(dragRow&&dragRow!==sec){ sec.parentNode.insertBefore(dragRow,sec); finishStructural(); } };
}

/* ------------------------------------------------------- COMPONENTS */
var BLOCKS={
  cta:{name:'Appel à action',html:'<section class="section cta"><div class="wrap cta__box"><h2>Un titre qui donne envie d\'agir</h2><p>Décrivez en une phrase la valeur que vous apportez à vos clients.</p><a href="#contact" class="btn btn--navy">Nous contacter</a></div></section>'},
  cols2:{name:'2 colonnes',html:'<section class="section twocol"><div class="wrap"><div><img src="assets/photo-38.png" alt=""></div><div><h2 class="h-sec">Titre de la colonne</h2><div class="about__rule"></div><p class="about__col" style="margin-top:14px">Un paragraphe pour présenter votre activité, votre méthode ou votre équipe. Cliquez pour modifier ce texte.</p></div></div></section>'},
  cols3:{name:'3 colonnes',html:'<section class="section services"><div class="wrap"><div class="cards"><article class="card"><div class="card__ic"><img src="assets/photo-38.png" alt=""></div><h3>Colonne 1</h3><p>Décrivez ce service en quelques mots.</p></article><article class="card"><div class="card__ic"><img src="assets/photo-40.png" alt=""></div><h3>Colonne 2</h3><p>Décrivez ce service en quelques mots.</p></article><article class="card"><div class="card__ic"><img src="assets/photo-37.png" alt=""></div><h3>Colonne 3</h3><p>Décrivez ce service en quelques mots.</p></article></div></div></section>'},
  tmoi:{name:'Témoignages',html:'<section class="section"><div class="wrap"><div class="tmoi-grid"><div class="tmoi-card"><p>« Un accompagnement clair et réactif, exactement ce qu\'il nous fallait. »</p><b>Client satisfait</b><span>Dirigeant de PME</span></div><div class="tmoi-card"><p>« Des conseils précieux qui nous ont fait gagner un temps fou. »</p><b>Cliente fidèle</b><span>Gérante</span></div></div></div></section>'},
  gallery:{name:'Galerie',html:'<section class="section"><div class="wrap"><div class="gal-grid"><img src="assets/hero.png" alt=""><img src="assets/photo-37.png" alt=""><img src="assets/photo-38.png" alt=""></div></div></section>'},
  contact:{name:'Contact',html:'<section class="section contactblk"><div class="wrap"><div><h2 class="h-sec">Contactez-nous</h2><div class="about__rule"></div><p class="about__col" style="margin-top:14px">Une question ? Écrivez-nous, nous répondons sous 24 h.</p></div><div><input class="cfield" placeholder="Votre nom"><input class="cfield" placeholder="Votre e-mail"><textarea class="cfield" rows="4" placeholder="Votre message"></textarea><a href="#" class="btn btn--navy">Envoyer</a></div></div></section>'}
};
function renderComponents(){
  var box=$('#compList'); box.innerHTML='';
  Object.keys(BLOCKS).forEach(function(k){
    var b=document.createElement('button');
    b.innerHTML='<span class="glyph">'+blockGlyph(k)+'</span>'+BLOCKS[k].name;
    b.onclick=function(){ insertBlock(k); };
    box.appendChild(b);
  });
}
function blockGlyph(k){ var g={cta:'▭',cols2:'▤',cols3:'▦',tmoi:'❝',gallery:'▣',contact:'✉'}; return '<span style="font-size:20px">'+(g[k]||'▦')+'</span>'; }
function insertBlock(k){
  var main=doc.querySelector('main'); var tmp=doc.createElement('div'); tmp.innerHTML=BLOCKS[k].html.trim();
  var node=tmp.firstChild; var ref=selected?selected.closest('main > section'):null;
  if(ref) ref.parentNode.insertBefore(node,ref.nextSibling); else main.appendChild(node);
  finishStructural(); node.scrollIntoView({behavior:'smooth',block:'center'}); toast('Bloc « '+BLOCKS[k].name+' » ajouté');
}

/* ------------------------------------------------------- MEDIA */
var media=[];
function renderMedia(){
  var box=$('#mediaList'); box.innerHTML='';
  $$('img',doc).slice(0,30).forEach(function(im){ if(media.indexOf(im.src)<0) media.push(im.src); });
  media.forEach(function(src){
    var b=document.createElement('button'); b.innerHTML='<span class="glyph" style="height:54px;overflow:hidden"><img src="'+src+'" style="width:100%;height:100%;object-fit:cover;border-radius:4px"></span>';
    b.title='Remplacer l\'image sélectionnée'; b.onclick=function(){ if(selected&&selected.getAttribute('data-ed')==='image'){ selected.src=src; commit(); toast('Image appliquée'); } else toast('Sélectionne d\'abord une image dans la page'); };
    box.appendChild(b);
  });
  $('#mediaUp').onclick=function(){ $('#mediaInput').click(); };
  $('#mediaInput').onchange=function(){ [].forEach.call(this.files,function(f){ readFile(f,function(u){ media.push(u); renderMedia(); }); }); toast('Image(s) importée(s)'); };
}
function readFile(file,cb){ var fr=new FileReader(); fr.onload=function(){ cb(fr.result); }; fr.readAsDataURL(file); } /* dataURL : survit à l'export et au rechargement (≠ blob: temporaire) */
function pickImage(cb){ var i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=function(){ if(i.files[0]) readFile(i.files[0],function(u){ media.push(u); cb(u); }); }; i.click(); }

/* ------------------------------------------------------- HISTORY / STATE */
function getTheme(){ var vars={}; THEMEVARS.forEach(function(t){ vars[t.v]=doc.documentElement.style.getPropertyValue(t.v).trim()||rgbToHex(win.getComputedStyle(doc.documentElement).getPropertyValue(t.v).trim()); }); return {vars:vars,font:curFont,space:curSpace}; }
function cleanHTML(){ var b=doc.body.cloneNode(true); $$('.ed-sel,.ed-hover',b).forEach(function(x){x.classList.remove('ed-sel','ed-hover');}); $$('[contenteditable]',b).forEach(function(x){x.removeAttribute('contenteditable');}); return b.innerHTML; }
function snapshot(){ return {html:cleanHTML(),theme:getTheme(),seo:getSEO()}; }
function endInlineEdit(){ if(selected&&selected.isContentEditable) selected.contentEditable='false'; $$('[contenteditable="true"]',doc).forEach(function(x){ x.contentEditable='false'; }); }
function flushSnap(){ if(snapTimer){ clearTimeout(snapTimer); snapTimer=null; if(dirty) commit(); } }
function reexecScripts(){ $$('script',doc.body).forEach(function(old){ var s=doc.createElement('script'); [].forEach.call(old.attributes,function(a){ s.setAttribute(a.name,a.value); }); s.textContent=old.textContent; old.parentNode.replaceChild(s,old); }); }
function uniqueId(base){ var id=base,n=2; while(doc.getElementById(id)){ id=base+'-'+n; n++; } return id; }
function applyState(st,silent){
  endInlineEdit();
  suppress=true;
  doc.body.innerHTML=st.html;
  reexecScripts();                 /* FIX P0: ré-exécute le JS du site (FAQ, menu, header) sinon aperçu inerte */
  if(st.theme){ Object.keys(st.theme.vars||{}).forEach(function(k){ if(st.theme.vars[k]) doc.documentElement.style.setProperty(k,st.theme.vars[k]); }); applyFont(st.theme.font||'open'); applySpace(st.theme.space||'normal'); }
  applySEO(st.seo);
  markEditable(); selected=null; emptyInspector(); renderSections(); renderTheme(); renderSEO();
  suppress=false;
}
function resetHistory(){ history=[snapshot()]; hi=0; updateUndo(); }
function commit(){ if(suppress) return; var snap=snapshot(); if(history[hi]&&JSON.stringify(history[hi])===JSON.stringify(snap)){ markDirty(); return; } history=history.slice(0,hi+1); history.push(snap); hi++; updateUndo(); markDirty(); }
function scheduleSnap(){ markDirty(); clearTimeout(snapTimer); snapTimer=setTimeout(commit,600); }
function undo(){ flushSnap(); endInlineEdit(); if(hi>0){ hi--; applyState(history[hi],true); updateUndo(); markDirty(); } }
function redo(){ flushSnap(); endInlineEdit(); if(hi<history.length-1){ hi++; applyState(history[hi],true); updateUndo(); markDirty(); } }
function updateUndo(){ $('#undo').disabled=hi<=0; $('#redo').disabled=hi>=history.length-1; }

/* ------------------------------------------------------- AUTOSAVE / VERSIONS */
function markDirty(){ dirty=true; setSave(false); }
function setSave(saved){ var s=$('#save'); s.classList.toggle('saving',!saved); $('#saveTxt').textContent=saved?'Enregistré':'Modifications…'; }
function autosave(){ if(!dirty) return; if(save(stateKey(),snapshot())){ dirty=false; setSave(true); } else { setSave(false); toast('Stockage local plein (images lourdes) — utilise « Publier » pour ne rien perdre'); } }
function renderVersions(){
  var box=$('#verList'); box.innerHTML=''; if(!versions.length){ box.innerHTML='<p class="empty-note">Aucune version enregistrée. Crée un point de restauration avant une grosse modification.</p>'; }
  versions.slice().reverse().forEach(function(v,idx){ var i=versions.length-1-idx;
    var row=document.createElement('div'); row.className='vrow';
    row.innerHTML='<div class="vt"><b>'+esc(v.label)+'</b><small>'+v.date+'</small></div><button class="tbtn" data-i="'+i+'">Restaurer</button>';
    row.querySelector('button').onclick=function(){ confirmModal('Restaurer cette version ?','La page actuelle sera remplacée par « '+v.label+' ».',function(){ applyState(v,true); commit(); toast('Version restaurée'); }); };
    box.appendChild(row);
  });
  $('#snapNow').onclick=function(){ var d=new Date(); versions.push({label:'Version '+(versions.length+1),date:d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),html:cleanHTML(),theme:getTheme()}); if(save(versKey(),versions)){ renderVersions(); toast('Version enregistrée'); } else { versions.pop(); toast('Version non enregistrée : stockage plein'); } };
}

/* ------------------------------------------------------- DEVICE / PREVIEW / PUBLISH */
$$('#device button').forEach(function(b){ b.onclick=function(){ $$('#device button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); stage.dataset.d=b.dataset.d; $('#dtag').textContent=b.dataset.d==='tablet'?'Tablette · 768px':'Mobile · 390px'; }; });
$('#preview').onclick=function(){ var blob=new Blob([exportDoc()],{type:'text/html'}); window.open(URL.createObjectURL(blob),'_blank'); };
$('#publish').onclick=function(){ openValidation(); };
$('#saveOnline').onclick=saveOnline;
$('#addPageBtn').onclick=addPage;
authInit();
$('#undo').onclick=undo; $('#redo').onclick=redo;

function exportDoc(){
  var cl=doc.documentElement.cloneNode(true);
  var rm=cl.querySelector('#ed-style'); if(rm) rm.remove();
  var ft=cl.querySelector('#ed-font'); if(ft&&!ft.getAttribute('href')) ft.remove();   /* FIX P2: pas de <link> police vide */
  cl.classList.remove('ed-mode');
  [].forEach.call(cl.querySelectorAll('[data-ed],[data-ed-q]'),function(x){ x.removeAttribute('data-ed'); x.removeAttribute('data-ed-q'); });
  [].forEach.call(cl.querySelectorAll('.ed-hidden'),function(x){ x.classList.remove('ed-hidden'); x.setAttribute('hidden',''); });   /* FIX P1: section masquée reste masquée à l'export */
  [].forEach.call(cl.querySelectorAll('.ed-sel,.ed-hover'),function(x){ x.classList.remove('ed-sel','ed-hover'); });
  [].forEach.call(cl.querySelectorAll('[contenteditable]'),function(x){ x.removeAttribute('contenteditable'); });
  var bs=cl.querySelector('base'); if(bs) bs.remove();   /* jamais de <base> (preview srcdoc) dans le fichier publié */
  return '<!DOCTYPE html>\n'+cl.outerHTML;
}
function download(name,content){ var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'text/html'})); a.download=name; a.click(); }

/* ------------------------------------------------------- ENREGISTRER EN LIGNE (commit GitHub) */
var GH={ owner:'ynelstudio', repo:'parfi', branch:'main' };
function ghToken(){ try{ return localStorage.getItem('parfi-gh-token')||''; }catch(e){ return ''; } }
function repoPathFor(id){ var p=PAGES.filter(function(x){ return x.id===id; })[0]; return 'editor/'+p.file; }   /* p.file = "site/index.html" */
function b64utf8(s){ return btoa(unescape(encodeURIComponent(s))); }
function saveOnline(){
  var page=PAGES.filter(function(x){ return x.id===currentPage; })[0];
  if(!ghToken()){ askToken(saveOnline); return; }
  confirmModal('Enregistrer « '+page.label+' » en ligne ?','La page sera publiée sur le site. La mise à jour est visible dans ~30 secondes.',function(){ doCommit(repoPathFor(currentPage), page.label); });
}
function doCommit(path,label){
  endInlineEdit(); flushSnap();
  setSave(false); toast('Enregistrement en ligne…');
  commitContent(path, exportDoc(), 'Edition de '+label+' (editeur visuel)')
    .then(function(){ dirty=false; setSave(true); toast('✓ Enregistré en ligne — le site se met à jour (~30 s)'); })
    .catch(function(err){ setSave(false); toast('Échec de l\'enregistrement : '+err.message); });
}
function askToken(after){
  showModal('<h3>Connecter GitHub (une seule fois)</h3>'
    +'<p class="sub">Pour enregistrer en ligne, l\'éditeur a besoin d\'un jeton. Il reste <b>uniquement dans ton navigateur</b> et n\'est jamais publié.</p>'
    +'<ol class="hint" style="margin:0 0 14px;padding-left:18px;line-height:1.95">'
    +'<li>Ouvre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token</a></li>'
    +'<li><b>Repository access</b> → Only select repositories → <b>ynelstudio/parfi</b></li>'
    +'<li><b>Permissions</b> → <b>Contents</b> → <b>Read and write</b></li>'
    +'<li>Generate token → copie-le → colle-le ci-dessous.</li></ol>'
    +'<input type="password" id="ghTok" placeholder="github_pat_…" autocomplete="off" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:8px;margin-bottom:6px">'
    +'<div class="modal__act"><button class="tbtn" id="tkCancel">Annuler</button><button class="tbtn tbtn--primary" id="tkSave">Connecter</button></div>');
  $('#tkCancel').onclick=closeModal;
  $('#tkSave').onclick=function(){ var v=($('#ghTok').value||'').trim(); if(!v){ $('#ghTok').focus(); return; } try{ localStorage.setItem('parfi-gh-token',v); }catch(e){} closeModal(); toast('GitHub connecté ✓'); if(after) after(); };
}

/* ------------------------------------------------------- VALIDATION */
function openValidation(){
  var checks=[];
  var emptyTx=$$('[data-ed="text"]',doc).filter(function(e){return !e.textContent.trim();});
  checks.push(emptyTx.length?{s:'err',t:emptyTx.length+' texte(s) vide(s)',d:'Remplis-les avant de publier.'}:{s:'ok',t:'Textes',d:'Aucun texte vide.'});
  var brokeImg=$$('img',doc).filter(function(i){return !i.getAttribute('src');});
  checks.push(brokeImg.length?{s:'err',t:brokeImg.length+' image(s) sans source',d:'Remplace-les.'}:{s:'ok',t:'Images',d:'Toutes les images ont une source.'});
  var noAlt=$$('img',doc).filter(function(i){return !i.getAttribute('alt');});
  checks.push(noAlt.length?{s:'warn',t:noAlt.length+' image(s) sans texte alternatif',d:'Recommandé pour le SEO/accessibilité.'}:{s:'ok',t:'Accessibilité images',d:'Tous les alt sont présents.'});
  var dead=$$('a[href]',doc).filter(function(a){var h=a.getAttribute('href');return h===''||h==='#';});
  checks.push(dead.length?{s:'warn',t:dead.length+' lien(s) à vérifier',d:'Certains liens pointent vers « # ».'}:{s:'ok',t:'Liens',d:'Aucun lien vide.'});
  var contrast=contrastIssues();
  checks.push(contrast?{s:'warn',t:'Contraste à surveiller',d:contrast}:{s:'ok',t:'Contraste',d:'Couleurs de texte lisibles.'});
  var critical=checks.some(function(c){return c.s==='err';});
  var H='<h3>Validation avant publication</h3><p class="sub">'+(critical?'⚠️ Corrige les points rouges avant de publier.':'✅ Tout est bon — prêt à publier.')+'</p>';
  checks.forEach(function(c){ H+='<div class="check '+c.s+'"><span class="mk">'+(c.s==='ok'?'✓':c.s==='warn'?'!':'✕')+'</span><div><b>'+c.t+'</b><small>'+c.d+'</small></div></div>'; });
  H+='<div class="modal__act"><button class="tbtn" id="mCancel">Fermer</button><button class="tbtn tbtn--primary" id="mPublish"'+(critical?' disabled':'')+'>⬇ Publier (télécharger index.html)</button></div>';
  showModal(H);
  $('#mCancel').onclick=closeModal;
  if(!critical) $('#mPublish').onclick=function(){ download('index.html',exportDoc()); closeModal(); toast('Site publié — index.html téléchargé ✓'); };
}
function contrastIssues(){
  var bad=0;
  $$('[data-ed="text"]',doc).forEach(function(e){ var col=e.style.color; if(!col) return; var bg=bgOf(e); if(bg&&ratio(col,bg)<4.5) bad++; });
  return bad?bad+' texte(s) au contraste limité (ratio < 4.5).':'';
}

/* ------------------------------------------------------- KEYBOARD */
window.addEventListener('keydown',handleKeys);
function handleKeys(e){
  var ctrl=e.ctrlKey||e.metaKey, t=e.target, tag=t&&t.tagName;
  if(tag&&/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;                          /* FIX P0: champ du panneau → ne rien intercepter */
  if(t&&t.isContentEditable&&ctrl&&/^(z|y)$/.test(e.key.toLowerCase())) return;   /* FIX P1: édition texte → undo natif du navigateur */
  if(ctrl&&e.key.toLowerCase()==='z'&&!e.shiftKey){ e.preventDefault(); undo(); }
  else if(ctrl&&(e.key.toLowerCase()==='y'||(e.key.toLowerCase()==='z'&&e.shiftKey))){ e.preventDefault(); redo(); }
  else if(ctrl&&e.key.toLowerCase()==='d'){ e.preventDefault(); if(selected){ var sec=selected.closest('main > section'); if(sec) secAction('dup',sec); } }
  else if(e.key==='Escape'){ deselect(); }
  else if((e.key==='Delete'||e.key==='Backspace')&&selected&&!selected.isContentEditable){ var ty=selected.getAttribute('data-ed'); if(ty==='image'||ty==='button'||ty==='link'){ e.preventDefault(); var el=selected; deselect(); el.remove(); commit(); toast('Élément supprimé'); } }
}

/* ------------------------------------------------------- MODALE / TOAST / UTILS */
function showModal(html){ $('#modal').innerHTML=html; $('#backdrop').classList.add('on'); }
function closeModal(){ $('#backdrop').classList.remove('on'); }
$('#backdrop').addEventListener('click',function(e){ if(e.target===this) {} }); // pas de fermeture au clic extérieur
function confirmModal(title,msg,onYes){ showModal('<h3>'+title+'</h3><p class="sub">'+msg+'</p><div class="modal__act"><button class="tbtn" id="cNo">Annuler</button><button class="tbtn tbtn--primary" id="cYes">Confirmer</button></div>'); $('#cNo').onclick=closeModal; $('#cYes').onclick=function(){ closeModal(); onYes(); }; }
var toastT;
function toast(m){ var t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(function(){t.classList.remove('on');},2200); }

/* onglets gauche */
$$('#ltabs button').forEach(function(b){ b.onclick=function(){ $$('#ltabs button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); $$('.tabpane').forEach(function(p){ p.classList.toggle('on',p.dataset.p===b.dataset.t); }); }; });

function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function save(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function rgbToHex(c){ if(!c) return '#000000'; if(c[0]==='#') return c.length===4?('#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]):c; var m=c.match(/\d+/g); if(!m) return '#000000'; return '#'+m.slice(0,3).map(function(n){return ('0'+parseInt(n).toString(16)).slice(-2);}).join(''); }
function lum(hex){ var h=rgbToHex(hex).substring(1); var r=parseInt(h.substr(0,2),16)/255,g=parseInt(h.substr(2,2),16)/255,b=parseInt(h.substr(4,2),16)/255; var f=function(x){return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);}; return .2126*f(r)+.7152*f(g)+.0722*f(b); }
function ratio(a,b){ var l1=lum(a),l2=lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
function bgOf(el){ var n=el; for(var i=0;i<8&&n;i++){ var c=win.getComputedStyle(n).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent') return rgbToHex(c); n=n.parentElement; } return '#ffffff'; }

/* ===================================================================
   AUTH (login back-office) + GESTION DES UTILISATEURS — côté navigateur.
   Mots de passe en empreinte SHA-256 (jamais en clair). Barrière d'accès,
   pas une sécurité serveur (la vraie auth = Phase 2 backend).
=================================================================== */
var DEFAULT_USERS=[{email:'contact@ynelstudio.fr',hash:'0f631a05df4ed1669dcd56b2346d871c0a7383800e681a3a04fb0856359f2453',role:'admin'}];
function users(){ try{ var u=JSON.parse(localStorage.getItem('parfi-users')); return (u&&u.length)?u:DEFAULT_USERS.slice(); }catch(e){ return DEFAULT_USERS.slice(); } }
function setUsers(list){ try{ localStorage.setItem('parfi-users',JSON.stringify(list)); }catch(e){} }
function session(){ try{ return JSON.parse(localStorage.getItem('parfi-auth')); }catch(e){ return null; } }
function isAuthed(){ var s=session(); return !!(s&&s.email&&s.exp&&s.exp>Date.now()); }
function sha256(s){ var b=new TextEncoder().encode(s); return crypto.subtle.digest('SHA-256',b).then(function(h){ return [].map.call(new Uint8Array(h),function(x){ return ('0'+x.toString(16)).slice(-2); }).join(''); }); }
function authInit(){
  var login=$('#login'); if(!login) return;
  if(isAuthed()){ login.classList.add('hidden'); afterLogin(); }
  else { login.classList.remove('hidden'); setTimeout(function(){ var e=$('#loginEmail'); if(e) e.focus(); },60); }
  $('#loginForm').addEventListener('submit',function(ev){ ev.preventDefault(); doLogin(); });
  $('#logoutBtn').onclick=function(){ try{ localStorage.removeItem('parfi-auth'); }catch(e){} location.reload(); };
  $('#usersBtn').onclick=openUsers;
}
function doLogin(){
  var email=($('#loginEmail').value||'').trim(), pass=$('#loginPass').value||'', btn=$('#loginBtn');
  btn.disabled=true; $('#loginErr').textContent='';
  var u=users().filter(function(x){ return x.email.toLowerCase()===email.toLowerCase(); })[0];
  sha256(pass).then(function(h){
    if(u&&h===u.hash){ try{ localStorage.setItem('parfi-auth',JSON.stringify({email:u.email,role:u.role,exp:Date.now()+7*864e5})); }catch(e){} $('#login').classList.add('hidden'); afterLogin(); }
    else { $('#loginErr').textContent='E-mail ou mot de passe incorrect.'; btn.disabled=false; $('#loginPass').value=''; $('#loginPass').focus(); }
  });
}
function afterLogin(){ var s=session()||{}; var w=$('#whoEmail'); if(w) w.textContent=s.email||''; var ub=$('#usersBtn'); if(ub) ub.classList.toggle('hide', s.role!=='admin'); }
function openUsers(){
  var list=users();
  var H='<h3>Utilisateurs du back-office</h3><p class="sub">Qui peut se connecter. Mots de passe stockés en empreinte (jamais en clair).</p>';
  list.forEach(function(u,i){ H+='<div class="urow"><span class="ue">'+esc(u.email)+'</span><span class="ur">'+esc(u.role)+'</span><button class="udel" data-i="'+i+'" title="Supprimer">✕</button></div>'; });
  H+='<h4>Ajouter un utilisateur</h4><div class="uadd">'
   +'<input class="full" id="nuEmail" type="email" placeholder="email@exemple.fr" autocomplete="off">'
   +'<input id="nuPass" type="password" placeholder="mot de passe" autocomplete="new-password">'
   +'<select id="nuRole"><option value="editor">Éditeur</option><option value="admin">Admin</option></select>'
   +'<button class="tbtn tbtn--primary full" id="nuAdd">Ajouter</button></div>'
   +'<h4>Changer mon mot de passe</h4><div class="uadd"><input class="full" id="cpPass" type="password" placeholder="nouveau mot de passe" autocomplete="new-password"><button class="tbtn full" id="cpBtn">Mettre à jour</button></div>'
   +'<div class="modal__act"><button class="tbtn" id="uClose">Fermer</button></div>';
  showModal(H);
  $('#uClose').onclick=closeModal;
  $$('#modal .udel').forEach(function(b){ b.onclick=function(){ var i=+b.dataset.i, l=users(); if(l.length<=1){ toast('Impossible de supprimer le dernier utilisateur'); return; } if(l[i].email===(session()||{}).email){ toast('Tu ne peux pas te supprimer toi-même'); return; } l.splice(i,1); setUsers(l); openUsers(); }; });
  $('#nuAdd').onclick=function(){ var e=($('#nuEmail').value||'').trim(), p=$('#nuPass').value||'', r=$('#nuRole').value; if(!e||!p){ toast('E-mail et mot de passe requis'); return; } var l=users(); if(l.some(function(x){ return x.email.toLowerCase()===e.toLowerCase(); })){ toast('Cet e-mail existe déjà'); return; } sha256(p).then(function(h){ l.push({email:e,hash:h,role:r}); setUsers(l); openUsers(); toast('Utilisateur ajouté ✓'); }); };
  $('#cpBtn').onclick=function(){ var p=$('#cpPass').value||''; if(p.length<4){ toast('Mot de passe trop court'); return; } var me=(session()||{}).email; sha256(p).then(function(h){ setUsers(users().map(function(x){ if(x.email===me) x.hash=h; return x; })); toast('Mot de passe mis à jour ✓'); closeModal(); }); };
}

/* ===================================================================
   SEO par page (titre, description, Open Graph) + aperçu Google
=================================================================== */
function getMeta(name,attr){ attr=attr||'name'; return doc.head.querySelector('meta['+attr+'="'+name+'"]'); }
function setMeta(name,attr,content){ attr=attr||'name'; var m=getMeta(name,attr); if(!m){ m=doc.createElement('meta'); m.setAttribute(attr,name); doc.head.appendChild(m); } m.setAttribute('content',content||''); }
function getSEO(){ if(!doc) return null; var t=doc.querySelector('title'); function mc(n,a){ var m=getMeta(n,a); return m?(m.getAttribute('content')||''):''; }
  return { title:t?t.textContent:'', desc:mc('description','name'), ogt:mc('og:title','property'), ogd:mc('og:description','property'), ogi:mc('og:image','property') }; }
function applySEO(s){ if(!s||!doc) return; var t=doc.querySelector('title'); if(!t){ t=doc.createElement('title'); doc.head.appendChild(t); } t.textContent=s.title||''; setMeta('description','name',s.desc||''); setMeta('og:title','property',s.ogt||s.title||''); setMeta('og:description','property',s.ogd||s.desc||''); if(s.ogi) setMeta('og:image','property',s.ogi); }
function renderSEO(){
  var box=$('#seoPanel'); if(!box||!doc) return; var s=getSEO();
  box.innerHTML='<div class="seo-field"><label>Titre <span class="count" id="seoTc"></span></label><input id="seoTitle" type="text" value="'+esc(s.title)+'"></div>'
    +'<div class="seo-field"><label>Description <span class="count" id="seoDc"></span></label><textarea id="seoDesc">'+esc(s.desc)+'</textarea></div>'
    +'<div class="gpreview"><div class="gt" id="gpT"></div><div class="gu">ynelstudio.github.io › parfi</div><div class="gd" id="gpD"></div></div>'
    +'<div class="seo-field"><label>Image de partage (URL)</label><input id="seoOg" type="url" placeholder="https://…/image.jpg" value="'+esc(s.ogi)+'"></div>';
  function refresh(){ var t=$('#seoTitle').value, d=$('#seoDesc').value; $('#gpT').textContent=t||'Titre de la page'; $('#gpD').textContent=d||'La description s\'affichera ici dans les résultats Google.'; var tc=$('#seoTc'); tc.textContent=t.length+'/60'; tc.classList.toggle('warn',t.length>60); var dc=$('#seoDc'); dc.textContent=d.length+'/160'; dc.classList.toggle('warn',d.length>160); }
  function commitSEO(){ applySEO({ title:$('#seoTitle').value, desc:$('#seoDesc').value, ogi:$('#seoOg').value }); commit(); }
  $('#seoTitle').oninput=function(){ refresh(); markDirty(); }; $('#seoTitle').onchange=commitSEO;
  $('#seoDesc').oninput=function(){ refresh(); markDirty(); }; $('#seoDesc').onchange=commitSEO;
  $('#seoOg').onchange=commitSEO;
  refresh();
}

/* ===================================================================
   PAGES dynamiques : registre site/pages.json + ajout de page (au thème)
=================================================================== */
var pagesLoaded=false;
function loadPagesRegistry(cb){
  if(pagesLoaded){ if(cb)cb(); return; }
  fetch('site/pages.json?cb='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; })
    .then(function(list){ if(list&&list.length) PAGES=list; pagesLoaded=true; if(cb)cb(); })
    .catch(function(){ pagesLoaded=true; if(cb)cb(); });
}
function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'page'; }
function addPage(){
  if(!ghToken()){ askToken(addPage); return; }
  showModal('<h3>Nouvelle page</h3><p class="sub">Une page au thème du site (en-tête, pied et styles identiques).</p>'
    +'<div class="seo-field"><label>Nom de la page</label><input id="npName" type="text" placeholder="Ex : Nos tarifs"></div>'
    +'<label class="toggle" style="padding:4px 0;cursor:pointer"><span style="font-size:13px;font-weight:600">Copier la page courante comme base</span> <input type="checkbox" id="npCopy" style="width:auto;height:auto"></label>'
    +'<div class="modal__act"><button class="tbtn" id="npCancel">Annuler</button><button class="tbtn tbtn--primary" id="npCreate">Créer la page</button></div>');
  $('#npCancel').onclick=closeModal; setTimeout(function(){ var n=$('#npName'); if(n) n.focus(); },40);
  $('#npCreate').onclick=function(){ var name=($('#npName').value||'').trim(); if(!name){ $('#npName').focus(); return; } var copy=$('#npCopy').checked; closeModal(); createPage(name,copy); };
}
function createPage(name,copyCurrent){
  endInlineEdit(); flushSnap();
  var base=slugify(name), slug=base, n=2, existing=PAGES.map(function(p){ return p.file; });
  while(existing.indexOf('site/'+slug+'.html')>-1){ slug=base+'-'+n; n++; }
  var file='site/'+slug+'.html', id=slug;
  var docp=new DOMParser().parseFromString(exportDoc(),'text/html');
  var t=docp.querySelector('title'); if(t) t.textContent=name+' - ParFi Group';
  var dm=docp.head.querySelector('meta[name="description"]'); if(dm) dm.setAttribute('content','');
  if(!copyCurrent){ var m=docp.querySelector('main'); if(m) m.innerHTML='<section class="page-hero"><div class="wrap"><h1>'+esc(name)+'</h1><p>Cliquez sur ce texte pour le modifier, ou ajoutez des blocs depuis le panneau « Blocs ».</p></div></section>'; }
  var html='<!DOCTYPE html>\n'+docp.documentElement.outerHTML;
  PAGES.push({id:id,label:name,file:file}); renderPages();
  currentPage=id; deselect();
  frame.srcdoc=html.replace('<head>','<head><base href="site/">');   /* aperçu immédiat ; base pour résoudre assets/ */
  toast('Création de « '+name+' »…');
  Promise.all([
    commitContent('editor/'+file, html, 'Nouvelle page : '+name),
    commitContent('editor/site/pages.json', JSON.stringify(PAGES,null,2), 'MAJ liste des pages')
  ]).then(function(){ toast('✓ Page « '+name+' » créée — en ligne dans ~30 s'); })
    .catch(function(err){ toast('Page créée (locale) ; échec mise en ligne : '+err.message); });
}

/* Commit générique d'un fichier via l'API GitHub (réutilisé par doCommit/createPage) */
function commitContent(path,contentStr,message){
  var token=ghToken(), api='https://api.github.com/repos/'+GH.owner+'/'+GH.repo+'/contents/'+path;
  var headers={ 'Authorization':'Bearer '+token, 'Accept':'application/vnd.github+json' };
  return fetch(api+'?ref='+GH.branch,{ headers:headers, cache:'no-store' })
    .then(function(r){ if(r.status===404) return {}; if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||('HTTP '+r.status)); }); return r.json(); })
    .then(function(cur){ var body={ message:message, content:b64utf8(contentStr), branch:GH.branch }; if(cur&&cur.sha) body.sha=cur.sha; return fetch(api,{ method:'PUT', headers:headers, body:JSON.stringify(body) }); })
    .then(function(r){ if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||('HTTP '+r.status)); }); return r.json(); });
}

})();
