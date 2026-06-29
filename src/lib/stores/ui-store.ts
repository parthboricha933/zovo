'use client'

import { create } from 'zustand'

/**
 * Since the dev sandbox only exposes the `/` route to the user, we manage app
 * navigation client-side via a simple view state machine.
 *
 * Views:
 *   auth              -> login / signup screen
 *   role-select       -> "How do you want to use ZOVO?"
 *   passenger.*       -> passenger dashboard views
 *   driver.*          -> driver dashboard views
 *   admin.*           -> admin panel views
 */
interface UIState {
  view: string
  params: Record<string, any>
  navigate: (view: string, params?: Record<string, any>) => void
  back: () => void
  history: { view: string; params: Record<string, any> }[]
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  view: 'auth',
  params: {},
  history: [],
  sidebarOpen: false,

  navigate: (view, params = {}) => {
    const cur = { view: get().view, params: get().params }
    set({
      view,
      params,
      history: [...get().history, cur].slice(-20),
      sidebarOpen: false,
    })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  },

  back: () => {
    const h = [...get().history]
    if (h.length === 0) return
    const last = h.pop()!
    set({ view: last.view, params: last.params, history: h })
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
