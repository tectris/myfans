import { create } from 'zustand'

type User = {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
}

type AuthStore = {
  user: User | null
  isAuthenticated: boolean
  hydrated: boolean
  setUser: (user: User | null) => void
  logout: () => void
  hydrate: () => void
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        localStorage.removeItem('user')
      }
    }
    set({ user, isAuthenticated: !!user })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
    }
    set({ user: null, isAuthenticated: false })
  },
  hydrate: () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const user = getStoredUser()
    if (token && user) {
      set({ user, isAuthenticated: true, hydrated: true })
    } else {
      set({ hydrated: true })
    }
  },
}))

type UIStore = {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
