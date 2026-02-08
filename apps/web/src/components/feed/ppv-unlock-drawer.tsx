'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Lock, Coins, CreditCard, QrCode, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface PpvUnlockDrawerProps {
  open: boolean
  onClose: () => void
  onUnlocked: () => void
  post: {
    id: string
    ppvPrice: string
    creatorUsername: string
    creatorDisplayName: string | null
    contentText?: string | null
  }
}

type DrawerState = 'choose' | 'processing' | 'waiting' | 'success' | 'error'

export function PpvUnlockDrawer({ open, onClose, onUnlocked, post }: PpvUnlockDrawerProps) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<DrawerState>('choose')
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'fancoins' | 'pix' | 'credit_card'>('fancoins')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)

  const price = Number(post.ppvPrice)
  const priceInCoins = Math.ceil(price * 100)
  const displayName = post.creatorDisplayName || post.creatorUsername

  const { data: walletData } = useQuery({
    queryKey: ['fancoin-wallet'],
    queryFn: () => api.get<{ balance: string }>('/fancoins/wallet'),
    enabled: open,
  })

  const balance = Number(walletData?.data?.balance || 0)
  const hasEnoughCoins = balance >= priceInCoins

  useEffect(() => {
    if (!open) {
      setState('choose')
      setError('')
      setPaymentId(null)
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open])

  function startPolling(pId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ status: string }>(`/payments/status/${pId}`)
        if (res.data?.status === 'completed') {
          setState('success')
          if (pollRef.current) clearInterval(pollRef.current)
          queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
          queryClient.invalidateQueries({ queryKey: ['feed'] })
          onUnlocked()
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)
  }

  async function handleUnlockWithFancoins() {
    setState('processing')
    setError('')
    try {
      await api.post(`/posts/${post.id}/unlock`, {})
      setState('success')
      queryClient.invalidateQueries({ queryKey: ['fancoin-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      onUnlocked()
      toast.success('Conteudo desbloqueado!')
    } catch (e: any) {
      setState('error')
      setError(e.message || 'Erro ao desbloquear')
    }
  }

  async function handlePayWithMp() {
    setState('processing')
    setError('')
    try {
      const res = await api.post<any>('/payments/checkout/ppv', {
        postId: post.id,
        paymentMethod: paymentMethod === 'pix' ? 'pix' : 'credit_card',
      })
      const data = res.data

      if (data.checkoutUrl) {
        setPaymentId(data.paymentId)
        window.open(data.checkoutUrl, 'mp_ppv_checkout', 'width=600,height=700,scrollbars=yes')
        setState('waiting')
        startPolling(data.paymentId)
      }
    } catch (e: any) {
      setState('error')
      setError(e.message || 'Erro ao criar pagamento')
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-warning" />
            Desbloquear conteudo
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-surface-light">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Post info */}
          <div className="bg-surface-light rounded-sm p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Post de @{post.creatorUsername}</p>
              <Badge variant="warning">{formatCurrency(post.ppvPrice)}</Badge>
            </div>
            {post.contentText && (
              <p className="text-sm text-muted line-clamp-2">{post.contentText}</p>
            )}
          </div>

          {/* State: Choose payment */}
          {state === 'choose' && (
            <>
              <h4 className="font-semibold text-sm mb-3">Como deseja pagar?</h4>
              <div className="space-y-2 mb-5">
                {/* FanCoins option */}
                <button
                  onClick={() => setPaymentMethod('fancoins')}
                  className={`w-full flex items-center gap-3 p-4 rounded-sm border transition-colors ${
                    paymentMethod === 'fancoins'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Coins className={`w-5 h-5 ${paymentMethod === 'fancoins' ? 'text-warning' : 'text-muted'}`} />
                  <div className="text-left flex-1">
                    <p className="font-medium text-sm">FanCoins</p>
                    <p className="text-xs text-muted">
                      {priceInCoins.toLocaleString()} coins
                      {hasEnoughCoins
                        ? ` (saldo: ${balance.toLocaleString()})`
                        : ` — saldo insuficiente (${balance.toLocaleString()})`}
                    </p>
                  </div>
                  {hasEnoughCoins && <Badge variant="success" className="text-xs">Disponivel</Badge>}
                </button>

                {/* Credit Card option */}
                <button
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`w-full flex items-center gap-3 p-4 rounded-sm border transition-colors ${
                    paymentMethod === 'credit_card'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'credit_card' ? 'text-primary' : 'text-muted'}`} />
                  <div className="text-left">
                    <p className="font-medium text-sm">Cartao de Credito</p>
                    <p className="text-xs text-muted">{formatCurrency(post.ppvPrice)} — parcele em ate 12x</p>
                  </div>
                </button>

                {/* PIX option */}
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`w-full flex items-center gap-3 p-4 rounded-sm border transition-colors ${
                    paymentMethod === 'pix'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <QrCode className={`w-5 h-5 ${paymentMethod === 'pix' ? 'text-primary' : 'text-muted'}`} />
                  <div className="text-left">
                    <p className="font-medium text-sm">PIX</p>
                    <p className="text-xs text-muted">{formatCurrency(post.ppvPrice)} — aprovacao instantanea</p>
                  </div>
                </button>
              </div>

              {paymentMethod === 'fancoins' ? (
                <Button
                  className="w-full"
                  onClick={handleUnlockWithFancoins}
                  disabled={!hasEnoughCoins}
                >
                  <Coins className="w-4 h-4 mr-2" />
                  {hasEnoughCoins
                    ? `Desbloquear com ${priceInCoins.toLocaleString()} FanCoins`
                    : 'Saldo insuficiente'}
                </Button>
              ) : (
                <Button className="w-full" onClick={handlePayWithMp}>
                  {paymentMethod === 'pix' ? (
                    <QrCode className="w-4 h-4 mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Pagar {formatCurrency(post.ppvPrice)}
                </Button>
              )}

              {!hasEnoughCoins && paymentMethod === 'fancoins' && (
                <p className="text-xs text-muted text-center mt-2">
                  Voce precisa de mais {(priceInCoins - balance).toLocaleString()} FanCoins.
                  Compre na sua carteira ou pague com PIX/Cartao.
                </p>
              )}
            </>
          )}

          {/* State: Processing */}
          {state === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted">Processando pagamento...</p>
            </div>
          )}

          {/* State: Waiting for MP payment */}
          {state === 'waiting' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold mb-1">Finalize o pagamento</p>
                <p className="text-sm text-muted mb-4">
                  Complete o pagamento na janela do Mercado Pago.
                </p>
                <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-3" />
                <p className="text-xs text-muted">Aguardando confirmacao...</p>
              </div>
            </div>
          )}

          {/* State: Success */}
          {state === 'success' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg">Conteudo desbloqueado!</p>
                <p className="text-sm text-muted mt-1">
                  Voce agora tem acesso permanente a este post.
                </p>
              </div>
              <Button onClick={onClose} className="mt-2">
                Ver conteudo
              </Button>
            </div>
          )}

          {/* State: Error */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                <X className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-bold">Erro no pagamento</p>
                <p className="text-sm text-muted mt-1">{error}</p>
              </div>
              <Button variant="outline" onClick={() => setState('choose')}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
