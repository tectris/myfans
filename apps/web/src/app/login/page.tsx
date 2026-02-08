'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@fandreams/shared'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flame } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setLoading(true)
    try {
      const res = await api.post<{
        user: { id: string; email: string; username: string; displayName: string; avatarUrl: string; role: string }
        accessToken: string
        refreshToken: string
      }>('/auth/login', data)

      api.setToken(res.data.accessToken)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      setUser(res.data.user)
      toast.success('Bem-vindo de volta!')
      router.push('/feed')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao fazer login')
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
          <p className="text-muted text-sm mt-2">Entre na sua conta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            placeholder="Sua senha"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Nao tem uma conta?{' '}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
