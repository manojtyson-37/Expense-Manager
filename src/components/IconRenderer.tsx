import {
  Wallet, Laptop, TrendingUp, Gift, UtensilsCrossed, Car, ShoppingBag,
  FileText, Film, Heart, GraduationCap, ShoppingCart, Home, Zap, Package,
  CreditCard, Smartphone, Banknote, Building2, HandCoins,
  Plane, Pill, Gamepad2, Shirt, Sparkles,
  type LucideProps
} from 'lucide-react'

const EMOJI_TO_ICON: Record<string, React.ComponentType<LucideProps>> = {
  '💰': Wallet,
  '💻': Laptop,
  '📈': TrendingUp,
  '🎁': Gift,
  '🍔': UtensilsCrossed,
  '🚗': Car,
  '🛍️': ShoppingBag,
  '📄': FileText,
  '🎬': Film,
  '🏥': Heart,
  '📚': GraduationCap,
  '🛒': ShoppingCart,
  '🏠': Home,
  '⚡': Zap,
  '📦': Package,
  '💳': CreditCard,
  '📱': Smartphone,
  '💵': Banknote,
  '🏦': Building2,
  '👛': HandCoins,
  '✈️': Plane,
  '💊': Pill,
  '🎮': Gamepad2,
  '👕': Shirt,
  '💅': Sparkles,
}

interface Props {
  icon: string
  size?: number
  className?: string
  color?: string
}

export default function IconRenderer({ icon, size = 18, className, color }: Props) {
  const LucideIcon = EMOJI_TO_ICON[icon]

  if (LucideIcon) {
    return <LucideIcon size={size} className={className} style={color ? { color } : undefined} aria-label={icon} />
  }

  return <span className={className} style={{ fontSize: size * 0.9 }} role="img" aria-label="icon">{icon}</span>
}
