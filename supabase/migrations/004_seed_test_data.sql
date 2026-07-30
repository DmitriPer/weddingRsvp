-- FAKE test data (PRD §8).
--
-- Every name here is invented. No real guest data belongs in a migration.
--
-- Covers every state the guest flow can produce, so no screen or filter ever
-- renders against nothing: all-approved, partly declined, placeholder "+1"s,
-- no people at all, fully declined, unanswered, 5+ contact attempts, multi-row
-- history including a declined → attending, and people both seated and unseated.
--
-- Re-runnable: deletes its own rows first, by the __test__ marker on invites.
-- Remove everything with:
--     delete from invites where name like '%__test__%';
--
-- DO NOT RUN THIS once your real guest list is loaded.

begin;

-- Clean up a previous run. Cascades take attendees and history with it.
delete from invites where name like '%__test__%';

-- --------------------------------------------------------------------------
-- Seating tables
-- --------------------------------------------------------------------------
insert into tables (id, name, capacity, sort_order) values
  ('11111111-0000-0000-0000-000000000001', 'שולחן 1', 10, 1),
  ('11111111-0000-0000-0000-000000000002', 'שולחן 2', 10, 2),
  ('11111111-0000-0000-0000-000000000003', 'שולחן 3',  8, 3)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Wedding config — one row already exists from 002; fill it with test values
-- --------------------------------------------------------------------------
update wedding_config set
  couple_names      = 'דמיטרי ואנה',
  wedding_date_time = timestamptz '2026-09-15 19:30:00+03',
  venue_name        = 'אולמי הגן הסודי, תל אביב',
  rsvp_deadline     = timestamptz '2026-09-01 23:59:00+03',
  contact_phone     = '+972501112233',
  updated_at        = now()
where id;

-- --------------------------------------------------------------------------
-- Invites
-- --------------------------------------------------------------------------
insert into invites
  (id, name, phone, status, side, relation, last_contacted_at, contact_attempts,
   attending, responded_at, updated_at)
values
  -- all approved, seated
  ('22222222-0000-0000-0000-000000000001', 'סלבה __test__', '+972501111111', 'submitted', 'groom', 'family',
   '2026-07-25 10:00+03', 1, true,  '2026-08-01 12:00+03', '2026-08-01 12:00+03'),

  -- some approved, one declined; edited
  ('22222222-0000-0000-0000-000000000002', 'משפחת כהן __test__', '+972502222222', 'edited', 'bride', 'family',
   '2026-07-25 10:00+03', 2, true,  '2026-08-02 09:00+03', '2026-08-14 18:30+03'),

  -- named people PLUS a placeholder "+1"
  ('22222222-0000-0000-0000-000000000003', 'אבא __test__', '+972503333333', 'edited', 'groom', 'family',
   '2026-07-26 10:00+03', 1, true,  '2026-08-03 15:00+03', '2026-08-20 11:00+03'),

  -- no named people; guest added one "+1"
  ('22222222-0000-0000-0000-000000000004', 'דני __test__', '+972504444444', 'submitted', 'groom', 'friend',
   '2026-07-26 10:00+03', 1, true,  '2026-08-05 20:00+03', '2026-08-05 20:00+03'),

  -- opened, no people at all, no answer
  ('22222222-0000-0000-0000-000000000005', 'רחל לוי __test__', '+972505555555', 'opened', 'bride', 'work',
   '2026-07-27 10:00+03', 1, null, null, null),

  -- declined entirely: people exist, none attending
  ('22222222-0000-0000-0000-000000000006', 'משפחת ברקוביץ __test__', '+972506666666', 'submitted', 'shared', 'invited_by_family',
   '2026-07-27 10:00+03', 1, false, '2026-08-06 08:00+03', '2026-08-06 08:00+03'),

  -- declined → attending (the case history exists to catch)
  ('22222222-0000-0000-0000-000000000007', 'ולדימיר __test__', '+972507777777', 'edited', 'groom', 'friend',
   '2026-07-28 10:00+03', 3, true,  '2026-08-04 10:00+03', '2026-08-25 16:00+03'),

  -- silent after 6 attempts → "needs a phone call"
  ('22222222-0000-0000-0000-000000000008', 'הדוד מיכאל __test__', '+972508888888', 'pending', 'bride', 'family',
   '2026-08-20 10:00+03', 6, null, null, null),

  -- opened but silent, exactly at the threshold
  ('22222222-0000-0000-0000-000000000009', 'החברים מהצבא __test__', '+972509999999', 'opened', 'groom', 'friend',
   '2026-08-18 10:00+03', 5, null, null, null),

  -- never contacted: the 'added' state
  ('22222222-0000-0000-0000-000000000010', 'שכנים מהבניין __test__', '+972501010101', 'added', 'shared', 'friend',
   null, 0, null, null, null),

  ('22222222-0000-0000-0000-000000000011', 'משפחת פרידמן __test__', '+972501111222', 'added', 'bride', 'family',
   null, 0, null, null, null),

  -- duplicate phone with #11, to exercise the duplicate-phone warning
  ('22222222-0000-0000-0000-000000000012', 'עמיתים מהעבודה __test__', '+972501111222', 'pending', 'bride', 'work',
   '2026-08-10 10:00+03', 2, null, null, null);

-- --------------------------------------------------------------------------
-- People. is_attending is the guest's tick; is_placeholder marks a "+1".
-- --------------------------------------------------------------------------
insert into attendees (invite_id, name, is_child, is_attending, is_placeholder, table_id) values
  -- 1: all three coming, all seated together
  ('22222222-0000-0000-0000-000000000001', 'סלבה',  false, true,  false, '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000001', 'נסטיה', false, true,  false, '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000001', 'טוליק', false, true,  false, '11111111-0000-0000-0000-000000000001'),

  -- 2: the child dropped out
  ('22222222-0000-0000-0000-000000000002', 'רונית כהן', false, true,  false, '11111111-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000002', 'אבי כהן',   false, true,  false, '11111111-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000002', 'מאיה כהן',  true,  false, false, null),

  -- 3: two named + one unnamed "+1", partly unseated
  ('22222222-0000-0000-0000-000000000003', 'אלכס',        false, true, false, '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000003', 'מרינה',       false, true, false, null),
  ('22222222-0000-0000-0000-000000000003', 'אורח של אבא', false, true, true,  null),

  -- 4: only a "+1", nobody named
  ('22222222-0000-0000-0000-000000000004', 'אורח של דני', false, true, true, null),

  -- 6: declined, so nobody is attending
  ('22222222-0000-0000-0000-000000000006', 'יוסי ברקוביץ',  false, false, false, null),
  ('22222222-0000-0000-0000-000000000006', 'שירה ברקוביץ',  false, false, false, null),

  -- 7: changed their mind, now coming and seated
  ('22222222-0000-0000-0000-000000000007', 'ולדימיר', false, true, false, '11111111-0000-0000-0000-000000000003'),
  ('22222222-0000-0000-0000-000000000007', 'אולגה',   false, true, false, '11111111-0000-0000-0000-000000000003'),

  -- 8, 9, 10, 11, 12: listed but no answer yet, so nobody ticked
  ('22222222-0000-0000-0000-000000000008', 'מיכאל', false, false, false, null),
  ('22222222-0000-0000-0000-000000000008', 'לנה',   false, false, false, null),
  ('22222222-0000-0000-0000-000000000009', 'גיא',   false, false, false, null),
  ('22222222-0000-0000-0000-000000000009', 'עומר',  false, false, false, null),
  ('22222222-0000-0000-0000-000000000009', 'ניר',   false, false, false, null),
  ('22222222-0000-0000-0000-000000000010', 'תמר',   false, false, false, null),
  ('22222222-0000-0000-0000-000000000010', 'אורי',  false, false, false, null),
  ('22222222-0000-0000-0000-000000000011', 'דוד פרידמן',  false, false, false, null),
  ('22222222-0000-0000-0000-000000000011', 'נועה פרידמן', false, false, false, null),
  ('22222222-0000-0000-0000-000000000011', 'איתי פרידמן', true,  false, false, null),
  ('22222222-0000-0000-0000-000000000012', 'יעל',   false, false, false, null),
  ('22222222-0000-0000-0000-000000000012', 'רועי',  false, false, false, null),
  ('22222222-0000-0000-0000-000000000012', 'שירה',  true,  false, false, null);

-- --------------------------------------------------------------------------
-- History. Counts are the snapshot at submission time.
-- --------------------------------------------------------------------------
insert into response_history (invite_id, attending, adult_count, kid_count, submitted_at) values
  ('22222222-0000-0000-0000-000000000001', true,  3, 0, '2026-08-01 12:00+03'),

  -- shrank: 3 people, then 2
  ('22222222-0000-0000-0000-000000000002', true,  2, 1, '2026-08-02 09:00+03'),
  ('22222222-0000-0000-0000-000000000002', true,  2, 0, '2026-08-14 18:30+03'),

  -- grew: added a "+1" on the second submission
  ('22222222-0000-0000-0000-000000000003', true,  2, 0, '2026-08-03 15:00+03'),
  ('22222222-0000-0000-0000-000000000003', true,  3, 0, '2026-08-20 11:00+03'),

  ('22222222-0000-0000-0000-000000000004', true,  1, 0, '2026-08-05 20:00+03'),
  ('22222222-0000-0000-0000-000000000006', false, 0, 0, '2026-08-06 08:00+03'),

  -- no → yes. Invisible without this log.
  ('22222222-0000-0000-0000-000000000007', false, 0, 0, '2026-08-04 10:00+03'),
  ('22222222-0000-0000-0000-000000000007', true,  2, 0, '2026-08-25 16:00+03');

commit;
