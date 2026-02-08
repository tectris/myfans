'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPostSchema, type CreatePostInput } from '@fandreams/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ImagePlus, Video, Send, Eye, Lock, DollarSign, X, Loader2, Shield, ArrowRight, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import Link from 'next/link'

type UploadedMedia = {
  key: string
  mediaType: string
  previewUrl: string
}

export default function CreateContentPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const kycApproved = user?.kycStatus === 'approved' || user?.role === 'admin'
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<UploadedMedia[]>([])
  const [coverIndex, setCoverIndex] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { visibility: 'public', postType: 'regular' },
  })

  const visibility = watch('visibility')

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const res = await api.upload<{ key: string; mediaType: string; fileSize: number }>(
        '/media/upload',
        file,
      )
      const previewUrl = URL.createObjectURL(file)
      setMediaFiles((prev) => [
        ...prev,
        { key: res.data.key, mediaType: res.data.mediaType, previewUrl },
      ])
      toast.success('Arquivo enviado!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar arquivo')
    } finally {
      setUploading(false)
    }
  }

  async function handleMultiImageUpload(files: FileList) {
    for (const file of Array.from(files)) {
      await handleFileUpload(file)
    }
  }

  function removeMedia(index: number) {
    setMediaFiles((prev) => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    setCoverIndex((prev) => {
      if (index === prev) return 0
      if (index < prev) return prev - 1
      return prev
    })
  }

  async function onSubmit(data: CreatePostInput) {
    setLoading(true)
    try {
      // Reorder so cover image comes first
      const ordered = [...mediaFiles]
      if (coverIndex > 0 && coverIndex < ordered.length) {
        const [cover] = ordered.splice(coverIndex, 1)
        ordered.unshift(cover)
      }
      const payload: CreatePostInput = {
        ...data,
        media:
          ordered.length > 0
            ? ordered.map((m) => ({ key: api.getMediaUrl(m.key), mediaType: m.mediaType }))
            : undefined,
      }
      await api.post('/posts', payload)
      toast.success('Post publicado!')
      router.push('/feed')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Novo post</h1>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <textarea
                {...register('contentText')}
                placeholder="O que voce quer compartilhar?"
                rows={5}
                className="w-full px-4 py-3 rounded-sm bg-surface-light border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Media previews */}
            {mediaFiles.length > 0 && (
              <div>
                {mediaFiles.filter((m) => m.mediaType === 'image').length > 1 && (
                  <p className="text-xs text-muted mb-1.5">Clique na estrela para escolher a capa</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {mediaFiles.map((m, i) => (
                    <div key={m.key} className={`relative rounded-sm overflow-hidden border-2 ${i === coverIndex && m.mediaType === 'image' && mediaFiles.filter((f) => f.mediaType === 'image').length > 1 ? 'border-primary' : 'border-border'}`}>
                      {m.mediaType === 'image' ? (
                        <img src={m.previewUrl} alt="" className="w-full h-40 object-cover" />
                      ) : (
                        <video src={m.previewUrl} className="w-full h-40 object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white hover:bg-black/90"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {m.mediaType === 'image' && mediaFiles.filter((f) => f.mediaType === 'image').length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCoverIndex(i)}
                          className={`absolute top-1 left-1 p-1 rounded-full ${i === coverIndex ? 'bg-primary text-white' : 'bg-black/70 text-white/70 hover:text-white'}`}
                          title="Definir como capa"
                        >
                          <Star className={`w-4 h-4 ${i === coverIndex ? 'fill-white' : ''}`} />
                        </button>
                      )}
                      {i === coverIndex && m.mediaType === 'image' && mediaFiles.filter((f) => f.mediaType === 'image').length > 1 && (
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary/90 rounded text-white text-[10px] font-medium">
                          Capa
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media upload buttons */}
            {kycApproved ? (
              <div className="flex gap-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files && files.length > 0) handleMultiImageUpload(files)
                    e.target.value = ''
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-sm border border-border text-sm text-muted hover:text-foreground hover:border-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  Imagens
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-sm border border-border text-sm text-muted hover:text-foreground hover:border-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                  Video
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-md bg-warning/5 border border-warning/20">
                <Shield className="w-5 h-5 text-warning shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {user?.kycStatus === 'pending'
                      ? 'Verificacao em analise'
                      : 'Verificacao necessaria'}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {user?.kycStatus === 'pending'
                      ? 'Seus documentos estao sendo analisados. Voce podera enviar midia em breve.'
                      : 'Verifique sua identidade para poder postar imagens e videos.'}
                  </p>
                </div>
                {user?.kycStatus !== 'pending' && (
                  <Link href="/kyc">
                    <Button size="sm" variant="outline">
                      Verificar
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium mb-2">Visibilidade</label>
              <div className="flex gap-2">
                {[
                  { value: 'public', icon: Eye, label: 'Publico' },
                  { value: 'subscribers', icon: Lock, label: 'Assinantes' },
                  { value: 'ppv', icon: DollarSign, label: 'Pago (PPV)' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2 rounded-sm border text-sm cursor-pointer transition-colors ${
                      visibility === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...register('visibility')}
                      className="hidden"
                    />
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {visibility === 'ppv' && (
              <Input
                id="ppvPrice"
                label="Preco do conteudo (R$)"
                type="number"
                step="0.01"
                min="1"
                placeholder="29.90"
                error={errors.ppvPrice?.message}
                {...register('ppvPrice', { valueAsNumber: true })}
              />
            )}

            <Button type="submit" className="w-full" loading={loading} disabled={uploading}>
              <Send className="w-4 h-4 mr-1" />
              Publicar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
