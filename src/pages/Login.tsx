import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, Mail } from 'lucide-react'

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
    <div className="flex-1 flex flex-col items-center justify-center px-6" style={{
      background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%)',
    }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 relative" style={{
            background: 'linear-gradient(135deg, #1a3a2a 0%, #0d1f17 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}>
            <span className="text-4xl">₹</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Tracker</h1>
          <p className="text-text-muted text-sm mt-1.5">Track every rupee, never lose data</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="pl-10"
              required
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
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

          {error && (
            <div className="text-expense text-xs bg-expense/10 border border-expense/20 rounded-xl px-3 py-2.5">{error}</div>
          )}
          {message && (
            <div className="text-income text-xs bg-income/10 border border-income/20 rounded-xl px-3 py-2.5">{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary rounded-xl text-white font-semibold disabled:opacity-50 active:bg-primary-dark transition-colors mt-1"
          >
            {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
          className="w-full text-center text-sm text-text-muted mt-5 py-2"
        >
          {isSignUp
            ? <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
            : <>New here? <span className="text-primary font-medium">Create account</span></>
          }
        </button>

        <div className="mt-8 text-center">
          <p className="text-text-muted text-[11px] leading-relaxed">
            Syncs to cloud automatically
            <br />Works offline · Data encrypted
          </p>
        </div>
      </div>
    </div>
  )
}
