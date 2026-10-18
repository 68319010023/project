<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    LayoutDashboard, Users, School, Sparkles, ScrollText, LogOut, Search, Trash2, ClipboardList,
    GraduationCap, Presentation, ListChecks, X
} from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import AppNavbar from '../../components/AppNavbar.vue'
import LogoutModal from '../../components/LogoutModal.vue'
import ConfirmModal from '../../components/admin/ConfirmModal.vue'

// งบ token ต่อเดือน (ปรับตัวเลขนี้ที่เดียว)
const MONTHLY_TOKEN_BUDGET = 1_000_000

const route = useRoute()
const router = useRouter()

// ============ หมวดใน sidebar (เก็บใน URL: ?tab=...) ============
const tabs = [
    { key: 'overview', label: 'ภาพรวม', icon: LayoutDashboard, desc: 'สรุปการใช้งานระบบและ AI เดือนนี้' },
    { key: 'users', label: 'ผู้ใช้', icon: Users, desc: 'ค้นหาและกรองผู้ใช้ตามบทบาท' },
    { key: 'rooms', label: 'ห้องเรียน', icon: School, desc: 'ดูและจัดการห้องเรียนทั้งหมด' },
    { key: 'ai', label: 'การใช้ AI', icon: Sparkles, desc: 'การใช้ AI แยกตามห้องเรียน เดือนนี้ (เวลาไทย)' },
    { key: 'audit', label: 'บันทึกการทำงาน', icon: ScrollText, desc: 'ประวัติการกระทำของแอดมิน' },
]
const activeTab = computed(() =>
    tabs.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview'
)
const activeMeta = computed(() => tabs.find((t) => t.key === activeTab.value))
function selectTab(key) {
    if (key !== activeTab.value) router.replace({ query: { ...route.query, tab: key } })
}

// ============ ตัวช่วยจัดรูปแบบ ============
const fmt = (n) => Number(n ?? 0).toLocaleString('th-TH')
const rawPct = (n) => (Number(n ?? 0) / MONTHLY_TOKEN_BUDGET) * 100
const pctText = (n) => rawPct(n).toFixed(2)
// ถ้ามีการใช้งาน ให้แถบกว้างอย่างน้อย 2% ไม่เช่นนั้น 0.47% จะมองไม่เห็นเลย
const barWidth = (n) => {
    const p = rawPct(n)
    return (p > 0 ? Math.min(100, Math.max(2, p)) : 0) + '%'
}
const barColor = (n) => {
    const p = rawPct(n)
    if (p >= 85) return 'bg-red-500'
    if (p >= 60) return 'bg-orange'
    return 'bg-purple'
}
const fmtDateTime = (ts) =>
    ts ? new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '-'
const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }) : '-'
const dayLabel = (s) =>
    new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const fullName = (u) => `${u?.name ?? ''} ${u?.lastname ?? ''}`.trim() || u?.email || 'ผู้ใช้'

const monthLabel = new Date().toLocaleDateString('th-TH', {
    month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
})

const ROLE_LABEL = { student: 'นักเรียน', teacher: 'ครู', admin: 'ผู้ดูแลระบบ' }
const roleLabel = (r) => ROLE_LABEL[r] ?? r ?? '-'
const roleBadge = (r) =>
    r === 'admin' ? 'bg-dark text-white' : r === 'teacher' ? 'bg-orange text-dark' : 'bg-purple-light text-dark'

// ============ สถานะข้อมูล ============
const error = ref('')
const actionError = ref('')

const overview = ref(null)
const usage = ref([])
const daily = ref([])
const dailyFailed = ref(false)
const recentUsers = ref([])
const loadingOverview = ref(true)

const users = ref([])
const search = ref('')
const roleFilter = ref('all')
const loadingUsers = ref(false)

const rooms = ref([])
const loadingRooms = ref(false)

const auditLog = ref([])
const loadingAudit = ref(false)

const breakdown = ref(null)
const breakdownFailed = ref(false)
const loadingBreakdown = ref(false)

async function loadOverview() {
    loadingOverview.value = true
    const [o, u, d, r] = await Promise.all([
        supabase.rpc('admin_overview'),
        supabase.rpc('admin_ai_usage_by_classroom'),
        supabase.rpc('admin_ai_usage_daily'),
        supabase.rpc('admin_list_users', { p_limit: 5 }),
    ])
    loadingOverview.value = false

    if (o.error || u.error) {
        console.error('loadOverview error:', o.error || u.error)
        error.value = 'โหลดข้อมูลภาพรวมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        return
    }
    error.value = ''
    overview.value = o.data
    usage.value = u.data ?? []

    // กราฟกับผู้ใช้ล่าสุดล้มเหลวได้โดยไม่ขวางส่วนอื่น (เช่น ยังไม่ได้รัน SQL ชุดใหม่)
    dailyFailed.value = !!d.error
    if (d.error) console.error('daily usage error:', d.error)
    if (r.error) console.error('recent users error:', r.error)
    daily.value = d.data ?? []
    recentUsers.value = r.data ?? []
}

let usersReq = 0
async function loadUsers() {
    const req = ++usersReq
    loadingUsers.value = true
    const { data, error: e } = await supabase.rpc('admin_list_users', {
        p_search: search.value.trim() || null,
        p_role: roleFilter.value === 'all' ? null : roleFilter.value,
    })
    if (req !== usersReq) return // มีคำค้นใหม่กว่าแล้ว ทิ้งผลเก่า
    loadingUsers.value = false
    if (e) {
        console.error('loadUsers error:', e)
        error.value = 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ กรุณาลองใหม่'
        return
    }
    error.value = ''
    users.value = data ?? []
}

async function loadRooms() {
    loadingRooms.value = true
    const { data, error: e } = await supabase.rpc('admin_list_classrooms')
    loadingRooms.value = false
    if (e) {
        console.error('loadRooms error:', e)
        error.value = 'โหลดรายชื่อห้องเรียนไม่สำเร็จ กรุณาลองใหม่'
        return
    }
    error.value = ''
    rooms.value = data ?? []
}

async function loadAudit() {
    loadingAudit.value = true
    const { data, error: e } = await supabase.rpc('admin_list_audit_log', { p_limit: 100 })
    loadingAudit.value = false
    if (e) {
        console.error('loadAudit error:', e)
        error.value = 'โหลดบันทึกการทำงานไม่สำเร็จ (ตรวจว่ารัน admin-upgrade.sql แล้ว)'
        return
    }
    error.value = ''
    auditLog.value = data ?? []
}
async function loadBreakdown() {
    loadingBreakdown.value = true
    const { data, error: e } = await supabase.rpc('admin_ai_usage_breakdown')
    loadingBreakdown.value = false
    breakdownFailed.value = !!e
    if (e) {
        console.error('loadBreakdown error:', e)
        return
    }
    breakdown.value = data
}
// โหลดข้อมูลของหมวดที่เปิด (ทุกครั้งที่สลับ เพื่อให้ข้อมูลสด)
watch(
    activeTab,
    (t) => {
        error.value = ''
        actionError.value = ''
        if (t === 'overview' || t === 'ai') loadOverview()
        if (t === 'ai') loadBreakdown()
        if (t === 'users') loadUsers()
        else if (t === 'rooms') loadRooms()
        else if (t === 'audit') loadAudit()
    },
    { immediate: true }
)

let timer
watch(search, () => {
    clearTimeout(timer)
    timer = setTimeout(loadUsers, 300)
})
watch(roleFilter, loadUsers)
onBeforeUnmount(() => clearTimeout(timer))

// ============ ภาพรวม: การ์ดสถิติ ============
const stats = computed(() => [
    { label: 'นักเรียน', value: fmt(overview.value?.students), icon: GraduationCap, bg: 'bg-purple-light' },
    { label: 'ครู', value: fmt(overview.value?.teachers), icon: Presentation, bg: 'bg-orange' },
    { label: 'ห้องเรียน', value: fmt(overview.value?.classrooms), icon: School, bg: 'bg-purple-light' },
    { label: 'งานที่มอบหมาย', value: fmt(overview.value?.assignments), icon: ClipboardList, bg: 'bg-orange' },
    { label: 'แบบทดสอบ', value: fmt(overview.value?.quizzes), icon: ListChecks, bg: 'bg-purple-light' },
])

const totalTokens = computed(() => Number(overview.value?.ai_tokens_month ?? 0))
const remainingTokens = computed(() => Math.max(0, MONTHLY_TOKEN_BUDGET - totalTokens.value))

// คาดการณ์สิ้นเดือนแบบเส้นตรง จากค่าเฉลี่ยต่อวันที่ผ่านมา (นับวันตามเวลาไทย)
const projected = computed(() => {
    if (!totalTokens.value) return null
    const [y, m, d] = new Date()
        .toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) // YYYY-MM-DD
        .split('-')
        .map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    return Math.round((totalTokens.value / d) * daysInMonth)
})

// ============ ภาพรวม: กราฟแท่งรายวัน ============
// ============ ภาพรวม: กราฟรายวัน (เส้น + พื้นที่) ============
const metrics = [
    { key: 'tokens', label: 'token' },
    { key: 'calls', label: 'จำนวนครั้ง' },
    { key: 'cumulative', label: 'token สะสม' },
]
const metric = ref('tokens')
const metricUnit = computed(() => (metric.value === 'calls' ? 'ครั้ง' : 'token'))

// ปัดแกนตั้งขึ้นเป็นเลขกลมๆ (1, 2, 5 x 10^n) เช่น 4,739 เป็น 5,000
function niceMax(v) {
    if (v <= 0) return 1
    const exp = 10 ** Math.floor(Math.log10(v))
    const f = v / exp
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

// ขนาดพื้นที่วาดกราฟ (หน่วย viewBox ของ SVG)
const CH = { w: 720, h: 280, l: 56, r: 16, t: 16, b: 30 }
const plot = { w: CH.w - CH.l - CH.r, h: CH.h - CH.t - CH.b }

const chart = computed(() => {
    let run = 0
    const rows = daily.value.map((d) => {
        const tokens = Number(d.tokens ?? 0)
        const calls = Number(d.calls ?? 0)
        run += tokens
        const value = metric.value === 'tokens' ? tokens : metric.value === 'calls' ? calls : run
        return {
            day: d.day,
            dayNum: Number(String(d.day).slice(8, 10)),
            tokens,
            calls,
            cumulative: run,
            value,
        }
    })

    const max = Math.max(0, ...rows.map((r) => r.value))
    // จำนวนครั้งต้องเป็นจำนวนเต็มทุกขีด จึงปัดให้หารด้วย 4 ลงตัว
    const top = metric.value === 'calls'
        ? Math.max(4, Math.ceil(niceMax(max) / 4) * 4)
        : niceMax(max)

    const n = rows.length
    const xAt = (i) => CH.l + (n <= 1 ? plot.w / 2 : (i * plot.w) / (n - 1))
    const yAt = (v) => CH.t + plot.h - (v / top) * plot.h
    const base = CH.t + plot.h

    const pts = rows.map((r, i) => ({ ...r, x: xAt(i), y: yAt(r.value) }))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = pts.length
        ? `${line} L${pts[n - 1].x.toFixed(1)} ${base} L${pts[0].x.toFixed(1)} ${base} Z`
        : ''
    const ticks = [0, 1, 2, 3, 4].map((k) => {
        const value = (top * k) / 4
        return { value, y: yAt(value) }
    })
    const band = n <= 1 ? plot.w : plot.w / (n - 1)

    return { rows: pts, max, top, line, area, ticks, base, band }
})

const chartSummary = computed(() => {
    const rows = chart.value.rows
    const byCalls = metric.value === 'calls'
    const totalTokens = rows.reduce((s, r) => s + r.tokens, 0)
    const totalCalls = rows.reduce((s, r) => s + r.calls, 0)
    const total = byCalls ? totalCalls : totalTokens
    const peak = rows.reduce((best, r) => {
        const v = byCalls ? r.calls : r.tokens
        const bv = best ? (byCalls ? best.calls : best.tokens) : -1
        return v > bv ? r : best
    }, null)

    return {
        total,
        avg: rows.length ? Math.round(total / rows.length) : 0,
        activeDays: rows.filter((r) => r.calls > 0 || r.tokens > 0).length,
        perCall: totalCalls ? Math.round(totalTokens / totalCalls) : 0,
        peak: peak && (byCalls ? peak.calls : peak.tokens) > 0 ? peak : null,
    }
})

// วันที่เลือกดูรายละเอียด (ค่าเริ่มต้น = วันล่าสุดที่มีการใช้งาน)
const pickedDay = ref(null)
const activeDay = computed(() => {
    const rows = chart.value.rows
    if (!rows.length) return null
    return (
        rows.find((r) => r.day === pickedDay.value) ??
        [...rows].reverse().find((r) => r.tokens > 0) ??
        rows[rows.length - 1]
    )
})
// แสดงเลขวันที่ใต้กราฟ: ถ้าเกิน 16 วัน แสดงเฉพาะวันคี่ (และวันที่เลือกอยู่)
const showDayLabel = (r) =>
    chart.value.rows.length <= 16 || r.dayNum % 2 === 1 || r.day === activeDay.value?.day


// ============ ภาพรวม: โดนัท สัดส่วน token แยกตามห้อง ============
const topUsage = computed(() =>
    [...usage.value].sort((a, b) => Number(b.total_tokens) - Number(a.total_tokens))
)

// ต้องเขียนชื่อคลาสให้ครบ (Tailwind ไม่รู้จักคลาสที่ประกอบจากสตริง)
const DONUT_COLORS = [
    { stroke: 'stroke-purple', bg: 'bg-purple' },
    { stroke: 'stroke-orange', bg: 'bg-orange' },
    { stroke: 'stroke-dark', bg: 'bg-dark' },
    { stroke: 'stroke-purple-light', bg: 'bg-purple-light' },
    { stroke: 'stroke-gray', bg: 'bg-gray' },
]

const donut = computed(() => {
    const rows = topUsage.value.filter((r) => Number(r.total_tokens) > 0)
    const total = rows.reduce((s, r) => s + Number(r.total_tokens), 0)
    if (!total) return { total: 0, segs: [] }

    const items = rows.slice(0, 4).map((r) => ({
        key: r.classroom_id ?? 'deleted',
        label: r.classroom_name ?? 'ห้องที่ถูกลบ',
        tokens: Number(r.total_tokens),
    }))
    const rest = rows.slice(4).reduce((s, r) => s + Number(r.total_tokens), 0)
    if (rest > 0) items.push({ key: 'others', label: `อื่นๆ (${rows.length - 4} ห้อง)`, tokens: rest })

    let acc = 0
    const segs = items.map((s, i) => {
        const pct = (s.tokens / total) * 100
        const seg = {
            ...s,
            pct,
            // เว้นช่องว่างเล็กๆ ระหว่างส่วน (ช่องว่างเป็นสีเข้มจากวงแหวนด้านล่าง)
            len: items.length > 1 ? Math.max(pct - 1, 0.2) : pct,
            offset: 25 - acc, // เริ่มที่ 12 นาฬิกา
            ...DONUT_COLORS[i],
        }
        acc += pct
        return seg
    })
    return { total, segs }
})
const pctLabel = (p) => (p < 1 ? '<1%' : Math.round(p) + '%')
// ============ การใช้ AI: รายละเอียด ============
// ชื่อฟีเจอร์ภาษาไทย: ปรับ key ให้ตรงกับค่า feature ที่บันทึกจริงใน ai_usage_log
const FEATURE_LABEL = {
    summarize_classroom: 'สรุปภาพรวมห้อง',
    'summarize-classroom': 'สรุปภาพรวมห้อง',
    class_summary: 'สรุปภาพรวมห้อง',
    weakness: 'วิเคราะห์จุดอ่อน',
    chat: 'แชทติวเตอร์',
    tutor: 'แชทติวเตอร์',
}
const featureLabel = (f) => FEATURE_LABEL[f] ?? f ?? 'ไม่ระบุ'

const featureRows = computed(() => {
    const rows = breakdown.value?.by_feature ?? []
    const total = rows.reduce((s, r) => s + Number(r.total_tokens), 0)
    return rows.map((r) => ({
        ...r,
        label: featureLabel(r.feature),
        pct: total ? (Number(r.total_tokens) / total) * 100 : 0,
        perCall: r.calls ? Math.round(Number(r.total_tokens) / r.calls) : 0,
    }))
})

const modelRows = computed(() => {
    const rows = breakdown.value?.by_model ?? []
    const total = rows.reduce((s, r) => s + Number(r.total_tokens), 0)
    return rows.map((r) => ({
        ...r,
        pct: total ? (Number(r.total_tokens) / total) * 100 : 0,
    }))
})

const tokenSplit = computed(() => {
    const rows = breakdown.value?.by_feature ?? []
    const prompt = rows.reduce((s, r) => s + Number(r.prompt_tokens), 0)
    const output = rows.reduce((s, r) => s + Number(r.output_tokens), 0)
    const total = prompt + output
    return {
        prompt,
        output,
        total,
        promptPct: total ? (prompt / total) * 100 : 0,
        outputPct: total ? (output / total) * 100 : 0,
    }
})

// ชั่วโมงในวัน (0-23 ตามเวลาไทย) เติมชั่วโมงที่ไม่มีข้อมูลให้เป็น 0
const hourRows = computed(() => {
    const map = new Map((breakdown.value?.by_hour ?? []).map((h) => [Number(h.hour), h]))
    const rows = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        calls: Number(map.get(h)?.calls ?? 0),
        tokens: Number(map.get(h)?.total_tokens ?? 0),
    }))
    const max = Math.max(1, ...rows.map((r) => r.calls))
    return rows.map((r) => ({ ...r, height: r.calls > 0 ? Math.max(6, (r.calls / max) * 100) : 0 }))
})
const peakHour = computed(() => {
    const best = hourRows.value.reduce((b, r) => (r.calls > (b?.calls ?? 0) ? r : b), null)
    return best && best.calls > 0 ? best : null
})
const hourText = (h) => `${String(h).padStart(2, '0')}:00`
// ============ ผู้ใช้ ============
const roleFilters = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'student', label: 'นักเรียน' },
    { key: 'teacher', label: 'ครู' },
    { key: 'admin', label: 'ผู้ดูแลระบบ' },
]

// ============ ยืนยันก่อนลบห้องเรียน ============
const dlg = ref({ open: false, room: null })
const confirming = ref(false)

const dlgOpen = computed({
    get: () => dlg.value.open,
    set: (v) => { if (!v) dlg.value.open = false },
})

function askDeleteRoom(r) {
    dlg.value = { open: true, room: r }
}

const dlgInfo = computed(() => ({
    title: 'ลบห้องเรียนนี้?',
    confirmText: 'ลบห้องเรียน',
    danger: true,
    message: `ห้อง "${dlg.value.room?.name ?? ''}" และข้อมูลทั้งหมดในห้องจะถูกลบถาวร ย้อนกลับไม่ได้`,
}))

async function runConfirm() {
    const room = dlg.value.room
    if (!room) return
    confirming.value = true
    actionError.value = ''
    try {
        const { error: e } = await supabase.rpc('admin_delete_classroom', { p_classroom_id: room.id })
        if (e) throw e
        await Promise.all([loadRooms(), loadOverview()])
    } catch (e) {
        console.error('delete classroom error:', e)
        actionError.value = e?.message || 'ลบห้องเรียนไม่สำเร็จ กรุณาลองใหม่'
    } finally {
        confirming.value = false
        dlg.value.open = false
    }
}

// ============ บันทึกการทำงาน ============
function auditText(a) {
    const d = a.detail ?? {}
    if (a.action === 'set_role') {
        return `เปลี่ยนบทบาท ${d.target_name || d.target_email || 'ผู้ใช้'} จาก ${roleLabel(d.from)} เป็น ${roleLabel(d.to)}`
    }
    if (a.action === 'delete_classroom') {
        return `ลบห้องเรียน "${d.name ?? '-'}"${d.grade_level ? ` (${d.grade_level})` : ''}`
    }
    return a.action
}

// ============ ออกจากระบบ ============
const showLogoutModal = ref(false)

// คลาสที่ใช้ซ้ำ
const card = 'bg-white border-3 border-dark rounded-2xl shadow-offset p-5'
const thBase = 'py-2 pr-3 text-gray font-mono text-[11.5px] uppercase font-normal'
const th = thBase + ' text-left'
const thRight = thBase + ' text-right'
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
        <AppNavbar :show-search="false" :breadcrumb="[{ label: 'ผู้ดูแลระบบ' }]" />

        <main
            class="w-full max-w-[1480px] mx-auto px-4 sm:px-6 xl:px-10 py-8 flex flex-col lg:flex-row gap-6 items-start">

            <!-- ============ Sidebar ============ -->
            <aside class="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-[114px]">
                <nav aria-label="เมนูผู้ดูแลระบบ"
                    class="bg-white border-3 border-dark rounded-2xl shadow-offset p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                    <button v-for="t in tabs" :key="t.key" type="button" @click="selectTab(t.key)"
                        :aria-current="activeTab === t.key ? 'page' : undefined"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-[13.5px] whitespace-nowrap text-left transition"
                        :class="activeTab === t.key ? 'bg-dark text-white' : 'text-dark hover:bg-dark/15'">
                        <component :is="t.icon" :size="16" :stroke-width="2.5" class="shrink-0" />
                        {{ t.label }}
                    </button>

                    <div class="hidden lg:block h-0.5 bg-dark/10 my-1 mx-2"></div>

                    <button type="button" @click="showLogoutModal = true"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-600 font-semibold text-[13.5px] whitespace-nowrap text-left hover:bg-red-200 transition">
                        <LogOut :size="16" :stroke-width="2.5" class="shrink-0" />
                        ออกจากระบบ
                    </button>
                </nav>
            </aside>

            <!-- ============ เนื้อหา ============ -->
            <div class="flex-1 min-w-0 w-full flex flex-col gap-5">
                <div>
                    <h1 class="font-mali font-bold text-2xl text-dark">{{ activeMeta.label }}</h1>
                    <p class="text-[13px] text-gray mt-1">{{ activeMeta.desc }}</p>
                </div>

                <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>
                <p v-if="actionError" role="alert"
                    class="text-[13px] text-red-600 border-2 border-red-600 rounded-xl bg-red-50 px-4 py-2.5">
                    {{ actionError }}
                </p>

                <!-- ===== ภาพรวม ===== -->
                <template v-if="activeTab === 'overview'">
                    <p v-if="loadingOverview && !overview" class="text-center text-gray text-[13px] py-10">
                        กำลังโหลด...
                    </p>

                    <template v-else-if="overview">
                        <!-- การ์ดสถิติ -->
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div v-for="s in stats" :key="s.label" :class="card" class="!p-4 flex flex-col gap-3">
                                <div class="w-9 h-9 shrink-0 rounded-xl border-2 border-dark flex items-center justify-center"
                                    :class="s.bg">
                                    <component :is="s.icon" :size="18" :stroke-width="2.5" class="text-dark" />
                                </div>
                                <div class="min-w-0">
                                    <p class="font-mali font-bold text-[28px] leading-none text-dark">{{ s.value }}</p>
                                    <p class="text-[13px] text-gray mt-1.5">{{ s.label }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- แถวกราฟ: แท่งรายวัน + โดนัทแยกตามห้อง -->
                        <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">

                            <!-- กราฟรายวัน (เส้น + พื้นที่) -->
                            <section :class="card" class="flex flex-col">
                                <div class="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 class="font-mali font-bold text-[16px] text-dark">การใช้ AI รายวัน</h2>
                                        <p class="text-[12.5px] text-gray mt-0.5">
                                            {{ monthLabel }} · ใช้งาน {{ chartSummary.activeDays }} จาก {{
                                                chart.rows.length }} วัน
                                        </p>
                                    </div>
                                    <div role="group" aria-label="เลือกข้อมูลที่แสดงในกราฟ"
                                        class="flex flex-wrap gap-2">
                                        <button v-for="m in metrics" :key="m.key" type="button" @click="metric = m.key"
                                            :aria-pressed="metric === m.key"
                                            class="px-3.5 py-1.5 rounded-lg border-2 border-dark text-[12.5px] font-bold transition"
                                            :class="metric === m.key ? 'bg-orange text-dark' : 'bg-white text-dark hover:bg-gray-light'">
                                            {{ m.label }}
                                        </button>
                                    </div>
                                </div>

                                <p v-if="dailyFailed"
                                    class="border-2 border-dashed border-dark/30 rounded-xl p-6 mt-4 text-center text-gray text-[13px]">
                                    โหลดกราฟไม่สำเร็จ (ตรวจว่ารัน admin-upgrade.sql แล้ว)
                                </p>

                                <p v-else-if="chart.max === 0"
                                    class="border-2 border-dashed border-dark/30 rounded-xl p-10 mt-4 text-center text-gray text-[13px]">
                                    เดือนนี้ยังไม่มีการใช้ AI
                                </p>

                                <template v-else>
                                    <!-- ตัวเลขสรุป -->
                                    <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                        <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                            <dt class="text-[12px] text-gray">รวมเดือนนี้</dt>
                                            <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                                {{ fmt(chartSummary.total) }}
                                                <span class="text-[12px] font-mitr font-normal text-gray">{{ metricUnit
                                                    }}</span>
                                            </dd>
                                        </div>
                                        <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                            <dt class="text-[12px] text-gray">เฉลี่ยต่อวัน</dt>
                                            <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                                {{ fmt(chartSummary.avg) }}
                                                <span class="text-[12px] font-mitr font-normal text-gray">{{ metricUnit
                                                    }}</span>
                                            </dd>
                                        </div>
                                        <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                            <dt class="text-[12px] text-gray">ใช้สูงสุด</dt>
                                            <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                                {{ chartSummary.peak ? dayLabel(chartSummary.peak.day) : '-' }}
                                            </dd>
                                        </div>
                                        <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                            <dt class="text-[12px] text-gray">เฉลี่ยต่อครั้ง</dt>
                                            <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                                {{ fmt(chartSummary.perCall) }}
                                                <span class="text-[12px] font-mitr font-normal text-gray">token</span>
                                            </dd>
                                        </div>
                                    </dl>

                                    <!-- กราฟเส้น + พื้นที่ -->
                                    <div class="mt-5 overflow-x-auto">
                                        <svg :viewBox="`0 0 ${CH.w} ${CH.h}`" class="w-full h-auto min-w-[560px]"
                                            role="img"
                                            :aria-label="`กราฟ${metrics.find((m) => m.key === metric).label}รายวัน ${monthLabel}`">

                                            <!-- เส้นกริด + ตัวเลขแกนตั้ง -->
                                            <g v-for="t in chart.ticks" :key="t.value">
                                                <line :x1="CH.l" :x2="CH.w - CH.r" :y1="t.y" :y2="t.y" stroke="#1a1a1a"
                                                    :stroke-opacity="t.value === 0 ? 1 : 0.15"
                                                    :stroke-width="t.value === 0 ? 2 : 1"
                                                    :stroke-dasharray="t.value === 0 ? undefined : '4 4'" />
                                                <text :x="CH.l - 8" :y="t.y + 4" text-anchor="end" font-size="11"
                                                    fill="#666666" font-family="monospace">{{ fmt(t.value) }}</text>
                                            </g>

                                            <!-- พื้นที่ใต้เส้น -->
                                            <path :d="chart.area" fill="#c4a7d6" fill-opacity="0.45" />

                                            <!-- เส้นนำสายตาของวันที่เลือก -->
                                            <line v-if="activeDay" :x1="activeDay.x" :x2="activeDay.x" :y1="CH.t"
                                                :y2="chart.base" stroke="#1a1a1a" stroke-width="1.5"
                                                stroke-dasharray="4 4" />

                                            <!-- เส้นกราฟ -->
                                            <path :d="chart.line" fill="none" stroke="#1a1a1a" stroke-width="3"
                                                stroke-linejoin="round" stroke-linecap="round" />

                                            <!-- จุดข้อมูล (เฉพาะวันที่มีการใช้ + วันที่เลือก) -->
                                            <template v-for="r in chart.rows" :key="r.day">
                                                <circle v-if="r.value > 0 || r.day === activeDay?.day" :cx="r.x"
                                                    :cy="r.y" :r="r.day === activeDay?.day ? 7 : 4.5"
                                                    :fill="r.day === activeDay?.day ? '#ff9800' : '#ffffff'"
                                                    stroke="#1a1a1a" stroke-width="2.5" />
                                            </template>

                                            <!-- เลขวันที่ -->
                                            <template v-for="r in chart.rows" :key="'l' + r.day">
                                                <text v-if="showDayLabel(r)" :x="r.x" :y="CH.h - 8" text-anchor="middle"
                                                    font-size="10.5" font-family="monospace"
                                                    :fill="r.day === activeDay?.day ? '#1a1a1a' : '#666666'"
                                                    :font-weight="r.day === activeDay?.day ? 700 : 400">{{ r.dayNum
                                                    }}</text>
                                            </template>

                                            <!-- พื้นที่รับเมาส์/แตะ ของแต่ละวัน (โปร่งใส) -->
                                            <rect v-for="r in chart.rows" :key="'h' + r.day" :x="r.x - chart.band / 2"
                                                :y="CH.t" :width="chart.band" :height="plot.h" fill="transparent"
                                                class="cursor-pointer focus:outline-none" tabindex="0" role="button"
                                                :aria-label="`${dayLabel(r.day)}: ${fmt(r.tokens)} token, ${fmt(r.calls)} ครั้ง`"
                                                @mouseenter="pickedDay = r.day" @focus="pickedDay = r.day"
                                                @click="pickedDay = r.day" />
                                        </svg>
                                    </div>

                                    <!-- รายละเอียดของวันที่เลือก -->
                                    <div v-if="activeDay" aria-live="polite"
                                        class="mt-3 px-3.5 py-2.5 rounded-xl border-2 border-dark bg-gray-light text-[13px] text-dark flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                                        <span class="font-semibold">{{ dayLabel(activeDay.day) }}</span>
                                        <span class="flex flex-wrap gap-x-4 gap-y-1">
                                            <span><span class="font-mono font-bold">{{ fmt(activeDay.tokens) }}</span>
                                                token</span>
                                            <span><span class="font-mono font-bold">{{ fmt(activeDay.calls) }}</span>
                                                ครั้ง</span>
                                            <span>
                                                เฉลี่ย
                                                <span class="font-mono font-bold">{{ activeDay.calls ?
                                                    fmt(Math.round(activeDay.tokens / activeDay.calls)) :
                                                    '-' }}</span>
                                                token/ครั้ง
                                            </span>
                                            <span>
                                                สะสม <span class="font-mono font-bold">{{ fmt(activeDay.cumulative)
                                                    }}</span>
                                                ({{ pctText(activeDay.cumulative) }}% ของงบ)
                                            </span>
                                        </span>
                                    </div>
                                    <p class="text-[12px] text-gray mt-2">แตะหรือเลื่อนเมาส์บนกราฟเพื่อดูรายวัน</p>
                                </template>
                            </section>

                            <!-- โดนัท สัดส่วน token แยกตามห้อง -->
                            <section :class="card" class="flex flex-col">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 class="font-mali font-bold text-[16px] text-dark">สัดส่วนการใช้ AI รายห้อง
                                        </h2>
                                        <p class="text-[12.5px] text-gray mt-0.5">เทียบ token ทั้งเดือน</p>
                                    </div>
                                    <button type="button" @click="selectTab('ai')"
                                        class="shrink-0 text-[12.5px] font-semibold text-dark underline underline-offset-2 hover:no-underline">
                                        ดูทั้งหมด
                                    </button>
                                </div>

                                <p v-if="donut.segs.length === 0"
                                    class="border-2 border-dashed border-dark/30 rounded-xl p-10 mt-4 text-center text-gray text-[13px]">
                                    เดือนนี้ยังไม่มีการใช้ AI
                                </p>

                                <template v-else>
                                    <div class="relative w-[210px] h-[210px] mx-auto mt-5">
                                        <svg viewBox="0 0 42 42" class="w-full h-full" role="img"
                                            :aria-label="`สัดส่วน token รายห้อง: ${donut.segs.map((s) => `${s.label} ${pctLabel(s.pct)}`).join(', ')}`">
                                            <!-- วงแหวนพื้น (สีเข้ม) ทำให้เกิดช่องว่างคั่นระหว่างส่วน -->
                                            <circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="7"
                                                class="stroke-dark" />
                                            <circle v-for="s in donut.segs" :key="s.key" cx="21" cy="21" r="15.9155"
                                                fill="none" stroke-width="7" :class="s.stroke"
                                                :stroke-dasharray="`${s.len} ${100 - s.len}`"
                                                :stroke-dashoffset="s.offset" />
                                            <!-- เส้นขอบนอก/ใน -->
                                            <circle cx="21" cy="21" r="19.4155" fill="none" stroke-width="0.7"
                                                class="stroke-dark" />
                                            <circle cx="21" cy="21" r="12.4155" fill="none" stroke-width="0.7"
                                                class="stroke-dark" />
                                        </svg>
                                        <div
                                            class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span class="font-mali font-bold text-[22px] leading-none text-dark">
                                                {{ fmt(donut.total) }}
                                            </span>
                                            <span class="text-[12px] text-gray mt-1">token รวม</span>
                                        </div>
                                    </div>

                                    <ul class="mt-5 flex flex-col gap-2.5">
                                        <li v-for="s in donut.segs" :key="s.key" class="flex items-center gap-2.5">
                                            <span class="w-3.5 h-3.5 shrink-0 rounded-md border-2 border-dark"
                                                :class="s.bg"></span>
                                            <span
                                                class="flex-1 min-w-0 text-[13.5px] font-semibold text-dark truncate">{{
                                                    s.label }}</span>
                                            <span class="font-mono text-[12.5px] text-gray shrink-0">{{ fmt(s.tokens)
                                                }}</span>
                                            <span
                                                class="font-mono text-[12.5px] font-bold text-dark w-[42px] text-right shrink-0">
                                                {{ pctLabel(s.pct) }}
                                            </span>
                                        </li>
                                    </ul>
                                </template>
                            </section>
                        </div>

                        <!-- แถวล่าง: งบ token + ผู้ใช้ล่าสุด -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                            <!-- งบ token -->
                            <section :class="card" class="flex flex-col gap-3">
                                <h2 class="font-mali font-bold text-[16px] text-dark">งบ token เดือนนี้</h2>
                                <p class="font-mali font-bold text-[30px] leading-none text-dark">{{ fmt(totalTokens) }}
                                </p>
                                <p class="text-[12.5px] text-gray -mt-1">
                                    จาก {{ fmt(MONTHLY_TOKEN_BUDGET) }} token ({{ monthLabel }})
                                </p>

                                <div class="h-3.5 border-3 border-dark rounded-full bg-white overflow-hidden">
                                    <div class="h-full transition-all duration-700" :class="barColor(totalTokens)"
                                        :style="{ width: barWidth(totalTokens) }"></div>
                                </div>
                                <p class="font-mono text-[12.5px] font-bold text-dark">ใช้ไป {{ pctText(totalTokens) }}%
                                </p>

                                <div class="border-t-2 border-dark/10 pt-3 text-[13px] text-gray flex flex-col gap-1.5">
                                    <p>เหลือ <span class="font-mono font-bold text-dark">{{ fmt(remainingTokens)
                                            }}</span> token</p>
                                    <p>เรียก AI <span class="font-mono font-bold text-dark">{{
                                        fmt(overview.ai_calls_month) }}</span> ครั้ง</p>
                                    <p v-if="projected !== null">
                                        คาดการณ์สิ้นเดือน ~<span class="font-mono font-bold text-dark">{{ fmt(projected)
                                            }}</span> token
                                    </p>
                                </div>
                            </section>

                            <!-- ผู้ใช้ล่าสุด -->
                            <section :class="card">
                                <div class="flex items-center justify-between mb-2">
                                    <h2 class="font-mali font-bold text-[16px] text-dark">ผู้ใช้ล่าสุด</h2>
                                    <button type="button" @click="selectTab('users')"
                                        class="text-[12.5px] font-semibold text-dark underline underline-offset-2 hover:no-underline">
                                        ดูทั้งหมด
                                    </button>
                                </div>
                                <p v-if="recentUsers.length === 0" class="text-center text-gray text-[13px] py-6">
                                    ยังไม่มีผู้ใช้
                                </p>
                                <ul v-else class="divide-y-2 divide-dark/10">
                                    <li v-for="u in recentUsers" :key="u.id" class="flex items-center gap-3 py-2.5">
                                        <div class="min-w-0 flex-1">
                                            <p class="text-[13.5px] font-semibold text-dark truncate">{{ fullName(u) }}
                                            </p>
                                            <p class="text-[12px] text-gray truncate">{{ fmtDate(u.created_at) }}</p>
                                        </div>
                                        <span
                                            class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 text-[11.5px] font-bold"
                                            :class="roleBadge(u.role)">{{ roleLabel(u.role) }}</span>
                                    </li>
                                </ul>
                            </section>
                        </div>
                    </template>
                </template>

                <!-- ===== ผู้ใช้ ===== -->
                <section v-else-if="activeTab === 'users'" :class="card" class="flex flex-col gap-4">
                    <div class="flex flex-wrap items-center gap-3 justify-between">
                        <div class="flex gap-2 flex-wrap">
                            <button v-for="f in roleFilters" :key="f.key" type="button" @click="roleFilter = f.key"
                                :aria-pressed="roleFilter === f.key"
                                class="px-3.5 py-1.5 rounded-lg border-2 border-dark text-[12.5px] font-bold transition"
                                :class="roleFilter === f.key ? 'bg-orange text-dark' : 'bg-white text-dark hover:bg-gray-light'">
                                {{ f.label }}
                            </button>
                        </div>

                        <div class="relative w-full sm:w-[240px]">
                            <Search :size="15" :stroke-width="2.5"
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
                            <input v-model="search" type="text" placeholder="ค้นหาชื่อ / อีเมล..."
                                aria-label="ค้นหาผู้ใช้"
                                class="w-full pl-9 pr-8 py-2 rounded-lg border-2 border-dark bg-white text-[13px] text-dark placeholder:text-gray outline-none focus:bg-gray-light transition" />
                            <button v-if="search" type="button" @click="search = ''" aria-label="ล้างคำค้นหา"
                                class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-orange transition">
                                <X :size="12" :stroke-width="3" />
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-[13px]">
                            <thead>
                                <tr>
                                    <th scope="col" :class="th">ชื่อ</th>
                                    <th scope="col" :class="th">อีเมล</th>
                                    <th scope="col" :class="th">สมัครเมื่อ</th>
                                    <th scope="col" :class="th">บทบาท</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="u in users" :key="u.id" class="border-t-2 border-dark/10">
                                    <td class="py-2.5 pr-3 font-semibold text-dark">{{ fullName(u) }}</td>
                                    <td class="py-2.5 pr-3 text-gray">{{ u.email }}</td>
                                    <td class="py-2.5 pr-3 text-gray whitespace-nowrap">{{ fmtDate(u.created_at) }}</td>
                                    <td class="py-2.5">
                                        <span class="border-2 border-dark rounded-lg px-2 py-1 text-[11.5px] font-bold"
                                            :class="roleBadge(u.role)">
                                            {{ roleLabel(u.role) }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p v-if="loadingUsers && users.length === 0" class="text-center text-gray text-[13px] py-6">
                            กำลังโหลด...
                        </p>
                        <p v-else-if="!loadingUsers && users.length === 0"
                            class="text-center text-gray text-[13px] py-6">ไม่พบผู้ใช้
                        </p>
                    </div>
                    <p v-if="users.length" class="text-[12px] text-gray">แสดง {{ fmt(users.length) }} รายการ</p>
                </section>

                <!-- ===== ห้องเรียน ===== -->
                <section v-else-if="activeTab === 'rooms'" :class="card" class="overflow-x-auto">
                    <table class="w-full text-[13px]">
                        <thead>
                            <tr>
                                <th scope="col" :class="th">ห้องเรียน</th>
                                <th scope="col" :class="th">ระดับชั้น</th>
                                <th scope="col" :class="th">ครู</th>
                                <th scope="col" :class="thRight">สมาชิก</th>
                                <th scope="col" class="py-2"><span class="sr-only">จัดการ</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in rooms" :key="r.id" class="border-t-2 border-dark/10">
                                <td class="py-2.5 pr-3 font-semibold text-dark">{{ r.name }}</td>
                                <td class="py-2.5 pr-3 text-gray">{{ r.grade_level ?? '-' }}</td>
                                <td class="py-2.5 pr-3 text-gray">{{ r.teacher_name ?? '-' }}</td>
                                <td class="py-2.5 pr-3 text-right font-mono">{{ fmt(r.member_count) }}</td>
                                <td class="py-2.5 text-right">
                                    <button type="button" @click="askDeleteRoom(r)" :aria-label="`ลบห้อง ${r.name}`"
                                        class="w-8 h-8 inline-flex items-center justify-center rounded-lg border-2 border-dark text-red-600 hover:bg-red-100 transition">
                                        <Trash2 :size="14" :stroke-width="2.5" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-if="loadingRooms && rooms.length === 0" class="text-center text-gray text-[13px] py-6">
                        กำลังโหลด...
                    </p>
                    <p v-else-if="!loadingRooms && rooms.length === 0" class="text-center text-gray text-[13px] py-6">
                        ยังไม่มีห้องเรียน
                    </p>
                </section>

                                <!-- ===== การใช้ AI ===== -->
                <template v-else-if="activeTab === 'ai'">
                    <p v-if="breakdownFailed" role="alert" class="text-[13px] text-red-600">
                        โหลดรายละเอียดไม่สำเร็จ (ตรวจว่ารัน admin-ai-breakdown.sql แล้ว)
                    </p>

                    <template v-if="breakdown && tokenSplit.total > 0">
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">

                            <!-- โครงสร้าง token -->
                            <section :class="card" class="flex flex-col gap-4">
                                <div>
                                    <h2 class="font-mali font-bold text-[16px] text-dark">โครงสร้าง token</h2>
                                    <p class="text-[12.5px] text-gray mt-0.5">
                                        ข้อมูลที่ส่งให้ AI (prompt) เทียบกับคำตอบที่ได้ (output)
                                    </p>
                                </div>

                                <div class="h-5 border-3 border-dark rounded-full overflow-hidden flex bg-white">
                                    <div class="h-full bg-purple" :style="{ width: tokenSplit.promptPct + '%' }"></div>
                                    <div class="h-full bg-orange border-l-2 border-dark"
                                        :style="{ width: tokenSplit.outputPct + '%' }"></div>
                                </div>

                                <dl class="grid grid-cols-2 gap-3">
                                    <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                        <dt class="flex items-center gap-2 text-[12px] text-gray">
                                            <span class="w-3 h-3 rounded-md border-2 border-dark bg-purple"></span>
                                            prompt
                                        </dt>
                                        <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                            {{ fmt(tokenSplit.prompt) }}
                                            <span class="text-[12px] font-mitr font-normal text-gray">({{ pctLabel(tokenSplit.promptPct) }})</span>
                                        </dd>
                                    </div>
                                    <div class="rounded-xl border-2 border-dark px-3 py-2.5">
                                        <dt class="flex items-center gap-2 text-[12px] text-gray">
                                            <span class="w-3 h-3 rounded-md border-2 border-dark bg-orange"></span>
                                            output
                                        </dt>
                                        <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
                                            {{ fmt(tokenSplit.output) }}
                                            <span class="text-[12px] font-mitr font-normal text-gray">({{ pctLabel(tokenSplit.outputPct) }})</span>
                                        </dd>
                                    </div>
                                </dl>
                            </section>

                            <!-- แยกตามฟีเจอร์ -->
                            <section :class="card" class="flex flex-col gap-4">
                                <div>
                                    <h2 class="font-mali font-bold text-[16px] text-dark">แยกตามฟีเจอร์</h2>
                                    <p class="text-[12.5px] text-gray mt-0.5">เดือนนี้ใช้ AI กับงานอะไรมากที่สุด</p>
                                </div>

                                <ul class="flex flex-col gap-3.5">
                                    <li v-for="f in featureRows" :key="f.feature">
                                        <div class="flex items-center justify-between gap-3 text-[13.5px]">
                                            <span class="font-semibold text-dark truncate">{{ f.label }}</span>
                                            <span class="font-mono text-[12.5px] font-bold text-dark shrink-0">{{ pctLabel(f.pct) }}</span>
                                        </div>
                                        <div class="h-2.5 border-2 border-dark rounded-full bg-white overflow-hidden mt-1.5">
                                            <div class="h-full bg-purple" :style="{ width: Math.max(2, f.pct) + '%' }"></div>
                                        </div>
                                        <p class="text-[12px] text-gray mt-1">
                                            {{ fmt(f.calls) }} ครั้ง · {{ fmt(f.total_tokens) }} token · เฉลี่ย {{ fmt(f.perCall) }} token/ครั้ง
                                        </p>
                                    </li>
                                </ul>
                            </section>
                        </div>

                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">

                            <!-- ช่วงเวลาที่ใช้ -->
                            <section :class="card" class="flex flex-col gap-3">
                                <div>
                                    <h2 class="font-mali font-bold text-[16px] text-dark">ช่วงเวลาที่ใช้งาน</h2>
                                    <p class="text-[12.5px] text-gray mt-0.5">
                                        จำนวนครั้งต่อชั่วโมง (เวลาไทย)
                                        <template v-if="peakHour"> · ช่วงที่ใช้มากสุด {{ hourText(peakHour.hour) }} ({{ fmt(peakHour.calls) }} ครั้ง)</template>
                                    </p>
                                </div>

                                <div class="flex items-end gap-[3px] h-[150px] border-b-2 border-dark">
                                    <div v-for="r in hourRows" :key="r.hour" class="flex-1 h-full flex items-end"
                                        :title="`${hourText(r.hour)}: ${fmt(r.calls)} ครั้ง, ${fmt(r.tokens)} token`">
                                        <div v-if="r.calls > 0"
                                            class="w-full border-2 border-b-0 border-dark rounded-t-md"
                                            :class="peakHour && r.hour === peakHour.hour ? 'bg-orange' : 'bg-purple'"
                                            :style="{ height: r.height + '%' }"></div>
                                    </div>
                                </div>
                                <div class="flex justify-between text-[11px] font-mono text-gray">
                                    <span v-for="h in [0, 3, 6, 9, 12, 15, 18, 21]" :key="h">{{ hourText(h) }}</span>
                                </div>
                            </section>

                            <!-- แยกตามโมเดล -->
                            <section :class="card" class="flex flex-col gap-4">
                                <div>
                                    <h2 class="font-mali font-bold text-[16px] text-dark">แยกตามโมเดล</h2>
                                    <p class="text-[12.5px] text-gray mt-0.5">
                                        ถ้ารุ่นสำรองถูกใช้บ่อย แสดงว่ารุ่นหลักมีปัญหาตอบช้าหรือไม่ว่าง
                                    </p>
                                </div>

                                <ul class="flex flex-col gap-3.5">
                                    <li v-for="m in modelRows" :key="m.model">
                                        <div class="flex items-center justify-between gap-3">
                                            <span class="font-mono text-[13px] font-bold text-dark truncate">{{ m.model }}</span>
                                            <span class="font-mono text-[12.5px] font-bold text-dark shrink-0">{{ pctLabel(m.pct) }}</span>
                                        </div>
                                        <div class="h-2.5 border-2 border-dark rounded-full bg-white overflow-hidden mt-1.5">
                                            <div class="h-full bg-orange" :style="{ width: Math.max(2, m.pct) + '%' }"></div>
                                        </div>
                                        <p class="text-[12px] text-gray mt-1">
                                            {{ fmt(m.calls) }} ครั้ง · {{ fmt(m.total_tokens) }} token
                                        </p>
                                    </li>
                                </ul>
                            </section>
                        </div>

                        <!-- ผู้ใช้ที่ใช้มากสุด -->
                        <section :class="card" class="overflow-x-auto">
                            <h2 class="font-mali font-bold text-[16px] text-dark mb-2">ผู้ใช้ที่ใช้ AI มากที่สุด</h2>
                            <table class="w-full text-[13px]">
                                <thead>
                                    <tr>
                                        <th scope="col" :class="th">ผู้ใช้</th>
                                        <th scope="col" :class="th">บทบาท</th>
                                        <th scope="col" :class="thRight">ครั้ง</th>
                                        <th scope="col" :class="thRight">token</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="u in breakdown.by_user" :key="u.user_id ?? 'none'"
                                        class="border-t-2 border-dark/10">
                                        <td class="py-2.5 pr-3 font-semibold text-dark">{{ u.user_name ?? 'ผู้ใช้ที่ถูกลบ' }}</td>
                                        <td class="py-2.5 pr-3">
                                            <span v-if="u.role"
                                                class="border-2 border-dark rounded-lg px-2 py-0.5 text-[11.5px] font-bold"
                                                :class="roleBadge(u.role)">{{ roleLabel(u.role) }}</span>
                                            <span v-else class="text-gray">-</span>
                                        </td>
                                        <td class="py-2.5 pr-3 text-right font-mono">{{ fmt(u.calls) }}</td>
                                        <td class="py-2.5 text-right font-mono">{{ fmt(u.total_tokens) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>
                    </template>

                    <!-- ตารางรายห้อง (เดิม) -->
                    <section :class="card">
                        <h2 class="font-mali font-bold text-[16px] text-dark mb-2">แยกตามห้องเรียน</h2>
                        <p v-if="loadingOverview && usage.length === 0" class="text-center text-gray text-[13px] py-6">
                            กำลังโหลด...
                        </p>
                        <p v-else-if="topUsage.length === 0"
                            class="border-2 border-dashed border-dark/30 rounded-xl p-6 text-center text-gray text-[13px]">
                            เดือนนี้ยังไม่มีการเรียกใช้ AI
                        </p>
                        <div v-else class="overflow-x-auto">
                            <table class="w-full text-[13px]">
                                <thead>
                                    <tr>
                                        <th scope="col" :class="th">ห้องเรียน</th>
                                        <th scope="col" :class="th">ครู</th>
                                        <th scope="col" :class="thRight">ครั้ง</th>
                                        <th scope="col" :class="thRight">token</th>
                                        <th scope="col" :class="th" class="w-[190px]">% ของงบ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="r in topUsage" :key="r.classroom_id ?? 'deleted'"
                                        class="border-t-2 border-dark/10">
                                        <td class="py-2.5 pr-3 font-semibold text-dark">{{ r.classroom_name ?? 'ห้องที่ถูกลบ' }}</td>
                                        <td class="py-2.5 pr-3 text-gray">{{ r.teacher_name ?? '-' }}</td>
                                        <td class="py-2.5 pr-3 text-right font-mono">{{ fmt(r.calls) }}</td>
                                        <td class="py-2.5 pr-3 text-right font-mono">{{ fmt(r.total_tokens) }}</td>
                                        <td class="py-2.5">
                                            <div class="flex items-center gap-2">
                                                <div class="flex-1 h-2.5 border-2 border-dark rounded-full bg-white overflow-hidden">
                                                    <div class="h-full" :class="barColor(r.total_tokens)"
                                                        :style="{ width: barWidth(r.total_tokens) }"></div>
                                                </div>
                                                <span class="font-mono text-[11.5px] w-[52px] text-right">
                                                    {{ pctText(r.total_tokens) }}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </template>
                <!-- ===== บันทึกการทำงาน ===== -->
                <section v-else-if="activeTab === 'audit'" :class="card">
                    <p v-if="loadingAudit && auditLog.length === 0" class="text-center text-gray text-[13px] py-6">
                        กำลังโหลด...
                    </p>
                    <p v-else-if="auditLog.length === 0"
                        class="border-2 border-dashed border-dark/30 rounded-xl p-6 text-center text-gray text-[13px]">
                        ยังไม่มีบันทึกการทำงาน
                    </p>
                    <ul v-else class="divide-y-2 divide-dark/10">
                        <li v-for="a in auditLog" :key="a.id" class="py-3 flex flex-col gap-0.5">
                            <p class="text-[13.5px] font-semibold text-dark">{{ auditText(a) }}</p>
                            <p class="text-[12px] text-gray">
                                โดย {{ a.admin_name || 'ผู้ดูแลระบบ' }} · {{ fmtDateTime(a.created_at) }}
                            </p>
                        </li>
                    </ul>
                </section>
            </div>
        </main>

        <ConfirmModal v-model="dlgOpen" :title="dlgInfo.title" :confirm-text="dlgInfo.confirmText"
            :danger="dlgInfo.danger" :loading="confirming" @confirm="runConfirm">
            {{ dlgInfo.message }}
        </ConfirmModal>

        <LogoutModal v-model="showLogoutModal" />
    </div>
</template>