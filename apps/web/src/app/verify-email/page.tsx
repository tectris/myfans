'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Flame, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'

type VerifyState = 'loading' | 'success' | 'error' | 'no-token'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'no-token')
  const [errorMessage, setErrorMessage] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token) return

    api
      .post('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((e: any) => {
        setState('error')
        setErrorMessage(e.message || 'Token invalido ou expirado')
      })
  }, [token])

  async function handleResend() {
    setResending(true)
    try {
      await api.post('/auth/resend-verification')
      setResent(true)
    } catch (e: any) {
      setErrorMessage(e.message || 'Erro ao reenviar. Faca login primeiro.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl">
          <Flame className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">FanDreams</span>
        </Link>
      </div>

      {state === 'loading' && (
        <div>
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h1 className="text-xl font-bold mb-2">Verificando...</h1>
          <p className="text-muted text-sm">Aguarde enquanto verificamos seu email.</p>
        </div>
      )}

      {state === 'success' && (
        <div>
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Email verificado!</h1>
          <p className="text-muted text-sm mb-6">
            Seu email foi verificado com sucesso. Agora voce tem acesso completo a plataforma.
          </p>
          <Link href="/feed">
            <Button className="w-full">Ir para o feed</Button>
          </Link>
        </div>
      )}

      {state === 'error' && (
        <div>
          <XCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Verificacao falhou</h1>
          <p className="text-muted text-sm mb-6">{errorMessage}</p>
          {resent ? (
            <p className="text-success text-sm mb-4">Novo email enviado! Verifique sua caixa de entrada.</p>
          ) : (
            <Button variant="outline" className="w-full mb-3" loading={resending} onClick={handleResend}>
              <Mail className="w-4 h-4 mr-1" />
              Reenviar email de verificacao
            </Button>
          )}
          <Link href="/login">
            <Button variant="ghost" className="w-full">Ir para login</Button>
          </Link>
        </div>
      )}

      {state === 'no-token' && (
        <div>
          <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Verifique seu email</h1>
          <p className="text-muted text-sm mb-6">
            Enviamos um link de verificacao para seu email. Clique no link para ativar sua conta.
          </p>
          {resent ? (
            <p className="text-success text-sm mb-4">Email reenviado! Verifique sua caixa de entrada.</p>
          ) : (
            <Button variant="outline" className="w-full mb-3" loading={resending} onClick={handleResend}>
              <Mail className="w-4 h-4 mr-1" />
              Reenviar email
            </Button>
          )}
          <Link href="/feed">
            <Button variant="ghost" className="w-full">Continuar para o feed</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
