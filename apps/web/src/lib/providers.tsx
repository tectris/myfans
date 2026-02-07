'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { useAuthStore } from './store'
import { api } from './api'

function AuthHydrator() {
  const { hydrate, setUser, logout, hydrated } = useAuthStore()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  // After hydration, validate token with the server in the background
  useEffect(() => {
    if (!hydrated) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    api
      .get<{ id: string; email: string; username: string; displayName: string | null; avatarUrl: string | null; role: string }>('/auth/me')
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        // Token is invalid and refresh also failed — clear session
        logout()
      })
  }, [hydrated, setUser, logout])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator />
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: '#1A1A2E',
            border: '1px solid #2D2D44',
            color: '#F5F5F5',
          },
        }}
      />
    </QueryClientProvider>
  )
}
