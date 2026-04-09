import { AlertForm } from '@/components/alerts/AlertForm'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NewAlertPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>← Voltar</Link>
        <h1 className="text-2xl font-bold">Novo alerta</h1>
      </div>
      <AlertForm />
    </div>
  )
}
