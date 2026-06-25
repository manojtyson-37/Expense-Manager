import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Lock } from 'lucide-react'

export default function ResetPassword() {
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else clearRecovery() // session is now a normal one → App renders the app
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-svh">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Set a new password</h1>
        <p className="text-text-muted text-sm text-center mb-8">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              style={{ paddingLeft: '2.75rem' }}
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="text-expense text-xs bg-expense/10 border border-expense/20 rounded-xl px-3 py-2.5">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary rounded-xl text-white font-semibold disabled:opacity-50 active:bg-primary-dark transition-colors mt-1"
          >
            {loading ? '...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
