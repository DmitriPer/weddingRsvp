# Architecture

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind v4 · shadcn/ui

## Component / Route Structure

```mermaid
flowchart TB
    subgraph Guest["Guest-facing"]
        Page["app/page.tsx<br/>reads ?token="]
        Landing["wedding-landing.tsx<br/>(no token)"]
        Form["rsvp-form.tsx"]
    end

    subgraph Admin["Admin area (proxy-protected)"]
        Proxy["proxy.ts<br/>gates /admin/:path*"]
        Login["admin/login/page.tsx"]
        Dash["admin/page.tsx"]
        Invitees["invitees-tab.tsx"]
        Responses["responses-tab.tsx"]
        Stats["stats-tab.tsx"]
    end

    subgraph API["API routes (app/api)"]
        RsvpApi["POST /api/rsvp"]
        StatsApi["GET /api/stats"]
        InvitesApi["GET/POST /api/invites"]
        InviteApi["PATCH/DELETE /api/invites/[id]"]
        OpenApi["POST /api/invites/[id]/open"]
        ImportApi["POST /api/invites/import"]
    end

    subgraph Supa["lib/supabase"]
        Client["client.ts<br/>(anon, browser)"]
        Server["server.ts<br/>(anon, auth check)"]
        AdminC["admin.ts<br/>(service role, bypasses RLS)"]
    end

    Page --> Form
    Page -.no token.-> Landing
    Form -->|submit| RsvpApi

    Proxy --> Dash
    Proxy -.no session.-> Login
    Dash --> Invitees & Responses & Stats
    Invitees --> InvitesApi & InviteApi & ImportApi
    Stats --> StatsApi

    Page --> AdminC
    RsvpApi --> AdminC
    InvitesApi --> Server & AdminC
    InviteApi --> Server & AdminC
    ImportApi --> Server & AdminC
    StatsApi --> Server & AdminC
    Proxy --> Server
```

## Data Model

```mermaid
erDiagram
    invites ||--o| responses : "has current"
    invites ||--o{ response_history : "append-only log"

    invites {
        uuid id PK
        uuid token UK
        text name
        text phone
        text status "pending|opened|submitted|edited"
        timestamptz created_at
    }
    responses {
        uuid id PK
        uuid invite_id FK "UNIQUE"
        boolean attending
        int adult_count
        int kid_count
        timestamptz submitted_at
        timestamptz updated_at
    }
    response_history {
        uuid id PK
        uuid invite_id FK
        boolean attending
        int adult_count
        int kid_count
        timestamptz submitted_at
    }
```

Status is one-directional: `pending → opened → submitted → edited` (never reverts). RLS on all three tables is deny-all; every operation goes through `admin.ts` (service role).

## Request Flow — Guest RSVP

```mermaid
sequenceDiagram
    actor Guest
    participant Page as app/page.tsx
    participant Admin as admin.ts (service role)
    participant Form as rsvp-form.tsx
    participant Api as POST /api/rsvp
    participant DB as Postgres

    Guest->>Page: GET /?token=xyz
    Page->>Admin: fetch invite by token
    Admin->>DB: select invites + responses
    alt status = pending and not a bot
        Page->>DB: update status -> opened
    end
    Page->>Form: render with existing response
    Guest->>Form: fill + submit
    Form->>Api: POST { token, attending, counts }
    Api->>DB: resolve invite by token
    Api->>DB: upsert responses (onConflict invite_id)
    Api->>DB: insert response_history row
    Api->>DB: update invites.status -> submitted | edited
    Api-->>Form: { success: true }
```

## Request Flow — Admin

```mermaid
sequenceDiagram
    actor Admin
    participant Proxy as proxy.ts
    participant Dash as admin/page.tsx
    participant Route as API route
    participant Srv as server.ts
    participant Adm as admin.ts
    participant DB as Postgres

    Admin->>Proxy: GET /admin/*
    Proxy->>Srv: getUser() (verifies session)
    alt no session
        Proxy-->>Admin: redirect /admin/login
    end
    Proxy->>Dash: allow through
    Dash->>Route: call API (invites/stats/import)
    Route->>Srv: verifyAdmin() (defense in depth)
    alt unauthorized
        Route-->>Dash: 401
    end
    Route->>Adm: query/mutate via service role
    Adm->>DB: bypasses RLS
    Route-->>Dash: data
```
