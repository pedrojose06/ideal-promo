import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PromotionList } from '@/components/alerts/PromotionList'
import type { Alert, Promotion } from '@/types'

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: alert }, { data: promotions }] = await Promise.all([
    supabase.from('alerts').select('*').eq('id', id).single(),
    supabase
      .from('promotions')
      .select('*')
      .eq('alert_id', id)
      .order('found_at', { ascending: false }),
  ])

  if (!alert) notFound()

  const a = alert as Alert
  const today = new Date().toISOString().slice(0, 10)
  const isExpired = a.end_date < today
  const isActive = a.is_active && !isExpired

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>← Voltar</Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{a.label}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(a.start_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} →{' '}
            {format(new Date(a.end_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} · a cada{' '}
            {a.frequency_hours}h
          </p>
        </div>
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isExpired ? 'Expirado' : isActive ? 'Ativo' : 'Pausado'}
        </Badge>
      </div>

      <div className="grid gap-3 text-sm bg-muted/40 rounded-lg p-4">
        {a.search_query && (
          <p><span className="font-medium">Busca:</span> {a.search_query}</p>
        )}
        {a.product_url && (
          <p>
            <span className="font-medium">URL:</span>{' '}
            <a href={a.product_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
              {a.product_url}
            </a>
          </p>
        )}
        {a.last_run_at && (
          <p>
            <span className="font-medium">Última busca:</span>{' '}
            {format(new Date(a.last_run_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
        {a.next_run_at && isActive && (
          <p>
            <span className="font-medium">Próxima busca:</span>{' '}
            {format(new Date(a.next_run_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Promoções encontradas{' '}
          <span className="text-muted-foreground font-normal text-base">
            ({promotions?.length ?? 0})
          </span>
        </h2>
        <PromotionList promotions={(promotions as Promotion[]) ?? []} />
      </div>
    </div>
  )
}
