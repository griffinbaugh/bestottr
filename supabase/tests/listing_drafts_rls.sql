begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('aa000000-0000-4000-8000-000000000001','draft-qa-owner@example.invalid','{"display_name":"Draft QA"}'),
 ('bb000000-0000-4000-8000-000000000002','draft-qa-other@example.invalid','{"display_name":"Other QA"}');
set local role service_role;
insert into public.listing_drafts(seller_id,kind,asset_id,place_id,roblox_user_id,creator_type,creator_id,asset_name,title,format,price_cents,ownership_checked_at) values
 ('aa000000-0000-4000-8000-000000000001','experience','990001','990011','42','User','42','QA Game','Owner draft','buy_now',101,now()),
 ('bb000000-0000-4000-8000-000000000002','community','990002',null,'43','Group','990002','QA Group','Other draft','auction',999,now());
reset role;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$
begin
 if (select count(*) from public.listing_drafts) <> 1 then raise exception 'Owner read isolation failed'; end if;
 if exists(select 1 from public.listing_drafts where seller_id='bb000000-0000-4000-8000-000000000002') then raise exception 'Other draft exposed'; end if;
 if (select price_cents from public.listing_drafts) <> 101 then raise exception 'Cent precision failed'; end if;
 begin
  insert into public.listing_drafts(seller_id,kind,asset_id,place_id,roblox_user_id,creator_type,creator_id,asset_name,title,format,ownership_checked_at) values ('aa000000-0000-4000-8000-000000000001','experience','990003','990012','42','User','42','Forged','Forged draft','buy_now',now());
  raise exception 'Client certified ownership';
 exception when insufficient_privilege then null; end;
 begin update public.listing_drafts set roblox_user_id='999'; raise exception 'Client changed verified ownership';
 exception when insufficient_privilege then null; end;
 begin delete from public.listing_drafts; raise exception 'Client deleted records directly';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.listing_drafts; raise exception 'Anonymous draft access';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner isolation, cross-account denial, integer cents, blocked direct writes, anonymous denial; QA rolled back' as result;
rollback;
