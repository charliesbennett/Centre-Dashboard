-- Excursion bookings migration
-- Run in Supabase SQL editor (Database > SQL Editor > New query)
--
-- The `excursions` table used to hold exactly one row per (centre_id, exc_date) --
-- a single destination + coach list per day. The Excursions tab now supports
-- several bookings on the same date (different attractions/groups/AM-PM splits),
-- matching the richer per-booking data centres receive from operators (e.g. the
-- Reaseheath Excursion Bookings spreadsheet: attraction, transport method,
-- student/leader/staff counts, booking ref, email contact, ticket link, per group).

-- 1. Drop the one-row-per-date constraint so multiple bookings can share a date
drop index if exists idx_excursions_natural;

-- 2. Add the richer booking columns
alter table excursions
  add column if not exists group_ids jsonb not null default '[]',
  add column if not exists attraction text not null default '',
  add column if not exists day_part text not null default 'Full',
  add column if not exists transport_method text not null default '',
  add column if not exists manual_student_count int not null default 0,
  add column if not exists manual_leader_count int not null default 0,
  add column if not exists staff_count int not null default 0,
  add column if not exists booking_ref text not null default '',
  add column if not exists email_contact text not null default '',
  add column if not exists booking_link text not null default '';

-- 3. Backfill attraction from the old single-destination field, then drop it
update excursions set attraction = destination where attraction = '' and destination <> '';
alter table excursions drop column if exists destination;

-- Existing `notes` and `coaches` columns are unchanged and now apply per booking.
