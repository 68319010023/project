<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, Check, Copy } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const result = ref(null)
const updatedAt = ref(null)
const loading = ref(false)
const error = ref('')
const steps = ref([])      // [{ key, text, done }]
const elapsed = ref(0)
const copied = ref(false)
let timer = null

onMounted(async () => {
  // แสดงผลล่าสุดที่เก็บไว้ทันที ไม่ต้องรอ AI
  const { data } = await supabase
    .from('ai_summaries')
    .select('result, updated_at')
    .eq('classroom_id', props.classroomId)
    .maybeSingle()
  if (data) {
    result.value = data.result
    updatedAt.value = data.updated_at
  }
})
onBeforeUnmount(() => clearInterval(timer))

function onEvent(e) {
  if (e.type === 'stage') {
    const last = steps.value[steps.value.length - 1]
    if (last && last.key === e.key) {
      last.text = e.text
      return
    }
    if (last) last.done = true
    steps.value.push({ key: e.key, text: e.text, done: false })
  } else if (e.type === 'result') {
    steps.value.forEach((s) => (s.done = true))
    result.value = e.data
    updatedAt.value = e.updated_at ?? new Date().toISOString()
  } else if (e.type === 'error') {
    error.value = e.message
  }
}

async function generate() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  steps.value = []
  elapsed.value = 0
  timer = setInterval(() => elapsed.value++, 1000)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')

    const res = await fetch(`${supabase.supabaseUrl}/functions/v1/summarize-classroom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabase.supabaseKey,
      },
      body: JSON.stringify({ classroom_id: props.classroomId }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? 'สรุปไม่สำเร็จ กรุณาลองใหม่')
    }

    // อ่านสถานะที่ฟังก์ชันส่งมาทีละบรรทัด
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line) onEvent(JSON.parse(line))
      }
    }
  } catch (e) {
    console.error('generate summary failed:', e)
    error.value = e.message || 'สรุปไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    clearInterval(timer)
    loading.value = false
  }
}

async function copyText() {
  if (!result.value) return
  const r = result.value
  const text = [
    r.summary,
    r.concerns?.length ? '\nประเด็นที่ควรจับตา\n' + r.concerns.map((c) => `- ${c}`).join('\n') : '',
    r.suggestions?.length ? '\nข้อเสนอแนะ\n' + r.suggestions.map((s) => `- ${s}`).join('\n') : '',
  ].join('\n')
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-4 sm:px-6 pb-8">
    <section class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-5">

      <!-- หัวการ์ด -->
      <div class="flex items-start gap-3 flex-wrap">
        <div class="w-11 h-11 shrink-0 rounded-xl border-[3px] border-dark bg-purple-light flex items-center justify-center -rotate-3">
          <Sparkles :size="20" :stroke-width="2.5" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-mali font-bold text-[17px] text-dark">สรุปภาพรวมห้องด้วย AI</h3>
          <p class="text-[12.5px] text-gray mt-0.5">
            ส่งเฉพาะตัวเลขรวม ไม่ส่งชื่อนักเรียน
            <template v-if="updatedAt && !loading">
              · สรุปล่าสุด {{ new Date(updatedAt).toLocaleString('th-TH') }}
            </template>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button v-if="result && !loading" type="button" @click="copyText"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dark bg-white text-[12.5px] font-bold hover:bg-gray-light transition">
            <Check v-if="copied" :size="13" :stroke-width="3" />
            <Copy v-else :size="13" :stroke-width="2.5" />
            {{ copied ? 'คัดลอกแล้ว' : 'คัดลอก' }}
          </button>
          <button type="button" @click="generate" :disabled="loading"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dark bg-orange text-dark font-bold text-[13px]
                   shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition disabled:opacity-60 disabled:pointer-events-none">
            <RefreshCw :size="14" :stroke-width="2.5" :class="loading ? 'animate-spin' : ''" />
            {{ loading ? 'กำลังสรุป...' : result ? 'สรุปใหม่' : 'สรุปด้วย AI' }}
          </button>
        </div>
      </div>

      <p v-if="error" role="alert"
        class="text-[13px] text-red-600 border-2 border-red-600 bg-red-50 rounded-lg px-3 py-2">
        {{ error }}
      </p>

      <!-- ความคืบหน้าระหว่างรอ -->
      <div v-if="loading" class="rounded-xl border-2 border-dark bg-[#fff0d6] p-4 flex flex-col gap-2.5" aria-live="polite">
        <ul class="flex flex-col gap-2">
          <li v-for="s in steps" :key="s.key" class="flex items-center gap-2.5 text-[13px] text-dark">
            <span class="w-5 h-5 shrink-0 rounded-full border-2 border-dark flex items-center justify-center"
              :class="s.done ? 'bg-[#c8e6c9]' : 'bg-white'">
              <Check v-if="s.done" :size="11" :stroke-width="3.5" />
              <RefreshCw v-else :size="10" :stroke-width="3" class="animate-spin" />
            </span>
            <span :class="s.done ? 'text-gray' : 'font-semibold'">{{ s.text }}</span>
          </li>
          <li v-if="steps.length === 0" class="text-[13px] text-gray">กำลังเชื่อมต่อ...</li>
        </ul>
        <p class="text-[11.5px] text-gray font-mono">ใช้เวลาแล้ว {{ elapsed }} วินาที</p>
      </div>

      <!-- ยังไม่มีผล -->
      <p v-if="!result && !loading && !error"
        class="border-2 border-dashed border-dark/30 rounded-xl p-6 text-center text-[13px] text-gray">
        กดปุ่มเพื่อให้ AI สรุปอัตราการส่งงาน คะแนน และประเด็นที่ควรจับตาของห้องนี้
      </p>

      <!-- ผลสรุป (จางลงระหว่างสรุปใหม่) -->
      <div v-if="result" class="flex flex-col gap-4 transition-opacity" :class="loading ? 'opacity-40' : ''">
        <p class="text-[14.5px] text-dark leading-relaxed whitespace-pre-wrap">{{ result.summary }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-if="result.concerns?.length" class="rounded-xl border-[3px] border-dark bg-[#fff0d6] p-4">
            <p class="flex items-center gap-1.5 text-[13px] font-bold text-dark mb-2">
              <AlertTriangle :size="15" :stroke-width="2.5" /> ประเด็นที่ควรจับตา
            </p>
            <ul class="list-disc pl-5 flex flex-col gap-1.5 text-[13px] text-dark leading-relaxed">
              <li v-for="(c, i) in result.concerns" :key="i">{{ c }}</li>
            </ul>
          </div>

          <div v-if="result.suggestions?.length" class="rounded-xl border-[3px] border-dark bg-[#c8e6c9] p-4">
            <p class="flex items-center gap-1.5 text-[13px] font-bold text-dark mb-2">
              <Lightbulb :size="15" :stroke-width="2.5" /> ข้อเสนอแนะ
            </p>
            <ul class="list-disc pl-5 flex flex-col gap-1.5 text-[13px] text-dark leading-relaxed">
              <li v-for="(s, i) in result.suggestions" :key="i">{{ s }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>