begin;
CREATE FUNCTION pg_temp.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE denied boolean:=false;
BEGIN
 BEGIN EXECUTE statement;EXCEPTION WHEN insufficient_privilege OR raise_exception OR check_violation OR unique_violation THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Unexpectedly permitted: %',statement;END IF;
END $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001','review-seller@example.invalid','{}'),
 ('b1000000-0000-4000-8000-000000000002','review-moderator@example.invalid','{}'),
 ('c1000000-0000-4000-8000-000000000003','review-other@example.invalid','{}');
insert into public.user_roles(user_id,role) values ('b1000000-0000-4000-8000-000000000002','admin');
set local role service_role;
insert into public.listing_drafts(id,seller_id,kind,asset_name,title,description,format,price_cents) values ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','file','QA source','QA original title','A project with private deliverables.','buy_now',5000);
insert into public.listing_assets(id,draft_id,seller_id,category,filename,content_type,size_bytes,path,position,status) values
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','image','cover.png','image/png',100,'a1000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001',0,'ready'),
 ('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','file','project.zip','application/octet-stream',1000,'a1000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000002',1,'ready');
select pg_temp.expect_denied($s$select public.reserve_listing_review('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',false)$s$);
select public.reserve_listing_review('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',true);
do $$begin
 if (public.reserve_listing_review('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',true)->>'created')::boolean then raise exception 'Repeated submission created a second snapshot';end if;
end$$;
select pg_temp.expect_denied($s$select public.reserve_listing_review('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',true)$s$);
select pg_temp.expect_denied($s$update public.listing_drafts set title='Unreviewed edit' where id='a2000000-0000-4000-8000-000000000001'$s$);
select pg_temp.expect_denied($s$delete from public.listing_drafts where id='a2000000-0000-4000-8000-000000000001'$s$);
select pg_temp.expect_denied($s$delete from public.listing_assets where id='a3000000-0000-4000-8000-000000000001'$s$);
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',0,'submit')$s$);
insert into public.listing_review_assets(id,review_id,source_asset_id,category,filename,content_type,size_bytes,path,position,ready)
 select case when category='image' then 'a5000000-0000-4000-8000-000000000001'::uuid else 'a5000000-0000-4000-8000-000000000002'::uuid end,'a4000000-0000-4000-8000-000000000001',id,category,filename,content_type,size_bytes,'a4000000-0000-4000-8000-000000000001/'||case when category='image' then 'a5000000-0000-4000-8000-000000000001' else 'a5000000-0000-4000-8000-000000000002' end,position,true from public.listing_assets where draft_id='a2000000-0000-4000-8000-000000000001';
select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',0,'submit');
select pg_temp.expect_denied($s$update public.listing_review_assets set ready=false where review_id='a4000000-0000-4000-8000-000000000001'$s$);
select pg_temp.expect_denied($s$update public.listing_reviews set snapshot=jsonb_set(snapshot,'{title}','"Bypass"') where id='a4000000-0000-4000-8000-000000000001'$s$);
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003',1,'approve')$s$);
select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',1,'approve','Reviewed fixed version.');
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',1,'publish','',true)$s$);
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',2,'publish','',false)$s$);
select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',2,'publish','',true);
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if (select count(*) from public.listing_reviews where id='a4000000-0000-4000-8000-000000000001')<>1 then raise exception 'Seller cannot read own review';end if;end$$;
select pg_temp.expect_denied($s$update public.listing_reviews set state='published'$s$);
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',3,'unpublish','forged moderator')$s$);
select pg_temp.expect_denied($s$select * from public.listing_review_assets$s$);
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.listing_reviews where id='a4000000-0000-4000-8000-000000000001') then raise exception 'Other user read a private review';end if;if exists(select 1 from public.listing_review_events where review_id='a4000000-0000-4000-8000-000000000001') then raise exception 'Other user read review history';end if;end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if (select count(*) from public.listing_reviews where id='a4000000-0000-4000-8000-000000000001')<>1 then raise exception 'Moderator cannot read review';end if;end$$;
reset role;
set local role anon;
select pg_temp.expect_denied($s$select * from public.listing_reviews$s$);
select pg_temp.expect_denied($s$select * from public.listing_review_assets$s$);
reset role;
set local role service_role;
select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',3,'unpublish','Seller requested removal.');
update public.listing_drafts set title='Edited after unpublish' where id='a2000000-0000-4000-8000-000000000001';
do $$begin
 if (select snapshot->>'title' from public.listing_reviews where id='a4000000-0000-4000-8000-000000000001')<>'QA original title' then raise exception 'Frozen snapshot changed after draft edit';end if;
 if (select count(*) from public.listing_review_events where review_id='a4000000-0000-4000-8000-000000000001')<>4 then raise exception 'Audit transitions not recorded exactly once';end if;
end$$;
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',4,'publish','',true)$s$);
select public.reserve_listing_review('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',true);
select public.transition_listing_review('a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',0,'withdraw');
update public.listing_drafts set description='Editable after withdrawal' where id='a2000000-0000-4000-8000-000000000001';
-- A second seller submission needs a new approval; changes requests require feedback.
select public.reserve_listing_review('a4000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),'{}',true);
insert into public.listing_review_assets(id,review_id,source_asset_id,category,filename,content_type,size_bytes,path,position,ready)
 select case when category='image' then 'a5000000-0000-4000-8000-000000000003'::uuid else 'a5000000-0000-4000-8000-000000000004'::uuid end,'a4000000-0000-4000-8000-000000000003',id,category,filename,content_type,size_bytes,'a4000000-0000-4000-8000-000000000003/'||case when category='image' then 'a5000000-0000-4000-8000-000000000003' else 'a5000000-0000-4000-8000-000000000004' end,position,true from public.listing_assets where draft_id='a2000000-0000-4000-8000-000000000001';
select public.transition_listing_review('a4000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001',0,'submit');
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002',1,'reject','short')$s$);
select public.transition_listing_review('a4000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002',1,'reject','Please clarify the included files.');
update public.listing_drafts set description='Revised after feedback' where id='a2000000-0000-4000-8000-000000000001';
-- Roblox proof is mandatory and bound to both the exact asset and linked identity.
insert into public.listing_drafts(id,seller_id,kind,asset_id,place_id,roblox_user_id,creator_type,creator_id,asset_name,title,description,format,price_cents,ownership_checked_at)
 values('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','experience','200','100','42','User','42','QA game','QA game','An owned game.','buy_now',5000,now());
insert into public.listing_assets(id,draft_id,seller_id,category,filename,content_type,size_bytes,path,position,status)
 values('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','image','cover.png','image/png',100,'a1000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000003',0,'ready');
select pg_temp.expect_denied($s$select public.reserve_listing_review('a4000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',now(),'{}',true)$s$);
select pg_temp.expect_denied($s$select public.reserve_listing_review('a4000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',now(),jsonb_build_object('asset_id','200','roblox_user_id','42','ownership_checked_at',now()-interval '3 minutes'),true)$s$);
select pg_temp.expect_denied($s$select public.reserve_listing_review('a4000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',now(),jsonb_build_object('asset_id','999','roblox_user_id','42','ownership_checked_at',now()),true)$s$);
select public.reserve_listing_review('a4000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',now(),jsonb_build_object('asset_id','200','roblox_user_id','42','ownership_checked_at',now()),true);
insert into public.listing_review_assets(id,review_id,source_asset_id,category,filename,content_type,size_bytes,path,position,ready)
 values('a5000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000003','image','cover.png','image/png',100,'a4000000-0000-4000-8000-000000000004/a5000000-0000-4000-8000-000000000005',0,true);
select public.transition_listing_review('a4000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001',0,'submit');
select public.transition_listing_review('a4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000002',1,'approve');
select pg_temp.expect_denied($s$select public.transition_listing_review('a4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000002',2,'publish','',true,'{}')$s$);
reset role;
do $$begin if not exists(select 1 from storage.buckets where id='bestottr-review-assets' and public=false) then raise exception 'Private review bucket missing';end if;end$$;
rollback;
