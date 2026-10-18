<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { getClassroomColorById } from '../../lib/classroomColors'
import AppNavbar from '../../components/AppNavbar.vue'
import {
  ArrowLeft, Calendar, Star, Paperclip, Link2, ExternalLink, Check, Pencil,
  ClipboardList, Users, Clock, CheckCircle2, Search, X, ImageIcon,
} from 'lucide-vue-next'

const route = useRoute()

const classroomId = route.params.id
const assignmentId = route.params.assignmentId

const roomColor = getClassroomColorById(classroomId)

const {
  assignmentDetail, assignmentDetailLoading, loadAssignmentDetail,
  formatDate, isLate,
  getSubmissionUrl, fetchSubmissionItems,
  getAssignmentAttachmentUrl,
} = useClassroomDetail(classroomId)

// --- เอกสารประกอบที่ครูแนบไว้ (หลายไฟล์/ลิงก์) ---
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']

function isImageLabel(label) {
  if (!label) return false
  const ext = label.includes('.') ? label.slice(label.lastIndexOf('.') + 1).toLowerCase() : ''
  return IMAGE_EXTENSIONS.includes(ext)
}

const teacherAttachments = ref([]) // [{ id, type, url, label }]
const teacherPreviewUrls = ref({}) // { [id]: signedUrl } เฉพาะไฟล์รูปภาพ
const openingAttachmentId = ref(null)

async function loadTeacherAttachments() {
  const { data, error } = await supabase
    .from('assignment_attachments')
    .select('id, type, url, label, created_at')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  let list = error ? [] : (data || [])

  // fallback: งานเก่าที่ยังไม่ได้ย้ายข้อมูล ใช้ไฟล์เดียวจากคอลัมน์เดิม
  if (list.length === 0 && assignmentDetail.value?.attachment_url) {
    const url = assignmentDetail.value.attachment_url
    list = [{
      id: 'legacy',
      type: /^https?:\/\//.test(url) ? 'link' : 'file',
      url,
      label: assignmentDetail.value.attachment_name,
    }]
  }

  teacherAttachments.value = list

  for (const att of list) {
    if (att.type === 'file' && isImageLabel(att.label)) {
      const signed = await getAssignmentAttachmentUrl(att.url)
      if (signed) teacherPreviewUrls.value = { ...teacherPreviewUrls.value, [att.id]: signed }
    }
  }
}

async function openTeacherAttachment(att) {
  if (att.type === 'link') {
    window.open(att.url, '_blank')
    return
  }
  openingAttachmentId.value = att.id
  const url = await getAssignmentAttachmentUrl(att.url)
  openingAttachmentId.value = null

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

// --- สรุปตัวเลข + ค้นหา/กรอง ---
const hasScore = (s) => s.score !== null && s.score !== undefined

const pendingCount = computed(() => submissions.value.filter((s) => !hasScore(s)).length)
const gradedCount = computed(() => submissions.value.filter(hasScore).length)

const search = ref('')
const statusFilter = ref('all') // 'all' | 'pending' | 'graded'

const STATUS_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รอตรวจ' },
  { key: 'graded', label: 'ตรวจแล้ว' },
]

const filteredSubmissions = computed(() => {
  const q = search.value.trim().toLowerCase()
  return submissions.value
    .filter((s) => {
      if (statusFilter.value === 'pending' && hasScore(s)) return false
      if (statusFilter.value === 'graded' && !hasScore(s)) return false
      if (!q) return true
      const fullName = `${s.profiles?.name ?? ''} ${s.profiles?.lastname ?? ''}`.toLowerCase()
      return fullName.includes(q)
    })
    // งานที่รอตรวจขึ้นก่อน (sort เสถียร ลำดับเวลาส่งเดิมยังคงอยู่ในแต่ละกลุ่ม)
    .sort((a, b) => Number(hasScore(a)) - Number(hasScore(b)))
})

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
  await loadTeacherAttachments()
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

    <!-- ===== แถบหัวเรื่อง ===== -->
    <div class="relative overflow-hidden border-b-[3px] border-dark px-4 sm:px-6 py-6 sm:py-8"
        :style="{ background: `linear-gradient(135deg, ${roomColor.from} 0%, ${roomColor.to} 100%)` }">
        <div class="absolute inset-0 pointer-events-none opacity-[0.12]"
          style="background-image: radial-gradient(#1a1a1a 1.5px, transparent 1.5px); background-size: 18px 18px;" />

        <div class="max-w-[1000px] mx-auto relative">
          <router-link :to="{ name: 'classroom-detail', params: { id: classroomId }, query: { tab: 'assignments' } }"
            class="inline-flex items-center gap-1.5 mb-4 h-8 px-3 rounded-full border-2 border-dark bg-white text-[12.5px] font-bold text-dark
                   shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
            <ArrowLeft :size="14" :stroke-width="3" />
            กลับห้องเรียน
          </router-link>

          <div v-if="assignmentDetailLoading" class="h-[80px] rounded-2xl bg-white/40 animate-pulse" />

          <template v-else-if="assignmentDetail">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 shrink-0 rounded-xl border-[3px] border-dark bg-white flex items-center justify-center
                          shadow-[3px_3px_0_#1a1a1a] -rotate-3">
                <ClipboardList :size="22" :stroke-width="2.5" class="text-dark" />
              </div>
              <h1 class="font-mali font-bold text-[26px] sm:text-3xl text-dark break-words min-w-0">{{ assignmentDetail.title }}</h1>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2.5">
              <span v-if="assignmentDetail.due_date"
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[11.5px] sm:text-[12.5px] font-semibold text-dark">
                <Calendar :size="14" :stroke-width="2.5" />
                ส่งภายใน {{ formatDate(assignmentDetail.due_date) }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[11.5px] sm:text-[12.5px] font-semibold text-dark">
                <Star :size="14" :stroke-width="2.5" />
                {{ assignmentDetail.max_score }} คะแนนเต็ม
              </span>
            </div>
          </template>
        </div>
      </div>

      <div class="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <p v-if="!assignmentDetailLoading && !assignmentDetail" class="text-center text-gray text-[14px] py-16">
        ไม่พบการบ้านนี้
      </p>

      <template v-else-if="assignmentDetail">
               <!-- ===== รายละเอียดงาน + ไฟล์แนบ ===== -->
        <div v-if="assignmentDetail.description || teacherAttachments.length > 0"
          class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 mb-8">
          <template v-if="assignmentDetail.description">
            <h2 class="font-mali font-bold text-[16px] text-dark mb-2">รายละเอียดงาน</h2>
            <p class="text-[14px] text-dark leading-relaxed whitespace-pre-wrap">{{ assignmentDetail.description }}</p>
          </template>

          <div v-if="teacherAttachments.length > 0"
            :class="assignmentDetail.description ? 'mt-5 pt-5 border-t-[3px] border-dashed border-dark/20' : ''">
            <p class="text-[12px] font-bold text-gray font-mono uppercase mb-2.5">
              เอกสารประกอบที่แนบไว้ ({{ teacherAttachments.length }})
            </p>

            <ul class="flex flex-col gap-2.5">
              <li v-for="att in teacherAttachments" :key="att.id">
                <button type="button" @click="openTeacherAttachment(att)" :disabled="openingAttachmentId === att.id"
                  class="w-full flex items-center gap-3 border-[3px] border-dark rounded-xl px-4 py-3 bg-purple-light
                         shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 hover:bg-purple transition disabled:opacity-50">
                  <div
                    class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark bg-white overflow-hidden flex items-center justify-center">
                    <img v-if="teacherPreviewUrls[att.id]" :src="teacherPreviewUrls[att.id]"
                      class="w-full h-full object-cover" />
                    <ImageIcon v-else-if="att.type === 'file' && isImageLabel(att.label)" :size="18" :stroke-width="2"
                      class="text-gray" />
                    <Link2 v-else-if="att.type === 'link'" :size="18" :stroke-width="2.5" />
                    <Paperclip v-else :size="18" :stroke-width="2.5" />
                  </div>
                  <div class="flex-1 min-w-0 text-left">
                    <p class="text-[13.5px] font-bold text-dark truncate">
                      {{ att.label || 'เอกสารประกอบ' }}
                    </p>
                    <p class="text-[11.5px] text-gray">
                      {{ att.type === 'link' ? 'กดเพื่อเปิดลิงก์' : 'ไฟล์ที่คุณแนบไว้' }}
                    </p>
                  </div>
                  <ExternalLink :size="16" :stroke-width="2.5" class="shrink-0" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- ===== การ์ดสรุป ===== -->
        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="bg-white border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a]">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#bbdefb] flex items-center justify-center">
              <Users :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ submissions.length }}</p>
              <p class="text-[12px] text-gray mt-1">ส่งแล้ว</p>
            </div>
          </div>

          <div class="border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a]" :class="pendingCount > 0 ? 'bg-[#ffd699]' : 'bg-white'">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-white flex items-center justify-center">
              <Clock :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ pendingCount }}</p>
              <p class="text-[12px] text-gray mt-1">รอตรวจ</p>
            </div>
          </div>

          <div class="bg-white border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a]">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#c8e6c9] flex items-center justify-center">
              <CheckCircle2 :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ gradedCount }}</p>
              <p class="text-[12px] text-gray mt-1">ตรวจแล้ว</p>
            </div>
          </div>
        </div>

        <!-- ===== หัวรายการ + ค้นหา/กรอง ===== -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="font-mali font-bold text-[17px]">
            งานที่ส่งแล้ว
            <span class="text-[13px] text-gray font-mitr font-normal">
              ({{ filteredSubmissions.length }}{{ filteredSubmissions.length !== submissions.length ? ` จาก ${submissions.length}` : '' }} คน)
            </span>
          </h2>

          <div v-if="submissions.length > 0" class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <!-- ค้นหาชื่อ -->
            <div class="relative flex-1 sm:flex-none sm:w-[200px]">
              <Search :size="15" :stroke-width="2.5"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
              <input v-model="search" type="text" placeholder="ค้นหาชื่อนักเรียน..."
                class="w-full pl-9 pr-8 py-2 rounded-lg border-2 border-dark bg-white text-[13px] text-dark
                       placeholder:text-gray outline-none focus:bg-gray-light transition" />
              <button v-if="search" type="button" @click="search = ''" aria-label="ล้างคำค้นหา"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-orange transition">
                <X :size="12" :stroke-width="3" />
              </button>
            </div>

            <!-- กรองสถานะ -->
            <div class="inline-flex border-2 border-dark rounded-lg overflow-hidden bg-white">
              <button v-for="f in STATUS_FILTERS" :key="f.key" type="button" @click="statusFilter = f.key"
                class="px-3 py-1.5 text-[12.5px] font-bold transition border-r-2 border-dark last:border-r-0"
                :class="statusFilter === f.key ? 'bg-dark text-white' : 'bg-white text-dark hover:bg-gray-light'">
                {{ f.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- ===== Grid งานที่นักเรียนส่ง ===== -->
        <div v-if="submissionsLoading" class="flex flex-wrap gap-4">
          <div v-for="n in 4" :key="n" class="w-[250px] h-[72px] border-[3px] border-dark rounded-2xl bg-gray-light animate-pulse" />
        </div>

        <p v-else-if="submissions.length === 0"
          class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ยังไม่มีใครส่งการบ้านชิ้นนี้
        </p>

        <p v-else-if="filteredSubmissions.length === 0"
          class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ไม่พบนักเรียนที่ตรงกับเงื่อนไข
        </p>

        <div v-else class="flex flex-wrap gap-4">
          <button type="button" v-for="sub in filteredSubmissions" :key="sub.id" @click="openModal(sub)"
            class="w-[250px] border-[3px] border-dark rounded-2xl shadow-[4px_4px_0_#1a1a1a] overflow-hidden transition
                   hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] text-left"
            :class="hasScore(sub) ? 'bg-white' : 'bg-[#fff0d6]'">
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
                  class="text-[10.5px] font-bold text-red-600">
                  ส่งล่าช้า
                </p>
                <p v-else class="text-[10.5px] text-gray truncate">
                  {{ formatDate(sub.submitted_at) }}
                </p>
              </div>

              <span v-if="hasScore(sub)"
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

    <!-- ===== Modal รายละเอียดการส่งงาน + ให้คะแนน ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalSub" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="closeModal">
          <div role="dialog" aria-modal="true"
            class="modal-card w-full max-w-md bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

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
            <div class="pt-3 border-t-[3px] border-dashed border-dark/20">
              <p class="text-[12px] font-bold text-gray font-mono uppercase mb-2">ไฟล์ที่ส่ง</p>
              <p v-if="itemsLoading" class="text-gray text-[12px]">กำลังโหลดไฟล์...</p>
              <p v-else-if="(itemsBySubmission[modalSub.id] || []).length === 0" class="text-gray text-[12px]">
                ไม่พบไฟล์ที่ส่ง
              </p>
              <ul v-else class="flex flex-col gap-2">
                <li v-for="item in itemsBySubmission[modalSub.id]" :key="item.id">
                  <button type="button" @click="openItem(item)"
                    class="w-full flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-white
                           hover:bg-gray-light hover:-translate-y-0.5 transition">
                    <Link2 v-if="item.type === 'link'" :size="13" :stroke-width="2.5" class="shrink-0 text-purple" />
                    <Paperclip v-else :size="13" :stroke-width="2.5" class="shrink-0 text-gray" />
                    <span class="flex-1 min-w-0 text-left text-[12.5px] text-dark truncate">{{ item.label }}</span>
                    <ExternalLink :size="11" :stroke-width="2.5" class="shrink-0 text-gray" />
                  </button>
                </li>
              </ul>
            </div>

            <!-- ให้คะแนน + feedback -->
            <div class="pt-3 border-t-[3px] border-dashed border-dark/20">
              <template v-if="!grading[modalSub.id]?.open">
                <div v-if="hasScore(modalSub)"
                  class="rounded-xl border-[3px] border-dark bg-[#c8e6c9] p-3.5 flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="inline-flex items-center gap-1.5 text-[15px] font-bold text-dark">
                      <Check :size="16" :stroke-width="3" />
                      {{ modalSub.score }} / {{ assignmentDetail.max_score }} คะแนน
                    </p>
                    <p v-if="modalSub.feedback"
                      class="text-[12.5px] text-dark mt-1.5 leading-relaxed whitespace-pre-line break-words">
                      {{ modalSub.feedback }}
                    </p>
                  </div>
                  <button type="button" @click="openGrading(modalSub)"
                    class="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold border-2 border-dark rounded-lg px-2 py-1 bg-white
                           hover:-translate-y-0.5 transition">
                    <Pencil :size="12" :stroke-width="2.5" />
                    แก้ไข
                  </button>
                </div>
                <button v-else type="button" @click="openGrading(modalSub)"
                  class="w-full border-[3px] border-dark rounded-xl py-2.5 text-[14px] font-bold bg-orange
                         shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
                  ให้คะแนน
                </button>
              </template>

              <div v-else class="flex flex-col gap-2.5">
                <div class="flex items-center gap-2">
                  <input type="number" v-model="grading[modalSub.id].score" min="0" :max="assignmentDetail.max_score"
                    placeholder="คะแนน"
                    class="w-24 border-2 border-dark rounded-lg px-2 py-1.5 text-[13px] font-mono font-bold outline-none focus:bg-gray-light" />
                  <span class="text-[12px] text-gray">/ {{ assignmentDetail.max_score }}</span>
                </div>
                <textarea v-model="grading[modalSub.id].feedback" rows="3"
                  placeholder="feedback ให้นักเรียน (ไม่บังคับ)"
                  class="w-full border-2 border-dark rounded-lg px-2.5 py-1.5 text-[12.5px] resize-none outline-none focus:bg-gray-light" />
                <p v-if="grading[modalSub.id].error" class="text-[12px] text-red-600 font-semibold">
                  {{ grading[modalSub.id].error }}
                </p>
                <div class="flex items-center gap-2">
                  <button type="button" @click="saveGrading(modalSub)" :disabled="grading[modalSub.id].saving"
                    class="flex-1 border-[3px] border-dark rounded-xl py-2 text-[13px] font-bold bg-purple shadow-[3px_3px_0_#1a1a1a]
                           hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
                    {{ grading[modalSub.id].saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน' }}
                  </button>
                  <button type="button" @click="cancelGrading(modalSub.id)" :disabled="grading[modalSub.id].saving"
                    class="border-2 border-dark rounded-xl px-3 py-2 text-[13px] font-semibold hover:bg-gray-light transition disabled:opacity-50">
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>

            <button type="button" @click="closeModal"
              class="w-full text-center border-2 border-dark rounded-xl px-3 py-2 font-semibold text-[13px] hover:bg-gray-light transition">
              ปิด
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>