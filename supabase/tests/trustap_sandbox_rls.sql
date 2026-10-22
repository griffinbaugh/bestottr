begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('aa000000-0000-4000-8000-000000000001','trustap-qa-seller@example.invalid','{}'),
 ('bb000000-0000-4000-8000-000000000002','trustap-qa-buyer@example.invalid','{}'),
 ('ee000000-0000-4000-8000-000000000005','trustap-qa-other@example.invalid','{}');
set local role service_role;
insert into public.trustap_sandbox_orders(id,request_id,reference,seller_id,buyer_id,title,kind,amount_cents,buyer_provider_id,seller_provider_id,client_id,fees_buyer,fees_seller,fees_config) values
 ('cc000000-0000-4000-8000-000000000003','dd000000-0000-4000-8000-000000000004','bt_aaaaaaaaaaaaaaaaaaaa','aa000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000002','Sandbox project','file',12345,'11000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','cid_qa',290,0,1);
insert into public.trustap_sandbox_events(order_id,state) values ('cc000000-0000-4000-8000-000000000003','awaiting_funding');
do $$declare claim uuid;begin
 claim:=public.claim_trustap_sandbox_sync('cc000000-0000-4000-8000-000000000003',false);
 if claim is null then raise exception 'Sync lease missing';end if;
 if public.claim_trustap_sandbox_sync('cc000000-0000-4000-8000-000000000003',true) is not null then raise exception 'Parallel sync permitted';end if;
 if public.commit_trustap_sandbox_sync('cc000000-0000-4000-8000-000000000003',gen_random_uuid(),'completed','{}') then raise exception 'Stale sync committed';end if;
 if not public.commit_trustap_sandbox_sync('cc000000-0000-4000-8000-000000000003',claim,'funded','{"secured":true}') then raise exception 'Sync not committed';end if;
 begin update public.trustap_sandbox_orders set mode='live';raise exception 'Live order permitted';exception when check_violation then null;end;
 begin update public.trustap_sandbox_orders set kind='experience';raise exception 'Null ownership target permitted';exception when check_violation then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"bb000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin
 if (select count(id) from public.trustap_sandbox_orders)<>1 then raise exception 'Buyer read failed';end if;
 if (select count(*) from public.trustap_sandbox_events)<>2 then raise exception 'Event read failed';end if;
 begin perform checkout_url from public.trustap_sandbox_orders;raise exception 'Checkout token exposed via direct API';exception when insufficient_privilege then null;end;
 begin perform * from public.trustap_sandbox_accounts;raise exception 'Provider account mapping exposed';exception when insufficient_privilege then null;end;
 begin perform * from public.trustap_sandbox_files;raise exception 'Storage paths exposed';exception when insufficient_privilege then null;end;
 begin update public.trustap_sandbox_orders set state='funded';raise exception 'Client certified funding';exception when insufficient_privilege then null;end;
 begin perform public.claim_trustap_sandbox_sync('cc000000-0000-4000-8000-000000000003',true);raise exception 'Client sync RPC permitted';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"ee000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin
 if exists(select id from public.trustap_sandbox_orders) then raise exception 'Unrelated account order exposure';end if;
 if exists(select 1 from public.trustap_sandbox_events) then raise exception 'Unrelated account events exposure';end if;
end$$;
reset role;
set local role anon;
do $$begin begin perform id from public.trustap_sandbox_orders;raise exception 'Anonymous order access';exception when insufficient_privilege then null;end;end$$;
reset role;
do $$begin if exists(select 1 from storage.buckets where id='bestottr-trustap-test-files' and public) then raise exception 'Public order bucket';end if;end$$;
rollback;
