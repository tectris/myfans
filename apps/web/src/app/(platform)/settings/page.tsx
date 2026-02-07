'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateProfileSchema, type UpdateProfileInput } from '@myfans/shared'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { StreakCounter } from '@/components/gamification/streak-counter'
import { LevelBadge } from '@/components/gamification/level-badge'
import { Settings, User, LogOut, KeyRound, Shield, CheckCircle2, Clock, XCircle, ArrowRight, Camera, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, logout, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get<any>('/users/me')
      return res.data
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: profile ? { displayName: profile.displayName || '', bio: profile.bio || '' } : undefined,
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfileInput) => api.patch('/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      toast.success('Perfil atualizado!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me/password', data),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ url: string }>('/upload/avatar', file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      if (user && res.data?.url) {
        setUser({ ...user, avatarUrl: res.data.url })
      }
      toast.success('Foto de perfil atualizada!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar imagem'),
  })

  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ url: string }>('/upload/cover', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      toast.success('Imagem de capa atualizada!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar imagem'),
  })

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens sao aceitas')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no maximo 5MB')
      return
    }
    avatarMutation.mutate(file)
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens sao aceitas')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem deve ter no maximo 10MB')
      return
    }
    coverMutation.mutate(file)
  }

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('As senhas nao coincidem')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Nova senha deve ter pelo menos 6 caracteres')
      return
    }
    passwordMutation.mutate({ currentPassword, newPassword })
  }

  function handleLogout() {
    api.setToken(null)
    logout()
    window.location.href = '/'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Configuracoes</h1>
      </div>

      {/* Profile card with image uploads */}
      {profile && (
        <Card className="mb-6 overflow-hidden">
          {/* Cover image */}
          <div
            className="h-32 bg-gradient-to-br from-primary/30 to-secondary/30 relative group cursor-pointer"
            onClick={() => coverInputRef.current?.click()}
          >
            {profile.coverUrl && (
              <img src={profile.coverUrl} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-white text-sm flex items-center gap-2">
                <ImagePlus className="w-5 h-5" />
                {coverMutation.isPending ? 'Enviando...' : 'Alterar capa'}
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverChange}
              className="hidden"
            />
          </div>
          <CardContent className="py-6">
            <div className="flex items-center gap-4 mb-4 -mt-12">
              {/* Avatar with upload */}
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar src={profile.avatarUrl} alt={profile.displayName || profile.username} size="xl" />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="pt-8">
                <h2 className="text-lg font-bold">{profile.displayName || profile.username}</h2>
                <p className="text-sm text-muted">@{profile.username}</p>
              </div>
            </div>
            {(avatarMutation.isPending || coverMutation.isPending) && (
              <p className="text-xs text-muted mb-2">Enviando imagem...</p>
            )}
            {profile.gamification && (
              <div className="flex items-center gap-6">
                <LevelBadge
                  level={profile.gamification.level}
                  tier={profile.gamification.fanTier}
                  xp={profile.gamification.xp}
                />
                <StreakCounter streak={profile.gamification.currentStreak} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KYC verification status */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verificacao de identidade
          </h2>
        </CardHeader>
        <CardContent>
          {user?.kycStatus === 'approved' ? (
            <div className="flex items-center gap-3 p-3 rounded-md bg-success/5 border border-success/20">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-medium text-success">Verificado</p>
                <p className="text-xs text-muted">Sua identidade foi verificada com sucesso</p>
              </div>
            </div>
          ) : user?.kycStatus === 'pending' ? (
            <div className="flex items-center gap-3 p-3 rounded-md bg-warning/5 border border-warning/20">
              <Clock className="w-5 h-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning">Em analise</p>
                <p className="text-xs text-muted">Seus documentos estao sendo analisados</p>
              </div>
            </div>
          ) : user?.kycStatus === 'rejected' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-error/5 border border-error/20">
                <XCircle className="w-5 h-5 text-error shrink-0" />
                <div>
                  <p className="text-sm font-medium text-error">Rejeitado</p>
                  <p className="text-xs text-muted">Sua verificacao foi rejeitada. Tente novamente com documentos mais claros.</p>
                </div>
              </div>
              <Link href="/kyc">
                <Button size="sm" className="w-full">
                  Tentar novamente
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Verifique sua identidade para poder postar imagens e videos na plataforma.
              </p>
              <Link href="/kyc">
                <Button size="sm">
                  <Shield className="w-4 h-4 mr-1" />
                  Iniciar verificacao
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit profile */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Editar perfil
          </h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
            <Input
              id="displayName"
              label="Nome de exibicao"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
              <textarea
                {...register('bio')}
                rows={3}
                className="w-full px-4 py-2.5 rounded-sm bg-surface-light border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Conte um pouco sobre voce..."
              />
            </div>
            <Button type="submit" loading={updateMutation.isPending}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-bold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Alterar senha
          </h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input
              id="currentPassword"
              label="Senha atual"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              id="newPassword"
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirmPassword"
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" loading={passwordMutation.isPending}>
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button variant="danger" className="w-full" onClick={handleLogout}>
        <LogOut className="w-4 h-4 mr-2" />
        Sair da conta
      </Button>
    </div>
  )
}
