<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { Users, Search, KeyRound, Copy, Check, UserX, TriangleAlert } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  classCode: { type: String, default: '' },
  members: { type: Array, default: () => [] },
  membersLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['reload-members'])

const search = ref('')
const removingStudentId = ref(null)
const copied = ref(false)

const filteredMembers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.members
  return props.members.filter((m) => {
    const fullName = `${m.profiles?.name ?? ''} ${m.profiles?.lastname ?? ''}`.toLowerCase()
    return fullName.includes(q)
  })
})

function initials(m) {
  return (m.profiles?.name?.[0] ?? '') + (m.profiles?.lastname?.[0] ?? '')
}

async function copyCode() {
  await navigator.clipboard.writeText(props.classCode)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// --- Modal ยืนยันการลบสมาชิก ---
const showRemoveModal = ref(false)
const memberToRemove = ref(null) // { studentId, studentName }

function requestRemoveMember(studentId, studentName) {
  memberToRemove.value = { studentId, studentName }
  showRemoveModal.value = true
}

function cancelRemoveMember() {
  showRemoveModal.value = false
  memberToRemove.value = null
}

async function confirmRemoveMember() {
  if (!memberToRemove.value) return
  const { studentId } = memberToRemove.value

  showRemoveModal.value = false
  removingStudentId.value = studentId

  const { error } = await supabase
    .from('classroom_enrollments')
    .delete()
    .eq('classroom_id', props.classroomId)
    .eq('student_id', studentId)

  removingStudentId.value = null
  memberToRemove.value = null

  if (error) {
    console.error('removeMember error:', error)
    return
  }

  emit('reload-members')
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <!-- รหัสเข้าห้อง -->
    <div class="bg-purple-light border-3 border-dark rounded-2xl shadow-offset p-5 mb-6
                flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 shrink-0 rounded-full border-3 border-dark bg-white
                    flex items-center justify-center">
          <KeyRound :size="20" :stroke-width="2.5" />
        </div>
        <div>
          <p class="text-[11px] font-bold text-gray font-mono uppercase">รหัสเข้าห้องเรียน</p>
          <p class="font-mali font-bold text-[22px] text-dark tracking-wide">{{ classCode }}</p>
        </div>
      </div>
      <button type="button" @click="copyCode" class="inline-flex items-center gap-1.5 border-2 border-dark rounded-xl px-4 py-2
                     font-semibold text-[13px] bg-white hover:bg-purple transition">
        <component :is="copied ? Check : Copy" :size="14" :stroke-width="2.5" />
        {{ copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส' }}
      </button>
    </div>

    <!-- หัวข้อ + ค้นหา -->
    <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
      <h2 class="font-mali text-xl font-bold text-dark flex items-center gap-2">
        <Users :size="20" :stroke-width="2.5" />
        สมาชิก
        <span class="text-[13px] text-gray font-mitr font-normal">({{ members.length }} คน)</span>
      </h2>

      <div class="relative">
        <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
        <input v-model="search" type="text" placeholder="ค้นหาชื่อนักเรียน..." class="pl-9 pr-3 py-2 text-[13.5px] border-3 border-dark rounded-xl
                      bg-white focus:outline-none focus:bg-purple-light/30 transition w-[220px]" />
      </div>
    </div>

    <!-- Grid สมาชิก -->
    <div v-if="membersLoading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="n in 8" :key="n" class="h-[84px] border-3 border-dark rounded-xl bg-gray-light animate-pulse" />
    </div>

    <p v-else-if="members.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีสมาชิกในห้องนี้
    </p>

    <p v-else-if="filteredMembers.length === 0" class="text-gray text-[13.5px] py-6 text-center">
      ไม่พบชื่อ "{{ search }}"
    </p>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="member in filteredMembers" :key="member.student_id" class="bg-white border-3 border-dark rounded-xl shadow-offset p-3
                  flex items-center gap-3 hover:-translate-y-1 hover:shadow-offset-lg transition">
        <div class="w-9 h-9 shrink-0 rounded-full border-2 border-dark bg-purple-light
                    flex items-center justify-center font-mali font-bold text-[13px]">
          {{ initials(member) }}
        </div>
        <p class="flex-1 min-w-0 text-[13.5px] font-medium truncate">
          {{ member.profiles?.name }} {{ member.profiles?.lastname }}
        </p>
        <button type="button"
          @click="requestRemoveMember(member.student_id, `${member.profiles?.name} ${member.profiles?.lastname}`)"
          :disabled="removingStudentId === member.student_id" class="shrink-0 w-7 h-7 rounded-full border-2 border-dark flex items-center justify-center
                       text-red-600 hover:bg-red-50 disabled:opacity-40 transition">
          <UserX :size="14" :stroke-width="2.5" />
        </button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showRemoveModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6"
      @click.self="cancelRemoveMember">
      <div class="bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[360px] w-full p-6">
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-10 h-10 rounded-full border-2 border-danger bg-red-50 flex items-center justify-center shrink-0">
            <TriangleAlert :size="18" :stroke-width="2.5" class="text-danger" />
          </div>
          <h3 class="font-mali font-bold text-lg">ลบสมาชิกออกจากห้อง</h3>
        </div>

        <p class="text-[13px] text-gray mb-4">
          ต้องการลบ <span class="font-semibold text-dark">"{{ memberToRemove?.studentName }}"</span>
          ออกจากห้องเรียนใช่ไหม?
        </p>

        <div class="flex gap-3">
          <button type="button" @click="cancelRemoveMember"
            class="flex-1 px-4 py-2.5 rounded-[10px] border-2 border-dark bg-white font-semibold text-[13px] shadow-offset-sm hover:-translate-y-0.5 transition">
            ยกเลิก
          </button>
          <button type="button" @click="confirmRemoveMember"
            class="flex-1 px-4 py-2.5 rounded-[10px] border-2 border-dark bg-danger text-white font-semibold text-[13px] shadow-offset-sm hover:-translate-y-0.5 transition">
            ลบออกจากห้อง
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>