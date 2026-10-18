<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../../lib/supabase.js'
import CreateWorkModal from './CreateWorkModal.vue'
import AssignmentModal from './AssignmentModal.vue'
import QuizModal from './QuizModal.vue'
import { ClipboardList, FileQuestion, Calendar, Plus, Search, ChevronDown, Check, Trash2, Pencil, AlertTriangle } from 'lucide-vue-next'

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

const emit = defineEmits(['reload-assignments', 'reload-submissions', 'reload-quizzes'])

const searchQuery = ref('')
const filterKind = ref('all') // 'all' | 'assignment' | 'quiz'
const showFilterMenu = ref(false)

const filters = [
  { id: 'all', label: 'ทั้งหมด', icon: null },
  { id: 'assignment', label: 'การบ้าน', icon: ClipboardList },
  { id: 'quiz', label: 'Quiz', icon: FileQuestion },
]

const activeFilterLabel = computed(
  () => filters.find((f) => f.id === filterKind.value)?.label ?? 'ทั้งหมด'
)

function selectFilter(id) {
  filterKind.value = id
  showFilterMenu.value = false
}

const combinedItems = computed(() => {
  const items = [
    ...props.assignments.map((a) => ({ ...a, kind: 'assignment' })),
    ...props.quizzes.map((q) => ({ ...q, kind: 'quiz' })),
  ]

  let result = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (filterKind.value !== 'all') {
    result = result.filter((item) => item.kind === filterKind.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter((item) => item.title?.toLowerCase().includes(q))
  }

  return result
})

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

// ---------- แก้ไขงาน ----------
const editingAssignmentId = ref(null)
const editingQuizId = ref(null)

function startEdit(item) {
  if (item.kind === 'assignment') editingAssignmentId.value = item.id
  else editingQuizId.value = item.id
}

function handleAssignmentUpdated() {
  editingAssignmentId.value = null
  emit('reload-assignments')
}

function handleQuizUpdated() {
  editingQuizId.value = null
  emit('reload-quizzes')
}

// ---------- ลบงาน ----------
const deleteTarget = ref(null) // item ที่กำลังจะลบ (มี kind)
const deleting = ref(false)
const deleteError = ref('')

const deleteSubmittedCount = computed(() => {
  if (!deleteTarget.value) return 0
  return deleteTarget.value.kind === 'assignment'
    ? submissionsFor(deleteTarget.value.id).length
    : quizSubmissionsFor(deleteTarget.value.id).length
})

function askDelete(item) {
  deleteError.value = ''
  deleteTarget.value = item
}

function cancelDelete() {
  if (deleting.value) return
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''

  const target = deleteTarget.value

  // เก็บ path ไฟล์แนบของครูไว้ก่อนลบแถว (เพื่อลบไฟล์ใน Storage ทีหลัง)
 
  let attachmentPaths = []
  if (target.kind === 'assignment') {
    const { data } = await supabase
      .from('assignment_attachments')
      .select('url')
      .eq('assignment_id', target.id)
    attachmentPaths = (data || [])
      .map((r) => r.url)
      .filter((u) => u && !/^https?:\/\//.test(u))
  }

  const { error } =
    target.kind === 'assignment'
      ? await supabase.rpc('delete_assignment', { p_assignment_id: target.id })
      : await supabase.rpc('delete_quiz', { p_quiz_id: target.id })

  if (error) {
    deleting.value = false
    console.error('delete error', error)
    deleteError.value = 'ลบไม่สำเร็จ: ' + error.message
    return
  }

  if (attachmentPaths.length > 0) {
    try {
      await supabase.storage.from('assignment-files').remove(attachmentPaths)
    } catch (e) {
      console.warn('remove attachments failed:', e)
    }
  }

  deleting.value = false
  const wasAssignment = target.kind === 'assignment'
  deleteTarget.value = null
  if (wasAssignment) {
    emit('reload-assignments')
    emit('reload-submissions')
  } else {
    emit('reload-quizzes')
  }
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <h2 class="font-mali text-xl font-bold text-dark">งานทั้งหมด</h2>

      <div class="flex items-center gap-2.5 ml-auto flex-wrap sm:flex-nowrap">
        <div class="relative w-full sm:w-auto">
          <Search :size="15" :stroke-width="2.5" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
          <input v-model="searchQuery" type="text" placeholder="ค้นหาชื่องาน..." class="pl-9 pr-3.5 py-1.5 rounded-xl border-3 border-dark bg-white text-dark text-[13px]
                        placeholder-gray focus:outline-none focus:ring-2 focus:ring-purple w-full sm:w-[180px] md:w-[220px]" />
        </div>

        <!-- Dropdown filter -->
        <div class="relative">
          <button type="button" @click="showFilterMenu = !showFilterMenu" class="inline-flex items-center gap-1.5 border-2 border-dark rounded-xl px-3 py-1.5
                         font-semibold text-[13px] bg-white hover:bg-gray-light transition shrink-0">
            {{ activeFilterLabel }}
            <ChevronDown :size="14" :stroke-width="2.5" class="transition-transform"
              :class="showFilterMenu ? 'rotate-180' : ''" />
          </button>

          <Transition name="fade-hint">
            <div v-if="showFilterMenu" v-click-outside="() => showFilterMenu = false" class="absolute right-0 top-[calc(100%+6px)] z-10 w-[150px] bg-white border-2 border-dark
                        rounded-xl shadow-offset overflow-hidden">
              <button v-for="f in filters" :key="f.id" type="button" @click="selectFilter(f.id)" class="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] text-left
                             hover:bg-gray-light transition"
                :class="filterKind === f.id ? 'font-bold text-dark' : 'text-gray'">
                {{ f.label }}
                <Check v-if="filterKind === f.id" :size="14" :stroke-width="3" class="text-purple" />
              </button>
            </div>
          </Transition>
        </div>

        <button @click="showCreateModal = true" class="inline-flex items-center gap-1.5 border-2 border-dark rounded-xl px-3.5 py-1.5
                       font-semibold text-[13px] bg-orange hover:bg-white transition shrink-0">
          <Plus :size="14" :stroke-width="3" />
          สร้างงาน
        </button>
      </div>
    </div>

    <div class="inline-flex items-center gap-0.5 p-1 mb-4 bg-white border-2 border-dark rounded-xl shadow-offset-sm">
      <button v-for="f in filters" :key="f.id" type="button" @click="filterKind = f.id"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition" :class="filterKind === f.id
          ? 'bg-dark text-white'
          : 'text-gray hover:bg-gray-light hover:text-dark'">
        <component :is="f.icon" v-if="f.icon" :size="13" :stroke-width="2.5" />
        {{ f.label }}
      </button>
    </div>

    <div v-if="assignmentsLoading || submissionsLoading || quizzesLoading" class="text-gray text-[13px]">
      กำลังโหลด...
    </div>
    <div v-else-if="combinedItems.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      <template v-if="searchQuery.trim()">ไม่พบงานที่ตรงกับ "{{ searchQuery }}"</template>
      <template v-else-if="filterKind !== 'all'">ไม่มี{{ filterKind === 'quiz' ? ' Quiz ' : 'การบ้าน'
      }}ในห้องนี้</template>
      <template v-else>ยังไม่มีงานในห้องนี้</template>
    </div>

    <ul v-else class="flex flex-col gap-4">
      <li v-for="item in combinedItems" :key="`${item.kind}-${item.id}`">
        <!-- การ์ดการบ้าน -->
        <router-link v-if="item.kind === 'assignment'"
          :to="{ name: 'teacher-assignment-detail', params: { id: classroomId, assignmentId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-4 sm:p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
            <ClipboardList :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3 sm:gap-4 flex-col sm:flex-row">
              <div class="min-w-0">
                <p class="font-mali font-bold text-[16px] sm:text-[17px] text-dark break-words">{{ item.title }}</p>
                <p v-if="item.description" class="text-[12.5px] sm:text-[13px] text-gray mt-1.5 line-clamp-1">
                  {{ item.description }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                <span
                  class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light">
                  ส่งแล้ว {{ submissionsFor(item.id).length }}/{{ memberCount }}
                </span>
                <button type="button" title="แก้ไข" @click.prevent.stop="startEdit(item)" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border-2 border-dark bg-white
                         hover:bg-purple-light transition">
                  <Pencil :size="14" :stroke-width="2.5" />
                </button>
                <button type="button" title="ลบ" @click.prevent.stop="askDelete(item)" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border-2 border-dark bg-white
         hover:bg-[#f44336] hover:text-white transition">
                  <Trash2 :size="14" :stroke-width="2.5" />
                </button>
              </div>
            </div>
            <div class="flex items-center gap-4 mt-3 flex-wrap">
              <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12px] text-gray font-mono">
                <Calendar :size="13" :stroke-width="2.5" />
                {{ formatDate(item.due_date) }}
              </span>
              <span class="text-[11.5px] sm:text-[12px] text-gray font-mono">{{ item.max_score }} คะแนนเต็ม</span>
            </div>
          </div>
        </router-link>

        <!-- การ์ด Quiz -->
        <router-link v-else :to="{ name: 'teacher-quiz-detail', params: { id: classroomId, quizId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-4 sm:p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div
            class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
            <FileQuestion :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3 sm:gap-4 flex-col sm:flex-row">
              <p class="font-mali font-bold text-[16px] sm:text-[17px] text-dark break-words">{{ item.title }}</p>
              <div class="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                <span
                  class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light">
                  ส่งแล้ว {{ quizSubmissionsFor(item.id).length }}/{{ memberCount }}
                </span>
                <button type="button" title="แก้ไข" @click.prevent.stop="startEdit(item)" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border-2 border-dark bg-white
                         hover:bg-purple-light transition">
                  <Pencil :size="14" :stroke-width="2.5" />
                </button>
                <button type="button" title="ลบ" @click.prevent.stop="askDelete(item)" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border-2 border-dark bg-white
         hover:bg-[#f44336] hover:text-white transition">
                  <Trash2 :size="14" :stroke-width="2.5" />
                </button>
              </div>
            </div>
            <div class="flex items-center gap-4 mt-3 flex-wrap">
              <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12px] text-gray font-mono">
                <Calendar :size="13" :stroke-width="2.5" />
                {{ formatDate(item.due_date) }}
              </span>
              <span class="text-[11.5px] sm:text-[12px] text-gray font-mono">{{ item.max_score }} คะแนนเต็ม</span>
            </div>
          </div>
        </router-link>
      </li>
    </ul>

    <CreateWorkModal v-if="showCreateModal" :classroom-id="classroomId" @close="showCreateModal = false"
      @created="handleCreated" />

    <!-- Modal แก้ไข -->
    <AssignmentModal v-if="editingAssignmentId" :classroom-id="classroomId" :assignment-id="editingAssignmentId"
      @close="editingAssignmentId = null" @updated="handleAssignmentUpdated" />
    <QuizModal v-if="editingQuizId" :classroom-id="classroomId" :quiz-id="editingQuizId" @close="editingQuizId = null"
      @updated="handleQuizUpdated" />

    <!-- Modal ยืนยันลบ -->
    <Teleport to="body">
      <Transition name="fade-hint">
        <div v-if="deleteTarget" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          @click.self="cancelDelete">
          <div class="w-full max-w-[400px] bg-white border-3 border-dark rounded-2xl shadow-offset p-6">
            <div class="flex items-start gap-3.5 mb-4">
              <div
                class="w-12 h-12 shrink-0 rounded-xl border-2 border-dark bg-[#f44336] flex items-center justify-center">
                <AlertTriangle :size="22" :stroke-width="2.5" class="text-white" />
              </div>
              <div class="min-w-0 pt-0.5">
                <h3 class="font-mali font-bold text-[19px] text-dark leading-tight">
                  ลบ{{ deleteTarget.kind === 'quiz' ? ' Quiz' : 'การบ้าน' }}นี้?
                </h3>
                <p class="text-[13.5px] text-dark font-semibold mt-1 break-words">"{{ deleteTarget.title }}"</p>
              </div>
            </div>

            <div
              class="border-2 border-dashed border-dark/40 rounded-xl px-3.5 py-3 bg-gray-light text-[13px] text-dark leading-relaxed">
              <template v-if="deleteSubmittedCount > 0">
                มีนักเรียนส่งแล้ว <b>{{ deleteSubmittedCount }} คน</b>
                คะแนนและงานที่ส่งทั้งหมดจะถูกลบไปด้วย
              </template>
              <template v-else>ยังไม่มีนักเรียนส่งงานนี้</template>
              <span class="block font-bold mt-1 text-[#c62828]">การลบนี้กู้คืนไม่ได้</span>
            </div>

            <p v-if="deleteError"
              class="mt-3 text-[12.5px] text-[#c62828] bg-red-50 border-2 border-[#f44336] rounded-lg px-3 py-2 break-words">
              {{ deleteError }}
            </p>

            <div class="flex justify-end gap-2.5 mt-5">
              <button type="button" @click="cancelDelete" :disabled="deleting" class="border-2 border-dark rounded-lg px-4 py-2.5 font-semibold text-[13.5px] bg-white
                       hover:bg-gray-light transition disabled:opacity-50">
                ยกเลิก
              </button>
              <button type="button" @click="confirmDelete" :disabled="deleting" class="border-2 border-dark rounded-lg px-5 py-2.5 font-bold text-[13.5px] bg-[#f44336] text-white
                       shadow-offset-sm hover:-translate-y-0.5 transition
                       disabled:opacity-50 disabled:hover:translate-y-0">
                {{ deleting ? 'กำลังลบ...' : 'ลบเลย' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>