<script setup>
// แท็บ "การใช้ AI": โครงสร้าง token / ฟีเจอร์ / ช่วงเวลา / โมเดล / ผู้ใช้ / รายห้อง
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'
import {
  fmt, pctText, pctLabel, barWidth, barColor, roleLabel, roleBadge, card, th, thRight,
} from '../../lib/adminFormat.js'

const error = ref('')
const loading = ref(true)
const usage = ref([])

const breakdown = ref(null)
const breakdownFailed = ref(false)

async function loadAll() {
  loading.value = true
  const [u, b] = await Promise.all([
    supabase.rpc('admin_ai_usage_by_classroom'),
    supabase.rpc('admin_ai_usage_breakdown'),
  ])
  loading.value = false

  if (u.error) {
    console.error('loadUsage error:', u.error)
    error.value = 'โหลดข้อมูลการใช้ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  } else {
    error.value = ''
    usage.value = u.data ?? []
  }

  // รายละเอียดล้มเหลวได้โดยไม่ขวางตารางรายห้อง (เช่น ยังไม่ได้รัน SQL)
  breakdownFailed.value = !!b.error
  if (b.error) {
    console.error('loadBreakdown error:', b.error)
    return
  }
  breakdown.value = b.data
}

onMounted(loadAll)

const topUsage = computed(() =>
  [...usage.value].sort((a, b) => Number(b.total_tokens) - Number(a.total_tokens))
)

// ชื่อฟีเจอร์ภาษาไทย: ปรับ key ให้ตรงกับค่า feature ที่บันทึกจริงใน ai_usage_log
const FEATURE_LABEL = {
  classroom_summary: 'สรุปภาพรวมห้อง',
  student_weakness: 'วิเคราะห์จุดอ่อน',
  tutor_chat: 'แชทติวเตอร์',
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
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>
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
            <div class="h-full bg-orange border-l-2 border-dark" :style="{ width: tokenSplit.outputPct + '%' }"></div>
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
              <div v-if="r.calls > 0" class="w-full border-2 border-b-0 border-dark rounded-t-md"
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
            <tr v-for="u in breakdown.by_user" :key="u.user_id ?? 'none'" class="border-t-2 border-dark/10">
              <td class="py-2.5 pr-3 font-semibold text-dark">{{ u.user_name ?? 'ผู้ใช้ที่ถูกลบ' }}</td>
              <td class="py-2.5 pr-3">
                <span v-if="u.role" class="border-2 border-dark rounded-lg px-2 py-0.5 text-[11.5px] font-bold"
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

    <!-- ตารางรายห้อง -->
    <section :class="card">
      <h2 class="font-mali font-bold text-[16px] text-dark mb-2">แยกตามห้องเรียน</h2>
      <p v-if="loading && usage.length === 0" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</p>
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
            <tr v-for="r in topUsage" :key="r.classroom_id ?? 'deleted'" class="border-t-2 border-dark/10">
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
                  <span class="font-mono text-[11.5px] w-[52px] text-right">{{ pctText(r.total_tokens) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>