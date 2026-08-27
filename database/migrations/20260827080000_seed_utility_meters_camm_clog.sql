-- BIOTROP • Medidores padrão de Utilidades
-- Executar no Supabase depois do schema/base de utilidades.

insert into public.utility_meters (code,name,utility_type,location,unit,initial_reading,active)
values
('CAMM1-GAS-01','MEDIDOR GÁS 01 - CAMM 1','gas','CAMM 1','Nm³',0,true),
('CAMM1-AGUA-02','HIDROMETRO 02 - CAMM 1','agua','CAMM 1','m³',0,true),
('CAMM1-AGUA-03','HIDROMETRO 03 - CAMM 1','agua','CAMM 1','m³',0,true),
('CAMM1-AGUA-06','HIDROMETRO 06 - CAMM 1 - POÇO','agua','CAMM 1','m³',0,true),
('CAMM1-AGUA-08','HIDROMETRO 08 - CAMM 2','agua','CAMM 2','m³',0,true),
('CAMM1-AGUA-09','HIDROMETRO 09 - CAMM 2','agua','CAMM 2','m³',0,true),
('CAMM1-LUZ-02','MEDIDOR ENERGIA 02 - CAMM 1 - BOMBA DE INCENDIO','energia','CAMM 1','kWh',0,true),
('CAMM1-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 1 - CABINE PRIMARIA','energia','CAMM 1','kWh',0,true),
('CAMM2-GAS-01','MEDIDOR GÁS 01 - CAMM 2','gas','CAMM 2','Nm³',0,true),
('CAMM2-AGUA-01','HIDROMETRO 01 - CAMM 2','agua','CAMM 2','m³',0,true),
('CAMM2-AGUA-02','HIDROMETRO 02 - CAMM 2','agua','CAMM 2','m³',0,true),
('CAMM2-LUZ-02','MEDIDOR ENERGIA 02 - CAMM 2','energia','CAMM 2','kWh',0,true),
('CAMM2-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 2','energia','CAMM 2','kWh',0,true),
('CAMM3-GAS-01','MEDIDOR GÁS 01 - CAMM 3','gas','CAMM 3','Nm³',0,true),
('CAMM3-AGUA-01','HIDROMETRO 01 - CAMM 3','agua','CAMM 3','m³',0,true),
('CAMM3-LUZ-01','MEDIDOR ENERGIA 01 - CAMM 3','energia','CAMM 3','kWh',0,true),
('CLOG-AGUA-01','HIDROMETRO 01 - C.LOG','agua','C.LOG','m³',0,true),
('CLOG-LUZ-01','MEDIDOR ENERGIA 01 - C. LOG','energia','C.LOG','kWh',0,true)
on conflict (code) do update set name=excluded.name, utility_type=excluded.utility_type, location=excluded.location, unit=excluded.unit, active=true, updated_at=now();
