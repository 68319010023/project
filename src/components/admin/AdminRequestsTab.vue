<script setup>
// แท็บ "คำขอครู": อนุมัติ / ปฏิเสธผู้ขอเป็นครู
import { ref, onMounted } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import { fmtDateTime, fullName, card } from '../../lib/adminFormat.js'

const emit = defineEmits(['changed'])

const error = ref('')
const loading = ref(true)
const requests = ref([])
const target = ref(null) // { user, approve }
const working = ref(false)

async function load() {
  const { data, error: e } = await supabase.rpc('admin_list_teacher_requests')
  loading.value = false
  if (e) {
    console.error('loadRequests error:', e)
    error.value = 'โหลดคำขอไม่สำเร็จ กรุณาลองใหม่'
    return
  }
  
  requests.value = data ?? []
}

function ask(user, approve) {
  target.value = { user, approve }
}

async function confirmAction() {
  if (!target.value || working.value) return
  const { user, approve } = target.value
  working.value = true
  error.value = ''
  const { error: e } = await supabase.rpc(
    approve ? 'admin_approve_teacher' : 'admin_reject_teacher',
    { p_user_id: user.id },
  )
  working.value = false
  target.value = null

  if (e) {
    console.error('review error:', e)
    error.value = e.message?.includes('not pending')
      ? 'คำขอนี้ถูกดำเนินการไปแล้ว'
      : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'
  } else {
    
    emit('changed')
  }
  await load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>

    <section :class="card" class="flex flex-col gap-3">
      <p v-if="loading" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</p>
      <p v-else-if="requests.length === 0"
        class="border-2 border-dashed border-dark/30 rounded-xl p-6 text-center text-gray text-[13px]">
        ไม่มีคำขอที่รออนุมัติ
      </p>

      <div v-for="u in requests" :key="u.id"
        class="flex items-center gap-3 flex-wrap border-2 border-dark rounded-xl px-4 py-3">
        <div class="w-10 h-10 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light flex items-center justify-center font-mali font-bold text-[13px]">
          <img v-if="u.img" :src="u.img" class="w-full h-full object-cover" alt="" />
          <span v-else>{{ (u.name?.[0] ?? '') + (u.lastname?.[0] ?? '') }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <p class="font-semibold text-[14px] text-dark truncate">{{ fullName(u) }}</p>
          <p class="text-[12px] text-gray truncate">
            {{ u.email }} · ขอเมื่อ {{ u.teacher_requested_at ? fmtDateTime(u.teacher_requested_at) : '-' }}
          </p>
        </div>

        <button type="button" @click="ask(u, false)"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dark text-red-600 text-[12.5px] font-bold hover:bg-red-50 transition">
          <X :size="13" :stroke-width="3" /> ปฏิเสธ
        </button>
        <button type="button" @click="ask(u, true)"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dark bg-[#c8e6c9] text-[12.5px] font-bold hover:-translate-y-0.5 transition">
          <Check :size="13" :stroke-width="3" /> อนุมัติ
        </button>
      </div>
    </section>

    <!-- ยืนยันก่อนดำเนินการ -->
    <Teleport to="body">
      <div v-if="target" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="!working && (target = null)">
        <div role="dialog" aria-modal="true"
          class="w-full max-w-md bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4">
          <h3 class="font-mali font-bold text-[17px] text-dark">
            {{ target.approve ? 'อนุมัติเป็นครู?' : 'ปฏิเสธคำขอ?' }}
          </h3>
          <p class="text-[13.5px] text-gray leading-relaxed">
            {{ fullName(target.user) }}
            <template v-if="target.approve">จะได้รับสิทธิ์ครูทันทีและมีแจ้งเตือนในแอป</template>
            <template v-else>จะไม่ได้รับสิทธิ์ครู</template>
          </p>
          <div class="flex items-center justify-end gap-2">
            <button type="button" @click="target = null" :disabled="working"
              class="px-4 py-2 border-2 border-dark rounded-lg font-semibold text-[13px] hover:bg-gray-light transition disabled:opacity-50">
              ยกเลิก
            </button>
            <button type="button" @click="confirmAction" :disabled="working"
              class="px-4 py-2 border-2 border-dark rounded-lg font-semibold text-[13px] transition disabled:opacity-50"
              :class="target.approve ? 'bg-[#c8e6c9] hover:bg-green-200' : 'bg-red-600 text-white hover:bg-red-500'">
              {{ working ? 'กำลังดำเนินการ...' : 'ยืนยัน' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>