-- ---------------------------------------------------------------------------
-- 012 — where each table stands in the room (PRD §6.17)
--
-- The seating board answers "who sits together". This answers "where is that
-- table", so the plan can be laid out the way the venue actually is — the bar
-- on one side, the dance floor in the middle, the family near the front — and
-- read by someone standing in the room.
--
-- PERCENTAGES, not pixels. The plan is looked at on a laptop, on a phone, and
-- on paper, and a position stored in pixels means the layout is only true at
-- the width it was arranged on. 0–100 on each axis is the fraction across and
-- down the floor, whatever the floor is being drawn at.
--
-- NULL means "not placed yet". A table that has never been dragged has no
-- position to remember, and the map lays those out in a tidy grid rather than
-- stacking them all in the top corner — which is what a default of 0 would do.
-- ---------------------------------------------------------------------------

alter table tables
  add column if not exists pos_x double precision check (pos_x between 0 and 100),
  add column if not exists pos_y double precision check (pos_y between 0 and 100);

comment on column tables.pos_x is
  'Percent across the floor plan, 0-100. Null = never positioned.';
comment on column tables.pos_y is
  'Percent down the floor plan, 0-100. Null = never positioned.';
