/* BIOTROP • Modo Técnico V1 — operação simples, sem visão/cadastros */
(() => {
  'use strict';
  if (window.__BIOTROP_TECH_SIMPLE__) return;
  window.__BIOTROP_TECH_SIMPLE__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function state(){ try { return (typeof STATE !== 'undefined' && STATE) || null; } catch(_) { return null; } }
  function isTech(){ const s=state(); const u=s?.currentUser; return !!u && String(u.perfilId||u.role||'').toLowerCase()==='tecnico'; }
  function nav(area){ try { if(typeof navigateTo==='function') navigateTo(area); } catch(e) { console.warn('[BIOTROP] technician navigation',e); } }

  const css=document.createElement('style');
  css.textContent=`
    body.bt-technician-simple .sidebar{width:220px;padding:18px 12px;position:fixed!important;left:0;top:0;bottom:0;height:100vh;z-index:1000}
    body.bt-technician-simple .main-area{margin-left:220px!important;padding:28px 34px;min-height:100vh}
    body.bt-technician-simple .sidebar-nav{gap:5px}
    body.bt-technician-simple .tech-nav-only{display:flex!important}
    body.bt-technician-simple .tech-nav-only .nav-item{font-size:14px;padding:12px}
    body.bt-technician-simple .tech-home{max-width:980px;margin:0 auto}
    body.bt-technician-simple .tech-welcome{margin-bottom:26px}
    body.bt-technician-simple .tech-welcome h1{margin:0;color:#17332b;font-size:28px;font-weight:850}
    body.bt-technician-simple .tech-welcome p{margin:7px 0 0;color:#6b7a75;font-size:14px}
    body.bt-technician-simple .tech-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
    body.bt-technician-simple .tech-action{border:1px solid #e2ece7;background:#fff;border-radius:18px;padding:24px;text-align:left;cursor:pointer;box-shadow:0 8px 25px rgba(0,45,42,.06);transition:.16s;font-family:inherit}
    body.bt-technician-simple .tech-action:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(0,45,42,.1);border-color:#b8dacc}
    body.bt-technician-simple .tech-action .ico{width:48px;height:48px;border-radius:14px;background:#eaf7f1;color:#087657;display:grid;place-items:center;font-size:24px;margin-bottom:16px}
    body.bt-technician-simple .tech-action strong{display:block;color:#17332b;font-size:18px;margin-bottom:5px}
    body.bt-technician-simple .tech-action span{display:block;color:#71827b;font-size:13px;line-height:1.45}
    body.bt-technician-simple .tech-quick{margin-top:18px;background:#003c41;color:#fff;border-radius:16px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    body.bt-technician-simple .tech-quick b{font-size:15px}.tech-quick small{display:block;color:#b8ddd1;margin-top:3px}
    body.bt-technician-simple .tech-quick button{border:0;border-radius:10px;background:#39c99a;color:#06241e;font-weight:850;padding:11px 16px;cursor:pointer}
    body.bt-technician-simple #main-content .page-title-row p{display:none}
    body.bt-technician-simple #main-content .page-title-row{margin-bottom:18px}
    @media(max-width:800px){body.bt-technician-simple .sidebar{width:0;padding:0;overflow:hidden}body.bt-technician-simple .main-area{margin-left:0!important;padding:22px 16px}.bt-mobile-menu{z-index:2000!important}.tech-actions{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(css);

  function setTechnicianPermissions(){
    try{
      if(typeof PROFILES==='undefined') return;
      const p=PROFILES.find(x=>x.id==='tecnico');
      if(!p) return;
      p.permissoes=p.permissoes||{};
      p.permissoes.almoxarifado=Object.assign({},p.permissoes.almoxarifado,{acesso:true,solicitacoes:true,familias:false,scm_acesso:true,scm_gestao:false,scm_aprovacao:false});
      p.permissoes.pcm={acesso:false};
      p.permissoes.utilidades={acesso:true};
      if(typeof saveProfiles==='function') saveProfiles(PROFILES);
    }catch(e){ console.warn('[BIOTROP] technician permissions',e); }
  }

  function rebuildSidebar(){
    const navEl=$('#sidebar-nav');
    if(!navEl || typeof renderSidebarNav!=='function') return;
    try{
      navEl.innerHTML=renderSidebarNav();
      $$('.tech-nav-hide').forEach(x=>x.remove());
      const allowed=['home','utilidades','almoxarifado'];
      $$('[data-nav]',navEl).forEach(b=>{ if(!allowed.includes(b.getAttribute('data-nav'))) b.style.display='none'; });
      $$('[data-group]',navEl).forEach(b=>{
        const id=b.getAttribute('data-group');
        if(id!=='grp_almoxarifado') b.style.display='none';
      });
      // Deixa o grupo Almoxarifado disponível somente para solicitações operacionais.
      $$('[data-nav]',navEl).forEach(b=>{
        const id=b.getAttribute('data-nav');
        if(id && /scm|familia|cadastro|pcm|admin|trein/i.test(id)) b.style.display='none';
      });
    }catch(e){ console.warn('[BIOTROP] technician sidebar',e); }
  }

  function renderSimpleHome(){
    if(!isTech()) return;
    const main=$('#main-content'); if(!main) return;
    if(state()?.activeArea!=='home') return;
    main.innerHTML=`
      <div class="tech-home">
        <div class="tech-welcome"><h1>Olá, ${escapeHtml(state()?.currentUser?.nome||'Técnico')}.</h1><p>Escolha uma tarefa para registrar.</p></div>
        <div class="tech-actions">
          <button class="tech-action" type="button" data-tech-action="reading"><div class="ico">▣</div><strong>Registrar leitura</strong><span>Água, gás, energia e horímetros.</span></button>
          <button class="tech-action" type="button" data-tech-action="hourmeter"><div class="ico">◷</div><strong>Registrar horímetro</strong><span>Informe a leitura e fotografe o marcador.</span></button>
          <button class="tech-action" type="button" data-tech-action="material"><div class="ico">▤</div><strong>Solicitar material</strong><span>Faça uma solicitação para o Almoxarifado.</span></button>
          <button class="tech-action" type="button" data-tech-action="utility"><div class="ico">⌁</div><strong>Utilidades</strong><span>Abra os medidores e faça o apontamento.</span></button>
        </div>
        <div class="tech-quick"><div><b>Apontamento rápido</b><small>Abra diretamente a tela de medição.</small></div><button type="button" data-tech-action="reading">Registrar agora</button></div>
      </div>`;
  }

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function openFirstReading(){
    nav('utilidades');
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const b=document.querySelector('[data-utility-open]');
      if(b){clearInterval(timer);b.click();}
      if(tries>30)clearInterval(timer);
    },150);
  }

  function bindActions(){
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-tech-action]'); if(!b||!isTech())return;
      const a=b.getAttribute('data-tech-action');
      if(a==='reading'||a==='hourmeter'||a==='utility') openFirstReading();
      if(a==='material') nav('almoxarifado');
    },true);
  }

  function apply(){
    if(!isTech()) return;
    document.body.classList.add('bt-technician-simple');
    setTechnicianPermissions();
    rebuildSidebar();
    renderSimpleHome();
  }

  bindActions();
  let last='';
  const tick=()=>{
    const s=state(); const key=s?.currentUser?.id+'|'+s?.activeArea;
    if(key!==last){last=key;setTimeout(apply,80)} else if(isTech()&&!document.body.classList.contains('bt-technician-simple')) apply();
  };
  const mo=new MutationObserver(()=>{if(isTech())setTimeout(apply,40)});
  const start=()=>{if(document.body)mo.observe(document.body,{childList:true,subtree:true});tick();setInterval(tick,1000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
