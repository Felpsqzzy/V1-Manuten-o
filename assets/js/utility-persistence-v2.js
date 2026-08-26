(function(){
  'use strict';

  const DB=()=>{try{return (typeof SB!=='undefined'&&SB)||window.SB||null}catch(_){return null}};
  const uid=()=>{try{return STATE?.currentUser?.dbId||STATE?.currentUser?.id||null}catch(_){return null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function toast(message,ok=true){
    let el=document.querySelector('.bt-util-toast');
    if(!el){el=document.createElement('div');el.className='bt-util-toast';document.body.appendChild(el)}
    el.textContent=message;
    el.dataset.ok=ok?'1':'0';
    clearTimeout(window.__btUtilToastTimer);
    window.__btUtilToastTimer=setTimeout(()=>el.remove(),3500);
  }

  function closeModal(){
    const m=document.querySelector('#utility-reading-form')?.closest('.training-modal')||document.querySelector('[id="um-save"]')?.closest('.training-modal');
    if(m)m.remove();
    document.body.classList.remove('bt-modal-open');
  }

  function normalizeMeter(row){
    return {
      id:row.id,
      name:row.name,
      type:row.utility_type,
      asset:row.code||'',
      unit:row.unit||'h',
      initial:Number(row.initial_reading||0),
      active:row.active!==false,
      location:row.location||''
    };
  }

  function normalizeReading(row,meter){
    return {
      id:row.id,
      meterId:row.meter_id,
      meterName:meter?.name||row.meter_name||'Medidor',
      reading:Number(row.reading_value||0),
      consumption:row.consumption==null?null:Number(row.consumption),
      photo:!!row.photo_path,
      photoPath:row.photo_path||null,
      user:row.user_email||row.user_name||'',
      at:row.reading_date||row.created_at,
      status:row.status||'pendente',
      latitude:row.latitude,
      longitude:row.longitude
    };
  }

  async function syncFromDatabase(){
    const api=DB();
    if(!api||!uid())return;
    try{
      const [mr,rr]=await Promise.all([
        api.from('utility_meters').select('id,name,code,utility_type,location,unit,initial_reading,active,created_at').order('created_at',{ascending:true}),
        api.from('utility_readings').select('id,meter_id,user_id,reading_value,previous_reading,consumption,reading_date,created_at,status,photo_path,latitude,longitude').order('reading_date',{ascending:false}).limit(500)
      ]);
      if(mr.error)throw mr.error;
      if(rr.error)throw rr.error;
      const meters=(mr.data||[]).map(normalizeMeter);
      const byId=new Map(meters.map(m=>[m.id,m]));
      const readings=(rr.data||[]).map(r=>normalizeReading(r,byId.get(r.meter_id)));
      localStorage.setItem('BIOTROP_UTILITY_METERS_V9',JSON.stringify(meters));
      localStorage.setItem('BIOTROP_UTILITY_READINGS_V9',JSON.stringify(readings));
      window.dispatchEvent(new CustomEvent('biotrop:utility-db-synced',{detail:{meters,readings}}));
    }catch(error){
      console.warn('[BIOTROP] utility sync failed:',error);
      toast('Não foi possível sincronizar Utilidades com o banco.',false);
    }
  }

  async function uploadPhoto(file,userId,meterId){
    if(!file)return null;
    const api=DB();
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${userId}/${meterId}/${Date.now()}-${crypto.randomUUID()}-${safe}`;
    const result=await api.storage.from('utility-evidence').upload(path,file,{upsert:false,cacheControl:'3600',contentType:file.type});
    if(result.error)throw result.error;
    return path;
  }

  async function saveMeter(){
    const api=DB(),user=uid();
    if(!api||!user)throw new Error('Sessão expirada. Faça login novamente.');
    const name=document.getElementById('um-name')?.value.trim();
    const type=document.getElementById('um-type')?.value;
    const asset=document.getElementById('um-asset')?.value.trim();
    const unit=document.getElementById('um-unit')?.value.trim()||'h';
    const initial=Number(document.getElementById('um-initial')?.value||0);
    if(!name)throw new Error('Informe o nome do medidor.');
    if(!type)throw new Error('Selecione o tipo do medidor.');
    if(!Number.isFinite(initial)||initial<0)throw new Error('A leitura inicial é inválida.');
    const code=asset||('MED-'+Date.now().toString().slice(-8));
    const {data,error}=await api.from('utility_meters').insert({name,code,utility_type:type,unit,initial_reading:initial,active:true}).select('*').single();
    if(error)throw error;
    await syncFromDatabase();
    closeModal();
    toast('Medidor cadastrado e salvo no Supabase.');
    if(typeof navigateTo==='function')navigateTo('utilidades');
    return data;
  }

  async function saveReading(form){
    const api=DB(),user=uid();
    if(!api||!user)throw new Error('Sessão expirada. Faça login novamente.');
    const meterId=document.getElementById('ur-meter')?.value;
    const reading=Number(document.getElementById('ur-reading')?.value);
    const atField=document.getElementById('ur-at')?.value;
    const file=document.getElementById('ur-photo')?.files?.[0]||null;
    if(!meterId)throw new Error('Selecione o medidor.');
    if(!Number.isFinite(reading)||reading<0)throw new Error('Informe uma leitura válida.');
    const {data:meter,error:meterError}=await api.from('utility_meters').select('id,name,utility_type,unit,initial_reading').eq('id',meterId).maybeSingle();
    if(meterError)throw meterError;
    if(!meter)throw new Error('Medidor não encontrado no banco.');
    const prevResult=await api.from('utility_readings').select('reading_value').eq('meter_id',meterId).order('reading_date',{ascending:false}).limit(1).maybeSingle();
    if(prevResult.error)throw prevResult.error;
    const previous=prevResult.data?Number(prevResult.data.reading_value):Number(meter.initial_reading||0);
    if(reading<previous)throw new Error(`A leitura não pode ser menor que a anterior (${previous}).`);
    if(meter.utility_type==='horimetro'&&!file)throw new Error('A foto do horímetro é obrigatória.');
    if(file&&file.size>15*1024*1024)throw new Error('A foto deve ter no máximo 15 MB.');
    let photoPath=null;
    if(file)photoPath=await uploadPhoto(file,user,meterId);
    let coords={};
    try{
      coords=await new Promise(resolve=>{
        if(!navigator.geolocation)return resolve({});
        navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),()=>resolve({}),{enableHighAccuracy:true,timeout:5000,maximumAge:0});
      });
    }catch(_){coords={}}
    const stamp=atField?new Date(atField).toISOString():new Date().toISOString();
    const payload={meter_id:meterId,user_id:user,reading_value:reading,previous_reading:previous,consumption:reading-previous,reading_date:stamp,server_timestamp:new Date().toISOString(),latitude:coords.latitude??null,longitude:coords.longitude??null,status:'pendente',observation:'',inconsistent:false,correction_requested:false,photo_path:photoPath,captured_at:file?new Date().toISOString():null};
    const inserted=await api.from('utility_readings').insert(payload).select('*').single();
    if(inserted.error){if(photoPath)await api.storage.from('utility-evidence').remove([photoPath]);throw inserted.error;}
    await syncFromDatabase();
    closeModal();
    toast('Apontamento salvo no banco.');
    if(typeof navigateTo==='function')navigateTo('utilidades');
    try{window.dispatchEvent(new CustomEvent('biotrop:reading-saved',{detail:inserted.data}))}catch(_){ }
    return inserted.data;
  }

  function hideOldFloatingUI(){
    document.querySelectorAll('.bt-action-dock,.hm-open,.v12-float').forEach(el=>el.style.display='none');
    const old=document.getElementById('bt-utility-db-panel');if(old)old.remove();
  }

  function styleUtilityButtons(){
    document.querySelectorAll('.utility-meter-actions .t-btn,.utility-command-actions .t-btn').forEach(btn=>btn.classList.add('bt-utility-primary'));
  }

  function bind(){
    document.addEventListener('click',async e=>{
      const meterSave=e.target.closest?.('#um-save');
      if(meterSave){
        e.preventDefault();e.stopImmediatePropagation();
        try{meterSave.disabled=true;meterSave.textContent='Salvando…';await saveMeter()}catch(err){toast(err.message||'Erro ao salvar medidor.',false);meterSave.disabled=false;meterSave.textContent='Salvar medidor'}
        return;
      }
    },true);

    document.addEventListener('submit',async e=>{
      if(e.target?.id!=='utility-reading-form')return;
      e.preventDefault();e.stopImmediatePropagation();
      const btn=e.target.querySelector('button[type="submit"],button');
      try{if(btn){btn.disabled=true;btn.textContent='Salvando…'}await saveReading(e.target)}catch(err){toast(err.message||'Erro ao registrar apontamento.',false);if(btn){btn.disabled=false;btn.textContent='Salvar apontamento'}}
    },true);

    window.addEventListener('biotrop:utility-db-synced',()=>{styleUtilityButtons()});
  }

  async function boot(){
    hideOldFloatingUI();
    bind();
    await syncFromDatabase();
    styleUtilityButtons();
    setTimeout(hideOldFloatingUI,500);
    setTimeout(styleUtilityButtons,800);
  }

  window.BiotropUtilityDB={sync:syncFromDatabase,saveMeter,saveReading};
  window.addEventListener('load',()=>setTimeout(boot,900));
  setInterval(()=>{hideOldFloatingUI();if(document.querySelector('.utility-control-room'))styleUtilityButtons()},2500);
})();