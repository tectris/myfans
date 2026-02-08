'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  Settings, Shield, AlertTriangle, CheckCircle2, XCircle,
  Clock, ArrowDownToLine, DollarSign, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminPaymentsPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'settings'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  if (user?.role !== 'admin') {
    router.push('/feed')
    return null
  }

  const { data: pendingPayouts, isLoading: loadingPending } = useQuery({
    queryKey: ['admin-payouts-pending'],
    queryFn: async () => (await api.get<any>('/withdrawals/admin/pending')).data,
    enabled: activeTab === 'pending',
  })

  const { data: allPayouts, isLoading: loadingAll } = useQuery({
    queryKey: ['admin-payouts-all', statusFilter],
    queryFn: async () => (await api.get<any>(`/withdrawals/admin/all${statusFilter ? `?status=${statusFilter}` : ''}`)).data,
    enabled: activeTab === 'all',
  })

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin-payment-settings'],
    queryFn: async () => (await api.get<any>('/withdrawals/admin/settings')).data,
    enabled: activeTab === 'settings',
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/withdrawals/admin/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-pending'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-all'] })
      toast.success('Saque aprovado!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/withdrawals/admin/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-pending'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-all'] })
      setRejectId(null)
      setRejectReason('')
      toast.success('Saque rejeitado e FanCoins devolvidos.')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const settingsMutation = useMutation({
    mutationFn: (updates: any) => api.patch('/withdrawals/admin/settings', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-settings'] })
      toast.success('Configuracoes salvas!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  function PayoutRow({ payout }: { payout: any }) {
    return (
      <div className="border border-border rounded-md p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="font-bold">{formatCurrency(Number(payout.amount))}</span>
            <Badge variant="default">{payout.method?.toUpperCase()}</Badge>
            <Badge variant={
              payout.status === 'completed' ? 'success'
                : payout.status === 'rejected' ? 'error'
                  : payout.status === 'pending_approval' ? 'warning' : 'secondary'
            }>
              {payout.status === 'pending_approval' ? 'Aguardando Aprovacao'
                : payout.status === 'pending' ? 'Processando'
                  : payout.status === 'completed' ? 'Pago'
                    : payout.status === 'rejected' ? 'Rejeitado' : payout.status}
            </Badge>
          </div>
          <span className="text-xs text-muted">
            {new Date(payout.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="text-sm text-muted space-y-1">
          <p>Creator: <span className="text-foreground">{payout.creatorId}</span></p>
          <p>FanCoins: <span className="text-foreground">{payout.fancoinAmount?.toLocaleString()}</span></p>
          {payout.pixKey && <p>PIX: <span className="text-foreground">{payout.pixKey}</span></p>}
          {payout.cryptoAddress && <p>Crypto: <span className="text-foreground font-mono text-xs">{payout.cryptoAddress} ({payout.cryptoNetwork})</span></p>}
        </div>

        {payout.riskScore > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-warning/10 rounded text-xs">
            <AlertTriangle className="w-3 h-3 text-warning" />
            Risk Score: {payout.riskScore} | Flags: {(payout.riskFlags as string[])?.join(', ')}
          </div>
        )}

        {payout.rejectedReason && (
          <div className="mt-2 p-2 bg-error/10 rounded text-xs text-error">
            Motivo: {payout.rejectedReason}
          </div>
        )}

        {payout.status === 'pending_approval' && (
          <div className="flex gap-2 mt-3">
            {rejectId === payout.id ? (
              <div className="flex-1 space-y-2">
                <Input placeholder="Motivo da rejeicao" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" loading={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ id: payout.id, reason: rejectReason })}>
                    Confirmar Rejeicao
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button size="sm" variant="primary" loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(payout.id)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectId(payout.id)}>
                  <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Gestao de Pagamentos</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <Button variant={activeTab === 'pending' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('pending')}>
          <Clock className="w-4 h-4 mr-1" /> Pendentes{pendingPayouts?.total > 0 ? ` (${pendingPayouts.total})` : ''}
        </Button>
        <Button variant={activeTab === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('all')}>
          <ArrowDownToLine className="w-4 h-4 mr-1" /> Todos os Saques
        </Button>
        <Button variant={activeTab === 'settings' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('settings')}>
          <Settings className="w-4 h-4 mr-1" /> Configuracoes
        </Button>
      </div>

      {activeTab === 'pending' && (
        <div>
          {loadingPending ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : pendingPayouts?.items?.length > 0 ? (
            pendingPayouts.items.map((p: any) => <PayoutRow key={p.id} payout={p} />)
          ) : (
            <Card><CardContent className="py-8 text-center text-muted">Nenhum saque pendente de aprovacao</CardContent></Card>
          )}
        </div>
      )}

      {activeTab === 'all' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['', 'pending_approval', 'pending', 'completed', 'rejected'].map((s) => (
              <Button key={s} size="sm" variant={statusFilter === s ? 'primary' : 'outline'}
                onClick={() => setStatusFilter(s)}>
                {s === '' ? 'Todos' : s === 'pending_approval' ? 'Aprovacao' : s === 'pending' ? 'Processando' : s === 'completed' ? 'Pagos' : 'Rejeitados'}
              </Button>
            ))}
          </div>
          {loadingAll ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : allPayouts?.items?.length > 0 ? (
            allPayouts.items.map((p: any) => <PayoutRow key={p.id} payout={p} />)
          ) : (
            <Card><CardContent className="py-8 text-center text-muted">Nenhum saque encontrado</CardContent></Card>
          )}
        </div>
      )}

      {activeTab === 'settings' && settings && (
        <Card>
          <CardHeader>
            <h2 className="font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Configuracoes de Pagamento
            </h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              settingsMutation.mutate({
                manual_approval_threshold: Number(form.get('manual_approval_threshold')),
                max_daily_withdrawals: Number(form.get('max_daily_withdrawals')),
                max_daily_amount: Number(form.get('max_daily_amount')),
                cooldown_hours: Number(form.get('cooldown_hours')),
                min_payout: Number(form.get('min_payout')),
                fancoin_to_brl: Number(form.get('fancoin_to_brl')),
              })
            }}>
              <Input label="Aprovacao manual a partir de (R$)" name="manual_approval_threshold" type="number" step="0.01" defaultValue={settings.manual_approval_threshold} />
              <Input label="Max saques por dia" name="max_daily_withdrawals" type="number" defaultValue={settings.max_daily_withdrawals} />
              <Input label="Max valor diario (R$)" name="max_daily_amount" type="number" step="0.01" defaultValue={settings.max_daily_amount} />
              <Input label="Cooldown entre saques (horas)" name="cooldown_hours" type="number" defaultValue={settings.cooldown_hours} />
              <Input label="Saque minimo (R$)" name="min_payout" type="number" step="0.01" defaultValue={settings.min_payout} />
              <Input label="Taxa FanCoin → BRL" name="fancoin_to_brl" type="number" step="0.001" defaultValue={settings.fancoin_to_brl} />
              <Button type="submit" loading={settingsMutation.isPending}>
                Salvar Configuracoes
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
