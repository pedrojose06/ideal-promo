'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/types'

const schema = z.object({
  whatsapp: z
    .string()
    .regex(/^\+\d{10,15}$/, 'Use o formato internacional: +5511999999999')
    .optional()
    .or(z.literal('')),
  notify_email: z.boolean(),
  notify_whatsapp: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function SettingsForm({ profile }: { profile: Profile | null }) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      whatsapp: profile?.whatsapp ?? '',
      notify_email: profile?.notify_email ?? true,
      notify_whatsapp: profile?.notify_whatsapp ?? false,
    },
  })

  async function onSubmit(data: FormData) {
    setError(null)
    setSaved(false)
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, whatsapp: data.whatsapp || null }),
    })
    if (!res.ok) {
      setError('Erro ao salvar configurações')
      return
    }
    setSaved(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
            <Input
              id="whatsapp"
              placeholder="+5511999999999"
              {...register('whatsapp')}
            />
            <p className="text-xs text-muted-foreground">
              Inclua o código do país. Ex: +55 para Brasil
            </p>
            {errors.whatsapp && (
              <p className="text-xs text-destructive">{errors.whatsapp.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Canais de notificação</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('notify_email')} className="rounded" />
              <span className="text-sm">Notificar por e-mail</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('notify_whatsapp')} className="rounded" />
              <span className="text-sm">Notificar por WhatsApp</span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-green-600">Configurações salvas!</p>}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
