begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('aa000000-0000-4000-8000-000000000001','media-qa-owner@example.invalid','{}'),
 ('bb000000-0000-4000-8000-000000000002','media-qa-other@example.invalid','{}');
set local role service_role;
insert into public.listing_drafts(id,seller_id,kind,asset_name,title,format) values
 ('cc000000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000001','file','QA File','QA file draft','buy_now'),
 ('dd000000-0000-4000-8000-000000000004','bb000000-0000-4000-8000-000000000002','file','Other File','Other draft','buy_now');
select public.reserve_listing_asset('aa000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000003','image','One.png','image/png',12);
select public.reserve_listing_asset('aa000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000003','image','Two.png','image/png',12);
update public.listing_assets set status='ready';
do $$declare first_id uuid;begin
 select id into first_id from public.listing_assets where filename='One.png';
 perform public.move_listing_image('aa000000-0000-4000-8000-000000000001',first_id,'later');
 if (select position from public.listing_assets where id=first_id)<>1 then raise exception 'Order change failed';end if;
 begin
  perform public.reserve_listing_asset('aa000000-0000-4000-8000-000000000001','dd000000-0000-4000-8000-000000000004','image','Wrong.png','image/png',12);
  raise exception 'Cross seller reservation succeeded';
 exception when raise_exception then if sqlerrm<>'Draft not found' then raise;end if;end;
 begin
  update public.listing_drafts set roblox_user_id='42' where id='cc000000-0000-4000-8000-000000000003';
  raise exception 'File identity forgery accepted';
 exception when check_violation then null;end;
 for i in 3..8 loop
  perform public.reserve_listing_asset('aa000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000003','image','More.png','image/png',12);
 end loop;
 begin
  perform public.reserve_listing_asset('aa000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000003','image','Ninth.png','image/png',12);
  raise exception 'Quota bypass';
 exception when raise_exception then if sqlerrm<>'Draft upload limit reached' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"bb000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.listing_assets) then raise exception 'Cross account asset exposure';end if;
 begin perform public.reserve_listing_asset('bb000000-0000-4000-8000-000000000002','dd000000-0000-4000-8000-000000000004','image','One.png','image/png',12);raise exception 'Client RPC permitted';exception when insufficient_privilege then null;end;
 begin update public.listing_assets set status='ready';raise exception 'Client write permitted';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if (select count(*) from public.listing_assets)<>8 then raise exception 'Owner read failed';end if;end$$;
reset role;
set local role anon;
do $$begin begin perform * from public.listing_assets;raise exception 'Anonymous read permitted';exception when insufficient_privilege then null;end;end$$;
reset role;
do $$begin if exists(select 1 from storage.buckets where id in ('bestottr-draft-images','bestottr-draft-files') and public) then raise exception 'Public bucket';end if;end$$;
rollback;
