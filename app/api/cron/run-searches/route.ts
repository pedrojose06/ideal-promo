import { NextResponse } from 'next/server'
import { runDueAlerts } from '@/lib/cron/alert-runner'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDueAlerts()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/run-searches]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
