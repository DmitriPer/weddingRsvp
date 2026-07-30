# Carry-Over List — What to Keep When Rebuilding From Scratch

**Decision (2026-07-30):** the brownfield adaptation of `amirgal/wedding-rsvp` is being abandoned. The app will be rebuilt from scratch against Dmitri's own PRD. Reason: understanding someone else's structure before being able to change it was costing more time than it was saving.

**Side benefit:** the base repo has no LICENSE and was used under an informal verbal OK. Reimplementing from our own spec makes ownership unambiguous. This only holds if the app is *rebuilt*, not file-copied — patterns and ideas carry over freely, verbatim components do not.

This file records what was worth learning from the base repo, so nothing good is lost in the rewrite.

---

## 1. Security patterns — reimplement these exactly

### 1.1 Token-as-credential for guests ✅ *confirmed keep*
A UUID in the invite URL **is** the guest's password. No guest accounts, no login, no password reset.

Two reasons, both confirmed:
- **Security** — nothing to brute-force, nothing to leak, no credentials to store for ~150 people.
- **Individual landing pages** — each guest's link resolves to *their* reservation. The page greets them by name and shows their own household, not a generic form.

### 1.2 RLS `deny all` on every table
Row Level Security on, with a policy denying everything, on every table. No client ever talks to the database directly; all access goes through server code using the service role.

### 1.3 Three Supabase clients, one strict rule each
| Client | Key | Used in | Never used for |
|---|---|---|---|
| browser | anon | Client Components | any data mutation |
| server | anon + cookie awareness | Server Components, auth checks | bypassing RLS |
| admin | **service role** | API routes doing data work | anything reaching the browser |

The service-role key is server-only and must never be prefixed `NEXT_PUBLIC_`.

### 1.4 Defense in depth on the admin area
Two independent locks, deliberately redundant:
1. A proxy/middleware that gates `/admin/*` before any admin page renders.
2. Every admin API route **independently** re-verifying the session.

Rationale proven in practice: during the dependency audit on 2026-07-29 we found multiple Next.js middleware/proxy-bypass advisories. Because lock #2 exists, a bypass of lock #1 would have exposed an empty admin shell, not guest data.

### 1.5 `getUser()`, never `getSession()`
`getSession()` trusts the cookie as-is. `getUser()` verifies the token against the auth server. Use `getUser()` for anything that decides access.

### 1.6 Bot detection before marking an invite "opened"
WhatsApp (and every other messenger) fetches a link to build its preview card. Without a bot check, every invite flips to `opened` the moment it's *sent*, so the dashboard reports that guests have read invitations nobody has looked at.

**Escalated by the v3 decision to add per-guest preview images (PRD §4.10):** each invite now triggers *two* crawler fetches — the page meta tags and the generated image. The base repo marked `opened` during server rendering; the rebuild must mark it from **client-side JavaScript** instead, since crawlers fetch HTML but don't execute JS. UA sniffing stays as a backstop only.

---

## 2. Data design

### 2.1 One-directional status machine ✅ *confirmed keep, with a change*
Status only ever moves forward, never reverts. **New in this decision: a status before `pending`,** so that "added to the list" and "message actually sent" are distinguishable.

```
added → pending → opened → submitted → edited
```

| Status | Meaning | What moves it forward |
|---|---|---|
| `added` | on the guest list, **no message sent yet** | admin taps the `wa.me` button |
| `pending` | invite sent, waiting for them to open it | guest opens their link |
| `opened` | link opened, not answered | guest submits the form |
| `submitted` | answered once | guest submits again |
| `edited` | changed their answer at least once — terminal, stays `edited` forever | — |

Consequences:
- `pending` now means *"invited and waiting"*, not *"exists"* — which is what you actually want to filter on.
- The `added → pending` transition is the same action that increments `contact_attempts` and sets `last_contacted_at` (the manual `wa.me` tap).
- The "5 attempts, no response" follow-up flag applies to invites sitting in `pending` or `opened`.
- Name `added` is provisional — rename freely, the behaviour is what matters.

### 2.2 Append-only history alongside the current answer ✅ *confirmed keep*
Current answer is overwritten; every submission is also appended to an immutable log. Counts only, no per-person snapshot (decided in PRD §7).

### 2.3 Cascade deletes + indexes on the columns actually filtered by
Deleting an invite removes everything hanging off it, so no orphaned rows survive. Indexes on `token`, `status`, and every foreign key used for lookups.

---

## 3. Product decisions ✅ *all confirmed keep*

- **Manual `wa.me` per-row sending.** Every outbound message is a human tap. Never automated, never bulk. (Standing hard rule — see `claude-workflow.md`.)
- **Bulk import from a spreadsheet.** Nobody hand-types 150 guests.
- **Hebrew / RTL from day one**, not retrofitted afterwards.

---

## 4. Dmitri's own assets — reuse verbatim, zero rework

| File | Status |
|---|---|
| `docs/wedding-app-brownfield-PRD.md` | The v2 data model is the greenfield spec. Rename to drop "brownfield". |
| `docs/claude-workflow.md` | Process + hard rules. Reusable as-is. |
| `docs/project-explainer.html` | Plain-language field guide. Needs a content refresh after the rebuild. |
| Mock data layer **concept** | `isMockMode` flag + one swappable backing store. Dmitri's own addition (commit `a94547c`), not the base repo's. Same idea, cleaner second implementation. |

---

## 5. Do NOT carry over

| Thing | Why |
|---|---|
| `responses` table | Superseded — merged into `invites` (PRD §7) |
| Count-only headcounts | Superseded by the `attendees` table (PRD §4.9) |
| `shadcn` as a devDependency | Drags in 201 packages incl. an HTTP server stack and MCP SDK. Use `npx shadcn@latest add` on demand instead. |
| `xlsx` 0.18.5 | Permanently vulnerable — SheetJS stopped publishing to npm. Use `exceljs`. |
| `whatsapp` npm script | Broken stub (`scripts/` is gitignored) and contradicts the no-automation rule. |
| Base repo commit history | Mixed authorship; clean slate is simpler. |
