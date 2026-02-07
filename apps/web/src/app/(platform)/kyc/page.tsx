'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Shield,
  Camera,
  Upload,
  CreditCard,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

type StepId = 'intro' | 'doc-front' | 'doc-back' | 'selfie' | 'review' | 'done'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'intro', label: 'Inicio' },
  { id: 'doc-front', label: 'Frente' },
  { id: 'doc-back', label: 'Verso' },
  { id: 'selfie', label: 'Selfie' },
  { id: 'review', label: 'Revisar' },
]

export default function KycPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [currentStep, setCurrentStep] = useState<StepId>('intro')
  const [docFront, setDocFront] = useState<{ file: File; preview: string } | null>(null)
  const [docBack, setDocBack] = useState<{ file: File; preview: string } | null>(null)
  const [selfie, setSelfie] = useState<{ file: File; preview: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep)

  function handleSkip() {
    router.push('/feed')
  }

  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === currentStep)
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id)
  }

  function goBack() {
    const idx = STEPS.findIndex((s) => s.id === currentStep)
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id)
  }

  async function handleFileSelect(
    file: File,
    setter: (val: { file: File; preview: string } | null) => void,
  ) {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no maximo 10MB')
      return
    }
    const preview = URL.createObjectURL(file)
    setter({ file, preview })
  }

  async function handleSubmit() {
    if (!docFront || !docBack || !selfie) return

    setSubmitting(true)
    try {
      // Upload all 3 documents
      setUploading(true)
      const [frontRes, backRes, selfieRes] = await Promise.all([
        api.upload<{ key: string }>('/media/upload', docFront.file),
        api.upload<{ key: string }>('/media/upload', docBack.file),
        api.upload<{ key: string }>('/media/upload', selfie.file),
      ])
      setUploading(false)

      // Submit KYC
      await api.post('/kyc/submit', {
        documentFrontKey: frontRes.data.key,
        documentBackKey: backRes.data.key,
        selfieKey: selfieRes.data.key,
      })

      // Update local user state
      if (user) {
        setUser({ ...user, kycStatus: 'pending' })
      }

      setCurrentStep('done')
      toast.success('Documentos enviados com sucesso!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar documentos')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress bar */}
      {currentStep !== 'done' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < stepIndex
                      ? 'bg-primary text-white'
                      : i === stepIndex
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : 'bg-surface-light text-muted'
                  }`}
                >
                  {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 sm:w-12 h-0.5 mx-1 transition-colors duration-300 ${
                      i < stepIndex ? 'bg-primary' : 'bg-surface-light'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted">
            {STEPS[stepIndex]?.label}
          </p>
        </div>
      )}

      {/* Step: Intro */}
      {currentStep === 'intro' && (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold mb-2">Verificacao de identidade</h1>
            <p className="text-muted text-sm mb-6 leading-relaxed">
              Para garantir a seguranca da plataforma e proteger nossos usuarios,
              precisamos verificar sua identidade antes de permitir o envio de
              imagens e videos.
            </p>

            <div className="space-y-3 text-left mb-8">
              <div className="flex items-start gap-3 p-3 rounded-md bg-surface-light">
                <CreditCard className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Documento com foto</p>
                  <p className="text-xs text-muted">RG, CNH ou passaporte (frente e verso)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-surface-light">
                <User className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Selfie com documento</p>
                  <p className="text-xs text-muted">Uma foto sua segurando o documento ao lado do rosto</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={goNext} className="w-full">
                Comecar verificacao
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <button
                onClick={handleSkip}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Pular por agora
              </button>
            </div>

            <div className="mt-6 flex items-start gap-2 p-3 rounded-md bg-warning/5 border border-warning/20">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted text-left">
                Sem verificacao, voce pode usar a plataforma normalmente, mas nao
                podera postar imagens ou videos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Document Front */}
      {currentStep === 'doc-front' && (
        <DocumentUploadStep
          title="Frente do documento"
          description="Tire uma foto ou envie a imagem da frente do seu documento (RG, CNH ou passaporte)"
          icon={<CreditCard className="w-8 h-8 text-primary" />}
          file={docFront}
          onFileSelect={(f) => handleFileSelect(f, setDocFront)}
          onClear={() => {
            if (docFront) URL.revokeObjectURL(docFront.preview)
            setDocFront(null)
          }}
          onNext={goNext}
          onBack={goBack}
          onSkip={handleSkip}
          canProceed={!!docFront}
        />
      )}

      {/* Step: Document Back */}
      {currentStep === 'doc-back' && (
        <DocumentUploadStep
          title="Verso do documento"
          description="Agora a parte de tras do mesmo documento"
          icon={<CreditCard className="w-8 h-8 text-primary rotate-180" />}
          file={docBack}
          onFileSelect={(f) => handleFileSelect(f, setDocBack)}
          onClear={() => {
            if (docBack) URL.revokeObjectURL(docBack.preview)
            setDocBack(null)
          }}
          onNext={goNext}
          onBack={goBack}
          onSkip={handleSkip}
          canProceed={!!docBack}
        />
      )}

      {/* Step: Selfie */}
      {currentStep === 'selfie' && (
        <DocumentUploadStep
          title="Selfie com documento"
          description="Tire uma foto segurando seu documento ao lado do rosto. Seu rosto e o documento devem estar visiveis."
          icon={<Camera className="w-8 h-8 text-primary" />}
          file={selfie}
          onFileSelect={(f) => handleFileSelect(f, setSelfie)}
          onClear={() => {
            if (selfie) URL.revokeObjectURL(selfie.preview)
            setSelfie(null)
          }}
          onNext={goNext}
          onBack={goBack}
          onSkip={handleSkip}
          canProceed={!!selfie}
          isSelfie
        />
      )}

      {/* Step: Review */}
      {currentStep === 'review' && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold text-center mb-1">Revise seus documentos</h2>
            <p className="text-sm text-muted text-center mb-6">
              Confira se as imagens estao nítidas e legiveis
            </p>

            <div className="space-y-4 mb-6">
              <ReviewItem label="Frente do documento" preview={docFront?.preview} />
              <ReviewItem label="Verso do documento" preview={docBack?.preview} />
              <ReviewItem label="Selfie com documento" preview={selfie?.preview} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
                loading={submitting}
                disabled={!docFront || !docBack || !selfie}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-1" />
                    Enviar para analise
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {currentStep === 'done' && (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-xl font-bold mb-2">Documentos enviados!</h1>
            <p className="text-muted text-sm mb-8 leading-relaxed">
              Seus documentos foram enviados com sucesso e estao em analise.
              Voce sera notificado quando a verificacao for concluida.
            </p>
            <Button onClick={() => router.push('/feed')} className="w-full">
              Ir para o feed
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DocumentUploadStep({
  title,
  description,
  icon,
  file,
  onFileSelect,
  onClear,
  onNext,
  onBack,
  onSkip,
  canProceed,
  isSelfie,
}: {
  title: string
  description: string
  icon: React.ReactNode
  file: { file: File; preview: string } | null
  onFileSelect: (file: File) => void
  onClear: () => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  canProceed: boolean
  isSelfie?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            {icon}
          </div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>

        {file ? (
          <div className="relative mb-6">
            <img
              src={file.preview}
              alt={title}
              className="w-full rounded-md border border-border object-contain max-h-64"
            />
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-success/90 text-white text-xs px-2 py-1 rounded-sm flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Imagem selecionada
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="border-2 border-dashed border-border rounded-md p-8 text-center hover:border-primary/50 transition-colors">
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-3">
                  {/* Camera button */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture={isSelfie ? 'user' : 'environment'}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onFileSelect(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-3 rounded-md bg-primary text-white font-medium text-sm hover:bg-primary-light transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    Tirar foto
                  </button>

                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onFileSelect(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-3 rounded-md border border-border text-foreground font-medium text-sm hover:border-primary/50 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    Enviar arquivo
                  </button>
                </div>
                <p className="text-xs text-muted">JPG, PNG ou WEBP ate 10MB</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <Button onClick={onNext} className="flex-1" disabled={!canProceed}>
            Continuar
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <button
          onClick={onSkip}
          className="w-full mt-3 text-sm text-muted hover:text-foreground transition-colors text-center"
        >
          Pular por agora
        </button>
      </CardContent>
    </Card>
  )
}

function ReviewItem({ label, preview }: { label: string; preview?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md bg-surface-light">
      {preview ? (
        <img src={preview} alt={label} className="w-16 h-12 rounded object-cover border border-border" />
      ) : (
        <div className="w-16 h-12 rounded bg-surface flex items-center justify-center border border-border">
          <X className="w-4 h-4 text-muted" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      {preview ? (
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-error shrink-0" />
      )}
    </div>
  )
}
