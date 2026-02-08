'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@fandreams/shared'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flame } from 'lucide-react'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(data: RegisterInput) {
    setLoading(true)
    try {
      const res = await api.post<{
        user: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null; role: string }
        accessToken: string
        refreshToken: string
      }>('/auth/register', data)

      api.setToken(res.data.accessToken)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      setUser(res.data.user)
      toast.success('Conta criada! Verifique seu email.')
      router.push('/verify-email')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl">
            <Flame className="w-8 h-8 text-primary" />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">FanDreams</span>
          </Link>
          <p className="text-muted text-sm mt-2">Crie sua conta e comece a monetizar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...reg('email')}
          />
          <Input
            id="username"
            label="Username"
            placeholder="seu_username"
            error={errors.username?.message}
            {...reg('username')}
          />
          <Input
            id="displayName"
            label="Nome de exibicao"
            placeholder="Seu nome"
            error={errors.displayName?.message}
            {...reg('displayName')}
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            placeholder="Minimo 8 caracteres, 1 maiuscula, 1 numero"
            error={errors.password?.message}
            {...reg('password')}
          />
          <Input
            id="dateOfBirth"
            label="Data de nascimento"
            type="date"
            error={errors.dateOfBirth?.message}
            {...reg('dateOfBirth')}
          />

          <Button type="submit" className="w-full" loading={loading}>
            Criar conta
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Ja tem uma conta?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Entrar
          </Link>
        </p>

        <p className="text-center text-xs text-muted mt-4">
          Ao criar sua conta, voce concorda com nossos{' '}
          <Link href="#" className="underline">
            Termos de uso
          </Link>{' '}
          e{' '}
          <Link href="#" className="underline">
            Politica de privacidade
          </Link>
        </p>
      </div>
    </div>
  )
}
