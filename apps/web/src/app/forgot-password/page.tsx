'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@fandreams/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flame, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(data: ForgotPasswordInput) {
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', data)
      setSent(true)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar email')
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
        </div>

        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <h1 className="text-xl font-bold mb-2">Email enviado!</h1>
            <p className="text-muted text-sm mb-6">
              Se existe uma conta com esse email, voce recebera um link para redefinir sua senha.
              Verifique sua caixa de entrada e spam.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-xl font-bold">Esqueceu sua senha?</h1>
              <p className="text-muted text-sm mt-2">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>
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

              <Button type="submit" className="w-full" loading={loading}>
                Enviar link de redefinicao
              </Button>
            </form>

            <p className="text-center text-sm text-muted mt-6">
              <Link href="/login" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
