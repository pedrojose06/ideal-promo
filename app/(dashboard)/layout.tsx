import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link href="/dashboard" className="font-bold text-lg">
            ideal-promo
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Alertas
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Configurações
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
