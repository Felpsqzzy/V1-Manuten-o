/* BIOTROP • camada de aplicação moderna
 * Mantém o app legado intacto e corrige autenticação, sessão e pequenos ajustes de UI.
 * Usa o mesmo cliente Supabase já criado pelo app principal (SB).
 */
(function () {
  'use strict';

  let loginWatcher = null;
  let sessionBootstrapDone = false;

  function getSB() {
    try { return (typeof SB !== 'undefined' && SB) || window.SB || null; } catch (_) { return null; }
  }
  function getState() {
    try { return (typeof STATE !== 'undefined' && STATE) || null; } catch (_) { return null; }
  }
  function toast(message, kind = 'info') {
    const old = document.querySelector('.bt-app-toast'); if (old) old.remove();
    const node = document.createElement('div'); node.className = 'bt-app-toast'; node.textContent = message; node.dataset.kind = kind;
    document.body.appendChild(node); window.setTimeout(() => node.remove(), 3500);
  }
  function ensureToastStyle() {
    if (document.getElementById('bt-app-toast-style')) return;
    const style = document.createElement('style'); style.id = 'bt-app-toast-style';
    style.textContent = `.bt-app-toast{position:fixed;right:22px;bottom:22px;z-index:10050;padding:12px 16px;border-radius:13px;background:#0b2022;color:#ecf8f3;border:1px solid rgba(163,227,205,.16);box-shadow:0 18px 50px rgba(0,0,0,.25);font:700 12px/1.4 system-ui}.bt-app-toast[data-kind=error]{background:#33191b;color:#fecaca;border-color:rgba(248,113,113,.25)}.bt-app-toast[data-kind=success]{background:#08382c;color:#b7f7da;border-color:rgba(66,211,156,.25)}`;
    document.head.appendChild(style);
  }
  function findLoginInputs() {
    const root = document.querySelector('.login-wrap'); if (!root) return null;
    const inputs = Array.from(root.querySelectorAll('input'));
    const email = inputs.find(i => i.type === 'email') || inputs.find(i => /email|e-mail|usu[aá]rio/i.test(i.placeholder || i.name || i.id || ''));
    const password = inputs.find(i => i.type === 'password') || inputs.find(i => /senha|password/i.test(i.placeholder || i.name || i.id || ''));
    const submit = root.querySelector('.submit-btn,button[type="submit"]');
    return email && password && submit ? { root, email, password, submit } : null;
  }
  function setLoginBusy(ui, busy) {
    ui.submit.disabled = busy; ui.submit.style.opacity = busy ? '.65' : ''; ui.submit.dataset.btBusy = busy ? '1' : '0';
    if (busy) ui.submit.setAttribute('aria-busy', 'true'); else ui.submit.removeAttribute('aria-busy');
  }
  function showLoginError(root, message) {
    let el = root.querySelector('.bt-auth-error');
    if (!el) { el = document.createElement('div'); el.className = 'login-error bt-auth-error'; (root.querySelector('.right-inner') || root).appendChild(el); }
    el.textContent = message;
    el.style.display = message ? '' : 'none';
  }
  async function hydrateCurrentUser(session) {
    const sb = getSB(), state = getState();
    if (!sb || !state || !session?.user) return false;
    const userId = session.user.id; let profile = null;
    try {
      const result = await sb.from('profiles').select('id,name,full_name,email,phone,sector,department,avatar_url,role_code,app_role,active,is_active').eq('id', userId).maybeSingle();
      profile = result.data || null;
    } catch (_) {}
    const role = profile?.role_code || profile?.app_role || 'tecnico';
    if (!profile) {
      try {
        const result = await sb.from('profiles').insert({
          id: userId,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário',
          email: session.user.email,
          role_code: role,
          app_role: role,
          active: true,
          is_active: true,
          updated_at: new Date().toISOString()
        }).select('*').single();
        profile = result.data || null;
      } catch (_) {}
    }
    state.currentUser = {
      ...(state.currentUser || {}), id: userId, dbId: userId,
      email: session.user.email || profile?.email || '', usuario: session.user.email || profile?.email || '',
      nome: profile?.name || profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário',
      role, role_code: role, perfil: role, perfilId: role,
      avatar_url: profile?.avatar_url || null, phone: profile?.phone || ''
    };
    try {
      state.screen = 'app'; if (!state.activeArea) state.activeArea = 'home';
      localStorage.setItem('biotrop_auth_uid', userId);
    } catch (_) {}
    try { if (typeof hydrateV12 === 'function') await hydrateV12(); } catch (_) {}
    try { if (typeof render === 'function') render(); } catch (_) {}
    return true;
  }
  async function doLogin(ui) {
    const sb = getSB(); if (!sb) return showLoginError(ui.root, 'Backend de autenticação indisponível.');
    if (ui.submit.dataset.btBusy === '1') return;
    const email = ui.email.value.trim(), password = ui.password.value;
    if (!email || !password) return showLoginError(ui.root, 'Informe e-mail e senha.');
    setLoginBusy(ui, true); showLoginError(ui.root, '');
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session) throw new Error('O Supabase não retornou uma sessão válida.');
      const ok = await hydrateCurrentUser(data.session); if (!ok) throw new Error('Sessão criada, mas o perfil não pôde ser carregado.');
      toast('Login realizado com sucesso.', 'success');
    } catch (error) {
      const raw = String(error?.message || 'Falha ao entrar.');
      showLoginError(ui.root, /invalid login credentials/i.test(raw) ? 'E-mail ou senha incorretos.' : raw);
      toast(raw, 'error');
    } finally { setLoginBusy(ui, false); }
  }
  function bindLogin() {
    const ui = findLoginInputs(); if (!ui || ui.submit.dataset.btAuthBound === '1') return !!ui;
    ui.submit.dataset.btAuthBound = '1';
    ui.submit.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); doLogin(ui); }, true);
    ui.password.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); doLogin(ui); } }, true);
    return true;
  }
  async function bootstrapAuth() {
    const sb = getSB(); if (!sb || sessionBootstrapDone) return; sessionBootstrapDone = true;
    try {
      const { data } = await sb.auth.getSession(); if (data?.session) await hydrateCurrentUser(data.session);
      sb.auth.onAuthStateChange((_event, session) => { if (session) hydrateCurrentUser(session); });
    } catch (error) { console.warn('BIOTROP auth bootstrap:', error); }
  }
  function addBrandMicrocopy() {
    const row = document.querySelector('.brand-row');
    if (row && !row.querySelector('.bt-brand-caption')) { const box = document.createElement('div'); box.className = 'bt-brand-caption'; box.innerHTML = '<strong>BIOTROP</strong><span>GESTÃO INDUSTRIAL</span>'; row.appendChild(box); }
    const sb = document.querySelector('.sidebar-brand');
    if (sb && !sb.querySelector('.bt-sidebar-caption')) { const box = document.createElement('div'); box.className = 'bt-sidebar-caption'; box.innerHTML = '<strong>BIOTROP</strong><span>CONTROL ROOM</span>'; sb.appendChild(box); }
  }
  function start(){ensureToastStyle();bindLogin();addBrandMicrocopy();bootstrapAuth();}
  function startLoginWatcher(){
    if(loginWatcher)return; let ticks=0;
    loginWatcher=window.setInterval(()=>{ticks++;start();if(ticks>150||document.querySelector('.shell')){clearInterval(loginWatcher);loginWatcher=null;}},400);
  }
  document.addEventListener('click', event => { const mobile=event.target.closest?.('.mobile-menu-btn'); if(!mobile)return; const sidebar=document.querySelector('.sidebar'); if(sidebar)sidebar.classList.toggle('sidebar-open'); }, false);
  window.addEventListener('load',()=>{start();startLoginWatcher();});
  start();
})();
