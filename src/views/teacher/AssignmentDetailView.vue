<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import AppNavbar from '../../components/AppNavbar.vue'
import { ArrowLeft, Calendar, Star, Paperclip, Link2, ExternalLink, Check, Pencil } from 'lucide-vue-next'

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
// รายชื่อนักเรียนที่ส่งงานชิ้นนี้ (parent row) — โหลดแยกจาก useClassroomDetail
// เพราะหน้านี้สนใจแค่ submission ของ assignment เดียว ไม่ใช่ทั้งห้อง
const submissions = ref([])
const submissionsLoading = ref(true)

// ไฟล์/ลิงก์ต่อ submission — โหลดขนานทีเดียวตอนเปิดหน้า (ไม่ lazy โหลดทีละคนเหมือนฝั่ง list เดิม
// เพราะหน้านี้คือหน้าเดี่ยวของการบ้านชิ้นเดียว ไม่ต้องกลัวยิง query เยอะเกินเหมือนตอนอยู่ในลิสต์รวม)
const itemsBySubmission = reactive({})
const itemsLoading = ref(true)

// --- ให้คะแนน + feedback ---
// grading[sub.id] = { open, score, feedback, saving, error }
const grading = reactive({})

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
  sub.score = scoreNum
  sub.feedback = g.feedback?.trim() || null
  g.open = false
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
    <AppNavbar :show-search="false"
        :breadcrumb="[
            { label: 'หน้ารวมห้องเรียน', to: '/teacher' },
            { label: assignmentDetail?.classrooms?.name ?? '...', to: `/classroom/${classroomId}` },
            { label: assignmentDetail?.title ?? '...' }
        ]" />

    <div class="max-w-[1000px] mx-auto px-6 py-8">
      <button type="button" @click="router.back()"
              class="inline-flex items-center gap-1.5 text-[13px] text-gray font-semibold hover:text-dark transition mb-4">
        <ArrowLeft :size="15" :stroke-width="2.5" />
        กลับไปหน้าห้องเรียน
      </button>

      <div v-if="assignmentDetailLoading" class="h-[140px] border-3 border-dark rounded-2xl bg-gray-light animate-pulse" />

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

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="sub in submissions" :key="sub.id"
               class="bg-white border-3 border-dark rounded-xl shadow-offset p-4">
            <!-- โปรไฟล์นักเรียน -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light
                          flex items-center justify-center font-mali font-bold text-[13px]">
                <img v-if="sub.profiles?.img" :src="sub.profiles.img" class="w-full h-full object-cover" alt="นักเรียน" />
                <span v-else>{{ (sub.profiles?.name?.[0] ?? '') + (sub.profiles?.lastname?.[0] ?? '') }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-[14px] truncate">{{ sub.profiles?.name }} {{ sub.profiles?.lastname }}</p>
                <p class="text-[11.5px] text-gray">{{ formatDate(sub.submitted_at) }}</p>
              </div>
              <span v-if="isLate(assignmentDetail.due_date, sub.submitted_at)"
                    class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold bg-red-100 text-red-600">
                ส่งล่าช้า
              </span>
            </div>

            <!-- ไฟล์แนบ / ลิงก์ -->
            <div class="mt-3 pt-3 border-t-2 border-dashed border-gray-200">
              <p v-if="itemsLoading" class="text-gray text-[12px]">กำลังโหลดไฟล์...</p>
              <p v-else-if="(itemsBySubmission[sub.id] || []).length === 0" class="text-gray text-[12px]">
                ไม่พบไฟล์ที่ส่ง
              </p>
              <ul v-else class="flex flex-col gap-1.5">
                <li v-for="item in itemsBySubmission[sub.id]" :key="item.id">
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
            <div class="mt-3 pt-3 border-t-2 border-dashed border-gray-200">
              <!-- โหมดแสดงผล (ยังไม่เปิดฟอร์ม) -->
              <template v-if="!grading[sub.id]?.open">
                <div v-if="sub.score !== null && sub.score !== undefined" class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="inline-flex items-center gap-1.5 text-[13px] font-bold text-green-dark">
                      <Check :size="14" :stroke-width="3" />
                      {{ sub.score }} / {{ assignmentDetail.max_score }} คะแนน
                    </p>
                    <p v-if="sub.feedback" class="text-[12px] text-gray mt-1 leading-relaxed whitespace-pre-line">
                      {{ sub.feedback }}
                    </p>
                  </div>
                  <button type="button" @click="openGrading(sub)"
                          class="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-purple hover:text-dark transition">
                    <Pencil :size="12" :stroke-width="2.5" />
                    แก้ไข
                  </button>
                </div>
                <button v-else type="button" @click="openGrading(sub)"
                        class="w-full border-2 border-dark rounded-lg py-2 text-[13px] font-bold bg-orange text-white hover:opacity-90 transition">
                  ให้คะแนน
                </button>
              </template>

              <!-- ฟอร์มให้คะแนน -->
              <div v-else class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <input type="number" v-model="grading[sub.id].score" min="0" :max="assignmentDetail.max_score"
                         placeholder="คะแนน"
                         class="w-24 border-2 border-dark rounded-lg px-2 py-1.5 text-[13px] font-mono font-bold" />
                  <span class="text-[12px] text-gray">/ {{ assignmentDetail.max_score }}</span>
                </div>
                <textarea v-model="grading[sub.id].feedback" rows="2" placeholder="feedback ให้นักเรียน (ไม่บังคับ)"
                          class="w-full border-2 border-dark rounded-lg px-2.5 py-1.5 text-[12.5px] resize-none" />
                <p v-if="grading[sub.id].error" class="text-[11.5px] text-red font-semibold">
                  {{ grading[sub.id].error }}
                </p>
                <div class="flex items-center gap-2">
                  <button type="button" @click="saveGrading(sub)" :disabled="grading[sub.id].saving"
                          class="flex-1 border-2 border-dark rounded-lg py-1.5 text-[12.5px] font-bold bg-purple text-white hover:opacity-90 transition disabled:opacity-50">
                    {{ grading[sub.id].saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน' }}
                  </button>
                  <button type="button" @click="cancelGrading(sub.id)" :disabled="grading[sub.id].saving"
                          class="border-2 border-dark rounded-lg px-3 py-1.5 text-[12.5px] font-semibold hover:bg-gray-light transition disabled:opacity-50">
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>