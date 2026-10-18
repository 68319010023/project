<script setup>
// แท็บ "ภาพรวม": การ์ดสถิติ + กราฟรายวัน + โดนัทรายห้อง + งบ token + ผู้ใช้ล่าสุด
import { ref, computed, onMounted } from 'vue'
import {
  School, ClipboardList, GraduationCap, Presentation, ListChecks,
} from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import {
  MONTHLY_TOKEN_BUDGET, fmt, pctText, barWidth, barColor, fmtDate, fullName,
  monthLabel, roleLabel, roleBadge, card,
} from '../../lib/adminFormat.js'
import AiDailyChart from './AiDailyChart.vue'
import AiRoomDonut from './AiRoomDonut.vue'

const emit = defineEmits(['go-tab'])

const error = ref('')
const loading = ref(true)

const overview = ref(null)
const usage = ref([])
const daily = ref([])
const dailyFailed = ref(false)
const recentUsers = ref([])

async function loadOverview() {
  loading.value = true
  const [o, u, d, r] = await Promise.all([
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_ai_usage_by_classroom'),
    supabase.rpc('admin_ai_usage_daily'),
    supabase.rpc('admin_list_users', { p_limit: 5 }),
  ])
  loading.value = false

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

onMounted(loadOverview)

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
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>

    <p v-if="loading && !overview" class="text-center text-gray text-[13px] py-10">กำลังโหลด...</p>

    <template v-else-if="overview">
      <!-- การ์ดสถิติ -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div v-for="s in stats" :key="s.label" :class="card" class="!p-4 flex flex-col gap-3">
          <div class="w-9 h-9 shrink-0 rounded-xl border-2 border-dark flex items-center justify-center" :class="s.bg">
            <component :is="s.icon" :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="min-w-0">
            <p class="font-mali font-bold text-[28px] leading-none text-dark">{{ s.value }}</p>
            <p class="text-[13px] text-gray mt-1.5">{{ s.label }}</p>
          </div>
        </div>
      </div>

      <!-- แถวกราฟ: เส้นรายวัน + โดนัทแยกตามห้อง -->
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
        <AiDailyChart :daily="daily" :failed="dailyFailed" />
        <AiRoomDonut :usage="usage" @see-all="emit('go-tab', 'ai')" />
      </div>

      <!-- แถวล่าง: งบ token + ผู้ใช้ล่าสุด -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <!-- งบ token -->
        <section :class="card" class="flex flex-col gap-3">
          <h2 class="font-mali font-bold text-[16px] text-dark">งบ token เดือนนี้</h2>
          <p class="font-mali font-bold text-[30px] leading-none text-dark">{{ fmt(totalTokens) }}</p>
          <p class="text-[12.5px] text-gray -mt-1">
            จาก {{ fmt(MONTHLY_TOKEN_BUDGET) }} token ({{ monthLabel }})
          </p>

          <div class="h-3.5 border-3 border-dark rounded-full bg-white overflow-hidden">
            <div class="h-full transition-all duration-700" :class="barColor(totalTokens)"
              :style="{ width: barWidth(totalTokens) }"></div>
          </div>
          <p class="font-mono text-[12.5px] font-bold text-dark">ใช้ไป {{ pctText(totalTokens) }}%</p>

          <div class="border-t-2 border-dark/10 pt-3 text-[13px] text-gray flex flex-col gap-1.5">
            <p>เหลือ <span class="font-mono font-bold text-dark">{{ fmt(remainingTokens) }}</span> token</p>
            <p>เรียก AI <span class="font-mono font-bold text-dark">{{ fmt(overview.ai_calls_month) }}</span> ครั้ง</p>
            <p v-if="projected !== null">
              คาดการณ์สิ้นเดือน ~<span class="font-mono font-bold text-dark">{{ fmt(projected) }}</span> token
            </p>
          </div>
        </section>

        <!-- ผู้ใช้ล่าสุด -->
        <section :class="card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="font-mali font-bold text-[16px] text-dark">ผู้ใช้ล่าสุด</h2>
            <button type="button" @click="emit('go-tab', 'users')"
              class="text-[12.5px] font-semibold text-dark underline underline-offset-2 hover:no-underline">
              ดูทั้งหมด
            </button>
          </div>
          <p v-if="recentUsers.length === 0" class="text-center text-gray text-[13px] py-6">ยังไม่มีผู้ใช้</p>
          <ul v-else class="divide-y-2 divide-dark/10">
            <li v-for="u in recentUsers" :key="u.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-semibold text-dark truncate">{{ fullName(u) }}</p>
                <p class="text-[12px] text-gray truncate">{{ fmtDate(u.created_at) }}</p>
              </div>
              <span class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 text-[11.5px] font-bold"
                :class="roleBadge(u.role)">{{ roleLabel(u.role) }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>