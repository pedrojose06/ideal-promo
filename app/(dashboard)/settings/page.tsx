import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/notifications/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .single()

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure como você quer receber as notificações
        </p>
      </div>
      <SettingsForm profile={profile} />
    </div>
  )
}
