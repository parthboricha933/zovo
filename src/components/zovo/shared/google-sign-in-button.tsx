'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '170184700423-uk3uv9dormui3qc21g4f8fmlhgcoaego.apps.googleusercontent.com'

interface Props {
  onSuccess: () => void
  disabled?: boolean
}

/**
 * Renders the official Google Sign-In button via Google Identity Services.
 * On success, sends the ID token (credential) to /api/auth/google which verifies
 * it server-side using google-auth-library.
 */
export function GoogleSignInButton({ onSuccess, disabled }: Props) {
  const btnRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  // Wait for GIS to be available, then initialize
  useEffect(() => {
    let cancelled = false
    const check = () => {
      if (cancelled) return
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        if (cancelled) return
        try {
          ;(window as any).google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response: any) => {
              if (!response.credential) {
                toast.error('Google sign-in failed')
                setLoading(false)
                return
              }
              setLoading(true)
              api.auth
                .google({ credential: response.credential })
                .then(() => {
                  toast.success('Signed in with Google!')
                  onSuccessRef.current()
                })
                .catch((e: any) => {
                  toast.error(e.message || 'Google sign-in failed')
                  setLoading(false)
                })
            },
          })
          setSdkReady(true)
        } catch (e) {
          console.warn('[GoogleSignIn] init failed', e)
        }
      } else {
        setTimeout(check, 200)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Render the button once SDK is ready AND the ref is attached
  useEffect(() => {
    if (!sdkReady || !btnRef.current) return
    try {
      ;(window as any).google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
        locale: 'en',
      })
    } catch (e) {
      console.warn('[GoogleSignIn] renderButton failed', e)
    }
  }, [sdkReady])

  if (loading || disabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background h-11 px-4 text-sm font-medium opacity-70"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> {loading ? 'Signing in…' : 'Loading…'}
      </button>
    )
  }

  return (
    <div className="flex justify-center w-full">
      {!sdkReady ? (
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background h-11 px-4 text-sm font-medium"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Google…
        </button>
      ) : (
        <div ref={btnRef} className="[&_div]:!w-full" />
      )}
    </div>
  )
}
