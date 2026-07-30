-- Seed the single wedding_config row.
--
-- This runs at migration time so no screen can ever encounter a missing row.
-- The public landing page (PRD §6.4) and every message template read from here,
-- and both would break on an empty table.
--
-- Values are placeholders — edit them from the admin Settings tab, not here.

insert into wedding_config (
  id,
  couple_names,
  wedding_date_time,
  venue_name,
  rsvp_deadline,
  contact_phone,
  invite_message_template,
  day_of_message_template,
  thank_you_message_template
) values (
  true,
  'דמיטרי ו...',
  null,                     -- set the wedding date from Settings
  '',
  null,                     -- null = RSVP always open (PRD §6.3)
  '',
  'שלום {{name}}, הוזמנתם לחתונה שלנו! נשמח שתאשרו הגעה כאן: {{link}}',
  'שלום {{name}}, מזכירים שהחתונה היום! נתראה: {{link}}',
  'שלום {{name}}, תודה שחגגתם איתנו! {{link}}'
)
on conflict (id) do nothing;
