import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import * as kycService from '../services/kyc.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const kyc = new Hono()

kyc.post('/submit', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const { documentFrontKey, documentBackKey, selfieKey } = await c.req.json()

    if (!documentFrontKey || !documentBackKey || !selfieKey) {
      return error(c, 400, 'MISSING_DOCUMENTS', 'Todos os documentos sao obrigatorios')
    }

    const doc = await kycService.submitKyc(userId, {
      documentFrontKey,
      documentBackKey,
      selfieKey,
    })
    return success(c, doc)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

kyc.get('/status', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const result = await kycService.getKycStatus(userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default kyc
