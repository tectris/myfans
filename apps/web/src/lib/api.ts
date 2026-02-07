const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const API_URL = rawApiUrl.replace(/\/api\/v1\/?$/, '')

type ApiResponse<T> = {
  success: boolean
  data: T
  meta?: { page: number; limit: number; total: number; hasMore: boolean }
  error?: { code: string; message: string; details?: unknown }
}

class ApiClient {
  private accessToken: string | null = null

  setToken(token: string | null) {
    this.accessToken = token
    if (token) {
      if (typeof window !== 'undefined') localStorage.setItem('accessToken', token)
    } else {
      if (typeof window !== 'undefined') localStorage.removeItem('accessToken')
    }
  }

  getToken(): string | null {
    if (this.accessToken) return this.accessToken
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken')
    }
    return this.accessToken
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_URL}/api/v1${path}`, {
      ...options,
      headers,
    })

    const json = await res.json()

    if (!res.ok) {
      if (res.status === 401 && token) {
        const refreshed = await this.refreshToken()
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`
          const retryRes = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers })
          return retryRes.json()
        }
        this.logout()
      }
      throw new ApiError(json.error?.code || 'UNKNOWN', json.error?.message || 'Erro desconhecido', res.status)
    }

    return json
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
      if (!refreshToken) return false

      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) return false

      const json = await res.json()
      this.setToken(json.data.accessToken)
      if (typeof window !== 'undefined') {
        localStorage.setItem('refreshToken', json.data.refreshToken)
      }
      return true
    } catch {
      return false
    }
  }

  logout() {
    this.accessToken = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
  }

  get<T>(path: string) {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' })
  }

  async upload<T>(path: string, file: File): Promise<ApiResponse<T>> {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('file', file)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const json = await res.json()
    if (!res.ok) {
      throw new ApiError(json.error?.code || 'UNKNOWN', json.error?.message || 'Erro desconhecido', res.status)
    }
    return json
  }

  getMediaUrl(key: string): string {
    if (key.startsWith('http')) return key
    return `${API_URL}/api/v1/media/${key}`
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export const api = new ApiClient()
