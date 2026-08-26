(function(){
  'use strict';

  const DB=()=>{try{return window.SB||(typeof SB!=='undefined'?SB:null)}catch(_){return null}};
  const UID=()=>{try{return window.STATE?.currentUser?.dbId||window.STATE?.currentUser?.id||null}catch(_){return null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let meters=[];
  let readings=[];
  let bound=false;

  function toast(msg,ok=true){
    let el=document.getElementById('bt-db-toast');
    if(!el){el=document.createElement('div');el.id='bt-db-toast';document.body.appendChild(el)}
    el.textContent=msg;el.dataset.ok=ok?'1':'0';el.classList.add('show');
    clearTimeout(window.__btDbToast);window.__btDbToast=setTimeout(()=>el.classList.remove('show'),3500);
  }

  function injectCss(){
    if(document.getElementById('bt-db-v13-css'))return;
    const s=document.createElement('style');s.id='bt-db-v13-css';
    s.textContent=`
      #bt-db-toast{position:fixed;right:24px;bottom:24px;z-index:100000;padding:12px 16px;border-radius:12px;background:#073b3f;color:#fff;font:600 13px system-ui;box-shadow:0 12px 35px #0004;opacity:0;transform:translateY(10px);pointer-events:none;transition:.2s}#bt-db-toast.show{opacity:1;transform:none}#bt-db-toast[data-ok="0"]{background:#8b2635}
      .bt-db-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(3,24,26,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px}
      .bt-db-modal{width:min(680px,96vw);max-height:90vh;overflow:auto;background:#0b2527;color:#edf8f4;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 90px #0009}
      .bt-db-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:24px 26px 16px;border-bottom:1px solid rgba(255,255,255,.09)}
      .bt-db-head h2{margin:0;font-size:21px}.bt-db-head p{margin:6px 0 0;color:#9fc2b8;font-size:13px}.bt-db-x{border:0;background:#183538;color:#dff5ee;border-radius:10px;width:36px;height:36px;font-size:20px;cursor:pointer}
      .bt-db-body{padding:22px 26px}.bt-db-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bt-db-field{display:flex;flex-direction:column;gap:7px}.bt-db-field.full{grid-column:1/-1}.bt-db-field label{font-size:12px;font-weight:700;color:#a9cfc2}.bt-db-field input,.bt-db-field select,.bt-db-field textarea{width:100%;box-sizing:border-box;border:1px solid #315255;background:#071c1e;color:#eef9f5;border-radius:11px;padding:11px 12px;outline:0;font:inherit}.bt-db-field input:focus,.bt-db-field select:focus,.bt-db-field textarea:focus{border-color:#38c69b;box-shadow:0 0 0 3px #38c69b22}.bt-db-help{font-size:11px;color:#7fa69c}.bt-db-file{border:1px dashed #416b6a;padding:13px;border-radius:12px;background:#071c1e}.bt-db-actions{display:flex;justify-content:flex-end;gap:10px;padding:16px 26px 22px}.bt-db-btn{border:0;border-radius:11px;padding:11px 17px;font-weight:800;cursor:pointer}.bt-db-btn.ghost{background:#153437;color:#cce7df}.bt-db-btn.primary{background:#36c69b;color:#04211c}.bt-db-btn:disabled{opacity:.55;cursor:not-allowed}
      .bt-db-empty{padding:18px;border:1px dashed #3a5c5e;border-radius:12px;color:#8fb0a8;text-align:center}.bt-db-status{display:flex;gap:8px;align-items:center;font-size:12px;color:#91b9ad;margin-top:8px}.bt-db-dot{width:8px;height:8px;border-radius:50%;background:#39c99d}
      @media(max-width:650px){.bt-db-grid{grid-template-columns:1fr}.bt-db-field.full{grid-column:auto}.bt-db-modal{max-height:94vh}.bt-db-body,.bt-db-head{padding-left:18px;padding-right:18px}.bt-db-actions{padding-left:18px;padding-right:18px}}
    `;
    document.head.appendChild(s);
  }

  function removeJunk(){
    document.querySelectorAll('.bt-action-dock,.bt-context-toolbar,.bt-floating-actions,.bt-float-theme,.bt-settings-inline,.v12-float,.hm-open,.bt-hidden-layout-artifact').forEach(x=>x.remove());
    document.querySelectorAll('button,a,[role="button"],label').forEach(el=>{
      const t=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(/^(🌙\s*)?Modo escuro$/i.test(t)||/^(☀️\s*)?Modo claro$/i.test(t)){el.remove();return}
      if(/^Configura(ç|c)[oõ]es$/i.test(t)&&el.closest('body')&&!el.closest('.sidebar-footer')){
        const r=getComputedStyle(el);if(r.position==='fixed'||r.position==='absolute')el.remove();
      }
      if(/^Registrar hor[ií]metro$/i.test(t)){
        const r=getComputedStyle(el);if(r.position==='fixed'||r.position==='absolute')el.remove();
      }
    });
  }

  async function load(){
    const api=DB();const user=UID();if(!api||!user)return;
    const mr=await api.from('utility_meters').select('id,code,name,utility_type,location,unit,initial_reading,active,created_by,created_at,updated_at').eq('active',true).order('name');
    if(mr.error){console.error(mr.error);toast('Erro ao carregar medidores: '+mr.error.message,false);return}
    meters=mr.data||[];
    const rr=await api.from('utility_readings').select('id,meter_id,user_id,reading_value,previous_reading,consumption,reading_date,server_timestamp,latitude,longitude,status,observation,photo_path,captured_at,created_at').order('reading_date',{ascending:false}).limit(500);
    if(rr.error){console.error(rr.error);toast('Erro ao carregar apontamentos: '+rr.error.message,false);return}
    readings=rr.data||[];
    localStorage.setItem('BIOTROP_UTILITY_METERS_V13',JSON.stringify(meters));
    localStorage.setItem('BIOTROP_UTILITY_READINGS_V13',JSON.stringify(readings));
    window.dispatchEvent(new CustomEvent('biotrop:utility-db-synced',{detail:{meters,readings}}));
    paintSummary();
  }

  function paintSummary(){
    const active=meters.filter(x=>x.active!==false).length;
    document.querySelectorAll('[data-utility-meter-count],.utility-meter-count').forEach(x=>x.textContent=String(active));
    document.querySelectorAll('[data-utility-reading-count],.utility-reading-count').forEach(x=>x.textContent=String(readings.length));
    const history=document.querySelector('[data-utility-history]');
    if(history){
      const byId=new Map(meters.map(m=>[m.id,m]));
      history.innerHTML=readings.slice(0,20).map(r=>{const m=byId.get(r.meter_id);return `<div class="bt-db-status"><span class="bt-db-dot"></span><span><b>${esc(m?.name||'Medidor')}</b> · ${Number(r.reading_value).toLocaleString('pt-BR')} ${esc(m?.unit||'')} · ${new Date(r.reading_date||r.created_at).toLocaleString('pt-BR')}</span></div>`}).join('')||'<div class="bt-db-empty">Nenhum apontamento registrado.</div>';
    }
  }

  function close(){document.querySelectorAll('.bt-db-backdrop').forEach(x=>x.remove());document.body.classList.remove('bt-modal-open')}

  function shell(title,sub,body,saveText='Salvar'){
    close();
    const el=document.createElement('div');el.className='bt-db-backdrop';el.innerHTML=`<section class="bt-db-modal" role="dialog" aria-modal="true"><header class="bt-db-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p><div class="bt-db-status"><span class="bt-db-dot"></span>Dados salvos diretamente no Supabase</div></div><button type="button" class="bt-db-x" data-close>×</button></header><div class="bt-db-body">${body}</div><footer class="bt-db-actions"><button type="button" class="bt-db-btn ghost" data-close>Cancelar</button><button type="button" class="bt-db-btn primary" data-save>${esc(saveText)}</button></footer></section>`;
    el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-close]'))close()});document.body.appendChild(el);return el;
  }

  function openMeter(){
    const modal=shell('Cadastrar medidor','Cadastre o equipamento uma vez. Ele ficará disponível para os próximos apontamentos.','<div class="bt-db-grid"><div class="bt-db-field"><label>Nome do medidor</label><input id="dbm-name" placeholder="Ex.: Compressor 01 / Horímetro"></div><div class="bt-db-field"><label>Código / ativo</label><input id="dbm-code" placeholder="Ex.: COMP-001"></div><div class="bt-db-field"><label>Tipo</label><select id="dbm-type"><option value="horimetro">Horímetro</option><option value="agua">Água</option><option value="gas">Gás</option><option value="energia">Energia</option></select></div><div class="bt-db-field"><label>Unidade</label><input id="dbm-unit" value="h"></div><div class="bt-db-field full"><label>Local / equipamento</label><input id="dbm-location" placeholder="Ex.: Casa de máquinas"></div><div class="bt-db-field"><label>Leitura inicial</label><input id="dbm-initial" type="number" min="0" step="0.001" value="0"></div></div>','Salvar medidor');
    modal.querySelector('[data-save]').onclick=async()=>{
      const api=DB(),user=UID();if(!api||!user)return toast('Sessão não encontrada. Faça login novamente.',false);
      const btn=modal.querySelector('[data-save]');btn.disabled=true;btn.textContent='Salvando…';
      try{
        const name=modal.querySelector('#dbm-name').value.trim(),code=modal.querySelector('#dbm-code').value.trim(),type=modal.querySelector('#dbm-type').value,unit=modal.querySelector('#dbm-unit').value.trim()||'h',location=modal.querySelector('#dbm-location').value.trim(),initial=Number(modal.querySelector('#dbm-initial').value||0);
        if(!name)throw new Error('Informe o nome do medidor.');if(!Number.isFinite(initial)||initial<0)throw new Error('Leitura inicial inválida.');
        const finalCode=code||('MED-'+Date.now());
        const result=await api.from('utility_meters').insert({name,code:finalCode,utility_type:type,unit,location,initial_reading:initial,active:true,created_by:user,updated_at:new Date().toISOString()}).select('*').single();
        if(result.error)throw result.error;
        await load();close();toast('Medidor cadastrado e gravado no Supabase.');
      }catch(err){btn.disabled=false;btn.textContent='Salvar medidor';toast(err.message||'Não foi possível cadastrar o medidor.',false)}
    };
  }

  async function openReading(preselected=null){
    await load();
    const options=meters.map(m=>`<option value="${esc(m.id)}" data-unit="${esc(m.unit)}">${esc(m.name)} · ${esc(m.code)} (${esc(m.utility_type)})</option>`).join('');
    const modal=shell('Registrar leitura','Selecione o medidor já cadastrado. A leitura e a evidência serão gravadas no banco.','<div class="bt-db-grid"><div class="bt-db-field full"><label>Medidor / equipamento</label><select id="dbr-meter">'+(options||'<option value="">Nenhum medidor cadastrado</option>')+'</select></div><div class="bt-db-field"><label>Leitura atual</label><input id="dbr-value" type="number" min="0" step="0.001" placeholder="0"></div><div class="bt-db-field"><label>Data e hora</label><input id="dbr-at" type="datetime-local"></div><div class="bt-db-field full"><label>Observação</label><textarea id="dbr-note" rows="3" placeholder="Opcional"></textarea></div><div class="bt-db-field full"><label>Evidência fotográfica obrigatória</label><div class="bt-db-file"><input id="dbr-photo" type="file" accept="image/*" capture="environment"><div class="bt-db-help">Tire a foto do marcador no momento da leitura. A foto será vinculada ao registro.</div></div></div></div>','Salvar apontamento');
    const sel=modal.querySelector('#dbr-meter');if(preselected)sel.value=preselected;
    const dt=modal.querySelector('#dbr-at');dt.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    modal.querySelector('[data-save]').onclick=async()=>{
      const api=DB(),user=UID();const btn=modal.querySelector('[data-save]');btn.disabled=true;btn.textContent='Salvando…';
      try{
        if(!api||!user)throw new Error('Sessão não encontrada.');
        const meterId=sel.value,value=Number(modal.querySelector('#dbr-value').value),file=modal.querySelector('#dbr-photo').files?.[0]||null,note=modal.querySelector('#dbr-note').value.trim();
        if(!meterId)throw new Error('Nenhum medidor disponível. Cadastre um medidor primeiro.');
        if(!Number.isFinite(value)||value<0)throw new Error('Informe uma leitura válida.');
        if(!file)throw new Error('A foto do marcador é obrigatória.');
        if(file.size>15*1024*1024)throw new Error('A foto deve ter no máximo 15 MB.');
        const mr=await api.from('utility_meters').select('id,name,unit,initial_reading,utility_type').eq('id',meterId).single();if(mr.error)throw mr.error;
        const pr=await api.from('utility_readings').select('reading_value').eq('meter_id',meterId).order('reading_date',{ascending:false}).limit(1).maybeSingle();if(pr.error)throw pr.error;
        const previous=pr.data?Number(pr.data.reading_value):Number(mr.data.initial_reading||0);if(value<previous)throw new Error('A leitura não pode ser menor que a anterior ('+previous+').');
        let coords={};try{coords=await new Promise(resolve=>{if(!navigator.geolocation)return resolve({});navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),()=>resolve({}),{enableHighAccuracy:true,timeout:5000,maximumAge:0})})}catch(_){ }
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=user+'/'+meterId+'/'+Date.now()+'-'+crypto.randomUUID()+'-'+safe;
        const up=await api.storage.from('utility-evidence').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(up.error)throw up.error;
        const stamp=new Date(dt.value).toISOString();
        const ins=await api.from('utility_readings').insert({meter_id:meterId,user_id:user,reading_value:value,previous_reading:previous,consumption:value-previous,reading_date:stamp,server_timestamp:new Date().toISOString(),latitude:coords.latitude??null,longitude:coords.longitude??null,status:'pendente',observation:note,inconsistent:false,correction_requested:false,photo_path:path,captured_at:new Date().toISOString(),evidence_required:true,updated_at:new Date().toISOString()}).select('*').single();
        if(ins.error){await api.storage.from('utility-evidence').remove([path]);throw ins.error}
        await load();close();toast('Apontamento gravado com sucesso no Supabase.');window.dispatchEvent(new CustomEvent('biotrop:reading-saved',{detail:ins.data}));
      }catch(err){btn.disabled=false;btn.textContent='Salvar apontamento';toast(err.message||'Não foi possível salvar o apontamento.',false)}
    };
  }

  function intercept(){
    if(bound)return;bound=true;
    document.addEventListener('click',e=>{
      const target=e.target.closest?.('button,a,[role="button"]');if(!target)return;
      const text=(target.textContent||'').replace(/\s+/g,' ').trim();
      if(/^\+?\s*Cadastrar medidor$/i.test(text)){e.preventDefault();e.stopImmediatePropagation();openMeter();return}
      if(/^Registrar (?:leitura|hor[ií]metro)$/i.test(text)){e.preventDefault();e.stopImmediatePropagation();openReading();return}
    },true);
  }

  async function boot(){injectCss();removeJunk();intercept();await load();setTimeout(removeJunk,300);setTimeout(removeJunk,1000)}
  window.BiotropUtilityDB={sync:load,openMeter,openReading};
  window.addEventListener('load',()=>setTimeout(boot,500));
  setInterval(removeJunk,1800);
})();