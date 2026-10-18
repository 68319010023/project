<script setup>
// กราฟรายวัน (เส้น + พื้นที่) ของการใช้ AI
import { ref, computed } from 'vue'
import { fmt, pctText, dayLabel, monthLabel, card } from '../../lib/adminFormat.js'

const props = defineProps({
  daily: { type: Array, default: () => [] },
  failed: { type: Boolean, default: false },
})

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
  const rows = props.daily.map((d) => {
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
</script>

<template>
  <section :class="card" class="flex flex-col">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-mali font-bold text-[16px] text-dark">การใช้ AI รายวัน</h2>
        <p class="text-[12.5px] text-gray mt-0.5">
          {{ monthLabel }} · ใช้งาน {{ chartSummary.activeDays }} จาก {{ chart.rows.length }} วัน
        </p>
      </div>
      <div role="group" aria-label="เลือกข้อมูลที่แสดงในกราฟ" class="flex flex-wrap gap-2">
        <button v-for="m in metrics" :key="m.key" type="button" @click="metric = m.key"
          :aria-pressed="metric === m.key"
          class="px-3.5 py-1.5 rounded-lg border-2 border-dark text-[12.5px] font-bold transition"
          :class="metric === m.key ? 'bg-orange text-dark' : 'bg-white text-dark hover:bg-gray-light'">
          {{ m.label }}
        </button>
      </div>
    </div>

    <p v-if="failed"
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
            <span class="text-[12px] font-mitr font-normal text-gray">{{ metricUnit }}</span>
          </dd>
        </div>
        <div class="rounded-xl border-2 border-dark px-3 py-2.5">
          <dt class="text-[12px] text-gray">เฉลี่ยต่อวัน</dt>
          <dd class="font-mali font-bold text-[18px] text-dark leading-tight">
            {{ fmt(chartSummary.avg) }}
            <span class="text-[12px] font-mitr font-normal text-gray">{{ metricUnit }}</span>
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
        <svg :viewBox="`0 0 ${CH.w} ${CH.h}`" class="w-full h-auto min-w-[560px]" role="img"
          :aria-label="`กราฟ${metrics.find((m) => m.key === metric).label}รายวัน ${monthLabel}`">

          <!-- เส้นกริด + ตัวเลขแกนตั้ง -->
          <g v-for="t in chart.ticks" :key="t.value">
            <line :x1="CH.l" :x2="CH.w - CH.r" :y1="t.y" :y2="t.y" stroke="#1a1a1a"
              :stroke-opacity="t.value === 0 ? 1 : 0.15" :stroke-width="t.value === 0 ? 2 : 1"
              :stroke-dasharray="t.value === 0 ? undefined : '4 4'" />
            <text :x="CH.l - 8" :y="t.y + 4" text-anchor="end" font-size="11" fill="#666666"
              font-family="monospace">{{ fmt(t.value) }}</text>
          </g>

          <!-- พื้นที่ใต้เส้น -->
          <path :d="chart.area" fill="#c4a7d6" fill-opacity="0.45" />

          <!-- เส้นนำสายตาของวันที่เลือก -->
          <line v-if="activeDay" :x1="activeDay.x" :x2="activeDay.x" :y1="CH.t" :y2="chart.base" stroke="#1a1a1a"
            stroke-width="1.5" stroke-dasharray="4 4" />

          <!-- เส้นกราฟ -->
          <path :d="chart.line" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linejoin="round"
            stroke-linecap="round" />

          <!-- จุดข้อมูล (เฉพาะวันที่มีการใช้ + วันที่เลือก) -->
          <template v-for="r in chart.rows" :key="r.day">
            <circle v-if="r.value > 0 || r.day === activeDay?.day" :cx="r.x" :cy="r.y"
              :r="r.day === activeDay?.day ? 7 : 4.5" :fill="r.day === activeDay?.day ? '#ff9800' : '#ffffff'"
              stroke="#1a1a1a" stroke-width="2.5" />
          </template>

          <!-- เลขวันที่ -->
          <template v-for="r in chart.rows" :key="'l' + r.day">
            <text v-if="showDayLabel(r)" :x="r.x" :y="CH.h - 8" text-anchor="middle" font-size="10.5"
              font-family="monospace" :fill="r.day === activeDay?.day ? '#1a1a1a' : '#666666'"
              :font-weight="r.day === activeDay?.day ? 700 : 400">{{ r.dayNum }}</text>
          </template>

          <!-- พื้นที่รับเมาส์/แตะ ของแต่ละวัน (โปร่งใส) -->
          <rect v-for="r in chart.rows" :key="'h' + r.day" :x="r.x - chart.band / 2" :y="CH.t" :width="chart.band"
            :height="plot.h" fill="transparent" class="cursor-pointer focus:outline-none" tabindex="0" role="button"
            :aria-label="`${dayLabel(r.day)}: ${fmt(r.tokens)} token, ${fmt(r.calls)} ครั้ง`"
            @mouseenter="pickedDay = r.day" @focus="pickedDay = r.day" @click="pickedDay = r.day" />
        </svg>
      </div>

      <!-- รายละเอียดของวันที่เลือก -->
      <div v-if="activeDay" aria-live="polite"
        class="mt-3 px-3.5 py-2.5 rounded-xl border-2 border-dark bg-gray-light text-[13px] text-dark flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <span class="font-semibold">{{ dayLabel(activeDay.day) }}</span>
        <span class="flex flex-wrap gap-x-4 gap-y-1">
          <span><span class="font-mono font-bold">{{ fmt(activeDay.tokens) }}</span> token</span>
          <span><span class="font-mono font-bold">{{ fmt(activeDay.calls) }}</span> ครั้ง</span>
          <span>
            เฉลี่ย
            <span class="font-mono font-bold">{{ activeDay.calls ? fmt(Math.round(activeDay.tokens / activeDay.calls)) : '-' }}</span>
            token/ครั้ง
          </span>
          <span>
            สะสม <span class="font-mono font-bold">{{ fmt(activeDay.cumulative) }}</span>
            ({{ pctText(activeDay.cumulative) }}% ของงบ)
          </span>
        </span>
      </div>
      <p class="text-[12px] text-gray mt-2">แตะหรือเลื่อนเมาส์บนกราฟเพื่อดูรายวัน</p>
    </template>
  </section>
</template>