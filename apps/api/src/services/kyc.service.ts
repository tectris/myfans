import { eq, desc } from 'drizzle-orm'
import { users, kycDocuments } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'

export async function submitKyc(
  userId: string,
  input: { documentFrontKey: string; documentBackKey: string; selfieKey: string },
) {
  // Check if there's already a pending submission
  const [existing] = await db
    .select()
    .from(kycDocuments)
    .where(eq(kycDocuments.userId, userId))
    .orderBy(desc(kycDocuments.createdAt))
    .limit(1)

  if (existing?.status === 'pending') {
    throw new AppError('KYC_PENDING', 'Voce ja tem uma verificacao em analise', 409)
  }

  if (existing?.status === 'approved') {
    throw new AppError('KYC_APPROVED', 'Sua conta ja esta verificada', 409)
  }

  const [doc] = await db
    .insert(kycDocuments)
    .values({
      userId,
      documentFrontKey: input.documentFrontKey,
      documentBackKey: input.documentBackKey,
      selfieKey: input.selfieKey,
    })
    .returning()

  await db
    .update(users)
    .set({ kycStatus: 'pending', updatedAt: new Date() })
    .where(eq(users.id, userId))

  return doc
}

export async function getKycStatus(userId: string) {
  const [user] = await db
    .select({ kycStatus: users.kycStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  const [latestDoc] = await db
    .select()
    .from(kycDocuments)
    .where(eq(kycDocuments.userId, userId))
    .orderBy(desc(kycDocuments.createdAt))
    .limit(1)

  return {
    status: user.kycStatus,
    document: latestDoc
      ? {
          id: latestDoc.id,
          status: latestDoc.status,
          rejectedReason: latestDoc.rejectedReason,
          submittedAt: latestDoc.submittedAt,
          reviewedAt: latestDoc.reviewedAt,
        }
      : null,
  }
}

export async function reviewKyc(
  documentId: string,
  reviewerId: string,
  approved: boolean,
  rejectedReason?: string,
) {
  const [doc] = await db
    .select()
    .from(kycDocuments)
    .where(eq(kycDocuments.id, documentId))
    .limit(1)

  if (!doc) throw new AppError('NOT_FOUND', 'Documento nao encontrado', 404)
  if (doc.status !== 'pending') {
    throw new AppError('ALREADY_REVIEWED', 'Documento ja foi revisado', 409)
  }

  const newStatus = approved ? 'approved' : 'rejected'

  const [updated] = await db
    .update(kycDocuments)
    .set({
      status: newStatus,
      rejectedReason: approved ? null : (rejectedReason || null),
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(kycDocuments.id, documentId))
    .returning()

  await db
    .update(users)
    .set({ kycStatus: newStatus, updatedAt: new Date() })
    .where(eq(users.id, doc.userId))

  return updated
}
