# Wedding RSVP

A wedding RSVP app: guests confirm attendance via a personal WhatsApp link, the couple manages the guest list and sends every message by hand.

**Status:** greenfield rebuild in progress. Backend and admin panel working; the guest RSVP page is the next piece. See [`docs/progress.md`](docs/progress.md).

## Docs

| File | What it is |
|---|---|
| [`docs/progress.md`](docs/progress.md) | **Start here.** What's built, what's next, and why. |
| [`docs/wedding-rsvp-PRD.md`](docs/wedding-rsvp-PRD.md) | The spec. Scope, data model, requirements, definition of done. |
| [`docs/claude-workflow.md`](docs/claude-workflow.md) | How work gets done here: PRD first, clarify by asking, Plan Mode before coding. |
| [`docs/carry-over.md`](docs/carry-over.md) | What was worth keeping from the abandoned brownfield adaptation. |
| [`docs/architecture.md`](docs/architecture.md) | ⚠️ Describes the *old* app. Historical until regenerated. |
| [`docs/project-explainer.html`](docs/project-explainer.html) | ⚠️ Plain-language field guide to the *old* app. Historical. |

## Commands

```bash
npm run dev      # http://localhost:3030
npm run build
npm run lint
```
