import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogIn, Mail } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for confirmation link!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold">Expense Tracker</h1>
          <p className="text-text-muted text-sm mt-1">Track every penny, never lose data</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                className="pl-10"
                required
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <LogIn size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="pl-10"
                minLength={6}
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-expense text-xs bg-expense/10 rounded-xl px-3 py-2">{error}</div>
          )}
          {message && (
            <div className="text-income text-xs bg-income/10 rounded-xl px-3 py-2">{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary rounded-xl text-white font-semibold disabled:opacity-50"
          >
            {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
          className="w-full text-center text-sm text-text-muted mt-4 py-2"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        <div className="mt-6 text-center">
          <p className="text-text-muted text-xs">
            Your data syncs to the cloud automatically.
            <br />Works offline, syncs when connected.
          </p>
        </div>
      </div>
    </div>
  )
}
