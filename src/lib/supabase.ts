import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wqligdlzjkccmflaeqxz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_nZO-pR8ldKrJuEdjqzvYeg_HmKSNh4s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
