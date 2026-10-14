<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import AppNavbar from '../../components/AppNavbar.vue'
import { ArrowLeft, Calendar, Star, Paperclip, Link2, ExternalLink, Check, Pencil, ChevronDown } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const classroomId = route.params.id
const assignmentId = route.params.assignmentId

const {
  assignmentDetail, assignmentDetailLoading, loadAssignmentDetail,
  formatDate, isLate,
  getSubmissionUrl, fetchSubmissionItems,
  getAssignmentAttachmentUrl,
} = useClassroomDetail(classroomId)

const openingAttachment = ref(false)
async function openAttachment() {
  if (!assignmentDetail.value?.attachment_url) return
  openingAttachment.value = true
  const url = await getAssignmentAttachmentUrl(assignmentDetail.value.attachment_url)
  openingAttachment.value = false
  if (url) {
    window.open(url, '_blank')
  } else {
    alert('เปิดไฟล์แนบไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
}

const submissions = ref([])
const submissionsLoading = ref(true)
const itemsBySubmission = reactive({})
const itemsLoading = ref(true)

// --- ให้คะแนน + feedback ---

const grading = reactive({})
const modalSub = ref(null)

function openModal(sub) {
  modalSub.value = sub
}

function closeModal() {
  if (modalSub.value && grading[modalSub.value.id]?.saving) return // กันปิดระหว่างบันทึก
  modalSub.value = null
}

function openGrading(sub) {
  grading[sub.id] = {
    open: true,
    score: sub.score ?? null,
    feedback: sub.feedback ?? '',
    saving: false,
    error: '',
  }
}

function cancelGrading(subId) {
  if (grading[subId]) grading[subId].open = false
}

async function saveGrading(sub) {
  const g = grading[sub.id]
  if (!g) return

  const maxScore = assignmentDetail.value?.max_score ?? 100

  if (g.score === null || g.score === '' || isNaN(Number(g.score))) {
    g.error = 'กรุณากรอกคะแนน'
    return
  }
  const scoreNum = Number(g.score)
  if (scoreNum < 0 || scoreNum > maxScore) {
    g.error = `คะแนนต้องอยู่ระหว่าง 0 - ${maxScore}`
    return
  }

  g.error = ''
  g.saving = true

  const { error } = await supabase
    .from('assignment_submissions')
    .update({ score: scoreNum, feedback: g.feedback?.trim() || null })
    .eq('id', sub.id)

  g.saving = false

  if (error) {
    console.error('saveGrading error:', error)
    g.error = 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'
    return
  }

  // อัปเดตข้อมูลในการ์ดทันทีโดยไม่ต้อง reload ทั้งหน้า
  // อัปเดตข้อมูลในการ์ดทันทีโดยไม่ต้อง reload ทั้งหน้า
  sub.score = scoreNum
  sub.feedback = g.feedback?.trim() || null
  g.open = false
}

function openGradingAndKeepModal(sub) {
  openGrading(sub)
}

async function loadSubmissions() {
  submissionsLoading.value = true
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('id, student_id, submitted_at, score, feedback, profiles:student_id(name, lastname, img)')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('loadSubmissions error:', error)
    submissions.value = []
  } else {
    submissions.value = data
  }
  submissionsLoading.value = false
}

async function loadAllItems() {
  itemsLoading.value = true
  try {
    await Promise.all(
      submissions.value.map(async (sub) => {
        try {
          itemsBySubmission[sub.id] = await fetchSubmissionItems(sub.id)
        } catch (err) {
          console.error(`fetchSubmissionItems error (submission ${sub.id}):`, err)
          itemsBySubmission[sub.id] = [] // คนอื่นๆ ยังโหลดต่อได้ปกติ
        }
      })
    )
  } finally {
    itemsLoading.value = false // การันตีว่าจะไม่ค้างโหลดตลอดไป ไม่ว่าจะสำเร็จหรือพัง
  }
}

async function openItem(item) {
  if (item.type === 'link') {
    window.open(item.url, '_blank')
    return
  }
  const url = await getSubmissionUrl(item.url)
  if (url) {
    window.open(url, '_blank')
  } else {
    alert('เปิดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
}

onMounted(async () => {
  await loadAssignmentDetail(assignmentId)
  await loadSubmissions()
  await loadAllItems()
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/teacher' },
      { label: assignmentDetail?.classrooms?.name ?? '...', to: `/classroom/${classroomId}` },
      { label: assignmentDetail?.title ?? '...' }
    ]" />

    <div class="max-w-[1000px] mx-auto px-6 py-8">
      <router-link :to="{ name: 'classroom-detail', params: { id: classroomId }, query: { tab: 'assignments' } }"
        class="inline-flex items-center gap-1.5 text-[13px] text-gray font-semibold hover:text-dark transition mb-4">
        <ArrowLeft :size="15" :stroke-width="2.5" />
        กลับไปหน้าห้องเรียน
      </router-link>

      <div v-if="assignmentDetailLoading"
        class="h-[140px] border-3 border-dark rounded-2xl bg-gray-light animate-pulse" />

      <template v-else-if="assignmentDetail">
        <!-- ชื่องาน + รายละเอียด -->
        <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 mb-6">
          <h1 class="font-mali font-bold text-2xl text-dark">{{ assignmentDetail.title }}</h1>
          <p v-if="assignmentDetail.description" class="text-[14px] text-gray mt-2 leading-relaxed">
            {{ assignmentDetail.description }}
          </p>

          <div class="flex items-center gap-4 mt-4 flex-wrap">
            <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray font-mono">
              <Calendar :size="14" :stroke-width="2.5" />
              ส่งภายใน {{ formatDate(assignmentDetail.due_date) }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray font-mono">
              <Star :size="14" :stroke-width="2.5" />
              {{ assignmentDetail.max_score }} คะแนนเต็ม
            </span>
          </div>

          <div v-if="assignmentDetail.attachment_url" class="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
            <p class="text-[11px] font-bold text-gray font-mono uppercase mb-2">เอกสารประกอบที่แนบไว้</p>
            <button type="button" @click="openAttachment" :disabled="openingAttachment"
              class="w-full flex items-center gap-3 border-2 border-dark rounded-lg px-4 py-3 bg-purple-light hover:bg-purple transition disabled:opacity-50">
              <Paperclip :size="18" :stroke-width="2.5" class="shrink-0" />
              <div class="flex-1 min-w-0 text-left">
                <p class="text-[13px] font-bold text-dark truncate">
                  {{ assignmentDetail.attachment_name || 'เอกสารประกอบ' }}
                </p>
                <p class="text-[11px] text-gray">ไฟล์ที่คุณแนบไว้</p>
              </div>
              <ExternalLink :size="16" :stroke-width="2.5" class="shrink-0" />
            </button>
          </div>
        </div>
        <!-- Grid งานที่นักเรียนส่ง -->
        <h2 class="font-mali font-bold text-[17px] mb-3">
          งานที่ส่งแล้ว
          <span class="text-[13px] text-gray font-mitr font-normal">({{ submissions.length }} คน)</span>
        </h2>

        <div v-if="submissionsLoading" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="n in 4" :key="n" class="h-[140px] border-3 border-dark rounded-xl bg-gray-light animate-pulse" />
        </div>

        <p v-else-if="submissions.length === 0"
          class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ยังไม่มีใครส่งการบ้านชิ้นนี้
        </p>
        <div v-else class="flex flex-wrap gap-3">
          <button type="button" v-for="sub in submissions" :key="sub.id" @click="openModal(sub)" class="w-[250px] bg-white border-2 border-dark rounded-xl shadow-offset overflow-hidden transition
                     hover:-translate-y-1 hover:shadow-offset-lg text-left">
            <div class="flex items-center gap-2.5 px-3.5 py-3">
              <div class="w-9 h-9 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light
                          flex items-center justify-center font-mali font-bold text-[12px]">
                <img v-if="sub.profiles?.img" :src="sub.profiles.img" class="w-full h-full object-cover"
                  alt="นักเรียน" />
                <span v-else>{{ (sub.profiles?.name?.[0] ?? '') + (sub.profiles?.lastname?.[0] ?? '') }}</span>
              </div>

              <div class="min-w-0 flex-1">
                <p class="font-semibold text-[13.5px] truncate">
                  {{ sub.profiles?.name }} {{ sub.profiles?.lastname }}
                </p>
                <p v-if="isLate(assignmentDetail.due_date, sub.submitted_at)"
                  class="text-[10px] font-bold text-red-600">
                  ส่งล่าช้า
                </p>
                <p v-else class="text-[10.5px] text-gray truncate">
                  {{ formatDate(sub.submitted_at) }}
                </p>
              </div>

              <span v-if="sub.score !== null && sub.score !== undefined"
                class="shrink-0 inline-flex items-center gap-0.5 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold bg-green-100 text-green-dark">
                <Check :size="10" :stroke-width="3" />
                {{ sub.score }}/{{ assignmentDetail.max_score }}
              </span>
              <span v-else
                class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold bg-orange text-dark">
                รอตรวจ
              </span>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- Modal รายละเอียดการส่งงาน + ให้คะแนน -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalSub" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="closeModal">
          <div role="dialog" aria-modal="true"
            class="modal-card w-full max-w-md bg-white border-3 border-dark rounded-2xl shadow-offset p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

            <!-- หัว: โปรไฟล์นักเรียน -->
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light
                          flex items-center justify-center font-mali font-bold text-[14px]">
                <img v-if="modalSub.profiles?.img" :src="modalSub.profiles.img" class="w-full h-full object-cover"
                  alt="นักเรียน" />
                <span v-else>{{ (modalSub.profiles?.name?.[0] ?? '') + (modalSub.profiles?.lastname?.[0] ?? '')
                }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-mali font-bold text-[16px] truncate">{{ modalSub.profiles?.name }} {{
                  modalSub.profiles?.lastname }}</p>
                <p class="text-[11.5px]"
                  :class="isLate(assignmentDetail.due_date, modalSub.submitted_at) ? 'text-red-600 font-bold' : 'text-gray'">
                  {{ isLate(assignmentDetail.due_date, modalSub.submitted_at) ? 'ส่งล่าช้า — ' : '' }}{{
                    formatDate(modalSub.submitted_at) }}
                </p>
              </div>
            </div>

            <!-- ไฟล์แนบ / ลิงก์ -->
            <div class="pt-3 border-t-2 border-dashed border-gray-200">
              <p class="text-[11px] font-bold text-gray font-mono uppercase mb-2">ไฟล์ที่ส่ง</p>
              <p v-if="itemsLoading" class="text-gray text-[12px]">กำลังโหลดไฟล์...</p>
              <p v-else-if="(itemsBySubmission[modalSub.id] || []).length === 0" class="text-gray text-[12px]">
                ไม่พบไฟล์ที่ส่ง
              </p>
              <ul v-else class="flex flex-col gap-1.5">
                <li v-for="item in itemsBySubmission[modalSub.id]" :key="item.id">
                  <button type="button" @click="openItem(item)"
                    class="w-full flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-light/60 transition">
                    <Link2 v-if="item.type === 'link'" :size="13" :stroke-width="2.5" class="shrink-0 text-purple" />
                    <Paperclip v-else :size="13" :stroke-width="2.5" class="shrink-0 text-gray-400" />
                    <span class="flex-1 min-w-0 text-left text-[12.5px] text-dark truncate">{{ item.label }}</span>
                    <ExternalLink :size="11" :stroke-width="2.5" class="shrink-0 text-gray-400" />
                  </button>
                </li>
              </ul>
            </div>

            <!-- ให้คะแนน + feedback -->
            <div class="pt-3 border-t-2 border-dashed border-gray-200">
              <template v-if="!grading[modalSub.id]?.open">
                <div v-if="modalSub.score !== null && modalSub.score !== undefined"
                  class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="inline-flex items-center gap-1.5 text-[14px] font-bold text-green-dark">
                      <Check :size="15" :stroke-width="3" />
                      {{ modalSub.score }} / {{ assignmentDetail.max_score }} คะแนน
                    </p>
                    <p v-if="modalSub.feedback"
                      class="text-[12.5px] text-gray mt-1 leading-relaxed whitespace-pre-line">
                      {{ modalSub.feedback }}
                    </p>
                  </div>
                  <button type="button" @click="openGrading(modalSub)"
                    class="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-purple hover:text-dark transition">
                    <Pencil :size="13" :stroke-width="2.5" />
                    แก้ไข
                  </button>
                </div>
                <button v-else type="button" @click="openGrading(modalSub)"
                  class="w-full border-2 border-dark rounded-lg py-2.5 text-[13.5px] font-bold bg-orange  hover:opacity-90 transition">
                  ให้คะแนน
                </button>
              </template>

              <div v-else class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <input type="number" v-model="grading[modalSub.id].score" min="0" :max="assignmentDetail.max_score"
                    placeholder="คะแนน"
                    class="w-24 border-2 border-dark rounded-lg px-2 py-1.5 text-[13px] font-mono font-bold" />
                  <span class="text-[12px] text-gray">/ {{ assignmentDetail.max_score }}</span>
                </div>
                <textarea v-model="grading[modalSub.id].feedback" rows="3"
                  placeholder="feedback ให้นักเรียน (ไม่บังคับ)"
                  class="w-full border-2 border-dark rounded-lg px-2.5 py-1.5 text-[12.5px] resize-none" />
                <p v-if="grading[modalSub.id].error" class="text-[11.5px] text-red font-semibold">
                  {{ grading[modalSub.id].error }}
                </p>
                <div class="flex items-center gap-2">
                  <button type="button" @click="saveGrading(modalSub)" :disabled="grading[modalSub.id].saving"
                    class="flex-1 border-2 border-dark rounded-lg py-1.5 text-[12.5px] font-bold bg-purple hover:opacity-90 transition disabled:opacity-50">
                    {{ grading[modalSub.id].saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน' }}
                  </button>
                  <button type="button" @click="cancelGrading(modalSub.id)" :disabled="grading[modalSub.id].saving"
                    class="border-2 border-dark rounded-lg px-3 py-1.5 text-[12.5px] font-semibold hover:bg-gray-light transition disabled:opacity-50">
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>

            <button type="button" @click="closeModal"
              class="w-full text-center border-2 border-dark rounded-lg px-3 py-2 font-semibold text-[13px] hover:bg-gray-light transition">
              ปิด
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>