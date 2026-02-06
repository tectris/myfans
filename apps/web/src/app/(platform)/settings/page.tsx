'use client'

import { useState } from 'react'
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
import { Settings, User, LogOut, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, logout } = useAuthStore()
  const queryClient = useQueryClient()

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

      {/* Profile card */}
      {profile && (
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar src={profile.avatarUrl} alt={profile.displayName || profile.username} size="xl" />
              <div>
                <h2 className="text-lg font-bold">{profile.displayName || profile.username}</h2>
                <p className="text-sm text-muted">@{profile.username}</p>
              </div>
            </div>
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
