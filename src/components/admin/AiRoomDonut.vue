<script setup>
// โดนัท: สัดส่วน token แยกตามห้อง
import { computed } from 'vue'
import { fmt, pctLabel, card } from '../../lib/adminFormat.js'

const props = defineProps({
  usage: { type: Array, default: () => [] },
})

const emit = defineEmits(['see-all'])

const topUsage = computed(() =>
  [...props.usage].sort((a, b) => Number(b.total_tokens) - Number(a.total_tokens))
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
</script>

<template>
  <section :class="card" class="flex flex-col">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="font-mali font-bold text-[16px] text-dark">สัดส่วนการใช้ AI รายห้อง</h2>
        <p class="text-[12.5px] text-gray mt-0.5">เทียบ token ทั้งเดือน</p>
      </div>
      <button type="button" @click="emit('see-all')"
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
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="7" class="stroke-dark" />
          <circle v-for="s in donut.segs" :key="s.key" cx="21" cy="21" r="15.9155" fill="none" stroke-width="7"
            :class="s.stroke" :stroke-dasharray="`${s.len} ${100 - s.len}`" :stroke-dashoffset="s.offset" />
          <!-- เส้นขอบนอก/ใน -->
          <circle cx="21" cy="21" r="19.4155" fill="none" stroke-width="0.7" class="stroke-dark" />
          <circle cx="21" cy="21" r="12.4155" fill="none" stroke-width="0.7" class="stroke-dark" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="font-mali font-bold text-[22px] leading-none text-dark">{{ fmt(donut.total) }}</span>
          <span class="text-[12px] text-gray mt-1">token รวม</span>
        </div>
      </div>

      <ul class="mt-5 flex flex-col gap-2.5">
        <li v-for="s in donut.segs" :key="s.key" class="flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 shrink-0 rounded-md border-2 border-dark" :class="s.bg"></span>
          <span class="flex-1 min-w-0 text-[13.5px] font-semibold text-dark truncate">{{ s.label }}</span>
          <span class="font-mono text-[12.5px] text-gray shrink-0">{{ fmt(s.tokens) }}</span>
          <span class="font-mono text-[12.5px] font-bold text-dark w-[42px] text-right shrink-0">
            {{ pctLabel(s.pct) }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>