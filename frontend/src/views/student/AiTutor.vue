<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { supabase } from '../../supabase'
import LoadingSpinner from '../../components/LoadingSpinner.vue'

const messages = ref([
  { role: 'assistant', content: 'สวัสดีครับ ผมคือ AI ติวเตอร์ มีอะไรให้ช่วยทบทวนไหมครับ' },
])
const input = ref('')
const sending = ref(false)
const errorMsg = ref('')
const scrollArea = ref(null)

function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight
    }
  })
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || sending.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  errorMsg.value = ''
  scrollToBottom()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('กรุณาเข้าสู่ระบบใหม่')

    const { data, error } = await supabase.functions.invoke('ai-tutor-chat', {
      body: { message: text },
    })

    if (error) throw error

    messages.value.push({ role: 'assistant', content: data.reply })
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ส่งข้อความไม่สำเร็จ ลองอีกครั้ง'
    messages.value.pop()
    input.value = text
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(scrollToBottom)
</script>

<template>
  <div class="max-w-3xl mx-auto px-5 py-6 flex flex-col" style="height: calc(100vh - 64px);">
    <div class="flex items-center gap-3 mb-4 shrink-0">
      <div class="w-10 h-10 rounded-full bg-[#14213D] flex items-center justify-center text-[#FBF9F4] text-xs font-semibold" style="font-family: 'Chakra Petch', sans-serif;">
        AI
      </div>
      <div>
        <p class="font-semibold text-[#14213D]" style="font-family: 'Chakra Petch', sans-serif;">AI ติวเตอร์</p>
        <p class="text-xs text-[#14213D]/45">พร้อมช่วยตอบคำถามและทบทวนบทเรียน</p>
      </div>
    </div>

    <div
      ref="scrollArea"
      class="flex-1 overflow-y-auto bg-white border border-[#14213D]/10 rounded-2xl p-5 space-y-4 mb-4"
    >
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          :class="msg.role === 'user'
            ? 'bg-[#14213D] text-[#FBF9F4]'
            : 'bg-[#0F766E]/8 text-[#14213D]'"
        >
          {{ msg.content }}
        </div>
      </div>

      <div v-if="sending" class="flex justify-start">
        <div class="bg-[#0F766E]/8 rounded-2xl px-4 py-3">
          <LoadingSpinner :size="16" color="#0F766E" />
        </div>
      </div>
    </div>

    <p v-if="errorMsg" class="text-xs text-[#993C1D] mb-2">{{ errorMsg }}</p>

    <form @submit.prevent="sendMessage" class="flex items-end gap-2 shrink-0">
      <textarea
        v-model="input"
        @keydown="handleKeydown"
        rows="1"
        placeholder="พิมพ์คำถามของคุณ…"
        class="flex-1 resize-none px-4 py-3 rounded-xl border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] text-sm placeholder-[#14213D]/35 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition"
      ></textarea>
      <button
        type="submit"
        :disabled="sending || !input.trim()"
        class="bg-[#FF6B4A] text-[#4A1B0C] font-medium text-sm rounded-xl px-5 py-3 hover:bg-[#FF6B4A]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        ส่ง
      </button>
    </form>
  </div>
</template>