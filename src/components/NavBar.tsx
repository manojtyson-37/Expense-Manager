import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, List, PlusCircle, Tag, Settings } from 'lucide-react'

const tabs = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/transactions', icon: List, label: 'History' },
  { path: '/add', icon: PlusCircle, label: 'Add' },
  { path: '/categories', icon: Tag, label: 'Tags' },
  { path: '/settings', icon: Settings, label: 'More' },
]

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg border-t border-surface-light flex justify-around items-center py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              active ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <Icon size={path === '/add' ? 28 : 22} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
