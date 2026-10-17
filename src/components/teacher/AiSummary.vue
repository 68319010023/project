<script setup>
import { ref } from 'vue'
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const loading = ref(false)
const error = ref('')
const result = ref(null)

async function generate() {
  loading.value = true
  error.value = ''

  const { data, error: fnError } = await supabase.functions.invoke('summarize-classroom', {
    body: { classroom_id: props.classroomId },
  })

  if (fnError) {
    let msg = 'สรุปไม่สำเร็จ ลองใหม่อีกครั้ง'
    try {
      const body = await fnError.context.json()
      if (body?.error) msg = body.error
    } catch { /* ใช้ข้อความเริ่มต้น */ }
    error.value = msg
  } else if (data?.error) {
    error.value = data.error
  } else {
    result.value = data
  }

  loading.value = false
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-4 sm:px-6 pb-8">
    <div class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <h3 class="font-mali font-bold text-[16px] text-dark flex items-center gap-2">
          <Sparkles :size="18" :stroke-width="2.5" />
          สรุปภาพรวมห้องด้วย AI
        </h3>

        <button type="button" @click="generate" :disabled="loading"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dark bg-orange text-dark font-bold text-[13px]
                 shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
          <RefreshCw v-if="result" :size="14" :stroke-width="2.5" :class="loading ? 'animate-spin' : ''" />
          <Sparkles v-else :size="14" :stroke-width="2.5" />
          {{ loading ? 'กำลังวิเคราะห์...' : result ? 'สรุปใหม่' : 'สรุปด้วย AI' }}
        </button>
      </div>

      <p v-if="error" class="text-[13px] text-red-600">{{ error }}</p>

      <p v-else-if="!result && !loading" class="text-[13px] text-gray">
        กดปุ่มเพื่อให้ AI สรุปอัตราการส่งงาน คะแนน และประเด็นที่ควรจับตาของห้องนี้
        (ส่งเฉพาะตัวเลขรวม ไม่ส่งชื่อนักเรียน)
      </p>

      <template v-if="result">
        <p class="text-[14px] text-dark leading-relaxed whitespace-pre-wrap">{{ result.summary }}</p>

        <div v-if="result.concerns?.length" class="rounded-xl border-2 border-dark bg-[#fff0d6] p-4">
          <p class="flex items-center gap-1.5 text-[12.5px] font-bold text-dark mb-2">
            <AlertTriangle :size="14" :stroke-width="2.5" />
            ประเด็นที่ควรจับตา
          </p>
          <ul class="list-disc pl-5 flex flex-col gap-1 text-[13px] text-dark">
            <li v-for="(c, i) in result.concerns" :key="i">{{ c }}</li>
          </ul>
        </div>

        <div v-if="result.suggestions?.length" class="rounded-xl border-2 border-dark bg-[#c8e6c9] p-4">
          <p class="flex items-center gap-1.5 text-[12.5px] font-bold text-dark mb-2">
            <Lightbulb :size="14" :stroke-width="2.5" />
            ข้อเสนอแนะ
          </p>
          <ul class="list-disc pl-5 flex flex-col gap-1 text-[13px] text-dark">
            <li v-for="(s, i) in result.suggestions" :key="i">{{ s }}</li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>