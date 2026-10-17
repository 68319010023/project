<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Calendar, Star, MessageSquareText,
  Paperclip, Link2, Upload, ExternalLink, X, Send, ImageIcon,
  ArrowLeft, Check, Lock, Hourglass
} from 'lucide-vue-next'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import { getClassroomColorById } from '../../lib/classroomColors'
import AppNavbar from '../../components/AppNavbar.vue'
const route = useRoute()
const router = useRouter()
const classroomId = route.params.id
const assignmentId = route.params.assignmentId

const { user } = useAuth()

const roomColor = getClassroomColorById(classroomId)

const {
  assignmentDetail, assignmentDetailLoading, loadAssignmentDetail,
  mySubmission, mySubmissionLoading, loadMySubmission,
  submissionItems, submissionItemsLoading,
  ensureSubmission, addSubmissionItem, unsubmit,
  getSubmissionUrl, getAssignmentAttachmentUrl, formatDate, isLate,
} = useClassroomDetail(classroomId)

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']

function isImageLabel(label) {
  if (!label) return false
  const ext = label.includes('.') ? label.slice(label.lastIndexOf('.') + 1).toLowerCase() : ''
  return IMAGE_EXTENSIONS.includes(ext)
}
// --- เอกสารประกอบจากครู (หลายไฟล์/ลิงก์) ---
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
// --- staging: ยังไม่ยิงขึ้น DB จนกว่าจะกด "ส่ง" ---
// pendingFiles แต่ละรายการเป็นได้ 2 แบบ:
//   ใหม่จริง:      { tempId, file, previewUrl }
//   ของเดิมที่เคยส่งไปแล้ว (มาจากการกดยกเลิก): { tempId, existingUrl, label, previewUrl }
const pendingFiles = ref([])
const pendingLinks = ref([])   // [{ tempId, url, label }]

const linkUrlInput = ref('')
const linkError = ref('')

const fileInput = ref(null)

const submitting = ref(false)
const submitError = ref('')



// --- ยกเลิกการส่ง ---
const unsubmitting = ref(false)
const confirmingUnsubmit = ref(false)

// --- preview url ของไฟล์รูปที่ส่งไปแล้ว (ต้องขอ signed url เพราะ bucket private) ---
const itemPreviewUrls = ref({}) // { [itemId]: signedUrl }

const hasSubmitted = computed(() => submissionItems.value.length > 0)

const isGraded = computed(
  () => mySubmission.value?.score !== null && mySubmission.value?.score !== undefined
)
const hasPending = computed(() => pendingFiles.value.length > 0 || pendingLinks.value.length > 0)

// แยกรูปภาพออกจากไฟล์อื่น สำหรับ layout ที่ต่างกัน (รูป = grid เล็ก, อื่นๆ = list)
const imageItems = computed(() =>
  submissionItems.value.filter((i) => i.type === 'file' && isImageLabel(i.label))
)
const otherItems = computed(() =>
  submissionItems.value.filter((i) => !(i.type === 'file' && isImageLabel(i.label)))
)

// --- ข้อมูลสำหรับ UI ---
const teacherProfile = computed(() => assignmentDetail.value?.classrooms?.profiles ?? null)
const teacherName = computed(() =>
  teacherProfile.value ? `${teacherProfile.value.name ?? ''} ${teacherProfile.value.lastname ?? ''}`.trim() : ''
)
const teacherInitials = computed(
  () => (teacherProfile.value?.name?.[0] ?? '') + (teacherProfile.value?.lastname?.[0] ?? '')
)

// ชิปเวลา: บอกว่าเหลือกี่วัน / ส่งตรงเวลา / ส่งล่าช้า
const dueChip = computed(() => {
  const due = assignmentDetail.value?.due_date
  if (!due) return null

  if (hasSubmitted.value) {
    return isLate(due, mySubmission.value?.submitted_at)
      ? { text: 'ส่งล่าช้า', cls: 'bg-[#ffcdd2]' }
      : { text: 'ส่งตรงเวลา', cls: 'bg-[#c8e6c9]' }
  }
  if (isLate(due)) return { text: 'เลยกำหนดส่งแล้ว', cls: 'bg-[#ffcdd2]' }

  const daysLeft = Math.ceil((new Date(due) - new Date()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 1) return { text: 'ส่งภายในพรุ่งนี้!', cls: 'bg-orange' }
  if (daysLeft <= 3) return { text: `เหลืออีก ${daysLeft} วัน`, cls: 'bg-orange' }
  return { text: `เหลืออีก ${daysLeft} วัน`, cls: 'bg-white' }
})

// ไทม์ไลน์สถานะ: มอบหมาย -> ส่งแล้ว -> ตรวจแล้ว
const steps = computed(() => [
  { label: 'มอบหมาย', done: true },
  { label: 'ส่งแล้ว', done: hasSubmitted.value },
  { label: 'ตรวจแล้ว', done: isGraded.value },
])

// คะแนน
const scorePercent = computed(() => {
  const max = assignmentDetail.value?.max_score
  if (!isGraded.value || !max) return 0
  return Math.min(100, Math.round((mySubmission.value.score / max) * 100))
})
const scoreBg = computed(() => {
  if (scorePercent.value >= 80) return 'bg-[#c8e6c9]'
  if (scorePercent.value >= 50) return 'bg-[#ffe0b2]'
  return 'bg-[#ffcdd2]'
})
const scoreCheer = computed(() => {
  if (scorePercent.value === 100) return 'เต็มเลย! เก่งมาก 🎉'
  if (scorePercent.value >= 80) return 'ยอดเยี่ยม!'
  if (scorePercent.value >= 50) return 'ทำได้ดี พัฒนาต่อไปนะ'
  return 'ไม่เป็นไร ลองอ่านความเห็นครูแล้วพยายามต่อนะ'
})

watch(submissionItems, async (items) => {
  for (const item of items) {
    if (item.type === 'file' && isImageLabel(item.label) && !itemPreviewUrls.value[item.id]) {
      const url = await getSubmissionUrl(item.url)
      if (url) itemPreviewUrls.value = { ...itemPreviewUrls.value, [item.id]: url }
    }
  }
}, { immediate: true })



// --- staging: เพิ่ม/ลบไฟล์ ---
function triggerFilePicker() {
  fileInput.value?.click()
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files || [])
  for (const file of files) {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    pendingFiles.value.push({
      tempId: crypto.randomUUID(),
      file,
      previewUrl,
    })
  }
  e.target.value = ''
}

function removePendingFile(tempId) {
  const target = pendingFiles.value.find((f) => f.tempId === tempId)
  // revoke เฉพาะ blob url ที่เราสร้างเอง (ไฟล์ใหม่) ไม่ใช่ signed url จาก server (ของเดิม)
  if (target?.file && target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  pendingFiles.value = pendingFiles.value.filter((f) => f.tempId !== tempId)
}

// --- staging: เพิ่ม/ลบลิงก์ ---
function handleAddLinkToPending() {
  linkError.value = ''
  const url = linkUrlInput.value.trim()

  if (!url) return

  try {
    new URL(url)
  } catch {
    linkError.value = 'ลิงก์ไม่ถูกต้อง กรุณาใส่ URL ที่ขึ้นต้นด้วย http:// หรือ https://'
    return
  }

  pendingLinks.value.push({
    tempId: crypto.randomUUID(),
    url,
    label: url,
  })
  linkUrlInput.value = ''
}

function removePendingLink(tempId) {
  pendingLinks.value = pendingLinks.value.filter((l) => l.tempId !== tempId)
}

// --- ส่งจริง: อัปโหลดไฟล์ใหม่ + อ้างอิงไฟล์เดิม + insert ลิงก์ ทั้งหมดทีเดียว ---
async function handleSubmitAll() {
  submitError.value = ''

  // เช็ค auth ก่อนเสมอ: session อาจหมดอายุ/ถูก sign out ระหว่างที่เปิดหน้านี้ค้างไว้
  // (onAuthStateChange ใน useAuth.js จะเซ็ต user.value = null แบบ realtime)
  // ถ้าไม่เช็คตรงนี้ user.value.id ด้านล่างจะ throw ทันที
  if (!user.value) {
    submitError.value = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
    router.push('/login')
    return
  }

  if (!hasPending.value) {
    submitError.value = 'กรุณาแนบไฟล์หรือลิงก์อย่างน้อย 1 อย่างก่อนส่ง'
    return
  }

   submitting.value = true

  // 1) อัปโหลดไฟล์ใหม่ขึ้น storage พร้อมกัน (ยังไม่แตะ DB)
  const newFiles = pendingFiles.value.filter((p) => p.file)
  const uploads = await Promise.allSettled(
    newFiles.map(async (p) => {
      const ext = p.file.name.includes('.')
        ? p.file.name.slice(p.file.name.lastIndexOf('.'))
        : ''
      const filePath = `${assignmentId}/${user.value.id}/${crypto.randomUUID()}${ext}`
      const { error } = await supabase.storage
        .from('submission-files')
        .upload(filePath, p.file)
      if (error) throw error
      return { filePath, label: p.file.name }
    })
  )

  const uploaded = uploads
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
  const failedNames = newFiles
    .filter((_, i) => uploads[i].status === 'rejected')
    .map((p) => p.file.name)

  if (failedNames.length > 0) {
    console.error('upload failed:', failedNames)
    // ลบไฟล์ที่อัปโหลดสำเร็จแล้วทิ้ง (all-or-nothing) ไม่ให้ไฟล์ค้างใน storage
    if (uploaded.length > 0) {
      await supabase.storage
        .from('submission-files')
        .remove(uploaded.map((u) => u.filePath))
    }
    submitError.value = `อัปโหลดไม่สำเร็จ: ${failedNames.join(', ')} ลองใหม่อีกครั้ง`
    submitting.value = false
    return
  }

  // 2) อัปโหลดครบแล้วค่อยสร้างแถวส่งงาน
  const submissionId = await ensureSubmission(assignmentId, user.value.id)
  if (!submissionId) {
    submitError.value = 'ส่งงานไม่สำเร็จ ลองใหม่อีกครั้ง'
    submitting.value = false
    return
  }

  // 3) insert รายการทั้งหมด (ทีละรายการ เพราะ addSubmissionItem โหลดรายการซ้ำทุกครั้ง)
  const items = [
    ...pendingFiles.value
      .filter((p) => p.existingUrl)
      .map((p) => ({ type: 'file', url: p.existingUrl, label: p.label })),
    ...uploaded.map((u) => ({ type: 'file', url: u.filePath, label: u.label })),
    ...pendingLinks.value.map((l) => ({ type: 'link', url: l.url, label: l.label })),
  ]

  for (const item of items) {
    const { error } = await addSubmissionItem(submissionId, item)
    if (error) {
      submitError.value = `บันทึก "${item.label}" ไม่สำเร็จ ลองใหม่อีกครั้ง`
      submitting.value = false
      return
    }
  }


  pendingFiles.value.forEach((f) => f.file && f.previewUrl && URL.revokeObjectURL(f.previewUrl))
  pendingFiles.value = []
  pendingLinks.value = []
  submitting.value = false
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

// ยกเลิก: ลบ metadata การส่งออกจาก DB แต่ดึงรายการเดิมกลับมาโชว์เป็น staging
// (ไฟล์จริงยังอยู่ใน storage ไม่ได้ถูกลบ แค่ลบ record ว่า "ส่งแล้ว" เท่านั้น)
async function handleUnsubmit() {
  // งานที่ตรวจแล้วห้ามยกเลิก (กันซ้ำอีกชั้นนอกจากซ่อนปุ่ม)
  if (isGraded.value) {
    confirmingUnsubmit.value = false
    return
  }

  // เช็ค auth เช่นเดียวกับตอนส่งงาน — ป้องกัน session หมดอายุระหว่างเปิดหน้าค้างไว้
  if (!user.value) {
    alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง')
    router.push('/login')
    return
  }

  if (!mySubmission.value?.id) {
    alert('ไม่พบข้อมูลการส่งงาน ลองรีเฟรชหน้าใหม่อีกครั้ง')
    return
  }

  unsubmitting.value = true

  const previousItems = [...submissionItems.value]

  const { error } = await unsubmit(mySubmission.value.id)

  unsubmitting.value = false
  confirmingUnsubmit.value = false

  if (error) {
    alert('ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง')
    return
  }

  for (const item of previousItems) {
    if (item.type === 'file') {
      pendingFiles.value.push({
        tempId: crypto.randomUUID(),
        existingUrl: item.url,
        label: item.label,
        previewUrl: itemPreviewUrls.value[item.id] || null,
      })
    } else {
      pendingLinks.value.push({
        tempId: crypto.randomUUID(),
        url: item.url,
        label: item.label,
      })
    }
  }
}

onMounted(async () => {
  // เช็ค auth ตั้งแต่ mount — กันเคสเข้าหน้านี้มาโดย user ยังไม่พร้อม (ปกติ router guard กันไว้แล้ว
  // แต่เช็คซ้ำที่นี่เผื่อ component ถูก mount ไว้ก่อน auth state จะพร้อมจริงๆ)
  if (!user.value) {
    router.push('/login')
    return
  }

  await loadAssignmentDetail(assignmentId)
  await loadMySubmission(assignmentId, user.value.id)
  await loadTeacherAttachments()          // ✅ เรียกหลังโหลด assignmentDetail แล้ว (fallback งานเก่าใช้ได้)
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">

    <!-- Header -->
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/student' },
      { label: assignmentDetail?.classrooms?.name ?? '...', to: `/classroom/${classroomId}` },
      { label: assignmentDetail?.title ?? '...' }
    ]" />

    <div v-if="assignmentDetailLoading" class="text-center text-gray text-[13px] py-16">
      กำลังโหลด...
    </div>

    <div v-else-if="!assignmentDetail" class="flex flex-col items-center gap-4 text-center py-20">
      <p class="text-gray text-[15px]">ไม่พบการบ้านนี้</p>
      <router-link :to="{ name: 'classroom-detail', params: { id: classroomId } }"
        class="px-5 py-2.5 rounded-lg border-2 border-dark bg-purple text-dark font-semibold text-[14px] shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
        กลับหน้าห้องเรียน
      </router-link>
    </div>

    <template v-else>
      <!-- ===== แถบหัวเรื่อง ===== -->
      <div class="relative overflow-hidden border-b-[3px] border-dark px-6 py-8"
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

          <h1 class="font-mali font-bold text-3xl text-dark break-words">{{ assignmentDetail.title }}</h1>

          <div class="mt-3 flex flex-wrap items-center gap-2.5">
            <span v-if="teacherName"
              class="inline-flex items-center gap-2 border-2 border-dark rounded-full pl-1 pr-3 py-1 bg-white/80 text-[13px] font-semibold text-dark">
              <span class="w-6 h-6 rounded-full border-2 border-dark overflow-hidden bg-purple-light flex items-center justify-center
                           text-[10px] font-bold font-mali">
                <img v-if="teacherProfile?.img" :src="teacherProfile.img" class="w-full h-full object-cover" alt="" />
                <span v-else>{{ teacherInitials }}</span>
              </span>
              ครู{{ teacherName }}
            </span>

            <span v-if="assignmentDetail.due_date"
              class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[12.5px] font-semibold text-dark">
              <Calendar :size="14" :stroke-width="2.5" />
              ส่งภายใน {{ formatDate(assignmentDetail.due_date) }}
            </span>

            <span v-if="dueChip"
              class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 text-[12.5px] font-bold text-dark shadow-[2px_2px_0_#1a1a1a]"
              :class="dueChip.cls">
              <Hourglass :size="13" :stroke-width="2.5" />
              {{ dueChip.text }}
            </span>

            <span
              class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[12.5px] font-semibold text-dark">
              <Star :size="14" :stroke-width="2.5" />
              {{ assignmentDetail.max_score }} คะแนน
            </span>
          </div>
        </div>
      </div>

      <main class="max-w-[1000px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <!-- ซ้าย: เนื้อหางาน -->
        <div class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6">
          <h2 class="font-mali font-bold text-[16px] text-dark mb-3">รายละเอียดงาน</h2>

          <p v-if="assignmentDetail.description" class="text-[14.5px] text-dark leading-relaxed whitespace-pre-wrap">
            {{ assignmentDetail.description }}
          </p>
          <p v-else class="text-[13.5px] text-gray">ไม่มีรายละเอียดเพิ่มเติม</p>

                 <!-- เอกสารประกอบจากครู (หลายไฟล์/ลิงก์) -->
          <div v-if="teacherAttachments.length > 0" class="mt-6 pt-5 border-t-[3px] border-dashed border-dark/20">
            <p class="text-[12px] font-bold text-gray font-mono uppercase mb-2.5">
              เอกสารประกอบจากครู ({{ teacherAttachments.length }})
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
                      {{ att.type === 'link' ? 'กดเพื่อเปิดลิงก์' : 'กดเพื่อเปิดไฟล์จากครู' }}
                    </p>
                  </div>
                  <ExternalLink :size="16" :stroke-width="2.5" class="shrink-0" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- ขวา: งานของคุณ -->
        <div class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-5 flex flex-col gap-4
                    lg:sticky lg:top-6">
          <div class="flex items-center justify-between">
            <h2 class="font-mali font-bold text-[16px] text-dark">งานของคุณ</h2>

            <span v-if="mySubmissionLoading" class="text-[11px] text-gray">...</span>
            <span v-else-if="isGraded"
              class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-green-100 text-green-dark">
              ✓ ตรวจแล้ว
            </span>
            <span v-else-if="hasSubmitted && isLate(assignmentDetail.due_date, mySubmission?.submitted_at)"
              class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-red-100 text-red-600">
              ส่งล่าช้า
            </span>
            <span v-else-if="hasSubmitted"
              class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light text-dark">
              ส่งแล้ว
            </span>
            <span v-else-if="isLate(assignmentDetail.due_date)"
              class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-red-100 text-red-600">
              เลยกำหนดส่ง
            </span>
            <span v-else
              class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-orange text-dark">
              ยังไม่ส่ง
            </span>
          </div>

          <!-- ไทม์ไลน์สถานะ -->
          <ol class="flex items-start px-1">
            <li v-for="(s, idx) in steps" :key="s.label" class="flex items-start" :class="idx < steps.length - 1 ? 'flex-1' : ''">
              <div class="flex flex-col items-center gap-1">
                <span class="w-7 h-7 rounded-full border-[3px] border-dark flex items-center justify-center transition"
                  :class="s.done ? 'bg-[#c8e6c9]' : 'bg-white'">
                  <Check v-if="s.done" :size="14" :stroke-width="3.5" />
                </span>
                <span class="text-[11px] font-semibold" :class="s.done ? 'text-dark' : 'text-gray'">{{ s.label }}</span>
              </div>
              <div v-if="idx < steps.length - 1" class="flex-1 h-[3px] mx-1.5 mt-[12px] rounded"
                :class="steps[idx + 1].done ? 'bg-dark' : 'bg-dark/20'" />
            </li>
          </ol>

          <!-- การ์ดคะแนน -->
          <div v-if="isGraded" class="rounded-xl border-[3px] border-dark p-4 flex flex-col gap-3" :class="scoreBg">
            <div class="flex items-end gap-2">
              <span class="text-[44px] leading-none font-bold text-dark">{{ mySubmission.score }}</span>
              <span class="text-[20px] leading-none font-bold text-dark/50 mb-1">/ {{ assignmentDetail.max_score }}</span>
              <span class="ml-auto font-mono text-[12px] font-bold border-2 border-dark bg-white rounded-lg px-2 py-0.5">
                {{ scorePercent }}%
              </span>
            </div>
            <div class="h-3 border-2 border-dark rounded-full bg-white overflow-hidden">
              <div class="h-full bg-dark transition-all duration-700" :style="{ width: scorePercent + '%' }" />
            </div>
            <p class="text-[12.5px] font-medium text-dark">{{ scoreCheer }}</p>
          </div>

          <!-- ความเห็นจากครู (ฟองคำพูด) -->
          <div v-if="isGraded && mySubmission.feedback" class="flex items-start gap-2.5">
            <span class="w-8 h-8 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light flex items-center justify-center
                         text-[11px] font-bold font-mali">
              <img v-if="teacherProfile?.img" :src="teacherProfile.img" class="w-full h-full object-cover" alt="" />
              <span v-else>{{ teacherInitials }}</span>
            </span>
            <div class="flex-1 min-w-0 border-2 border-dark rounded-xl rounded-tl-none px-3 py-2 bg-white shadow-[3px_3px_0_#1a1a1a]">
              <p class="flex items-center gap-1.5 text-[11px] font-bold text-gray mb-1">
                <MessageSquareText :size="12" :stroke-width="2.5" />
                ความเห็นจากครู
              </p>
              <p class="text-[13px] text-dark leading-relaxed whitespace-pre-wrap break-words">{{ mySubmission.feedback }}</p>
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- STATE 2: ส่งแล้ว — โชว์การ์ดพรีวิวสิ่งที่ส่ง ซ่อนฟอร์มทั้งหมด -->
          <!-- ============================================================ -->
          <template v-if="hasSubmitted">
            <div v-if="submissionItemsLoading" class="text-[12.5px] text-gray text-center py-3">
              กำลังโหลด...
            </div>
            <template v-else>
              <p class="text-[12px] font-bold text-gray font-mono uppercase">สิ่งที่คุณส่ง</p>

              <!-- รูปภาพ: grid thumbnail เล็ก -->
              <div v-if="imageItems.length > 0" class="grid grid-cols-4 gap-2">
                <button v-for="item in imageItems" :key="item.id" type="button" @click="openItem(item)"
                  class="aspect-square rounded-lg overflow-hidden border-2 border-dark hover:-translate-y-0.5 transition">
                  <img v-if="itemPreviewUrls[item.id]" :src="itemPreviewUrls[item.id]" :alt="item.label"
                    class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center bg-gray-light">
                    <ImageIcon :size="16" :stroke-width="2" class="text-gray" />
                  </div>
                </button>
              </div>

              <!-- ไฟล์อื่น + ลิงก์: list -->
              <ul v-if="otherItems.length > 0" class="flex flex-col gap-2">
                <li v-for="item in otherItems" :key="item.id">
                  <button type="button" @click="openItem(item)"
                    class="w-full flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-white
                           hover:bg-gray-light hover:-translate-y-0.5 transition">
                    <Link2 v-if="item.type === 'link'" :size="14" :stroke-width="2.5" class="shrink-0 text-purple" />
                    <Paperclip v-else :size="14" :stroke-width="2.5" class="shrink-0 text-gray" />
                    <span class="flex-1 min-w-0 text-left text-[13px] text-dark truncate">{{ item.label }}</span>
                    <ExternalLink :size="12" :stroke-width="2.5" class="shrink-0 text-gray" />
                  </button>
                </li>
              </ul>
            </template>

            <!-- ตรวจแล้ว: ห้ามยกเลิก -->
            <div v-if="isGraded"
              class="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-dark/30 px-3 py-2 text-[12.5px] text-gray">
              <Lock :size="13" :stroke-width="2.5" />
              งานนี้ตรวจแล้ว ไม่สามารถยกเลิกการส่งได้
            </div>

            <!-- ยังไม่ตรวจ: ยกเลิกได้ (ปุ่มเล็ก + ขั้นยืนยัน) -->
            <template v-else>
              <button v-if="!confirmingUnsubmit" type="button" @click="confirmingUnsubmit = true"
                class="w-full text-center border-2 border-red-600 bg-white py-1.5 text-[12.5px] text-red-600 rounded-lg font-semibold
                       hover:bg-red-50 transition">
                ยกเลิกการส่ง
              </button>

              <div v-else class="rounded-lg border-2 border-dark bg-[#fff0d6] p-3 flex flex-col gap-2.5">
                <p class="text-[12.5px] text-dark leading-relaxed">
                  ยกเลิกการส่งทั้งหมดใช่ไหม? ไฟล์ที่ส่งไปจะกลับมาอยู่ในรายการเตรียมส่ง แก้ไขแล้วส่งใหม่ได้
                </p>
                <div class="flex gap-2">
                  <button type="button" @click="confirmingUnsubmit = false" :disabled="unsubmitting"
                    class="flex-1 border-2 border-dark bg-white rounded-lg py-1.5 text-[12.5px] font-semibold hover:bg-gray-light transition disabled:opacity-50">
                    ไม่ยกเลิก
                  </button>
                  <button type="button" @click="handleUnsubmit" :disabled="unsubmitting"
                    class="flex-1 border-2 border-dark bg-red-600 text-white rounded-lg py-1.5 text-[12.5px] font-semibold hover:bg-red-500 transition disabled:opacity-50">
                    {{ unsubmitting ? 'กำลังยกเลิก...' : 'ยืนยัน' }}
                  </button>
                </div>
              </div>
            </template>
          </template>

          <!-- ============================================================ -->
          <!-- STATE 1: ยังไม่ส่ง — ฟอร์มแนบไฟล์/ลิงก์ (staging) + ปุ่มส่ง -->
          <!-- ============================================================ -->
          <template v-else>
            <!-- รายการที่ staging ไว้ (ยังไม่ยิงขึ้น DB จริง — อาจเป็นไฟล์ใหม่ หรือของเดิมที่เพิ่งกดยกเลิกมา) -->
            <ul v-if="hasPending" class="flex flex-col gap-2">
              <li v-for="pending in pendingFiles" :key="pending.tempId"
                class="flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-gray-light/60">
                <img v-if="pending.previewUrl" :src="pending.previewUrl" class="w-8 h-8 rounded object-cover shrink-0" />
                <Paperclip v-else :size="14" :stroke-width="2.5" class="shrink-0 text-gray" />
                <span class="flex-1 min-w-0 text-[13px] text-dark truncate">{{ pending.file ? pending.file.name :
                  pending.label }}</span>
                <span v-if="pending.existingUrl" class="shrink-0 text-[10px] text-gray font-mono">เดิม</span>
                <button type="button" @click="removePendingFile(pending.tempId)"
                  class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50">
                  <X :size="13" :stroke-width="2.5" />
                </button>
              </li>
              <li v-for="pending in pendingLinks" :key="pending.tempId"
                class="flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-gray-light/60">
                <Link2 :size="14" :stroke-width="2.5" class="shrink-0 text-purple" />
                <span class="flex-1 min-w-0 text-[13px] text-dark truncate">{{ pending.label }}</span>
                <button type="button" @click="removePendingLink(pending.tempId)"
                  class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50">
                  <X :size="13" :stroke-width="2.5" />
                </button>
              </li>
            </ul>

            <!-- ฟอร์มแนบ -->
            <div class="flex flex-col gap-2.5 pt-3 border-t-[3px] border-dashed border-dark/20">
              <div class="flex flex-col gap-1.5">
                <input v-model="linkUrlInput" type="text" placeholder="วางลิงก์แล้วกด Enter เช่น https://..."
                  class="w-full px-3 py-2 rounded-lg border-2 border-dark text-[13px] outline-none focus:bg-gray-light transition"
                  @keyup.enter="handleAddLinkToPending" />
                <p v-if="linkError" class="text-[12px] text-red-600">{{ linkError }}</p>
              </div>

              <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileSelect" />
              <button type="button" @click="triggerFilePicker"
                class="w-full flex items-center justify-center gap-2 border-2 border-dark rounded-lg px-3 py-2 font-semibold text-[13px]
                       bg-white shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
                <Upload :size="14" :stroke-width="2.5" />
                แนบไฟล์
              </button>
            </div>

            <p v-if="submitError" class="text-[12px] text-red-600">{{ submitError }}</p>

            <!-- ปุ่มส่ง -->
            <button type="button" @click="handleSubmitAll" :disabled="submitting || !hasPending"
              class="w-full flex items-center justify-center gap-2 text-center border-dark border-[3px] bg-orange p-2.5 text-[14px] text-dark rounded-xl font-bold
                     shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
              <Send :size="15" :stroke-width="2.5" />
              {{ submitting ? 'กำลังส่ง...' : 'ส่งการบ้าน' }}
            </button>
          </template>
        </div>
      </main>
    </template>
  </div>
</template>