export const FAN_TIERS = {
  bronze: { name: 'Bronze', minXp: 0, color: '#CD7F32' },
  silver: { name: 'Prata', minXp: 1000, color: '#C0C0C0' },
  gold: { name: 'Ouro', minXp: 5000, color: '#FFD700' },
  diamond: { name: 'Diamante', minXp: 25000, color: '#B9F2FF' },
  obsidian: { name: 'Obsidian', minXp: 100000, color: '#1A1A2E' },
} as const

export const XP_REWARDS = {
  daily_login: 10,
  streak_bonus_per_day: 5,
  like_post: 2,
  comment_post: 5,
  tip_sent: 10,
  subscription_made: 50,
  share_post: 3,
  complete_mission: 25,
  watch_battle: 15,
  tip_battle: 20,
  referral_signup: 100,
  referral_subscription: 200,
} as const

export const LEVEL_THRESHOLDS = Array.from({ length: 100 }, (_, i) => ({
  level: i + 1,
  xpRequired: Math.floor(100 * Math.pow(1.5, i)),
}))

export const FANCOIN_PACKAGES = [
  { id: 'pack_100', coins: 100, price: 1.0, bonus: 0, label: '100 FanCoins' },
  { id: 'pack_500', coins: 550, price: 5.0, bonus: 50, label: '550 FanCoins (+10%)' },
  { id: 'pack_1000', coins: 1200, price: 10.0, bonus: 200, label: '1.200 FanCoins (+20%)' },
  { id: 'pack_5000', coins: 6500, price: 50.0, bonus: 1500, label: '6.500 FanCoins (+30%)' },
  { id: 'pack_10000', coins: 15000, price: 100.0, bonus: 5000, label: '15.000 FanCoins (+50%)' },
] as const

export const VIRTUAL_GIFTS = [
  { id: 'gift_heart', name: 'Coracao', icon: 'heart', cost: 10 },
  { id: 'gift_fire', name: 'Fogo', icon: 'flame', cost: 50 },
  { id: 'gift_star', name: 'Estrela', icon: 'star', cost: 100 },
  { id: 'gift_crown', name: 'Coroa', icon: 'crown', cost: 500 },
  { id: 'gift_diamond', name: 'Diamante', icon: 'diamond', cost: 1000 },
  { id: 'gift_rocket', name: 'Foguete', icon: 'rocket', cost: 5000 },
] as const
