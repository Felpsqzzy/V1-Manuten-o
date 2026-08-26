/* BIOTROP • UI Stability V11
 * Uma única camada de estabilidade: relógio vivo, perfil, medidores/apontamentos
 * e limpeza dos controles legados. Sem modo claro/escuro na configuração.
 */
(() => {
  'use strict';

  const APP = { clock: null, observer: null, booted: false, user: null, meters: [] };
  const sb = () => { try { return window.SB || (typeof SB !== 'undefined' ? SB : null); } catch (_) { return null; } };
  const state = () => { try { return window.STATE || (typeof STATE !== 'undefined' ? STATE : null); } catch (_) { return null; } };
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function toast(message, kind = 'info') {
    let box = document.querySelector('#bt-v11-toast');
    if (!box) { box = document.createElement('div'); box.id = 'bt-v11-toast'; document.body.appendChild(box); }
    box.textContent = message;
    box.dataset.kind = kind;
    box.classList.add('show');
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('show'), 3200);
  }

  function injectCss() {
    if (document.querySelector('link[data-bt-v11-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './assets/css/stability-v11.css?v=11';
    link.dataset.btV11Css = '1';
    document.head.appendChild(link);
  }

  function liveClock() {
    const now = new Date();
    const time = new Intl.DateTimeFormat('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);
    const date = new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'long', year:'numeric' }).format(now);
    document.querySelectorAll('[data-live-clock], .industrial-status-card strong').forEach(el => { el.textContent = time; });
    document.querySelectorAll('[data-live-date]').forEach(el => { el.textContent = date; });
    document.querySelectorAll('.industrial-status-card').forEach(card => {
      const spans = [...card.querySelectorAll('span')];
      const span = spans.find(x => /\d{1,2}.*de.*\d{4}/i.test(x.textContent || ''));
      if (span) span.textContent = date;
    });
  }

  function startClock() {
    if (APP.clock) return;
    liveClock();
    APP.clock = setInterval(liveClock, 1000);
  }

  async function hydrateAuth() {
    const client = sb();
    if (!client) return;
    try {
      const { data:{ session } } = await client.auth.getSession();
      if (session?.user) await syncProfile(session.user);
      client.auth.onAuthStateChange((_event, sessionNow) => {
        if (sessionNow?.user) syncProfile(sessionNow.user);
      });
    } catch (e) { console.warn('[BIOTROP] auth:', e); }
  }

  async function syncProfile(user) {
    const client = sb();
    if (!client || !user) return null;
    let profile = null;
    try {
      const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = data || null;
    } catch (e) { console.warn('[BIOTROP] profile read:', e); }

    if (!profile) {
      const fallback = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
      const { data } = await client.from('profiles').upsert({
        id:user.id, name:fallback, full_name:fallback, email:user.email || '',
        role_code:'tecnico', app_role:'tecnico', active:true, is_active:true,
        notifications_enabled:true, updated_at:new Date().toISOString()
      }).select('*').single();
      profile = data || null;
    }

    APP.user = { ...user, profile };
    const st = state();
    if (st) {
      st.currentUser = {
        ...(st.currentUser || {}), id:user.id, dbId:user.id, email:user.email || '', usuario:user.email || '',
        nome:profile?.name || profile?.full_name || user.email?.split('@')[0] || 'Usuário',
        role:profile?.role_code || profile?.app_role || 'tecnico',
        role_code:profile?.role_code || profile?.app_role || 'tecnico',
        avatar_url:profile?.avatar_url || null, phone:profile?.phone || ''
      };
    }
    paintUser(profile, user);
    return profile;
  }

  function paintUser(profile, user) {
    const name = profile?.name || profile?.full_name || user?.email?.split('@')[0] || 'Usuário';
    const role = profile?.role_code || profile?.app_role || 'tecnico';
    document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.user-role').forEach(el => el.textContent = /admin|gestor|aprovador|almoxarife/i.test(role) ? 'Administrador' : 'Técnico');
    document.querySelectorAll('.user-avatar').forEach(el => {
      if (profile?.avatar_url) el.innerHTML = `<img src="${esc(profile.avatar_url)}" alt="Foto de perfil">`;
      else el.textContent = name.trim().charAt(0).toUpperCase();
    });
  }

  function removeLegacyNode(el) {
    if (!el || el.id === 'app') return;
    if (el.matches?.('#bt-v11-settings,#bt-v11-meter,#bt-v11-reading')) return;
    el.remove();
  }

  function cleanupLegacyControls() {
    document.querySelectorAll('.bt-floating-actions,.bt-context-toolbar,.bt-float-theme,.bt-settings-inline,.bt-hidden-layout-artifact,.bt-v10-modal-backdrop').forEach(removeLegacyNode);

    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('#bt-v11-settings,#bt-v11-meter,#bt-v11-reading')) return;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      if (/^(?:🌙\s*)?Modo escuro$/i.test(text) || /^(?:☀️\s*)?Modo claro$/i.test(text)) {
        if (el.matches('button,a,[role="button"],label,div,span')) removeLegacyNode(el);
        return;
      }

      if (/^Configura(ç|c)[oõ]es$/i.test(text) && el.matches('button,a,[role="button"]')) {
        removeLegacyNode(el);
        return;
      }

      if (/^Registrar hor[ií]metro$/i.test(text) && el.matches('button,a,[role="button"]')) {
        const s = getComputedStyle(el);
        if (s.position === 'fixed' || s.position === 'absolute' || el.closest('body > *')) removeLegacyNode(el);
      }
    });
  }

  function bindProfile() {
    document.querySelectorAll('.user-chip').forEach(chip => {
      if (chip.dataset.btV11Bound) return;
      chip.dataset.btV11Bound = '1';
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openSettings(); }, true);
      chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSettings(); } });
    });
  }

  function bindActionCapture() {
    if (document.documentElement.dataset.btV11Actions) return;
    document.documentElement.dataset.btV11Actions = '1';
    document.addEventListener('click', e => {
      const profile = e.target.closest?.('.user-chip');
      if (profile) { e.preventDefault(); e.stopImmediatePropagation(); openSettings(); return; }

      const target = e.target.closest?.('button,a,[role="button"]');
      if (!target) return;
      const text = (target.innerText || target.textContent || '').replace(/\s+/g, ' ').trim();

      if (/^Cadastrar medidor$/i.test(text) || /^\+\s*Cadastrar medidor$/i.test(text)) {
        e.preventDefault(); e.stopImmediatePropagation(); openMeter(); return;
      }
      if (/^Registrar (?:leitura|hor[ií]metro)$/i.test(text)) {
        const r = getComputedStyle(target);
        if (r.position === 'fixed' || r.position === 'absolute') {
          e.preventDefault(); e.stopImmediatePropagation(); target.remove(); return;
        }
        e.preventDefault(); e.stopImmediatePropagation(); openReading(); return;
      }
    }, true);
  }

  function modalShell(id, title, subtitle, body, actions = '') {
    document.querySelectorAll('.bt-v11-modal-backdrop').forEach(x => x.remove());
    const el = document.createElement('div');
    el.id = id;
    el.className = 'bt-v11-modal-backdrop';
    el.innerHTML = `<section class="bt-v11-modal" role="dialog" aria-modal="true"><header><div><h2>${esc(title)}</h2><p>${esc(subtitle || '')}</p></div><button class="bt-v11-close" data-close="${id}" aria-label="Fechar">×</button></header><div class="bt-v11-modal-body">${body}</div>${actions ? `<footer>${actions}</footer>` : ''}</section>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest(`[data-close="${id}"]`)) el.remove(); });
    document.body.appendChild(el);
    return el;
  }

  function openSettings() {
    document.querySelectorAll('.bt-v11-modal-backdrop,.bt-v10-modal-backdrop,.modal-backdrop').forEach(x => { if (!x.id || x.id === 'bt-v10-settings') x.remove(); });
    const p = APP.user?.profile || state()?.currentUser || {};
    const body = `<div class="bt-v11-profile-grid"><div class="bt-v11-profile-photo"><div class="bt-v11-avatar-preview">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="Foto de perfil">` : esc((p.name || 'U').charAt(0).toUpperCase())}</div><label class="bt-v11-upload">Trocar foto<input id="bt-v11-photo" type="file" accept="image/png,image/jpeg,image/webp"></label><small>PNG, JPG ou WEBP · até 5 MB</small></div><div class="bt-v11-settings-fields"><label>Nome<input id="bt-v11-name" value="${esc(p.name || p.full_name || '')}></label><label>E-mail<input value="${esc(p.email || APP.user?.email || '')}" disabled></label><label>Telefone<input id="bt-v11-phone" value="${esc(p.phone || '')}"></label><label class="bt-v11-check"><input id="bt-v11-notify" type="checkbox" ${p.notifications_enabled !== false ? 'checked' : ''}> Receber notificações</label><hr><h3>Segurança</h3><label>Nova senha<input id="bt-v11-pass" type="password" placeholder="Deixe vazio para não alterar"></label><label>Confirmar nova senha<input id="bt-v11-pass2" type="password" placeholder="Repita a nova senha"></label></div></div>`;
    const modal = modalShell('bt-v11-settings', 'Configurações do usuário', 'Perfil, notificações e segurança.', body, '<button class="bt-v11-btn ghost" data-close="bt-v11-settings">Cancelar</button><button id="bt-v11-save-settings" class="bt-v11-btn primary">Salvar alterações</button>');
    modal.querySelector('#bt-v11-photo').addEventListener('change', previewPhoto);
    modal.querySelector('#bt-v11-save-settings').addEventListener('click', saveSettings);
  }

  function previewPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('A foto deve ter no máximo 5 MB.', 'error'); e.target.value = ''; return; }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const box = document.querySelector('.bt-v11-avatar-preview');
    if (box) { box.innerHTML = ''; box.appendChild(img); }
  }

  async function saveSettings() {
    const client = sb(), user = APP.user?.id;
    if (!client || !user) return toast('Sessão não encontrada. Faça login novamente.', 'error');
    const name = document.querySelector('#bt-v11-name')?.value.trim();
    const phone = document.querySelector('#bt-v11-phone')?.value.trim();
    const notifications = document.querySelector('#bt-v11-notify')?.checked !== false;
    const pass = document.querySelector('#bt-v11-pass')?.value || '';
    const pass2 = document.querySelector('#bt-v11-pass2')?.value || '';
    if (!name) return toast('Informe o nome.', 'error');
    if (pass && pass !== pass2) return toast('As senhas não conferem.', 'error');

    const btn = document.querySelector('#bt-v11-save-settings');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      let avatar_url = APP.user?.profile?.avatar_url || null;
      const file = document.querySelector('#bt-v11-photo')?.files?.[0];
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user}/profile-${Date.now()}.${ext}`;
        const upload = await client.storage.from('profile-pictures').upload(path, file, { upsert:true, contentType:file.type });
        if (upload.error) throw upload.error;
        avatar_url = client.storage.from('profile-pictures').getPublicUrl(path).data.publicUrl;
      }

      const { error } = await client.from('profiles').update({ name, full_name:name, phone, notifications_enabled:notifications, avatar_url, updated_at:new Date().toISOString() }).eq('id', user);
      if (error) throw error;
      if (pass) {
        const result = await client.auth.updateUser({ password:pass });
        if (result.error) throw result.error;
      }
      await syncProfile(APP.user);
      document.querySelector('#bt-v11-settings')?.remove();
      toast('Configurações salvas.', 'success');
    } catch (err) {
      toast(err?.message || 'Não foi possível salvar as configurações.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar alterações'; }
    }
  }

  async function loadMeters() {
    const client = sb();
    if (!client) return [];
    const { data, error } = await client.from('utility_meters').select('*').eq('active', true).order('name');
    if (error) { console.warn('[BIOTROP] meters:', error); toast('Não foi possível carregar os medidores.', 'error'); return []; }
    APP.meters = data || [];
    return APP.meters;
  }

  function openMeter() {
    const body = `<div class="bt-v11-form-grid"><label>Nome do medidor<input id="bt-meter-name" placeholder="Ex.: Horímetro Compressor 01" required></label><label>Código<input id="bt-meter-code" placeholder="Ex.: COMP-001" required></label><label>Tipo<select id="bt-meter-type"><option value="horimetro">Horímetro</option><option value="agua">Água</option><option value="gas">Gás</option><option value="energia">Energia</option></select></label><label>Unidade<input id="bt-meter-unit" value="h"></label><label class="full">Local / equipamento<input id="bt-meter-location" placeholder="Ex.: Casa de máquinas / COMP-001"></label><label>Leitura inicial<input id="bt-meter-initial" type="number" min="0" step="0.001" value="0"></label></div>`;
    const modal = modalShell('bt-v11-meter', 'Cadastrar medidor', 'Cadastre o equipamento uma vez para liberar os apontamentos.', body, '<button class="bt-v11-btn ghost" data-close="bt-v11-meter">Cancelar</button><button id="bt-save-meter" class="bt-v11-btn primary">Salvar medidor</button>');
    modal.querySelector('#bt-meter-type').addEventListener('change', e => {
      modal.querySelector('#bt-meter-unit').value = e.target.value === 'agua' ? 'm³' : e.target.value === 'gas' ? 'Nm³' : e.target.value === 'energia' ? 'kWh' : 'h';
    });
    modal.querySelector('#bt-save-meter').addEventListener('click', saveMeter);
  }

  async function saveMeter() {
    const client = sb(), user = APP.user?.id;
    if (!client || !user) return toast('Faça login novamente.', 'error');
    const payload = {
      code:document.querySelector('#bt-meter-code').value.trim(), name:document.querySelector('#bt-meter-name').value.trim(),
      utility_type:document.querySelector('#bt-meter-type').value, unit:document.querySelector('#bt-meter-unit').value.trim() || 'h',
      location:document.querySelector('#bt-meter-location').value.trim(), initial_reading:Number(document.querySelector('#bt-meter-initial').value || 0), active:true
    };
    if (!payload.code || !payload.name) return toast('Informe nome e código.', 'error');
    const btn = document.querySelector('#bt-save-meter'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const { error } = await client.from('utility_meters').insert(payload);
      if (error) throw error;
      await loadMeters();
      document.querySelector('#bt-v11-meter')?.remove();
      toast('Medidor cadastrado. Agora ele está disponível para apontamento.', 'success');
      refreshApp();
    } catch (e) { toast(e?.message || 'Erro ao cadastrar medidor.', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Salvar medidor'; }
  }

  async function openReading() {
    const meters = await loadMeters();
    if (!meters.length) return toast('Nenhum medidor cadastrado. Cadastre um medidor primeiro.', 'error');
    const options = meters.map(m => `<option value="${esc(m.id)}">${esc(m.name)} · ${esc(m.code)} · ${esc(m.unit)}</option>`).join('');
    const body = `<div class="bt-v11-form-grid"><label class="full">Medidor / equipamento<select id="bt-reading-meter">${options}</select></label><label>Leitura atual<input id="bt-reading-value" type="number" step="0.001" min="0" required></label><label>Localização<input id="bt-reading-location" readonly placeholder="Obtendo localização…"></label><label class="full">Observação<textarea id="bt-reading-note" rows="3" placeholder="Opcional"></textarea></label><label class="full bt-v11-camera">Evidência fotográfica <input id="bt-reading-photo" type="file" accept="image/*" capture="environment" required><small>A foto do marcador é obrigatória e fica vinculada ao registro.</small></label></div>`;
    const modal = modalShell('bt-v11-reading', 'Registrar horímetro', 'Leitura vinculada ao medidor, usuário, data/hora e evidência.', body, '<button class="bt-v11-btn ghost" data-close="bt-v11-reading">Cancelar</button><button id="bt-save-reading" class="bt-v11-btn primary">Salvar apontamento</button>');
    navigator.geolocation?.getCurrentPosition(pos => { const f = modal.querySelector('#bt-reading-location'); if (f) f.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`; }, () => { const f = modal.querySelector('#bt-reading-location'); if (f) f.value = 'Não disponível'; }, { enableHighAccuracy:true, timeout:6000 });
    modal.querySelector('#bt-save-reading').addEventListener('click', saveReading);
  }

  async function saveReading() {
    const client = sb(), user = APP.user?.id;
    if (!client || !user) return toast('Faça login novamente.', 'error');
    const meterId = document.querySelector('#bt-reading-meter')?.value;
    const value = Number(document.querySelector('#bt-reading-value')?.value);
    const photo = document.querySelector('#bt-reading-photo')?.files?.[0];
    if (!meterId || !Number.isFinite(value)) return toast('Informe a leitura.', 'error');
    if (!photo) return toast('A foto do marcador é obrigatória.', 'error');
    if (photo.size > 10 * 1024 * 1024) return toast('A foto deve ter até 10 MB.', 'error');

    const meter = APP.meters.find(m => m.id === meterId);
    if (!meter) return toast('Medidor inválido.', 'error');
    const btn = document.querySelector('#bt-save-reading'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const { data:last, error:lastError } = await client.from('utility_readings').select('reading_value').eq('meter_id', meterId).order('reading_date', { ascending:false }).limit(1).maybeSingle();
      if (lastError) throw lastError;
      const previous = last?.reading_value ?? meter.initial_reading ?? 0;
      const consumption = value - Number(previous);
      if (consumption < 0) throw new Error('A leitura atual não pode ser menor que a leitura anterior.');

      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user}/${meterId}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.${ext}`;
      const upload = await client.storage.from('utility-evidence').upload(path, photo, { upsert:false, contentType:photo.type });
      if (upload.error) throw upload.error;

      const coords = document.querySelector('#bt-reading-location')?.value || '';
      const parts = coords.split(',').map(x => Number(x.trim()));
      const result = await client.from('utility_readings').insert({
        meter_id:meterId, user_id:user, reading_value:value, previous_reading:previous, consumption,
        reading_date:new Date().toISOString(), server_timestamp:new Date().toISOString(),
        latitude:Number.isFinite(parts[0]) ? parts[0] : null, longitude:Number.isFinite(parts[1]) ? parts[1] : null,
        status:'pendente', observation:document.querySelector('#bt-reading-note')?.value.trim() || null,
        photo_path:path, captured_at:new Date().toISOString()
      });
      if (result.error) throw result.error;
      document.querySelector('#bt-v11-reading')?.remove();
      toast('Apontamento registrado com sucesso.', 'success');
      refreshApp();
    } catch (e) { toast(e?.message || 'Erro ao registrar apontamento.', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Salvar apontamento'; }
  }

  function bindLogin() {
    const root = document.querySelector('.login-wrap');
    if (!root) return;
    const email = root.querySelector('input[type=email]') || root.querySelector('input[name*=email i],input[placeholder*=email i]');
    const pass = root.querySelector('input[type=password]') || root.querySelector('input[name*=senha i],input[placeholder*=senha i]');
    const button = root.querySelector('.submit-btn,button[type=submit]');
    if (!email || !pass || !button || button.dataset.btV11Login) return;
    button.dataset.btV11Login = '1';
    const run = async e => {
      e?.preventDefault(); e?.stopImmediatePropagation();
      const client = sb();
      if (!client) return toast('Autenticação indisponível.', 'error');
      if (!email.value.trim() || !pass.value) return toast('Informe e-mail e senha.', 'error');
      button.disabled = true;
      try {
        const { data, error } = await client.auth.signInWithPassword({ email:email.value.trim(), password:pass.value });
        if (error) throw error;
        if (!data?.session) throw new Error('Sessão não retornada pelo Supabase.');
        await syncProfile(data.session.user);
        const st = state();
        if (st) { st.screen = 'app'; st.activeArea = st.activeArea || 'home'; }
        try { if (typeof hydrateV12 === 'function') await hydrateV12(); } catch (_) {}
        try { if (typeof render === 'function') render(); } catch (_) {}
        toast('Login realizado com sucesso.', 'success');
      } catch (err) { toast(/invalid login credentials/i.test(err?.message || '') ? 'E-mail ou senha incorretos.' : (err?.message || 'Falha ao entrar.'), 'error'); }
      finally { button.disabled = false; }
    };
    button.addEventListener('click', run, true);
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') run(e); }, true);
  }

  function refreshApp() {
    try { if (typeof hydrateV12 === 'function') hydrateV12(); } catch (_) {}
    setTimeout(() => {
      try { if (typeof render === 'function') render(); } catch (_) {}
      bindProfile(); bindLogin(); cleanupLegacyControls(); liveClock();
    }, 300);
  }

  function boot() {
    if (APP.booted) return;
    APP.booted = true;
    injectCss();
    startClock();
    bindActionCapture();
    bindProfile();
    bindLogin();
    cleanupLegacyControls();
    hydrateAuth();

    APP.observer = new MutationObserver(() => {
      bindProfile(); bindLogin(); cleanupLegacyControls(); liveClock();
    });
    APP.observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
