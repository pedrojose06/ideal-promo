import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { AlertCard } from '@/components/alerts/AlertCard'
import type { Alert } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus alertas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitore promoções e cupons dos seus produtos favoritos
          </p>
        </div>
        <Link href="/alerts/new" className={buttonVariants()}>Novo alerta</Link>
      </div>

      {!alerts || alerts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Nenhum alerta ainda</p>
          <p className="text-sm mt-1">Crie um alerta para começar a monitorar promoções</p>
          <Link href="/alerts/new" className={buttonVariants({ className: 'mt-4' })}>Criar primeiro alerta</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(alerts as Alert[]).map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  )
}
