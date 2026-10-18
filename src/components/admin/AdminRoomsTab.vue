<script setup>
// แท็บ "ห้องเรียน": รายการห้องทั้งหมด + ลบห้อง (มี modal ยืนยัน)
import { ref, computed, onMounted } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import { fmt, card, th, thRight } from '../../lib/adminFormat.js'
import ConfirmModal from './ConfirmModal.vue'

const error = ref('')
const actionError = ref('')
const rooms = ref([])
const loadingRooms = ref(false)

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

onMounted(loadRooms)

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
    await loadRooms()
  } catch (e) {
    console.error('delete classroom error:', e)
    actionError.value = e?.message || 'ลบห้องเรียนไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    confirming.value = false
    dlg.value.open = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>
    <p v-if="actionError" role="alert"
      class="text-[13px] text-red-600 border-2 border-red-600 rounded-xl bg-red-50 px-4 py-2.5">
      {{ actionError }}
    </p>

    <section :class="card" class="overflow-x-auto">
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
      <p v-if="loadingRooms && rooms.length === 0" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</p>
      <p v-else-if="!loadingRooms && rooms.length === 0" class="text-center text-gray text-[13px] py-6">
        ยังไม่มีห้องเรียน
      </p>
    </section>

    <ConfirmModal v-model="dlgOpen" :title="dlgInfo.title" :confirm-text="dlgInfo.confirmText"
      :danger="dlgInfo.danger" :loading="confirming" @confirm="runConfirm">
      {{ dlgInfo.message }}
    </ConfirmModal>
  </div>
</template>