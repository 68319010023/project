// งบ token ต่อเดือน (ปรับตัวเลขนี้ที่เดียว)
export const MONTHLY_TOKEN_BUDGET = 1_000_000

export const fmt = (n) => Number(n ?? 0).toLocaleString('th-TH')
export const rawPct = (n) => (Number(n ?? 0) / MONTHLY_TOKEN_BUDGET) * 100
export const pctText = (n) => rawPct(n).toFixed(2)
export const pctLabel = (p) => (p < 1 ? '<1%' : Math.round(p) + '%')

// ถ้ามีการใช้งาน ให้แถบกว้างอย่างน้อย 2% ไม่เช่นนั้น 0.47% จะมองไม่เห็นเลย
export const barWidth = (n) => {
  const p = rawPct(n)
  return (p > 0 ? Math.min(100, Math.max(2, p)) : 0) + '%'
}
export const barColor = (n) => {
  const p = rawPct(n)
  if (p >= 85) return 'bg-red-500'
  if (p >= 60) return 'bg-orange'
  return 'bg-purple'
}

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '-'
export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }) : '-'
export const dayLabel = (s) =>
  new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

export const displayName = (u) => {
  const fromMeta = u?.user_metadata?.full_name || u?.user_metadata?.name || u?.user_metadata?.display_name
  const fromProfile = u?.full_name || u?.display_name || u?.name || u?.username
  const fromParts = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim()
  const fallback = [u?.firstname, u?.lastname].filter(Boolean).join(' ').trim()
  return (fromMeta || fromProfile || fromParts || fallback || '').trim()
}

export const fullName = (u) => displayName(u) || u?.email || 'ผู้ใช้'

export const monthLabel = new Date().toLocaleDateString('th-TH', {
  month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
})

export const ROLE_LABEL = { student: 'นักเรียน', teacher: 'ครู', admin: 'ผู้ดูแลระบบ' }
export const roleLabel = (r) => ROLE_LABEL[r] ?? r ?? '-'
export const roleBadge = (r) =>
  r === 'admin' ? 'bg-dark text-white' : r === 'teacher' ? 'bg-orange text-dark' : 'bg-purple-light text-dark'

// คลาสที่ใช้ซ้ำ
export const card = 'bg-white border-3 border-dark rounded-2xl shadow-offset p-5'
const thBase = 'py-2 pr-3 text-gray font-mono text-[11.5px] uppercase font-normal'
export const th = thBase + ' text-left'
export const thRight = thBase + ' text-right'