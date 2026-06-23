import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, List, Plus, Tag, Settings } from 'lucide-react'

const tabs = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/transactions', icon: List, label: 'History' },
  { path: '/add', icon: Plus, label: 'Add', isFab: true },
  { path: '/categories', icon: Tag, label: 'Tags' },
  { path: '/settings', icon: Settings, label: 'More' },
]

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-surface-light/50 flex justify-around items-end py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
      {tabs.map(({ path, icon: Icon, label, isFab }) => {
        const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

        if (isFab) {
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-0.5 -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <Icon size={24} strokeWidth={2.5} className="text-white" />
              </div>
              <span className="text-[10px] font-medium text-primary">{label}</span>
            </button>
          )
        }

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              active ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
