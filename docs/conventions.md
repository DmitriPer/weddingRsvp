# Code Conventions

How code in this repo is structured. These are rules, not suggestions — a reviewer (human or Claude) should reject work that breaks them.

The point is that any single piece of this app should be readable on its own, without holding the rest in your head.

---

## 1. Functions do one thing

**If describing what a function does needs the word "and", it should be two functions.**

```ts
// ✗ does three things
async function handleRsvp(token, body) {
  const invite = await db.getInviteByToken(token)
  if (!invite) throw new Error('not found')
  if (config.rsvp_deadline && new Date() > config.rsvp_deadline) throw new Error('closed')
  const adults = attendees.filter(a => a.is_attending && !a.is_child).length
  // ...30 more lines
}

// ✓ each does one
function isRsvpOpen(deadline: Date | null): boolean
function countAttending(attendees: Attendee[]): Headcount
async function reconcilePlaceholders(inviteId: string, wanted: ExtraCounts): Promise<void>
```

**Size:** ~30 lines is a smell worth a second look. 100 lines is a defect. Neither is a hard limit — a flat `switch` over statuses can be long and perfectly clear. Nesting is the real signal: three levels of indentation usually means a function is hiding inside.

**Purity:** prefer compute-in, value-out. A function that takes data and returns data can be reasoned about and tested without a database. Push I/O to the edges.

**Explicit return types on everything exported.** Inference is fine inside a function; it is not fine across a module boundary, where it turns a signature change into a silent ripple.

**Naming:** verbs for functions (`buildInviteLink`, `countAttending`), nouns for data (`inviteWithPeople`). A boolean reads as a question: `isRsvpOpen`, `hasUnseatedGuests`.

## 2. Layers — never skip one

```
components/    render only
app/api/       orchestrate
lib/           compute
lib/data/      persist
```

| Layer | May do | Must never |
|---|---|---|
| `app/**/page.tsx` | fetch via `lib/data`, then hand data to components | contain business logic beyond choosing what to fetch |
| `components/` | render, hold local UI state, call API routes | contain business logic, compute headcounts, format dates, import `lib/data` |
| `app/api/` | check auth → validate input → call `lib/data` → shape the response | contain business logic worth testing, or talk to a store directly |
| `lib/` | pure logic: headcount, templates, dates, validation, status transitions | perform I/O, import React |
| `lib/data/` | persistence — the only place that knows a store exists | contain business rules |

**Direction is one-way.** `lib/` never imports from `components/` or `app/`. `lib/data/` never imports from `lib/` business logic.

**Pages may fetch; components may not.** A Server Component page calling `lib/data` directly is idiomatic App Router and saves an HTTP round trip. Everything below a page receives data as props. Client Components that need to mutate go through `app/api/`.

A component computing a headcount inline is the single most likely way this codebase rots, because the second copy is always *almost* right.

## 3. Single source of truth

Exactly one implementation of each of these. A second copy is a bug waiting to happen, not a convenience.

| Concern | Only lives in |
|---|---|
| Headcount arithmetic | `lib/headcount.ts` |
| Date and time formatting | `lib/datetime.ts` (pinned to `Asia/Jerusalem`) |
| Hebrew UI copy | `lib/strings.ts` |
| Message template rendering | `lib/templates.ts` |
| Status transition rules | `lib/status.ts` |
| Invite URL construction | `lib/links.ts` |

Never format a date inline. Never write a `.filter(a => a.is_attending)` count outside `lib/headcount.ts`. Never hardcode Hebrew in a component.

PRD §12 requires that every headcount come from one place. A second copy is precisely how that requirement dies quietly.

## 4. Files

- **One concern per file.** A file exporting a component, a hook, and three helpers is four files.
- **Name the file after what it exports.** `status-badge.tsx` exports `StatusBadge`.
- **No barrel files** re-exporting half the app. `lib/data/index.ts` is the one exception — it exists to pick a backing store, which is its single job.
- **Colocate nothing.** Tests, when they exist, sit beside the file; helpers used by one component live in that file until a second consumer appears.

## 5. Data layer

The mock/real swap is a **backing store** swap, not a fake client.

```
lib/data/index.ts      picks the store from NEXT_PUBLIC_MOCK_MODE
lib/data/types.ts      the interface both implementations satisfy
lib/data/mock/         in-memory store + seed
lib/data/supabase/     real implementation
```

Callers use `getInvites()`, `submitRsvp()` — they never see a Supabase client and never know which store is behind them. Both implementations satisfy the same TypeScript interface, so a missing method is a compile error rather than a runtime surprise.

**Do not emulate the PostgREST chainable API.** The previous version of this app spent 221 lines faking `.from().select().eq()`. It bought only that route code *looked* identical in both modes, which is exactly what made it fragile.

## 6. API routes

Every route follows the same four steps, in order:

```ts
export async function POST(request: NextRequest) {
  // 1. auth — every admin route, independently (PRD §7.4)
  const user = await verifyAdmin()
  if (!user) return unauthorized()

  // 2. validate input, and fail early
  const parsed = parseBody(await request.json())
  if (!parsed.ok) return badRequest(parsed.error)

  // 3. call the data layer
  const result = await createInvite(parsed.value)

  // 4. shape the response
  return NextResponse.json<ApiResponse<Invite>>({ success: true, data: result })
}
```

Anything interesting between steps 2 and 3 belongs in `lib/`, where it can be read and tested on its own.

**Errors are checked, never assumed.** The previous app awaited a history insert and ignored its error, so a failed write still reported success to the guest. Every write that matters gets its result checked.

## 7. Security rules that are also code rules

These come from PRD §7 and are as much structure as policy:

- `lib/supabase/admin.ts` (service role) is importable **only** from `app/api/`. Never from a component, never from anything client-rendered.
- Access decisions use `getUser()`. **`getSession()` appears nowhere in this codebase.**
- Every admin API route calls `verifyAdmin()` itself, even though `proxy.ts` already gated the page. Two independent locks.
- Rules the UI enforces are enforced on the server too — the RSVP deadline is the live example. A disabled form is bypassed with one `curl`.

## 8. Components

- Client Components only where interactivity requires it. Default to Server Components.
- No data fetching in deeply nested components — fetch at the route or page level and pass down.
- Every list and form has **empty, loading, and error** states (PRD §6.19). A blank box is a bug.
- Hebrew and RTL are the default, not a wrapper. Text comes from `lib/strings.ts`.

## 9. What "done" means for a change

- `npm run build` passes — this is the type check, and there is no test suite yet.
- `npm run lint` passes.
- No new copy of anything in §3.
- No layer skipped per §2.
- Scope matches the PRD. No "while I was in there" additions.
