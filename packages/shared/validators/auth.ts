import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Email invalido'),
  username: z
    .string()
    .min(3, 'Username deve ter pelo menos 3 caracteres')
    .max(50, 'Username deve ter no maximo 50 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username pode conter apenas letras, numeros e _'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um numero'),
  displayName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().refine(
    (date) => {
      const age = Math.floor((Date.now() - new Date(date).getTime()) / 31557600000)
      return age >= 18
    },
    { message: 'Voce deve ter pelo menos 18 anos' },
  ),
})

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalido'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um numero'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
