<script setup>
import { ref, reactive, computed } from 'vue'
import { supabase } from '../../lib/supabase.js'
import CreateWorkModal from './CreateWorkModal.vue'
import { ClipboardList, FileQuestion, Calendar, Plus, Paperclip, Link2, ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  assignments: { type: Array, default: () => [] },
  assignmentsLoading: { type: Boolean, default: false },
  submissions: { type: Array, default: () => [] },
  submissionsLoading: { type: Boolean, default: false },
  quizzes: { type: Array, default: () => [] },
  quizzesLoading: { type: Boolean, default: false },
  quizSubmissions: { type: Array, default: () => [] },
  memberCount: { type: Number, default: 0 },
  getSubmissionUrl: { type: Function, required: true },
  fetchSubmissionItems: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  isLate: { type: Function, required: true },
})


const combinedItems = computed(() => {
  const items = [
    ...props.assignments.map((a) => ({ ...a, kind: 'assignment' })),
    ...props.quizzes.map((q) => ({ ...q, kind: 'quiz' })),
  ]

  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})

const emit = defineEmits(['reload-assignments', 'reload-submissions', 'reload-quizzes'])

const showCreateModal = ref(false)

function submissionsFor(assignmentId) {
  return props.submissions.filter((s) => s.assignment_id === assignmentId)
}

function quizSubmissionsFor(quizId) {
  return props.quizSubmissions.filter((s) => s.quiz_id === quizId)
}

async function handleCreated() {
  emit('reload-assignments')
  emit('reload-submissions')
  emit('reload-quizzes')
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-mali text-xl font-bold text-dark">งานทั้งหมด</h2>
      <button @click="showCreateModal = true" class="inline-flex items-center gap-1.5 border-2 border-dark rounded-xl px-3.5 py-1.5
                     font-semibold text-[13px] bg-orange hover:bg-white transition">
        <Plus :size="14" :stroke-width="3" />
        สร้างงาน
      </button>
    </div>

    <div v-if="assignmentsLoading || submissionsLoading || quizzesLoading" class="text-gray text-[13px]">
      กำลังโหลด...
    </div>
    <div v-else-if="combinedItems.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีงานในห้องนี้
    </div>

    <ul v-else class="flex flex-col gap-4">
      <!-- การ์ดการบ้าน -->
      <li v-for="item in combinedItems" :key="`${item.kind}-${item.id}`">
        <router-link v-if="item.kind === 'assignment'"
          :to="{ name: 'teacher-assignment-detail', params: { id: classroomId, assignmentId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
            <ClipboardList :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="font-mali font-bold text-[17px] text-dark">{{ item.title }}</p>
                <p v-if="item.description" class="text-[13px] text-gray mt-1.5 line-clamp-1">
                  {{ item.description }}
                </p>
              </div>
              <span
                class="shrink-0 border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light">
                ส่งแล้ว {{ submissionsFor(item.id).length }}/{{ memberCount }}
              </span>
            </div>
            <div class="flex items-center gap-4 mt-3 flex-wrap">
              <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                <Calendar :size="13" :stroke-width="2.5" />
                {{ formatDate(item.due_date) }}
              </span>
              <span class="text-[12px] text-gray font-mono">{{ item.max_score }} คะแนนเต็ม</span>
            </div>
          </div>
        </router-link>


        <!-- การ์ด Quiz -->
        <router-link v-else :to="{ name: 'teacher-quiz-detail', params: { id: classroomId, quizId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div
            class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
            <FileQuestion :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-4">
              <p class="font-mali font-bold text-[17px] text-dark">{{ item.title }}</p>
              <span
                class="shrink-0 border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light">
                ส่งแล้ว {{ quizSubmissionsFor(item.id).length }}/{{ memberCount }}
              </span>
            </div>
            <div class="flex items-center gap-4 mt-3 flex-wrap">
              <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                <Calendar :size="13" :stroke-width="2.5" />
                {{ formatDate(item.due_date) }}
              </span>
              <span class="text-[12px] text-gray font-mono">{{ item.max_score }} คะแนนเต็ม</span>
            </div>
          </div>
        </router-link>
      </li>
    </ul>

    <CreateWorkModal v-if="showCreateModal" :classroom-id="classroomId" @close="showCreateModal = false"
      @created="handleCreated" />
  </div>
</template>