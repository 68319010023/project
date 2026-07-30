<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../supabase'
import LoadingSpinner from '../../components/LoadingSpinner.vue'

const router = useRouter()

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
  <div class="notebook-page relative flex min-h-dvh flex-col overflow-hidden">
    <!-- top nav: notebook tab -->
    <header class="relative z-10 shrink-0 border-b-2 border-[#E4DCC8] bg-[#FBF6EC]/95 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
        <button
          @click="router.back()"
          class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2A2521] text-[#2A2521] transition hover:bg-[#2A2521] hover:text-[#FBF6EC]"
          aria-label="ย้อนกลับ"
        >
          ‹
        </button>

        <div class="pencil-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF6B4A] text-lg text-white">
          ✎
        </div>

        <div class="min-w-0">
          <p class="title-font truncate text-[19px] font-semibold tracking-tight text-[#2A2521]">
            AI ติวเตอร์
          </p>
          <p class="truncate text-[12px] text-[#8A8072]">
            พร้อมช่วยทบทวนบทเรียน · ตลอด 24 ชม.
          </p>
        </div>

        <span class="ml-auto hidden shrink-0 rounded-full border border-[#7C9473]/40 bg-[#7C9473]/10 px-3 py-1 text-[11px] font-medium text-[#5C7355] sm:inline-block">
          ● พร้อมตอบ
        </span>
      </div>
    </header>

    <!-- chat area -->
    <main class="relative z-10 mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-4 py-5 sm:px-5">
      <div
        ref="scrollArea"
        class="ruled-paper relative min-h-0 flex-1 overflow-y-auto rounded-2xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-5 py-6 sm:px-8"
      >
        <!-- margin rule -->
        <div class="margin-rule pointer-events-none absolute bottom-0 left-4 top-0 w-px sm:left-6"></div>

        <div class="space-y-5">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="flex items-end gap-2.5"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start pl-3 sm:pl-4'"
          >
            <div
              v-if="msg.role === 'assistant'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-sm text-white"
            >
              ✎
            </div>

            <div
              class="note-card max-w-[78%] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap"
              :class="[
                msg.role === 'user' ? 'note-user' : 'note-assistant',
                i % 2 === 0 ? 'tilt-a' : 'tilt-b',
              ]"
            >
              {{ msg.content }}
            </div>
          </div>

          <div v-if="sending" class="flex items-end gap-2.5 pl-3 sm:pl-4">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-sm text-white">
              ✎
            </div>
            <div class="note-card note-assistant px-4 py-3.5">
              <LoadingSpinner :size="16" color="#FF6B4A" />
            </div>
          </div>
        </div>
      </div>

      <p
        v-if="errorMsg"
        class="mt-3 rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3.5 py-2 text-[12.5px] font-medium text-[#B8402A]"
      >
        {{ errorMsg }}
      </p>

      <!-- input bar -->
      <form @submit.prevent="sendMessage" class="mt-4 flex shrink-0 items-end gap-2.5">
        <textarea
          v-model="input"
          @keydown="handleKeydown"
          rows="1"
          placeholder="พิมพ์คำถามของคุณ…"
          class="notebook-input flex-1 resize-none rounded-2xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-4 py-3 text-[14px] text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
        ></textarea>
        <button
          type="submit"
          :disabled="sending || !input.trim()"
          class="stamp-btn flex shrink-0 items-center justify-center rounded-full bg-[#FF6B4A] px-5 py-3 text-[14px] font-semibold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692]"
        >
          ส่ง
        </button>
      </form>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.pencil-badge {
  box-shadow: 0 3px 0 #C94A2E;
}

.ruled-paper {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 31px,
    #EFE8D8 32px
  );
  background-position: 0 8px;
}

.margin-rule {
  background: repeating-linear-gradient(
    to bottom,
    #FF6B4A 0,
    #FF6B4A 6px,
    transparent 6px,
    transparent 12px
  );
  opacity: 0.35;
}

.note-card {
  position: relative;
  border-radius: 14px;
  box-shadow: 0 2px 6px rgba(42, 37, 33, 0.08);
}

/* folded-corner detail, the page's one signature flourish */
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 0 14px 0 14px;
}

.note-assistant {
  background: #FFFFFF;
  border: 1.5px solid #E4DCC8;
  color: #2A2521;
  border-bottom-left-radius: 4px;
}
.note-assistant::after {
  background: #F1EADC;
}

.note-user {
  background: #FF6B4A;
  color: #FFF6F0;
  border-bottom-right-radius: 4px;
}
.note-user::after {
  background: #E0562F;
}

.tilt-a { transform: rotate(-0.4deg); }
.tilt-b { transform: rotate(0.4deg); }

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:not(:disabled):active {
  box-shadow: 0 1px 0 #C94A2E;
}

.notebook-input {
  font-family: 'Sarabun', sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  .tilt-a, .tilt-b { transform: none; }
}
</style>