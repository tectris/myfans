import { env } from '../config/env'

type EmailPayload = {
  to: string
  subject: string
  html: string
}

async function sendViaResend(payload: EmailPayload): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Resend error:', err)
    return false
  }

  return true
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (env.RESEND_API_KEY) {
    return sendViaResend(payload)
  }

  // Dev fallback: log to console
  console.log('========== EMAIL (dev) ==========')
  console.log(`To: ${payload.to}`)
  console.log(`Subject: ${payload.subject}`)
  console.log(payload.html.replace(/<[^>]*>/g, ''))
  console.log('=================================')
  return true
}

const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`

  return sendEmail({
    to,
    subject: 'Verifique seu email - FanDreams',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e11d48;">FanDreams</h2>
        <p>Bem-vindo ao FanDreams! Clique no botao abaixo para verificar seu email:</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #e11d48; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
          Verificar Email
        </a>
        <p style="color: #666; font-size: 14px;">Ou copie e cole este link no navegador:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Este link expira em 24 horas.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  return sendEmail({
    to,
    subject: 'Redefinir senha - FanDreams',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e11d48;">FanDreams</h2>
        <p>Voce solicitou a redefinicao de senha. Clique no botao abaixo:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #e11d48; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
          Redefinir Senha
        </a>
        <p style="color: #666; font-size: 14px;">Ou copie e cole este link no navegador:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Este link expira em 1 hora. Se voce nao solicitou esta redefinicao, ignore este email.</p>
      </div>
    `,
  })
}
