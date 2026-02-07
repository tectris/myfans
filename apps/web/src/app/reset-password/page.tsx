'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flame, ArrowLeft, Lock, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const resetFormSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
      .regex(/[0-9]/, 'Senha deve conter pelo menos um numero'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas nao coincidem',
    path: ['confirmPassword'],
  })

type ResetFormInput = z.infer<typeof resetFormSchema>

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormInput>({ resolver: zodResolver(resetFormSchema) })

  async function onSubmit(data: ResetFormInput) {
    if (!token) {
      toast.error('Token invalido. Solicite um novo link.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      setSuccess(true)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm text-center">
        <Lock className="w-12 h-12 text-error mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Link invalido</h1>
        <p className="text-muted text-sm mb-6">
          Este link de redefinicao de senha e invalido ou expirou.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Solicitar novo link</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl">
          <Flame className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">MyFans</span>
        </Link>
      </div>

      {success ? (
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Senha redefinida!</h1>
          <p className="text-muted text-sm mb-6">
            Sua senha foi alterada com sucesso. Faca login com a nova senha.
          </p>
          <Link href="/login">
            <Button className="w-full">Ir para login</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <Lock className="w-10 h-10 text-primary mx-auto mb-3" />
            <h1 className="text-xl font-bold">Redefinir senha</h1>
            <p className="text-muted text-sm mt-2">
              Digite sua nova senha abaixo.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              id="password"
              label="Nova senha"
              type="password"
              placeholder="Minimo 8 caracteres, 1 maiuscula, 1 numero"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              id="confirmPassword"
              label="Confirmar nova senha"
              type="password"
              placeholder="Repita a nova senha"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" className="w-full" loading={loading}>
              Redefinir senha
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
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
