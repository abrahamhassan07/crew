-- Crew & Grounds: staff availability + usual hours (used by the Crews &
-- Staff profile page). Additive only.
alter table public.staff
  add column availability boolean[] not null default array[true, true, true, true, true, false, false],
  add column usual_hours text not null default '';

comment on column public.staff.availability is '7 booleans, Monday-first, whether this staff member is normally available that day.';
