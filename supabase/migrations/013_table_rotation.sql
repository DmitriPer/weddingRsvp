-- ---------------------------------------------------------------------------
-- 013 — which way a table faces (PRD §6.17)
--
-- A round table has no orientation. An ellipse or a rectangle does: the same
-- table along the wall and across the room are different plans, and a floor
-- plan that cannot express that is a diagram of the wrong room.
--
-- Degrees, 0-359, clockwise from the table's drawn orientation. Stored as an
-- integer because the map turns tables in steps rather than freely — a venue
-- plan needs "along that wall", not 37.4 degrees — and an integer is readable
-- when someone looks at the row.
--
-- Default 0, which is every existing table left exactly as it is drawn now.
-- ---------------------------------------------------------------------------

alter table tables
  add column if not exists rotation int not null default 0
  check (rotation >= 0 and rotation < 360);

comment on column tables.rotation is
  'Degrees clockwise, 0-359. Meaningless for round tables, which look the same at any angle.';
