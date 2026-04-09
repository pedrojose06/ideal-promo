'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const schema = z.object({
  label: z.string().min(1, 'Nome obrigatório').max(100),
  search_query: z.string().max(300).optional(),
  product_url: z.string().url('URL inválida').optional().or(z.literal('')),
  start_date: z.string().min(1, 'Data de início obrigatória'),
  end_date: z.string().min(1, 'Data de fim obrigatória'),
  frequency_hours: z.number().int().min(1).max(168),
}).refine((d) => d.search_query || d.product_url, {
  message: 'Informe a descrição do produto ou uma URL',
  path: ['search_query'],
})

type FormData = {
  label: string
  search_query?: string
  product_url?: string
  start_date: string
  end_date: string
  frequency_hours: number
}

const today = new Date().toISOString().slice(0, 10)
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

export function AlertForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: today,
      end_date: nextWeek,
      frequency_hours: 6,
    },
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        product_url: data.product_url || undefined,
        search_query: data.search_query || undefined,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(err.error?.formErrors?.[0] ?? JSON.stringify(err.error))
      return
    }

    const alert = await res.json()
    router.push(`/alerts/${alert.id}`)
    router.refresh()
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Novo alerta de promoção</CardTitle>
        <CardDescription>
          Defina o produto e o período. Você será notificado quando encontrarmos promoções ou cupons.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label">Nome do alerta</Label>
            <Input
              id="label"
              placeholder="ex: Samsung TV 55 OLED"
              {...register('label')}
            />
            {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="search_query">Descrição do produto</Label>
            <Textarea
              id="search_query"
              placeholder="ex: Samsung TV 55 polegadas OLED 4K"
              rows={2}
              {...register('search_query')}
            />
            <p className="text-xs text-muted-foreground">Ou informe a URL abaixo</p>
            {errors.search_query && (
              <p className="text-xs text-destructive">{errors.search_query.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product_url">URL do produto (opcional)</Label>
            <Input
              id="product_url"
              type="url"
              placeholder="https://www.amazon.com.br/..."
              {...register('product_url')}
            />
            {errors.product_url && (
              <p className="text-xs text-destructive">{errors.product_url.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Início</Label>
              <Input id="start_date" type="date" {...register('start_date')} />
              {errors.start_date && (
                <p className="text-xs text-destructive">{errors.start_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Fim</Label>
              <Input id="end_date" type="date" {...register('end_date')} />
              {errors.end_date && (
                <p className="text-xs text-destructive">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Frequência de busca</Label>
            <Select
              defaultValue="6"
              onValueChange={(v) => v && setValue('frequency_hours', parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A cada 1 hora</SelectItem>
                <SelectItem value="3">A cada 3 horas</SelectItem>
                <SelectItem value="6">A cada 6 horas</SelectItem>
                <SelectItem value="12">A cada 12 horas</SelectItem>
                <SelectItem value="24">Uma vez por dia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar alerta'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
