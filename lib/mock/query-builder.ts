import { randomUUID } from 'node:crypto'
import { mockDb } from './store'

type Row = Record<string, unknown>
type Filter = [string, unknown]
type OrderSpec = { column: string; ascending: boolean; referencedTable?: string }
type QueryResult = { data: unknown; error: { message: string; code?: string } | null }

function getTable(table: string): Row[] {
  switch (table) {
    case 'invites':
      return mockDb.invites as unknown as Row[]
    case 'responses':
      return mockDb.responses as unknown as Row[]
    case 'response_history':
      return mockDb.responseHistory as unknown as Row[]
    default:
      throw new Error(`Mock query builder: unknown table "${table}"`)
  }
}

function matchesFilters(row: Row, filters: Filter[]): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

// Chainable, thenable builder covering only the call shapes this codebase actually uses
// against Supabase — not a general Postgrest clone.
class MockQueryBuilder implements PromiseLike<QueryResult> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private selectClause?: string
  private filters: Filter[] = []
  private orderSpec?: OrderSpec
  private wantSingle = false
  private selectCalled = false
  private payload?: unknown
  private onConflictColumn?: string

  constructor(private table: string) {}

  select(clause?: string) {
    this.selectClause = clause
    this.selectCalled = true
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  order(column: string, opts?: { ascending?: boolean; referencedTable?: string }) {
    this.orderSpec = {
      column,
      ascending: opts?.ascending ?? true,
      referencedTable: opts?.referencedTable,
    }
    return this
  }

  single() {
    this.wantSingle = true
    return this
  }

  insert(payload: unknown) {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  update(payload: unknown) {
    this.op = 'update'
    this.payload = payload
    return this
  }

  upsert(payload: unknown, opts?: { onConflict?: string }) {
    this.op = 'upsert'
    this.payload = payload
    this.onConflictColumn = opts?.onConflict
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute(): QueryResult {
    switch (this.op) {
      case 'select':
        return this.execSelect()
      case 'insert':
        return this.execInsert()
      case 'update':
        return this.execUpdate()
      case 'upsert':
        return this.execUpsert()
      case 'delete':
        return this.execDelete()
    }
  }

  private execSelect(): QueryResult {
    const base = getTable(this.table)
    let rows = base.filter((row) => matchesFilters(row, this.filters))

    if (this.table === 'invites') {
      const wantResponses = this.selectClause?.includes('responses(')
      const wantHistory = this.selectClause?.includes('response_history(')
      rows = rows.map((invite) => {
        const result: Row = { ...invite }
        if (wantResponses) {
          result.responses =
            (mockDb.responses.find((r) => r.invite_id === invite.id) as unknown as Row) ?? null
        }
        if (wantHistory) {
          let history = mockDb.responseHistory.filter((h) => h.invite_id === invite.id)
          if (this.orderSpec?.referencedTable === 'response_history') {
            const { ascending } = this.orderSpec
            history = [...history].sort((a, b) =>
              ascending
                ? a.submitted_at.localeCompare(b.submitted_at)
                : b.submitted_at.localeCompare(a.submitted_at)
            )
          }
          result.response_history = history
        }
        return result
      })
    }

    if (this.orderSpec && !this.orderSpec.referencedTable) {
      const { column, ascending } = this.orderSpec
      rows = [...rows].sort((a, b) => {
        const av = a[column] as string | number
        const bv = b[column] as string | number
        if (av === bv) return 0
        const cmp = av < bv ? -1 : 1
        return ascending ? cmp : -cmp
      })
    }

    if (this.wantSingle) {
      if (rows.length !== 1) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
      }
      return { data: rows[0], error: null }
    }
    return { data: rows, error: null }
  }

  private execInsert(): QueryResult {
    const table = getTable(this.table)
    const items = Array.isArray(this.payload) ? this.payload : [this.payload]

    const inserted = items.map((item) => {
      const base =
        this.table === 'invites'
          ? { id: randomUUID(), token: randomUUID(), status: 'pending', created_at: new Date().toISOString(), phone: null }
          : this.table === 'response_history'
            ? { id: randomUUID(), submitted_at: new Date().toISOString() }
            : { id: randomUUID() }
      const row: Row = { ...base, ...(item as Row) }
      table.push(row)
      return row
    })

    if (!this.selectCalled) return { data: null, error: null }
    return { data: this.wantSingle ? inserted[0] : inserted, error: null }
  }

  private execUpdate(): QueryResult {
    const table = getTable(this.table)
    const matched = table.filter((row) => matchesFilters(row, this.filters))
    matched.forEach((row) => Object.assign(row, this.payload as Row))
    return { data: matched, error: null }
  }

  private execUpsert(): QueryResult {
    const table = getTable(this.table)
    const payload = this.payload as Row
    const conflictColumn = this.onConflictColumn ?? 'id'
    const existing = table.find((row) => row[conflictColumn] === payload[conflictColumn])

    if (existing) {
      Object.assign(existing, payload)
      return { data: [existing], error: null }
    }

    const row: Row = { id: randomUUID(), submitted_at: new Date().toISOString(), ...payload }
    table.push(row)
    return { data: [row], error: null }
  }

  private execDelete(): QueryResult {
    const table = getTable(this.table)
    const matched = table.filter((row) => matchesFilters(row, this.filters))
    const matchedIds = new Set(matched.map((row) => row.id))

    if (this.table === 'invites') {
      mockDb.invites = mockDb.invites.filter((i) => !matchedIds.has(i.id))
      // Cascade, mirroring the real `on delete cascade` FKs.
      mockDb.responses = mockDb.responses.filter((r) => !matchedIds.has(r.invite_id))
      mockDb.responseHistory = mockDb.responseHistory.filter((h) => !matchedIds.has(h.invite_id))
    }

    return { data: matched, error: null }
  }
}

export function createMockAdminClient() {
  return { from: (table: string) => new MockQueryBuilder(table) }
}
