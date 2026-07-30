/**
 * Creates the first (and only) admin account.
 *
 * Supabase Auth users cannot be created reliably by SQL migration: `auth.users`
 * is managed by Supabase, with password hashing and a linked `identities` row
 * that a plain INSERT does not produce. The supported path is the Admin API.
 *
 * Run once, against a real Supabase project:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npx tsx scripts/create-admin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the
 * environment. Never commit real credentials.
 *
 * There is deliberately no signup route in the app (PRD §6.18) — this script is
 * the only way an account comes into existence.
 */

import { createClient } from '@supabase/supabase-js'

interface AdminCredentials {
  email: string
  password: string
}

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function readCredentials(): AdminCredentials {
  const email = readEnv('ADMIN_EMAIL')
  const password = readEnv('ADMIN_PASSWORD')

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters')
  }

  return { email, password }
}

async function createAdminUser(credentials: AdminCredentials): Promise<string> {
  const supabase = createClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true, // no inbox round-trip; this account is created by hand
  })

  if (error) {
    throw new Error(`Failed to create admin user: ${error.message}`)
  }
  if (!data.user) {
    throw new Error('Supabase returned no user')
  }

  return data.user.id
}

async function main(): Promise<void> {
  const credentials = readCredentials()
  const userId = await createAdminUser(credentials)

  console.log(`Admin created: ${credentials.email}`)
  console.log(`User id: ${userId}`)
  console.log('This is the only account. There is no signup route.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
