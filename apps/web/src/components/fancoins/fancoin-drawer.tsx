'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Coins, ShoppingCart, ArrowRightLeft, Gift } from 'lucide-react'
import { toast } from 'sonner'

type Wallet = {
  balance: string
  totalEarned: string
  totalSpent: string
}

type Transaction = {
  id: string
  type: string
  amount: string
  description: string | null
  createdAt: string
}

type Package = {
  id: string
  name: string
  coins: number
  price: string
  bonusPercent: number
}

interface FancoinDrawerProps {
  open: boolean
  onClose: () => void
}

export function FancoinDrawer({ open, onClose }: FancoinDrawerProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'wallet' | 'buy' | 'history'>('wallet')

  const { data: walletData } = useQuery({
    queryKey: ['fancoin-wallet'],
    queryFn: () => api.get<Wallet>('/fancoins/wallet'),
    enabled: open,
  })

  const { data: transactionsData } = useQuery({
    queryKey: ['fancoin-transactions'],
    queryFn: () => api.get<Transaction[]>('/fancoins/transactions?limit=20'),
    enabled: open && tab === 'history',
  })

  const { data: packagesData } = useQuery({
    queryKey: ['fancoin-packages'],
    queryFn: () => api.get<Package[]>('/fancoins/packages'),
    enabled: open && tab === 'buy',
  })

  const purchaseMutation = useMutation({
    mutationFn: (packageId: string) => api.post('/fancoins/purchase', { packageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fancoin-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
      toast.success('FanCoins comprados!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro na compra'),
  })

  const wallet = walletData?.data
  const transactions = transactionsData?.data ?? []
  const packages = packagesData?.data ?? []

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-bold flex items-center gap-2">
            <Coins className="w-5 h-5 text-warning" />
            FanCoins
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-surface-light">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance */}
        <div className="px-4 py-5 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border">
          <p className="text-sm text-muted mb-1">Saldo disponivel</p>
          <p className="text-3xl font-bold flex items-center gap-2">
            <Coins className="w-7 h-7 text-warning" />
            {wallet ? Number(wallet.balance).toLocaleString() : '0'}
          </p>
          <div className="flex gap-4 mt-2 text-xs text-muted">
            <span>Ganhos: {wallet ? Number(wallet.totalEarned).toLocaleString() : '0'}</span>
            <span>Gastos: {wallet ? Number(wallet.totalSpent).toLocaleString() : '0'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: 'wallet' as const, icon: Coins, label: 'Carteira' },
            { id: 'buy' as const, icon: ShoppingCart, label: 'Comprar' },
            { id: 'history' as const, icon: ArrowRightLeft, label: 'Historico' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'wallet' && (
            <div className="space-y-3">
              <button
                onClick={() => setTab('buy')}
                className="w-full flex items-center gap-3 p-4 rounded-sm border border-border hover:border-primary/50 transition-colors"
              >
                <div className="p-2 bg-primary/10 rounded-sm">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Comprar FanCoins</p>
                  <p className="text-xs text-muted">Adquira pacotes de moedas</p>
                </div>
              </button>
              <button
                onClick={() => setTab('history')}
                className="w-full flex items-center gap-3 p-4 rounded-sm border border-border hover:border-primary/50 transition-colors"
              >
                <div className="p-2 bg-secondary/10 rounded-sm">
                  <ArrowRightLeft className="w-5 h-5 text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Historico</p>
                  <p className="text-xs text-muted">Ver transacoes anteriores</p>
                </div>
              </button>
              <div className="w-full flex items-center gap-3 p-4 rounded-sm border border-border opacity-50">
                <div className="p-2 bg-warning/10 rounded-sm">
                  <Gift className="w-5 h-5 text-warning" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Transferir</p>
                  <p className="text-xs text-muted">Em breve</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'buy' && (
            <div className="space-y-3">
              {packages.length > 0 ? (
                packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between p-4 rounded-sm border border-border"
                  >
                    <div>
                      <p className="font-medium text-sm">{pkg.name}</p>
                      <p className="text-xs text-muted">
                        {pkg.coins.toLocaleString()} coins
                        {pkg.bonusPercent > 0 && (
                          <Badge variant="success" className="ml-2">+{pkg.bonusPercent}%</Badge>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => purchaseMutation.mutate(pkg.id)}
                      loading={purchaseMutation.isPending}
                    >
                      R$ {Number(pkg.price).toFixed(2)}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted text-center py-8">
                  Nenhum pacote disponivel no momento
                </p>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b border-border/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        Number(tx.amount) >= 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      {Number(tx.amount) >= 0 ? '+' : ''}
                      {Number(tx.amount).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted text-center py-8">Nenhuma transacao ainda</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
