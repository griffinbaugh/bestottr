begin;
CREATE FUNCTION pg_temp.expect_notification_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE denied boolean:=false;
BEGIN
 BEGIN EXECUTE statement;EXCEPTION WHEN insufficient_privilege OR raise_exception OR check_violation OR unique_violation THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Unexpectedly permitted: %',statement;END IF;
END $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','notification-seller@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000002','notification-admin@example.invalid','{}'),
 ('f1000000-0000-4000-8000-000000000003','notification-other@example.invalid','{}');
insert into public.user_roles(user_id,role) values('e1000000-0000-4000-8000-000000000002','admin');
set local role service_role;
insert into public.listing_reviews(id,seller_id,state,snapshot) values('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','in_review','{"title":"QA listing","assets":[]}');
select public.transition_listing_review('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002',0,'approve');
select pg_temp.expect_notification_denied($s$select public.transition_listing_review('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002',0,'approve')$s$);
do $$begin
 if(select count(*) from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001')<>1 then raise exception 'Approval must notify once';end if;
 if not exists(select 1 from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001' and title='Listing approved' and body like '%does not make it public%' and read_at is null) then raise exception 'Approval copy or unread default invalid';end if;
end$$;
insert into public.listing_review_events(review_id,actor_id,action,note) values
 ('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','reject','Please fix the description.'),
 ('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','publish',''),
 ('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','unpublish','Removed for review.'),
 ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','unpublish','Seller self removal.'),
 ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','withdraw','');
do $$begin
 if(select count(*) from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001')<>4 then raise exception 'Unexpected notification events';end if;
 if not exists(select 1 from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001' and body like '%Please fix the description.%') then raise exception 'Feedback missing';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001') then raise exception 'Other user can read notifications';end if;end$$;
update public.account_notifications set read_at=now() where user_id='d1000000-0000-4000-8000-000000000001';
select pg_temp.expect_notification_denied($s$insert into public.account_notifications(user_id,source_event_id,review_id,kind,title,body) values('f1000000-0000-4000-8000-000000000003',-1,'d2000000-0000-4000-8000-000000000001','approve','Forged','Forged')$s$);
reset role;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001') then raise exception 'Admin can read other users notifications';end if;end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$begin if(select count(*) from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001' and read_at is null)<>4 then raise exception 'Other user modified unread status';end if;end$$;
select pg_temp.expect_notification_denied($s$update public.account_notifications set title='Forged'$s$);
select pg_temp.expect_notification_denied($s$update public.account_notifications set user_id='f1000000-0000-4000-8000-000000000003'$s$);
select pg_temp.expect_notification_denied($s$delete from public.account_notifications$s$);
update public.account_notifications set read_at=now() where user_id='d1000000-0000-4000-8000-000000000001' and read_at is null;
do $$begin if exists(select 1 from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001' and read_at is null) then raise exception 'Owner cannot mark read';end if;end$$;
reset role;
set local role service_role;
insert into public.listing_review_events(review_id,actor_id,action,note,created_at) values ('d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','approve','',now()+interval '1 minute');
reset role;
set local role authenticated;
update public.account_notifications set read_at=now() where user_id='d1000000-0000-4000-8000-000000000001' and read_at is null and created_at<=now();
do $$begin if(select count(*) from public.account_notifications where user_id='d1000000-0000-4000-8000-000000000001' and read_at is null)<>1 then raise exception 'Mark-all erased a later arrival';end if;end$$;
reset role;
set local role anon;
select pg_temp.expect_notification_denied($s$select * from public.account_notifications$s$);
reset role;
rollback;
