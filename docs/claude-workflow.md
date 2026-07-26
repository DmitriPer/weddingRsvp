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
- **Mock data until told otherwise.** Build and test against an in-memory data layer that mirrors the real Supabase call shapes (same function signatures), not a real Supabase project — this protects real guest data from ever existing in a dev/test environment before Dmitri is ready. Never fabricate or assume real guest data.
- **Keep the data-access layer swappable.** Mock-vs-real-Supabase should be a backing-store swap behind one set of functions, never scattered mock logic through components or API routes — this is what makes the later real-DB cutover cheap.
- **Never touch a friend's/third party's live systems or real data.** This repo was adapted from a friend's project (`amirgal/wedding-rsvp`) with his informal OK (no LICENSE file exists). Never assume access to his live Supabase project, his real WhatsApp sending script (deliberately not included in this repo — `.gitignore`'d), or any of his real guest data.

## Where the context lives

- `CLAUDE.md` — stack, architecture, Supabase client rules, request flow, status state machine.
- `docs/wedding-app-brownfield-PRD.md` — the current build phase's scope (functional gaps, data model changes, what's explicitly deferred).
- Ask Dmitri directly if something referenced here (e.g. the original mission PRD or the base-repo investigation writeup) isn't present in your checkout — those may live outside this repo depending on where you're working from.
