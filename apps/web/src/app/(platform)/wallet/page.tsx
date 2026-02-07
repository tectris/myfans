'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FANCOIN_PACKAGES } from '@myfans/shared'
import { formatCurrency } from '@/lib/utils'
import {
  Coins,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Gift,
  CreditCard,
  QrCode,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

type CheckoutResponse = {
  paymentId: string
  checkoutUrl: string
  preferenceId: string
  package: { id: string; coins: number; bonus: number; price: number; label: string }
}

function WalletContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('payment')

  // Show payment result toast on redirect back from MercadoPago
  useEffect(() => {
    if (paymentStatus === 'success') {
      toast.success('Pagamento aprovado! Seus FanCoins serao creditados em instantes.')
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
    } else if (paymentStatus === 'failure') {
      toast.error('Pagamento nao aprovado. Tente novamente.')
    } else if (paymentStatus === 'pending') {
      toast.info('Pagamento pendente. Voce sera notificado quando for confirmado.')
    }
  }, [paymentStatus, queryClient])

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api.get<any>('/fancoins/wallet')
      return res.data
    },
  })

  const { data: transactions } = useQuery({
    queryKey: ['fancoin-transactions'],
    queryFn: async () => {
      const res = await api.get<any[]>('/fancoins/transactions')
      return res.data
    },
  })

  // Real payment checkout via MercadoPago
  const checkoutMutation = useMutation({
    mutationFn: async ({ packageId, paymentMethod }: { packageId: string; paymentMethod: 'pix' | 'credit_card' }) => {
      const res = await api.post<CheckoutResponse>('/payments/checkout/fancoins', { packageId, paymentMethod })
      return res.data
    },
    onSuccess: (data) => {
      // Redirect to MercadoPago checkout
      window.location.href = data.checkoutUrl
    },
    onError: (e: any) => {
      // If MercadoPago is not configured, fallback to direct purchase (dev mode)
      if (e.code === 'PAYMENT_UNAVAILABLE') {
        toast.info('Pagamento via MercadoPago nao configurado. Usando modo de teste.')
        return
      }
      toast.error(e.message || 'Erro ao iniciar pagamento')
    },
  })

  // Direct purchase fallback (when MercadoPago is not configured)
  const directPurchaseMutation = useMutation({
    mutationFn: (packageId: string) => api.post('/fancoins/purchase', { packageId, paymentMethod: 'pix' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
      toast.success('FanCoins adicionados (modo teste)!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handlePurchase(packageId: string, method: 'pix' | 'credit_card') {
    checkoutMutation.mutate(
      { packageId, paymentMethod: method },
      {
        onError: (e: any) => {
          if (e.code === 'PAYMENT_UNAVAILABLE') {
            directPurchaseMutation.mutate(packageId)
          }
        },
      },
    )
  }

  const isPurchasing = checkoutMutation.isPending || directPurchaseMutation.isPending

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="w-6 h-6 text-warning" />
        <h1 className="text-xl font-bold">Meus FanCoins</h1>
      </div>

      {/* Payment result banner */}
      {paymentStatus && (
        <div
          className={`flex items-center gap-3 p-4 rounded-md mb-6 ${
            paymentStatus === 'success'
              ? 'bg-success/10 border border-success/20'
              : paymentStatus === 'failure'
                ? 'bg-error/10 border border-error/20'
                : 'bg-warning/10 border border-warning/20'
          }`}
        >
          {paymentStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : paymentStatus === 'failure' ? (
            <XCircle className="w-5 h-5 text-error shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-warning shrink-0" />
          )}
          <p className="text-sm">
            {paymentStatus === 'success'
              ? 'Pagamento aprovado! Seus FanCoins foram creditados.'
              : paymentStatus === 'failure'
                ? 'Pagamento nao aprovado. Tente novamente com outro metodo.'
                : 'Pagamento pendente. Aguardando confirmacao.'}
          </p>
        </div>
      )}

      {/* Balance */}
      <Card className="mb-8 bg-gradient-to-br from-primary/10 via-surface to-secondary/10">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted mb-1">Saldo atual</p>
          <div className="text-5xl font-bold text-foreground flex items-center justify-center gap-3">
            <Coins className="w-10 h-10 text-warning" />
            {(wallet?.balance || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted mt-2">FanCoins</p>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <span className="flex items-center gap-1 text-success">
              <TrendingUp className="w-4 h-4" />
              {(wallet?.totalEarned || 0).toLocaleString()} ganhos
            </span>
            <span className="flex items-center gap-1 text-error">
              <TrendingDown className="w-4 h-4" />
              {(wallet?.totalSpent || 0).toLocaleString()} gastos
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Packages */}
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-primary" />
        Comprar FanCoins
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {FANCOIN_PACKAGES.map((pkg) => (
          <Card key={pkg.id}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-lg">{pkg.coins.toLocaleString()}</span>
                  <span className="text-sm text-muted ml-1">FanCoins</span>
                  {pkg.bonus > 0 && (
                    <Badge variant="success" className="ml-2">
                      +{pkg.bonus} bonus
                    </Badge>
                  )}
                </div>
                <span className="text-lg font-bold text-primary">{formatCurrency(pkg.price)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1"
                  loading={isPurchasing}
                  onClick={() => handlePurchase(pkg.id, 'pix')}
                >
                  <QrCode className="w-4 h-4 mr-1" />
                  PIX
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  loading={isPurchasing}
                  onClick={() => handlePurchase(pkg.id, 'credit_card')}
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  Cartao
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <h2 className="font-bold flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Historico
          </h2>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{tx.description || tx.type}</span>
                    <p className="text-xs text-muted">
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-success' : 'text-error'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm text-center py-6">Nenhuma transacao ainda</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <WalletContent />
    </Suspense>
  )
}
