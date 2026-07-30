# How Dmitri Wants Claude Code to Work on This Repo

This file exists so that **any** Claude Code session on this repo — CLI, web, a fresh machine, whatever — picks up the same working process without Dmitri having to re-explain it every time. `CLAUDE.md` points here.

## Process for any new feature or change

1. **PRD first, no code.** Before implementing anything non-trivial, write or update a PRD in `docs/` describing the functionality and data model changes. Model it on `docs/wedding-app-brownfield-PRD.md` (mission, scope boundaries table, functional gaps, data model, explicitly-deferred list, open questions, definition of done).
2. **Clarify by asking, not assuming.** While drafting or refining a PRD, ask Dmitri clarifying questions about functionality, data shape, and edge cases until there's nothing ambiguous left — don't silently guess at requirements or fill gaps with a "reasonable" assumption. Keep asking in rounds until he confirms it's clear. Use structured multiple-choice questions where possible (easier for him to answer decisively) rather than open-ended ones.
3. **Plan Mode before writing code.** Once the PRD's open questions are resolved, use Plan Mode to turn it into a concrete step-by-step implementation plan (files touched, order of work, how it maps to the PRD) before touching any code. Get the plan reviewed/approved before implementing.
4. **Then implement**, following the approved plan and the PRD's scope boundaries exactly — don't quietly expand scope (e.g. adding styling work, extra features, or "while I'm at it" refactors not in the PRD).

## Standing hard rules (do not relitigate these without Dmitri raising it himself)

- **No automated, scheduled, or bulk WhatsApp/SMS/call sending — ever.** Every outbound message is a manual, human-triggered action (e.g. a per-row `wa.me` button the admin taps). Reason: risk of the couple's WhatsApp number being flagged/banned for spam-like bulk behavior — this is not a technical limitation to work around, it's an intentional constraint. The app's job is to prepare messages and flag who needs one; a human always decides when to actually send.
- **Function and data structure first, styling later.** Unless Dmitri explicitly asks for visual/design work, treat the current UI look as frozen and out of scope. Don't refactor styling incidentally while building functionality.
- **Viewport priority is opposite on the two surfaces.** When design work *is* asked for: the **guest RSVP page** is **mobile first** — guests open their link from a WhatsApp message on a phone — with desktop adjusted at the end. The **admin area** is **desktop first**, because the invitee table and seating board are worked at a desk, with mobile after. Start at each surface's primary viewport rather than designing something responsive from the middle, and don't restyle one surface while working on the other.
- **No real guest data until told otherwise.** The Supabase project exists, but it holds only invented test rows from `004_seed_test_data.sql`. Never put Dmitri's actual guest list in, and never fabricate or assume real guest data. *(This rule originally said "mock data" — see the note below on the dropped mock store. The protection it exists for is unchanged.)*
- **Keep all data access behind one layer.** Every read and write goes through `lib/data`, never a Supabase client reached directly from a route or component. *(Originally worded as "keep mock-vs-real swappable". The real database exists now and the mock store was dropped on 2026-07-30 — two implementations meant hand-mirroring Postgres semantics, which drifts. The single-layer rule is what actually mattered and still holds; test data lives in a seed migration.)*
- **Never touch a friend's/third party's live systems or real data.** This repo was adapted from a friend's project (`amirgal/wedding-rsvp`) with his informal OK (no LICENSE file exists). Never assume access to his live Supabase project, his real WhatsApp sending script (deliberately not included in this repo — `.gitignore`'d), or any of his real guest data.

## Where the context lives

- `CLAUDE.md` — stack, architecture, Supabase client rules, request flow, status state machine.
- `docs/wedding-app-brownfield-PRD.md` — the current build phase's scope (functional gaps, data model changes, what's explicitly deferred).
- Ask Dmitri directly if something referenced here (e.g. the original mission PRD or the base-repo investigation writeup) isn't present in your checkout — those may live outside this repo depending on where you're working from.
