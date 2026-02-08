import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { badges, dailyMissions } from '@fandreams/database'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const db = drizzle(sql)

async function seed() {
  console.log('Seeding database...')

  // Seed badges
  const badgeData = [
    { code: 'early_adopter', name: 'Early Adopter', description: 'Um dos primeiros usuarios da plataforma', iconUrl: '/badges/early-adopter.svg', category: 'achievement', rarity: 'legendary' as const, xpReward: 500 },
    { code: 'first_sub', name: 'Primeiro Fa', description: 'Fez sua primeira assinatura', iconUrl: '/badges/first-sub.svg', category: 'achievement', rarity: 'common' as const, xpReward: 50 },
    { code: 'first_tip', name: 'Generoso', description: 'Enviou seu primeiro tip', iconUrl: '/badges/first-tip.svg', category: 'achievement', rarity: 'common' as const, xpReward: 50 },
    { code: 'streak_7', name: 'Semana de Fogo', description: 'Streak de 7 dias consecutivos', iconUrl: '/badges/streak-7.svg', category: 'streak', rarity: 'common' as const, xpReward: 100 },
    { code: 'streak_30', name: 'Mes Inteiro', description: 'Streak de 30 dias consecutivos', iconUrl: '/badges/streak-30.svg', category: 'streak', rarity: 'rare' as const, xpReward: 500 },
    { code: 'streak_100', name: 'Inabalavel', description: 'Streak de 100 dias consecutivos', iconUrl: '/badges/streak-100.svg', category: 'streak', rarity: 'epic' as const, xpReward: 2000 },
    { code: 'streak_365', name: 'Lendario', description: 'Streak de 365 dias consecutivos', iconUrl: '/badges/streak-365.svg', category: 'streak', rarity: 'legendary' as const, xpReward: 10000 },
    { code: 'top_tipper_weekly', name: 'Top Tipper Semanal', description: 'Maior tipper da semana de um criador', iconUrl: '/badges/top-tipper.svg', category: 'achievement', rarity: 'rare' as const, xpReward: 200 },
    { code: 'level_10', name: 'Nivel 10', description: 'Alcancou nivel 10', iconUrl: '/badges/level-10.svg', category: 'tier', rarity: 'common' as const, xpReward: 100 },
    { code: 'level_25', name: 'Nivel 25', description: 'Alcancou nivel 25', iconUrl: '/badges/level-25.svg', category: 'tier', rarity: 'rare' as const, xpReward: 250 },
    { code: 'level_50', name: 'Nivel 50', description: 'Alcancou nivel 50', iconUrl: '/badges/level-50.svg', category: 'tier', rarity: 'epic' as const, xpReward: 1000 },
    { code: 'silver_tier', name: 'Prata', description: 'Alcancou o tier Prata', iconUrl: '/badges/silver.svg', category: 'tier', rarity: 'common' as const, xpReward: 100 },
    { code: 'gold_tier', name: 'Ouro', description: 'Alcancou o tier Ouro', iconUrl: '/badges/gold.svg', category: 'tier', rarity: 'rare' as const, xpReward: 500 },
    { code: 'diamond_tier', name: 'Diamante', description: 'Alcancou o tier Diamante', iconUrl: '/badges/diamond.svg', category: 'tier', rarity: 'epic' as const, xpReward: 2000 },
    { code: 'obsidian_tier', name: 'Obsidian', description: 'Alcancou o tier Obsidian', iconUrl: '/badges/obsidian.svg', category: 'tier', rarity: 'legendary' as const, xpReward: 10000 },
    { code: 'collector_10', name: 'Colecionador', description: 'Conquistou 10 badges', iconUrl: '/badges/collector.svg', category: 'achievement', rarity: 'rare' as const, xpReward: 300 },
    { code: 'social_butterfly', name: 'Borboleta Social', description: 'Assinou 10 criadores', iconUrl: '/badges/social.svg', category: 'achievement', rarity: 'rare' as const, xpReward: 200 },
    { code: 'battle_fan', name: 'Fa de Batalha', description: 'Participou de 10 Fan Battles', iconUrl: '/badges/battle.svg', category: 'achievement', rarity: 'rare' as const, xpReward: 200 },
    { code: 'creator_100_subs', name: '100 Assinantes', description: 'Criador alcancou 100 assinantes', iconUrl: '/badges/creator-100.svg', category: 'creator', rarity: 'rare' as const, xpReward: 500 },
    { code: 'creator_1k_subs', name: '1K Assinantes', description: 'Criador alcancou 1.000 assinantes', iconUrl: '/badges/creator-1k.svg', category: 'creator', rarity: 'epic' as const, xpReward: 2000 },
  ]

  console.log(`Seeding ${badgeData.length} badges...`)
  for (const badge of badgeData) {
    await db.insert(badges).values(badge).onConflictDoNothing()
  }

  // Seed daily missions
  const missionData = [
    { title: 'Faca check-in diario', description: 'Entre na plataforma e faca seu check-in', actionType: 'login', targetCount: 1, xpReward: 10, fancoinReward: 5 },
    { title: 'Curta 3 posts', description: 'De like em 3 posts de criadores', actionType: 'like', targetCount: 3, xpReward: 15, fancoinReward: 5 },
    { title: 'Comente em um post', description: 'Deixe um comentario em qualquer post', actionType: 'comment', targetCount: 1, xpReward: 20, fancoinReward: 10 },
    { title: 'Envie um tip', description: 'Envie FanCoins como tip para um criador', actionType: 'tip', targetCount: 1, xpReward: 25, fancoinReward: 0 },
    { title: 'Explore 5 perfis', description: 'Visite o perfil de 5 criadores diferentes', actionType: 'view_profile', targetCount: 5, xpReward: 15, fancoinReward: 5 },
  ]

  console.log(`Seeding ${missionData.length} daily missions...`)
  for (const mission of missionData) {
    await db.insert(dailyMissions).values(mission).onConflictDoNothing()
  }

  console.log('Seed completed successfully!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
