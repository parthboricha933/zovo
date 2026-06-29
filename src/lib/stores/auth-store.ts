'use client'

import { create } from 'zustand'
import { api, type User, type VerificationStatus } from '../api-client'

interface AuthState {
  user: User | null
  verification: VerificationStatus | null
  loading: boolean
  initialized: boolean
  error: string | null

  init: () => Promise<void>
  signup: (body: { name: string; email: string; password: string; phone?: string }) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  googleLogin: (payload: { googleId: string; email: string; name: string; picture?: string; idToken?: string }) => Promise<void>
  logout: () => Promise<void>
  switchRole: (role: 'PASSENGER' | 'DRIVER') => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  verification: null,
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    set({ loading: true })
    try {
      const { user, verification } = await api.auth.me()
      set({ user, verification, loading: false, initialized: true })
    } catch {
      set({ user: null, verification: null, loading: false, initialized: true })
    }
  },

  signup: async (body) => {
    set({ loading: true, error: null })
    try {
      await api.auth.signup(body)
      await get().init()
    } catch (e: any) {
      set({ loading: false, error: e.message })
      throw e
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      await api.auth.login({ email, password })
      await get().init()
    } catch (e: any) {
      set({ loading: false, error: e.message })
      throw e
    }
  },

  googleLogin: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      await api.auth.google(payload)
      await get().init()
    } catch (e: any) {
      set({ loading: false, error: e.message })
      throw e
    }
  },

  logout: async () => {
    try {
      await api.auth.logout()
    } finally {
      set({ user: null, verification: null, initialized: true })
    }
  },

  switchRole: async (role) => {
    await api.auth.switchRole(role)
    await get().init()
  },

  refresh: async () => {
    const { user, verification } = await api.auth.me()
    set({ user, verification })
  },

  clearError: () => set({ error: null }),
}))
