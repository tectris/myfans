'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FANCOIN_PACKAGES } from '@fandreams/shared'
import { formatCurrency } from '@/lib/utils'
import {
  Coins, TrendingUp, TrendingDown, ShoppingBag, Gift, CreditCard,
  QrCode, CheckCircle2, XCircle, Clock, Loader2, Bitcoin, Wallet,
  ArrowDownToLine, Shield, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Provider = { id: string; label: string; methods: string[]; sandbox: boolean }

function WalletContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('payment')
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<'buy' | 'withdraw' | 'history'>('buy')
  const [withdrawMethod, setWithdrawMethod] = useState<'pix' | 'crypto'>('pix')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [cryptoNetwork, setCryptoNetwork] = useState('TRC20')

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
    queryFn: async () => (await api.get<any>('/fancoins/wallet')).data,
  })

  const { data: transactions } = useQuery({
    queryKey: ['fancoin-transactions'],
    queryFn: async () => (await api.get<any[]>('/fancoins/transactions')).data,
  })

  const { data: providers } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: async () => (await api.get<Provider[]>('/payments/providers')).data,
  })

  const { data: earnings } = useQuery({
    queryKey: ['earnings'],
    queryFn: async () => (await api.get<any>('/withdrawals/earnings')).data,
    enabled: user?.role === 'creator' || user?.role === 'admin',
  })

  const checkoutMutation = useMutation({
    mutationFn: async (params: { packageId: string; paymentMethod: string; provider: string }) => {
      const res = await api.post<any>('/payments/checkout/fancoins', params)
      return res.data
    },
    onSuccess: (data) => { window.location.href = data.checkoutUrl },
    onError: (e: any) => {
      if (e.code === 'PAYMENT_UNAVAILABLE') {
        toast.info('Provedor nao configurado. Tente outro metodo.')
        return
      }
      toast.error(e.message || 'Erro ao iniciar pagamento')
    },
  })

  const directPurchaseMutation = useMutation({
    mutationFn: (packageId: string) => api.post('/fancoins/purchase', { packageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
      toast.success('FanCoins adicionados (modo teste)!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const withdrawMutation = useMutation({
    mutationFn: async (params: any) => (await api.post<any>('/withdrawals/request', params)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['earnings'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
      setWithdrawAmount('')
      if (data.needsApproval) {
        toast.info('Saque solicitado! Aguardando aprovacao da plataforma (ate 24h).')
      } else {
        toast.success('Saque solicitado com sucesso!')
      }
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handlePurchase(packageId: string, method: string, provider: string) {
    checkoutMutation.mutate(
      { packageId, paymentMethod: method, provider },
      {
        onError: (e: any) => {
          if (e.code === 'PAYMENT_UNAVAILABLE') {
            directPurchaseMutation.mutate(packageId)
          }
        },
      },
    )
  }

  function handleWithdraw() {
    const amount = Number(withdrawAmount)
    if (!amount || amount <= 0) { toast.error('Informe o valor em FanCoins'); return }
    withdrawMutation.mutate({
      method: withdrawMethod,
      fancoinAmount: amount,
      pixKey: withdrawMethod === 'pix' ? pixKey : undefined,
      cryptoAddress: withdrawMethod === 'crypto' ? cryptoAddress : undefined,
      cryptoNetwork: withdrawMethod === 'crypto' ? cryptoNetwork : undefined,
    })
  }

  const isPurchasing = checkoutMutation.isPending || directPurchaseMutation.isPending
  const isCreator = user?.role === 'creator' || user?.role === 'admin'
  const fancoinToBrl = earnings?.fancoinToBrl || 0.01

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="w-6 h-6 text-warning" />
        <h1 className="text-xl font-bold">Meus FanCoins</h1>
      </div>

      {paymentStatus && (
        <div className={`flex items-center gap-3 p-4 rounded-md mb-6 ${
          paymentStatus === 'success' ? 'bg-success/10 border border-success/20'
            : paymentStatus === 'failure' ? 'bg-error/10 border border-error/20'
              : 'bg-warning/10 border border-warning/20'
        }`}>
          {paymentStatus === 'success' ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            : paymentStatus === 'failure' ? <XCircle className="w-5 h-5 text-error shrink-0" />
              : <Clock className="w-5 h-5 text-warning shrink-0" />}
          <p className="text-sm">
            {paymentStatus === 'success' ? 'Pagamento aprovado! Seus FanCoins foram creditados.'
              : paymentStatus === 'failure' ? 'Pagamento nao aprovado. Tente novamente.'
                : 'Pagamento pendente. Aguardando confirmacao.'}
          </p>
        </div>
      )}

      {/* Balance Card */}
      <Card className="mb-6 bg-gradient-to-br from-primary/10 via-surface to-secondary/10">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted mb-1">Saldo atual</p>
          <div className="text-5xl font-bold text-foreground flex items-center justify-center gap-3">
            <Coins className="w-10 h-10 text-warning" />
            {(wallet?.balance || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted mt-1">FanCoins{isCreator && ` ≈ ${formatCurrency(Number(wallet?.balance || 0) * fancoinToBrl)}`}</p>
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={activeTab === 'buy' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('buy')}>
          <ShoppingBag className="w-4 h-4 mr-1" /> Comprar
        </Button>
        {isCreator && (
          <Button variant={activeTab === 'withdraw' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('withdraw')}>
            <ArrowDownToLine className="w-4 h-4 mr-1" /> Sacar
          </Button>
        )}
        <Button variant={activeTab === 'history' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('history')}>
          <Gift className="w-4 h-4 mr-1" /> Historico
        </Button>
      </div>

      {/* Buy Tab */}
      {activeTab === 'buy' && (
        <>
          {providers && providers.length > 0 && (
            <div className="flex items-center gap-2 mb-4 text-xs text-muted">
              <Shield className="w-3 h-3" />
              Metodos: {providers.map((p) => (
                <Badge key={p.id} variant="default" className="text-xs">
                  {p.label}{p.sandbox ? ' (sandbox)' : ''}
                </Badge>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {FANCOIN_PACKAGES.map((pkg) => (
              <Card key={pkg.id}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-lg">{pkg.coins.toLocaleString()}</span>
                      <span className="text-sm text-muted ml-1">FanCoins</span>
                      {pkg.bonus > 0 && <Badge variant="success" className="ml-2">+{pkg.bonus} bonus</Badge>}
                    </div>
                    <span className="text-lg font-bold text-primary">{formatCurrency(pkg.price)}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {providers?.some((p) => p.methods.includes('pix')) && (
                      <Button size="sm" variant="primary" className="flex-1 min-w-[80px]" loading={isPurchasing}
                        onClick={() => handlePurchase(pkg.id, 'pix', 'mercadopago')}>
                        <QrCode className="w-4 h-4 mr-1" /> PIX
                      </Button>
                    )}
                    {providers?.some((p) => p.methods.includes('credit_card')) && (
                      <Button size="sm" variant="outline" className="flex-1 min-w-[80px]" loading={isPurchasing}
                        onClick={() => handlePurchase(pkg.id, 'credit_card', 'mercadopago')}>
                        <CreditCard className="w-4 h-4 mr-1" /> Cartao
                      </Button>
                    )}
                    {providers?.some((p) => p.methods.includes('crypto')) && (
                      <Button size="sm" variant="outline" className="flex-1 min-w-[80px]" loading={isPurchasing}
                        onClick={() => handlePurchase(pkg.id, 'crypto', 'nowpayments')}>
                        <Bitcoin className="w-4 h-4 mr-1" /> Crypto
                      </Button>
                    )}
                    {providers?.some((p) => p.methods.includes('paypal')) && (
                      <Button size="sm" variant="outline" className="flex-1 min-w-[80px]" loading={isPurchasing}
                        onClick={() => handlePurchase(pkg.id, 'paypal', 'paypal')}>
                        <Wallet className="w-4 h-4 mr-1" /> PayPal
                      </Button>
                    )}
                    {(!providers || providers.length === 0) && (
                      <>
                        <Button size="sm" variant="primary" className="flex-1" loading={isPurchasing}
                          onClick={() => handlePurchase(pkg.id, 'pix', 'mercadopago')}>
                          <QrCode className="w-4 h-4 mr-1" /> PIX
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" loading={isPurchasing}
                          onClick={() => handlePurchase(pkg.id, 'credit_card', 'mercadopago')}>
                          <CreditCard className="w-4 h-4 mr-1" /> Cartao
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Withdraw Tab */}
      {activeTab === 'withdraw' && isCreator && (
        <Card className="mb-8">
          <CardHeader>
            <h2 className="font-bold flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-primary" />
              Solicitar Saque
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {earnings && (
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-surface p-3 rounded-md">
                  <p className="text-muted text-xs">Disponivel para saque</p>
                  <p className="font-bold text-lg">{formatCurrency(earnings.balanceBrl)}</p>
                  <p className="text-xs text-muted">{Number(wallet?.balance || 0).toLocaleString()} FanCoins</p>
                </div>
                <div className="bg-surface p-3 rounded-md">
                  <p className="text-muted text-xs">Total sacado</p>
                  <p className="font-bold text-lg">{formatCurrency(earnings.totalWithdrawnBrl)}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant={withdrawMethod === 'pix' ? 'primary' : 'outline'} onClick={() => setWithdrawMethod('pix')}>
                <QrCode className="w-4 h-4 mr-1" /> PIX
              </Button>
              <Button size="sm" variant={withdrawMethod === 'crypto' ? 'primary' : 'outline'} onClick={() => setWithdrawMethod('crypto')}>
                <Bitcoin className="w-4 h-4 mr-1" /> Crypto
              </Button>
            </div>

            <Input
              label="Quantidade de FanCoins"
              type="number"
              placeholder="Ex: 10000"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            {withdrawAmount && Number(withdrawAmount) > 0 && (
              <p className="text-sm text-muted">
                Valor estimado: <span className="font-bold text-foreground">{formatCurrency(Number(withdrawAmount) * fancoinToBrl)}</span>
              </p>
            )}

            {withdrawMethod === 'pix' && (
              <Input label="Chave PIX" placeholder="CPF, email, telefone ou chave aleatoria" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            )}

            {withdrawMethod === 'crypto' && (
              <>
                <div className="flex gap-2 mb-2">
                  {['TRC20', 'ERC20', 'BEP20'].map((net) => (
                    <Button key={net} size="sm" variant={cryptoNetwork === net ? 'primary' : 'outline'} onClick={() => setCryptoNetwork(net)}>
                      {net}
                    </Button>
                  ))}
                </div>
                <Input label={`Endereco USDT (${cryptoNetwork})`} placeholder="Endereco da carteira" value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} />
              </>
            )}

            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-md text-xs text-muted">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p>Saques acima de R$ 500 requerem aprovacao manual (ate 24h).</p>
                <p>Limite: 3 saques/dia, maximo R$ 10.000/dia.</p>
              </div>
            </div>

            <Button className="w-full" loading={withdrawMutation.isPending} onClick={handleWithdraw}>
              Solicitar Saque
            </Button>

            {/* Payout History */}
            {earnings?.payouts?.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-sm mb-3">Historico de saques</h3>
                <div className="space-y-2">
                  {earnings.payouts.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="text-sm font-medium">{p.method.toUpperCase()} - {formatCurrency(Number(p.amount))}</span>
                        <p className="text-xs text-muted">
                          {new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge variant={p.status === 'completed' ? 'success' : p.status === 'rejected' ? 'error' : 'warning'}>
                        {p.status === 'completed' ? 'Pago' : p.status === 'pending_approval' ? 'Aprovacao' : p.status === 'pending' ? 'Processando' : p.status === 'rejected' ? 'Rejeitado' : p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
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
                      <span className="text-sm font-medium">
                        <TransactionDescription text={tx.description || tx.type} />
                      </span>
                      <p className="text-xs text-muted">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
      )}
    </div>
  )
}

function TransactionDescription({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1)
          return <Link key={i} href={`/creator/${username}`} className="text-primary hover:underline">{part}</Link>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <WalletContent />
    </Suspense>
  )
}
