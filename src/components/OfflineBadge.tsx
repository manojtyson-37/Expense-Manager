import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBadge() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/20 text-amber-500 text-xs font-medium">
      <WifiOff size={11} />
      Offline — changes saved locally
    </div>
  )
}
