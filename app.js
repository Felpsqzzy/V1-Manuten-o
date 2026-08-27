/* BIOTROP • Utilidades V15 — medidores reais, apontamento vinculado, foto/câmera e Supabase */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const sb=()=>window.SB||null;
  const APP={user:null,meters:[],clock:null,camera:null};

  const DEFAULT=[
    ['CAMM1-GAS-01','MEDIDOR GÁS 01 - CAMM 1','gas','CAMM 1','Nm³'],
    ['CAMM1-AGUA-02','HIDROMETRO 02 - CAMM 1','agua','CAMM 1','m³'],
    ['CAMM1-AGUA-03','HIDROMETRO 03 - CAMM 1','agua','CAMM 1','m³'],
    ['CAMM1-AGUA-06','HIDROMETRO 06 - CAMM 1 - POÇO','agua','CAMM 1','m³'],
    ['CAMM2-AGUA-08','HIDROMETRO 08 - CAMM 2','agua','CAMM 2','m³'],
    ['CAMM2-AGUA-09','HIDROMETRO 09 - CAMM 2','agua','CAMM 2','m³'],
    ['CAMM1-LUZ-02','MEDIDOR ENERGIA 02 - CAMM 1 - BOMBA DE INCENDIO','energia','CAMM 1','kWh'],
    ['CAMM1-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 1 - CABINE PRIMARIA','energia','CAMM 1','kWh'],
    ['CAMM2-GAS-01','MEDIDOR GÁS 01 - CAMM 2','gas','CAMM 2','Nm³'],
    ['CAMM2-AGUA-01','HIDROMETRO 01 - CAMM 2','agua','CAMM 2','m³'],
    ['CAMM2-AGUA-02','HIDROMETRO 02 - CAMM 2','agua','CAMM 2','m³'],
    ['CAMM2-LUZ-02','MEDIDOR ENERGIA 02 - CAMM 2','energia','CAMM 2','kWh'],
    ['CAMM2-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 2','energia','CAMM 2','kWh'],
    ['CAMM3-GAS-01','MEDIDOR GÁS 01 - CAMM 3','gas','CAMM 3','Nm³'],
    ['CAMM3-AGUA-01','HIDROMETRO 01 - CAMM 3','agua','CAMM 3','m³'],
    ['CAMM3-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 3','energia','CAMM 3','kWh'],
    ['CLOG-AGUA-01','HIDROMETRO 01 - C.LOG','agua','C.LOG','m³'],
    ['CLOG-LUZ-01','MEDIDOR ENERGIA 01 - C. LOG','energia','C.LOG','kWh']
  ];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const nowLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);

  function toast(msg,type='info'){
    let x=$('#bt-v15-toast');
    if(!x){x=document.createElement('div');x.id='bt-v15-toast';document.body.appendChild(x)}
    x.textContent=msg;x.dataset.type=type;x.classList.add('show');clearTimeout(x._t);x._t=setTimeout(()=>x.classList.remove('show'),3800);
  }

  function clock(){
    const d=new Date();
    const t=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
    const dt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(d);
    $$('[data-live-clock],.industrial-status-card strong').forEach(e=>e.textContent=t);
    $$('[data-live-date]').forEach(e=>e.textContent=dt);
  }
  function startClock(){if(APP.clock)return;clock();APP.clock=setInterval(clock,1000)}

  async function auth(){
    const c=sb();if(!c)return;
    try{
      const {data:{session}}=await c.auth.getSession();
      if(session?.user){APP.user=session.user;await profile(session.user);await syncMeters()}
      c.auth.onAuthStateChange(async(_,s)=>{
        if(s?.user){APP.user=s.user;await profile(s.user);await syncMeters();await refresh()}
        else APP.user=null;
      });
    }catch(e){console.warn('[BIOTROP] auth',e)}
  }

  async function profile(u){
    const c=sb();if(!c)return;
    const {data:p}=await c.from('profiles').select('*').eq('id',u.id).maybeSingle();
    const name=p?.name||p?.full_name||u.email?.split('@')[0]||'Usuário';
    $$('.user-name').forEach(e=>e.textContent=name);
    $$('.user-role').forEach(e=>e.textContent=/admin|gestor|aprovador|almoxarife/i.test(p?.role_code||p?.app_role||'')?'Administrador':'Técnico');
    $$('.user-avatar').forEach(e=>{e.innerHTML=p?.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Foto de perfil">`:esc(name.charAt(0).toUpperCase())});
    // O perfil permanece apenas informativo nesta etapa. Configurações e tema foram removidos.
    $$('.user-chip').forEach(e=>{e.onclick=null;e.onkeydown=null;e.removeAttribute('role');e.removeAttribute('tabindex');e.style.cursor='default'});
  }

  async function syncMeters(){
    const c=sb();if(!c)return;
    const rows=DEFAULT.map(([code,name,utility_type,location,unit])=>({code,name,utility_type,location,unit,initial_reading:0,active:true,created_by:APP.user?.id||null}));
    const {error}=await c.from('utility_meters').upsert(rows,{onConflict:'code',ignoreDuplicates:false});
    if(error)console.warn('[BIOTROP] sync meters',error.message);
    await loadMeters();
  }

  async function loadMeters(){
    const c=sb();if(!c)return[];
    const {data,error}=await c.from('utility_meters').select('*').eq('active',true).order('location').order('utility_type').order('name');
    if(error){console.warn('[BIOTROP] load meters',error.message);return[]}
    APP.meters=data||[];return APP.meters;
  }

  async function latestReading(meterId){
    const c=sb();if(!c)return null;
    const {data,error}=await c.from('utility_readings').select('id,reading_value,previous_reading,consumption,reading_date,photo_path,status,observation').eq('meter_id',meterId).order('reading_date',{ascending:false}).limit(1).maybeSingle();
    if(error){console.warn('[BIOTROP] latest reading',error.message);return null}
    return data||null;
  }

  function removeBadUI(){
    const bad=[
      'modo escuro','modo claro','tema','configurações','configuracoes','configurações do usuário','configuracoes do usuario',
      'registrar horímetro','registrar horimetro'
    ];
    $$('.bt-floating-actions,.bt-context-toolbar,.bt-float-theme,.bt-settings-inline,.bt-hidden-layout-artifact,.bt-v10-modal-backdrop,#bt-v11-settings,#bt-v12-settings').forEach(e=>e.remove());
    $$('button,a,[role="button"],label').forEach(e=>{
      const t=norm(e.innerText||e.textContent);
      if(bad.some(x=>t===x||t.includes(x))){
        if(e.closest('.bt-v15-modal'))return;
        e.remove();
      }
    });
    // Remove os três cards antigos que não pertencem à lista real.
    ['eta / água','eta / agua','caldeira / gás','caldeira / gas','envase / energia'].forEach(name=>{
      $$('h1,h2,h3,h4,h5,strong,b,div,span,p').filter(e=>norm(e.textContent)===name).forEach(e=>{
        const card=e.closest('.card,.panel,.dashboard-card,.utility-card,article,section')||e.parentElement?.parentElement;
        if(card&&card!==document.body)card.remove();
      });
    });
    $$('.user-chip').forEach(e=>{e.onclick=null;e.onkeydown=null;e.removeAttribute('role');e.removeAttribute('tabindex')});
  }

  function modal(id,title,sub,body,actions=''){
    $$('.bt-v15-modal').forEach(e=>e.remove());
    const x=document.createElement('div');x.id=id;x.className='bt-v15-modal';
    x.innerHTML=`<div class="bt-v15-dialog"><header><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><button type="button" class="bt-v15-x">×</button></header><main>${body}</main><footer>${actions}</footer></div>`;
    x.addEventListener('click',e=>{if(e.target===x||e.target.closest('.bt-v15-x')){stopCamera();x.remove()}});
    document.body.appendChild(x);return x;
  }

  async function openReading(meterId=null){
    const ms=await loadMeters();
    if(!ms.length){toast('Nenhum medidor ativo encontrado no Supabase.','error');return}
    const selected=meterId&&ms.some(m=>String(m.id)===String(meterId))?String(meterId):String(ms[0].id);
    const opts=ms.map(m=>`<option value="${esc(m.id)}" ${String(m.id)===selected?'selected':''}>${esc(m.name)} · ${esc(m.unit)} · ${esc(m.location||'')}</option>`).join('');
    const x=modal('bt-v15-reading','Registrar leitura','Apontamento vinculado ao medidor, usuário, data/hora e evidência fotográfica.',`
      <div class="bt-v15-grid">
        <label class="full">Medidor / equipamento<select id="v15-meter">${opts}</select></label>
        <div class="v15-prev full" id="v15-prev">Carregando última leitura…</div>
        <label>Leitura atual<input id="v15-value" type="number" min="0" step="0.001" inputmode="decimal" placeholder="Ex.: 1234.500" autofocus></label>
        <label>Data e hora<input id="v15-date" type="datetime-local" value="${nowLocal()}"></label>
        <label class="full">Observação<textarea id="v15-note" rows="3" placeholder="Opcional"></textarea></label>
        <div class="v15-camera full">
          <div class="v15-camera-head"><div><b>Evidência fotográfica obrigatória</b><small>Fotografe o marcador no momento da leitura.</small></div><span id="v15-photo-status">Nenhuma foto</span></div>
          <video id="v15-video" autoplay playsinline></video>
          <canvas id="v15-canvas"></canvas>
          <div class="v15-photo-actions">
            <button type="button" class="bt-v15-secondary" id="v15-camera-open">Abrir câmera</button>
            <button type="button" class="bt-v15-secondary" id="v15-camera-shot" disabled>Tirar foto</button>
            <label class="bt-v15-secondary">Escolher foto<input id="v15-photo" type="file" accept="image/*" capture="environment" hidden></label>
          </div>
          <img id="v15-preview" class="v15-preview" alt="Prévia da evidência">
        </div>
      </div>`,
      '<button type="button" class="bt-v15-secondary" data-cancel>Cancelar</button><button type="button" class="bt-v15-primary" id="v15-save">Salvar apontamento</button>'
    );
    $('#v15-meter',x).onchange=()=>previous(x);
    $('#v15-camera-open',x).onclick=()=>openCamera(x);
    $('#v15-camera-shot',x).onclick=()=>takePhoto(x);
    $('#v15-photo',x).onchange=e=>filePhoto(x,e.target.files?.[0]);
    $('[data-cancel]',x).onclick=()=>{stopCamera();x.remove()};
    $('#v15-save',x).onclick=()=>saveReading(x);
    await previous(x);
  }

  async function previous(x){
    const id=$('#v15-meter',x)?.value,m=APP.meters.find(a=>String(a.id)===String(id));if(!m)return;
    const data=await latestReading(id);const v=Number(data?.reading_value??m.initial_reading??0);x.dataset.previous=String(v);
    $('#v15-prev',x).innerHTML=`<span>Última leitura</span><strong>${v.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${esc(m.unit)}</strong><small>${data?new Date(data.reading_date).toLocaleString('pt-BR'):'Sem apontamento anterior — leitura inicial'}</small>`;
  }

  async function openCamera(x){
    if(!navigator.mediaDevices?.getUserMedia){toast('Câmera não disponível neste navegador. Use Escolher foto.','error');return}
    try{
      stopCamera();
      APP.camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      const v=$('#v15-video',x);v.srcObject=APP.camera;v.style.display='block';$('#v15-camera-shot',x).disabled=false;$('#v15-camera-open',x).textContent='Câmera ativa';
    }catch(e){console.error(e);toast('Não foi possível abrir a câmera. Verifique a permissão do navegador.','error')}
  }
  function stopCamera(){APP.camera?.getTracks().forEach(t=>t.stop());APP.camera=null}
  function setPhoto(x,file,label='Foto selecionada'){
    if(!file)return;
    if(file.size>12*1024*1024){toast('A foto deve ter no máximo 12 MB.','error');return}
    x._photo=file;const img=$('#v15-preview',x);img.src=URL.createObjectURL(file);img.style.display='block';$('#v15-photo-status',x).textContent=label;
  }
  function takePhoto(x){
    const v=$('#v15-video',x),c=$('#v15-canvas',x);if(!v.videoWidth){toast('Aguarde a câmera iniciar.','error');return}
    c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
    c.toBlob(b=>{setPhoto(x,new File([b],`medidor-${Date.now()}.jpg`,{type:'image/jpeg'}),'Foto capturada da câmera');stopCamera();$('#v15-camera-shot',x).disabled=true;$('#v15-camera-open',x).textContent='Abrir câmera'},'image/jpeg',.9);
  }
  function filePhoto(x,f){setPhoto(x,f,f?`Foto selecionada: ${f.name}`:'Nenhuma foto')}

  async function saveReading(x){
    const c=sb(),u=APP.user?.id,id=$('#v15-meter',x)?.value,value=Number($('#v15-value',x)?.value),photo=x._photo;
    if(!c||!u){toast('Sessão não encontrada. Faça login novamente.','error');return}
    if(!id||!Number.isFinite(value)){toast('Informe a leitura atual.','error');return}
    if(!photo){toast('A foto do marcador é obrigatória.','error');return}
    const prev=Number(x.dataset.previous||0);if(value<prev){toast(`A leitura não pode ser menor que ${prev.toLocaleString('pt-BR')}.`,'error');return}
    const m=APP.meters.find(a=>String(a.id)===String(id));const btn=$('#v15-save',x);btn.disabled=true;btn.textContent='Salvando…';
    try{
      const path=`${u}/${id}/${Date.now()}-${Math.random().toString(36).slice(2,9)}.jpg`;
      const up=await c.storage.from('utility-evidence').upload(path,photo,{upsert:false,contentType:photo.type||'image/jpeg'});
      if(up.error)throw new Error(`Falha ao enviar foto: ${up.error.message}`);
      const selectedDate=$('#v15-date',x)?.value;
      const readingDate=selectedDate?new Date(selectedDate).toISOString():new Date().toISOString();
      const payload={meter_id:id,user_id:u,reading_value:value,previous_reading:prev,consumption:value-prev,reading_date:readingDate,server_timestamp:new Date().toISOString(),status:'pendente',observation:$('#v15-note',x)?.value.trim()||null,photo_path:path,captured_at:new Date().toISOString(),evidence_required:true};
      const {error}=await c.from('utility_readings').insert(payload);if(error)throw error;
      stopCamera();x.remove();toast(`Apontamento salvo em ${m?.name||'medidor'}.`,'success');await refresh();
    }catch(e){console.error('[BIOTROP] save reading',e);toast(e?.message||'Erro ao salvar apontamento.','error')}
    finally{btn.disabled=false;btn.textContent='Salvar apontamento'}
  }

  function meterTypeLabel(t){return t==='agua'?'Água':t==='gas'?'Gás':t==='energia'?'Energia':'Horímetro'}
  function meterIcon(t){return t==='agua'?'💧':t==='gas'?'◈':t==='energia'?'⚡':'◷'}

  async function renderMeterPanel(){
    const ms=await loadMeters();
    const host=findUtilityHost();if(!host)return;
    let list=host.querySelector('#bt-v15-meter-list');
    if(!list){
      list=document.createElement('div');list.id='bt-v15-meter-list';
      const heading=[...host.querySelectorAll('h1,h2,h3,h4')].find(e=>norm(e.textContent)==='leitura atual por equipamento');
      if(heading?.parentElement)heading.parentElement.insertAdjacentElement('afterend',list);else host.appendChild(list);
    }
    list.innerHTML='<div class="bt-v15-list-head"><div><span>MEDIDORES ATIVOS</span><h3>Apontamento por equipamento</h3><p>Cada cartão está ligado ao seu medidor no Supabase. Use <b>Registrar leitura</b> para lançar valor e foto.</p></div><button type="button" class="bt-v15-refresh" id="bt-v15-refresh">Atualizar</button></div><div class="bt-v15-groups"></div>';
    const groups={};ms.forEach(m=>(groups[m.location||'Sem local']??=[]).push(m));
    const root=$('.bt-v15-groups',list);
    for(const [location,arr] of Object.entries(groups)){
      const section=document.createElement('section');section.className='bt-v15-location';
      section.innerHTML=`<div class="bt-v15-location-title"><span>${esc(location)}</span><b>${arr.length} medidor${arr.length===1?'':'es'}</b></div><div class="bt-v15-cards"></div>`;
      root.appendChild(section);
      const cards=$('.bt-v15-cards',section);
      for(const m of arr){
        const r=await latestReading(m.id);const value=r?.reading_value??m.initial_reading??0;const status=r?'COM LEITURA':'SEM LEITURA';
        const card=document.createElement('article');card.className='bt-v15-meter-card';
        card.innerHTML=`<div class="bt-v15-card-top"><span>${meterIcon(m.utility_type)} ${esc(meterTypeLabel(m.utility_type))}</span><em>${status}</em></div><h4>${esc(m.name)}</h4><small>${esc(m.code)} · ${esc(m.location||'')}</small><div class="bt-v15-reading"><strong>${Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3})}</strong><span>${esc(m.unit)}</span></div><div class="bt-v15-card-meta">${r?`Último: ${new Date(r.reading_date).toLocaleString('pt-BR')}`:'Nenhum apontamento registrado'}</div><div class="bt-v15-card-actions"><button type="button" class="bt-v15-primary" data-v15-read="${esc(m.id)}">Registrar leitura</button>${r?.photo_path?'<span class="bt-v15-evidence">✓ Evidência salva</span>':'<span class="bt-v15-evidence muted">Evidência —</span>'}</div>`;
        cards.appendChild(card);
      }
    }
    $('#bt-v15-refresh',list).onclick=()=>refresh();
    await renderHistory(host);
  }

  function findUtilityHost(){
    const heading=[...document.querySelectorAll('h1,h2,h3,h4,h5')].find(e=>norm(e.textContent)==='leitura atual por equipamento');
    if(!heading)return null;
    return heading.closest('.card,.panel,.dashboard-card,.utility-panel,section')||heading.parentElement?.parentElement||heading.parentElement;
  }

  async function renderHistory(host){
    const c=sb();if(!c)return;
    let box=host.querySelector('#bt-v15-history');
    if(!box){box=document.createElement('section');box.id='bt-v15-history';host.appendChild(box)}
    const {data,error}=await c.from('utility_readings').select('id,meter_id,user_id,reading_value,previous_reading,consumption,reading_date,photo_path,status,observation').order('reading_date',{ascending:false}).limit(100);
    if(error){box.innerHTML='<div class="bt-v15-history-empty">Não foi possível carregar o histórico.</div>';return}
    const rows=data||[];const meterById=new Map(APP.meters.map(m=>[String(m.id),m]));
    box.innerHTML=`<div class="bt-v15-history-head"><div><span>HISTÓRICO</span><h3>Apontamentos recentes</h3><p>Data, leitura, consumo, evidência e responsável.</p></div><b>${rows.length}</b></div>`;
    if(!rows.length){box.insertAdjacentHTML('beforeend','<div class="bt-v15-history-empty">Nenhum apontamento registrado.</div>');return}
    const table=document.createElement('div');table.className='bt-v15-table-wrap';table.innerHTML='<table class="bt-v15-table"><thead><tr><th>Data</th><th>Medidor</th><th>Anterior</th><th>Atual</th><th>Consumo</th><th>Evidência</th><th>Status</th></tr></thead><tbody></tbody></table>';
    const tbody=$('tbody',table);
    rows.forEach(r=>{const m=meterById.get(String(r.meter_id));const tr=document.createElement('tr');tr.innerHTML=`<td>${new Date(r.reading_date).toLocaleString('pt-BR')}</td><td><b>${esc(m?.name||'Medidor')}</b><small>${esc(m?.location||'')}</small></td><td>${Number(r.previous_reading||0).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${esc(m?.unit||'')}</td><td><b>${Number(r.reading_value||0).toLocaleString('pt-BR',{maximumFractionDigits:3})}</b> ${esc(m?.unit||'')}</td><td>${Number(r.consumption||0).toLocaleString('pt-BR',{maximumFractionDigits:3})}</td><td>${r.photo_path?'<span class="bt-v15-ok">✓ Foto salva</span>':'—'}</td><td><span class="bt-v15-status">${esc(r.status||'pendente')}</span></td>`;tbody.appendChild(tr)});
    box.appendChild(table);
  }

  function injectCSS(){
    if($('#bt-v15-css'))return;
    const s=document.createElement('style');s.id='bt-v15-css';s.textContent=`
      .bt-v15-modal{position:fixed;inset:0;z-index:999990;background:rgba(0,15,16,.84);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:20px}
      .bt-v15-dialog{width:min(820px,96vw);max-height:92vh;overflow:auto;background:#092a2a;color:#edf9f4;border:1px solid rgba(130,220,198,.2);border-radius:20px;box-shadow:0 35px 100px rgba(0,0,0,.55);padding:22px}
      .bt-v15-dialog header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.bt-v15-dialog h2{margin:0;font-size:22px}.bt-v15-dialog header p{margin:6px 0 0;color:#8fb6aa;font-size:12px}.bt-v15-x{border:0;background:rgba(255,255,255,.07);color:#fff;border-radius:9px;width:36px;height:36px;font-size:22px;cursor:pointer}
      .bt-v15-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bt-v15-grid label{display:flex;flex-direction:column;gap:7px;color:#a6c8bf;font:800 10px system-ui;text-transform:uppercase;letter-spacing:.06em}.bt-v15-grid label.full{grid-column:1/-1}.bt-v15-grid input,.bt-v15-grid select,.bt-v15-grid textarea{width:100%;border:1px solid rgba(150,220,205,.17);background:#061e1f;color:#effaf5;border-radius:10px;padding:12px;font:600 14px system-ui;outline:0}.bt-v15-grid input:focus,.bt-v15-grid select:focus,.bt-v15-grid textarea:focus{border-color:#39c99a}
      .v15-prev{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;background:#071f20;border:1px solid rgba(150,220,205,.12);border-radius:10px;padding:12px 14px}.v15-prev span{color:#82a99f;font-size:11px}.v15-prev strong{font-size:19px}.v15-prev small{color:#6f9389;text-align:right}
      .v15-camera{border:1px dashed rgba(57,201,154,.3);border-radius:12px;padding:14px;background:rgba(57,201,154,.035)}.v15-camera-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.v15-camera-head div{display:flex;flex-direction:column;gap:4px}.v15-camera-head small{font-weight:500;color:#769b91;font-size:11px}.v15-camera-head span{color:#7fa79c;font-size:11px}.v15-camera video{width:100%;max-height:360px;object-fit:cover;border-radius:10px;background:#020909;display:none}.v15-photo-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.bt-v15-primary,.bt-v15-secondary{border-radius:10px;padding:11px 15px;font:800 12px system-ui;cursor:pointer}.bt-v15-primary{border:0;background:#39c99a;color:#06241e}.bt-v15-secondary{border:1px solid rgba(150,220,205,.18);background:transparent;color:#bde0d6}.v15-preview{max-width:100%;max-height:260px;border-radius:10px;margin-top:10px;display:none}.bt-v15-dialog footer{display:flex;justify-content:flex-end;gap:9px;border-top:1px solid rgba(150,220,205,.12);padding-top:15px;margin-top:18px}
      #bt-v15-meter-list{margin-top:22px}.bt-v15-list-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin:18px 0}.bt-v15-list-head span,.bt-v15-history-head span{font:800 10px system-ui;letter-spacing:.14em;color:#65c6a9}.bt-v15-list-head h3,.bt-v15-history-head h3{margin:4px 0;font-size:18px;color:inherit}.bt-v15-list-head p,.bt-v15-history-head p{margin:0;color:#86a69e;font-size:12px;line-height:1.5}.bt-v15-refresh{border:1px solid rgba(100,190,165,.3);background:transparent;color:inherit;border-radius:9px;padding:9px 13px;cursor:pointer;font-weight:700}
      .bt-v15-location{margin-top:20px}.bt-v15-location-title{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(140,210,195,.12);padding-bottom:8px;margin-bottom:10px}.bt-v15-location-title span{font-weight:800;font-size:12px;letter-spacing:.08em}.bt-v15-location-title b{font-size:11px;color:#7fa79c}.bt-v15-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bt-v15-meter-card{border:1px solid rgba(140,210,195,.15);border-radius:14px;padding:15px;background:rgba(7,35,35,.45)}.bt-v15-card-top{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#84b7a9;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.bt-v15-card-top em{font-style:normal;font-size:9px;border:1px solid rgba(100,190,165,.25);padding:3px 6px;border-radius:999px}.bt-v15-meter-card h4{margin:11px 0 3px;font-size:14px;line-height:1.3}.bt-v15-meter-card>small{color:#6f9189;font-size:10px}.bt-v15-reading{display:flex;align-items:baseline;gap:5px;margin-top:14px}.bt-v15-reading strong{font-size:27px}.bt-v15-reading span{color:#80a59b;font-size:12px;font-weight:700}.bt-v15-card-meta{font-size:10px;color:#70958b;margin-top:4px;min-height:16px}.bt-v15-card-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:13px}.bt-v15-card-actions .bt-v15-primary{padding:9px 11px}.bt-v15-evidence{font-size:9px;color:#63c9a7;font-weight:800}.bt-v15-evidence.muted{color:#698d84;font-weight:600}
      #bt-v15-history{margin-top:26px;border-top:1px solid rgba(140,210,195,.13);padding-top:20px}.bt-v15-history-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-end;margin-bottom:12px}.bt-v15-history-head>b{font-size:22px}.bt-v15-history-empty{padding:28px;text-align:center;color:#789b92;border:1px dashed rgba(140,210,195,.14);border-radius:12px}.bt-v15-table-wrap{overflow:auto;border:1px solid rgba(140,210,195,.12);border-radius:12px}.bt-v15-table{width:100%;border-collapse:collapse;min-width:850px;font-size:11px}.bt-v15-table th{background:rgba(255,255,255,.03);text-align:left;color:#7ea59b;padding:10px;border-bottom:1px solid rgba(140,210,195,.12);font-size:9px;text-transform:uppercase}.bt-v15-table td{padding:10px;border-bottom:1px solid rgba(140,210,195,.08);color:#c0d9d2}.bt-v15-table tr:last-child td{border-bottom:0}.bt-v15-table td small{display:block;color:#6d9087;margin-top:3px}.bt-v15-ok{color:#63c9a7;font-weight:800}.bt-v15-status{font-size:9px;border-radius:999px;padding:3px 7px;border:1px solid rgba(255,190,80,.2);color:#d8b66c}
      #bt-v15-toast{position:fixed;right:22px;top:22px;z-index:1000000;background:#092525;color:#effaf5;border:1px solid rgba(57,201,154,.35);padding:13px 17px;border-radius:12px;font:700 13px system-ui;opacity:0;transform:translateY(-8px);pointer-events:none;transition:.2s;max-width:min(440px,90vw)}#bt-v15-toast.show{opacity:1;transform:none}#bt-v15-toast[data-type="error"]{border-color:rgba(230,90,90,.5)}
      /* remove definitivamente os controles de tema/configuração desta versão */
      body .bt-floating-actions,body .bt-context-toolbar,body .bt-float-theme,body .bt-settings-inline,#bt-v11-settings,#bt-v12-settings{display:none!important}
      @media(max-width:1050px){.bt-v15-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.bt-v15-grid{grid-template-columns:1fr}.bt-v15-grid label.full{grid-column:auto}.bt-v15-cards{grid-template-columns:1fr}.bt-v15-list-head{align-items:flex-start;flex-direction:column}.bt-v15-dialog footer{flex-direction:column-reverse}.bt-v15-primary,.bt-v15-secondary{width:100%}.v15-prev{grid-template-columns:1fr}.v15-prev small{text-align:left}}
    `;document.head.appendChild(s);
  }

  async function refresh(){
    await loadMeters();
    removeBadUI();
    await renderMeterPanel();
    clock();
  }

  function bind(){
    document.addEventListener('click',e=>{
      const read=e.target.closest?.('[data-v15-read]');
      if(read){e.preventDefault();e.stopImmediatePropagation();openReading(read.dataset.v15Read);return}
      const b=e.target.closest?.('button,a,[role="button"]');if(!b)return;
      const t=norm(b.innerText||b.textContent);
      if(t==='registrar leitura'){e.preventDefault();e.stopImmediatePropagation();openReading();return}
      if(t.includes('modo escuro')||t.includes('modo claro')||t==='tema'||t.includes('configurações')||t.includes('configuracoes')||t.includes('registrar horímetro')||t.includes('registrar horimetro')){e.preventDefault();e.stopImmediatePropagation();b.remove()}
    },true);
  }

  function boot(){
    injectCSS();startClock();bind();removeBadUI();auth();
    const observer=new MutationObserver(()=>{removeBadUI();clock();const h=findUtilityHost();if(h&&!h.querySelector('#bt-v15-meter-list'))renderMeterPanel()});
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(refresh,700);setTimeout(refresh,1800);setTimeout(refresh,3500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
