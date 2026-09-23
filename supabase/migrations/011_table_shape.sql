-- ---------------------------------------------------------------------------
-- 011 — what shape a table is (PRD §6.17)
--
-- The shape is not decoration: it is what decides how many people fit, and the
-- seating page reads it to pre-fill the capacity and to warn when a table is
-- over it.
--
--   round       8-10   a round table seats ten before people are eating elbows
--   ellipse     12-13
--   rectangle   14
--
-- `capacity` stays its own column and stays editable. The shape sets the
-- expected maximum; the venue, not this schema, has the final say — a round
-- table with eleven chairs squeezed in is a real thing, and the app should warn
-- about it rather than refuse to record it.
--
-- Safe by inspection: `tables` holds no rows and no attendee is seated, so
-- there is nothing to back-fill and nothing to break. The default exists for
-- rows inserted by older code paths, not for a migration of existing data.
-- ---------------------------------------------------------------------------

alter table tables
  add column if not exists shape text not null default 'round'
  check (shape in ('round', 'ellipse', 'rectangle'));

comment on column tables.shape is
  'Decides the expected capacity: round 8-10, ellipse 12-13, rectangle 14.';
