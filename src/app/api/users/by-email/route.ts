import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/users/by-email?email=...
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ userId: profile.id })
}
