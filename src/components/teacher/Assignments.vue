<script setup>
import { ref, reactive } from 'vue'
import { supabase } from '../../lib/supabase.js'
import AssignmentModal from './AssignmentModal.vue'
import { ClipboardList, Calendar, Plus, Paperclip, Link2, ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  assignments: { type: Array, default: () => [] },
  assignmentsLoading: { type: Boolean, default: false },
  submissions: { type: Array, default: () => [] },
  submissionsLoading: { type: Boolean, default: false },
  memberCount: { type: Number, default: 0 },
  getSubmissionUrl: { type: Function, required: true },
  fetchSubmissionItems: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  isLate: { type: Function, required: true },
})

const emit = defineEmits(['reload-assignments', 'reload-submissions'])

const showCreateModal = ref(false)

function submissionsFor(assignmentId) {
  return props.submissions.filter((s) => s.assignment_id === assignmentId)
}

async function handleCreated() {
  emit('reload-assignments')
  emit('reload-submissions')
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-mali text-xl font-bold text-dark flex items-center gap-2">
        <ClipboardList :size="20" :stroke-width="2.5" />
        การบ้าน
      </h2>
      <button @click="showCreateModal = true" class="inline-flex items-center gap-1.5 border-2 border-dark rounded-xl px-3.5 py-1.5
                     font-semibold text-[13px] bg-orange hover:bg-white transition">
        <Plus :size="14" :stroke-width="3" />
        สร้างการบ้าน
      </button>
    </div>

    <div v-if="assignmentsLoading || submissionsLoading" class="text-gray text-[13px]">
      กำลังโหลดการบ้าน...
    </div>
    <div v-else-if="assignments.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีการบ้านในห้องนี้
    </div>
    <ul v-else class="flex flex-col gap-4">
      <li v-for="assignment in assignments" :key="assignment.id">
        <router-link
          :to="{ name: 'teacher-assignment-detail', params: { id: classroomId, assignmentId: assignment.id } }" class="block bg-white border-3 border-dark rounded-2xl shadow-offset p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-mali font-bold text-[17px] text-dark">{{ assignment.title }}</p>
              <p v-if="assignment.description" class="text-[13px] text-gray mt-1.5 line-clamp-1">
                {{ assignment.description }}
              </p>
            </div>
            <span
              class="shrink-0 border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light">
              ส่งแล้ว {{ submissionsFor(assignment.id).length }}/{{ memberCount }}
            </span>
          </div>
          <div class="flex items-center gap-4 mt-3 flex-wrap">
            <span class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
              <Calendar :size="13" :stroke-width="2.5" />
              {{ formatDate(assignment.due_date) }}
            </span>
            <span class="text-[12px] text-gray font-mono">{{ assignment.max_score }} คะแนนเต็ม</span>
          </div>
        </router-link>
      </li>
    </ul>

    <AssignmentModal v-if="showCreateModal" :classroom-id="classroomId" @close="showCreateModal = false"
      @created="handleCreated" />
  </div>
</template>