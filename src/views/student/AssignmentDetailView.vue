<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Calendar, Star, MessageSquareText,
  Paperclip, Link2, Upload, ExternalLink, X, Send, ImageIcon, Clock
} from 'lucide-vue-next'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import AppNavbar from '../../components/AppNavbar.vue'
const route = useRoute()
const router = useRouter()
const classroomId = route.params.id
const assignmentId = route.params.assignmentId

const { user } = useAuth()

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

// --- ไฟล์แนบโจทย์ (ของครู) ---
const openingAttachment = ref(false)

// --- ยกเลิกการส่ง ---
const unsubmitting = ref(false)

// --- preview url ของไฟล์รูปที่ส่งไปแล้ว (ต้องขอ signed url เพราะ bucket private) ---
const itemPreviewUrls = ref({}) // { [itemId]: signedUrl }
const attachmentPreviewUrl = ref(null)
const hasSubmitted = computed(() => submissionItems.value.length > 0)
const isAttachmentLink = computed(() => /^https?:\/\//.test(assignmentDetail.value?.attachment_url || ''))
const isAttachmentImage = computed(() => {
  if (isAttachmentLink.value) return false
  return isImageLabel(assignmentDetail.value?.attachment_name)
})
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

watch(submissionItems, async (items) => {
  for (const item of items) {
    if (item.type === 'file' && isImageLabel(item.label) && !itemPreviewUrls.value[item.id]) {
      const url = await getSubmissionUrl(item.url)
      if (url) itemPreviewUrls.value = { ...itemPreviewUrls.value, [item.id]: url }
    }
  }
}, { immediate: true })

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

  const submissionId = await ensureSubmission(assignmentId, user.value.id)
  if (!submissionId) {
    submitError.value = 'ส่งงานไม่สำเร็จ ลองใหม่อีกครั้ง'
    submitting.value = false
    return
  }

  for (const pending of pendingFiles.value) {
    // ไฟล์เดิมที่เคยส่งไปแล้ว (มาจากการกดยกเลิกก่อนหน้า) — ไม่ต้องอัปโหลดซ้ำ แค่ insert อ้างอิง path เดิม
    if (pending.existingUrl) {
      const { error } = await addSubmissionItem(submissionId, {
        type: 'file',
        url: pending.existingUrl,
        label: pending.label,
      })
      if (error) {
        submitError.value = `บันทึก "${pending.label}" ไม่สำเร็จ ลองใหม่อีกครั้ง`
        submitting.value = false
        return
      }
      continue
    }

    // ไฟล์ใหม่จริง — อัปโหลดขึ้น storage ก่อน
    const extension = pending.file.name.includes('.')
      ? pending.file.name.slice(pending.file.name.lastIndexOf('.'))
      : ''
    const filePath = `${assignmentId}/${user.value.id}/${crypto.randomUUID()}${extension}`

    const { error: uploadError } = await supabase.storage
      .from('submission-files')
      .upload(filePath, pending.file)

    if (uploadError) {
      console.error('upload error:', uploadError)
      submitError.value = `อัปโหลด "${pending.file.name}" ไม่สำเร็จ ลองใหม่อีกครั้ง`
      submitting.value = false
      return
    }

    const { error } = await addSubmissionItem(submissionId, {
      type: 'file',
      url: filePath,
      label: pending.file.name,
    })

    if (error) {
      submitError.value = `บันทึก "${pending.file.name}" ไม่สำเร็จ ลองใหม่อีกครั้ง`
      submitting.value = false
      return
    }
  }

  for (const pending of pendingLinks.value) {
    const { error } = await addSubmissionItem(submissionId, {
      type: 'link',
      url: pending.url,
      label: pending.label,
    })

    if (error) {
      submitError.value = 'บันทึกลิงก์บางรายการไม่สำเร็จ ลองใหม่อีกครั้ง'
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

  if (isAttachmentImage.value && assignmentDetail.value?.attachment_url) {
    attachmentPreviewUrl.value = await getAssignmentAttachmentUrl(assignmentDetail.value.attachment_url)
  }
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



    <div v-if="assignmentDetailLoading" class="text-center text-gray-400 text-[13px] py-16">
      กำลังโหลด...
    </div>

    <div v-else-if="!assignmentDetail" class="flex flex-col items-center gap-4 text-center py-20">
      <p class="text-gray-400 text-[15px]">ไม่พบการบ้านนี้</p>
      <router-link :to="{ name: 'classroom-detail', params: { id: classroomId } }"
        class="px-5 py-2.5 rounded-lg border-2 border-dark bg-purple text-dark font-semibold text-[14px] shadow-offset-sm hover:-translate-y-0.5 transition">
        กลับหน้าห้องเรียน
      </router-link>
    </div>

    <main v-else class="max-w-[1000px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      <!-- ซ้าย: เนื้อหางาน -->
      <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-6">
        <h1 class="font-mali font-bold text-xl text-dark">{{ assignmentDetail.title }}</h1>

        <p class="text-[13px] text-gray-400 mt-1.5">
          {{ assignmentDetail.classrooms?.profiles?.name }} {{ assignmentDetail.classrooms?.profiles?.lastname }}
        </p>

        <div class="flex items-center gap-4 mt-3 flex-wrap">
          <span v-if="assignmentDetail.due_date"
            class="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400 font-mono">
            <Calendar :size="14" :stroke-width="2.5" />
            ส่งภายใน {{ formatDate(assignmentDetail.due_date) }}
          </span>
          <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400 font-mono">
            <Star :size="14" :stroke-width="2.5" />
            {{ assignmentDetail.max_score }} คะแนน
          </span>
        </div>

        <hr class="border-t-2 border-gray-200 my-5" />

        <p v-if="assignmentDetail.description" class="text-[14px] text-dark leading-relaxed whitespace-pre-wrap">
          {{ assignmentDetail.description }}
        </p>
        <p v-else class="text-[13px] text-gray-400">ไม่มีรายละเอียดเพิ่มเติม</p>


        <!-- ไฟล์แนบโจทย์ (ของครู) -->
        <div v-if="assignmentDetail.attachment_url" class="mt-5 pt-4 border-t-2 border-dashed border-gray-200">
          <p class="text-[11px] font-bold text-gray-400 font-mono uppercase mb-2">เอกสารประกอบจากครู</p>

          <!-- การ์ดเอกสาร (แบบสวย) -->
          <button type="button" @click="openAttachment" :disabled="openingAttachment"
            class="w-full flex items-center gap-3 border-2 border-dark rounded-lg px-4 py-3 bg-purple-light hover:bg-purple transition disabled:opacity-50">
            <div
              class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-white overflow-hidden flex items-center justify-center">
              <img v-if="isAttachmentImage && attachmentPreviewUrl" :src="attachmentPreviewUrl"
                class="w-full h-full object-cover" />
              <ImageIcon v-else-if="isAttachmentImage" :size="18" :stroke-width="2" class="text-gray-400" />
              <Link2 v-else-if="isAttachmentLink" :size="18" :stroke-width="2.5" />
              <Paperclip v-else :size="18" :stroke-width="2.5" />
            </div>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-[13px] font-bold text-dark truncate">
                {{ assignmentDetail.attachment_name || 'เอกสารประกอบ' }}
              </p>
              <p class="text-[11px] text-gray-400">ไฟล์จากครู</p>
            </div>
            <ExternalLink :size="16" :stroke-width="2.5" class="shrink-0" />
          </button>
        </div>
      </div>

      <!-- ขวา: งานของคุณ -->
      <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h2 class="font-mali font-bold text-[15px] text-dark">งานของคุณ</h2>

          <span v-if="mySubmissionLoading" class="text-[11px] text-gray-400">...</span>
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

        <!-- คะแนน + feedback -->
        <div v-if="isGraded" class="rounded-xl border-2 border-gray-200 bg-gray-light/60 p-3.5 flex flex-col gap-2">
          <span class="inline-flex items-center gap-1.5 text-[13px] font-bold text-green-dark w-fit">
            <Star :size="14" :stroke-width="2.5" />
            {{ mySubmission.score }}/{{ assignmentDetail.max_score }}
          </span>
          <p v-if="mySubmission.feedback" class="flex items-start gap-1.5 text-[12.5px] text-gray-400 leading-relaxed">
            <MessageSquareText :size="14" :stroke-width="2.5" class="shrink-0 mt-0.5 text-purple" />
            {{ mySubmission.feedback }}
          </p>
        </div>

        <!-- ============================================================ -->
        <!-- STATE 2: ส่งแล้ว — โชว์การ์ดพรีวิวสิ่งที่ส่ง ซ่อนฟอร์มทั้งหมด -->
        <!-- ============================================================ -->
        <template v-if="hasSubmitted">
          <div v-if="submissionItemsLoading" class="text-[12.5px] text-gray-400 text-center py-3">
            กำลังโหลด...
          </div>
          <template v-else>
            <!-- รูปภาพ: grid thumbnail เล็ก -->
            <div v-if="imageItems.length > 0" class="grid grid-cols-4 gap-2">
              <button v-for="item in imageItems" :key="item.id" type="button" @click="openItem(item)"
                class="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-dark transition">
                <img v-if="itemPreviewUrls[item.id]" :src="itemPreviewUrls[item.id]" :alt="item.label"
                  class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center bg-gray-light">
                  <ImageIcon :size="16" :stroke-width="2" class="text-gray-400" />
                </div>
              </button>
            </div>

            <!-- ไฟล์อื่น + ลิงก์: list -->
            <ul v-if="otherItems.length > 0" class="flex flex-col gap-2">
              <li v-for="item in otherItems" :key="item.id">
                <button type="button" @click="openItem(item)"
                  class="w-full flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-light/60 transition">
                  <Link2 v-if="item.type === 'link'" :size="14" :stroke-width="2.5" class="shrink-0 text-purple" />
                  <Paperclip v-else :size="14" :stroke-width="2.5" class="shrink-0 text-gray-400" />
                  <span class="flex-1 min-w-0 text-left text-[13px] text-dark truncate">{{ item.label }}</span>
                  <ExternalLink :size="12" :stroke-width="2.5" class="shrink-0 text-gray-400" />
                </button>
              </li>
            </ul>
          </template>

          <!-- ยกเลิกการส่ง -->
          <button type="button" @click="handleUnsubmit" :disabled="unsubmitting"
            class="w-full text-center border-dark border-2 bg-red-600 p-2 text-[12.5px] text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-red-500 hover:text-black transition">
            {{ unsubmitting ? 'กำลังยกเลิก...' : 'ยกเลิกการส่งทั้งหมด' }}
          </button>
        </template>

        <!-- ============================================================ -->
        <!-- STATE 1: ยังไม่ส่ง — ฟอร์มแนบไฟล์/ลิงก์ (staging) + ปุ่มส่ง -->
        <!-- ============================================================ -->
        <template v-else>
          <!-- รายการที่ staging ไว้ (ยังไม่ยิงขึ้น DB จริง — อาจเป็นไฟล์ใหม่ หรือของเดิมที่เพิ่งกดยกเลิกมา) -->
          <ul v-if="hasPending" class="flex flex-col gap-2">
            <li v-for="pending in pendingFiles" :key="pending.tempId"
              class="flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-2 bg-gray-light/40">
              <img v-if="pending.previewUrl" :src="pending.previewUrl" class="w-8 h-8 rounded object-cover shrink-0" />
              <Paperclip v-else :size="14" :stroke-width="2.5" class="shrink-0 text-gray-400" />
              <span class="flex-1 min-w-0 text-[13px] text-dark truncate">{{ pending.file ? pending.file.name :
                pending.label }}</span>
              <span v-if="pending.existingUrl" class="shrink-0 text-[10px] text-gray-400 font-mono">เดิม</span>
              <button type="button" @click="removePendingFile(pending.tempId)"
                class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50">
                <X :size="13" :stroke-width="2.5" />
              </button>
            </li>
            <li v-for="pending in pendingLinks" :key="pending.tempId"
              class="flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-2 bg-gray-light/40">
              <Link2 :size="14" :stroke-width="2.5" class="shrink-0 text-purple" />
              <span class="flex-1 min-w-0 text-[13px] text-dark truncate">{{ pending.label }}</span>
              <button type="button" @click="removePendingLink(pending.tempId)"
                class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50">
                <X :size="13" :stroke-width="2.5" />
              </button>
            </li>
          </ul>

          <!-- ฟอร์มแนบ -->
          <div class="flex flex-col gap-2.5 pt-2 border-t-2 border-dashed border-gray-200">
            <div class="flex flex-col gap-1.5">
              <input v-model="linkUrlInput" type="text" placeholder="วางลิงก์แล้วกด Enter เช่น https://..."
                class="w-full px-3 py-2 rounded-lg border-2 border-dark text-[13px]"
                @keyup.enter="handleAddLinkToPending" />
              <p v-if="linkError" class="text-[12px] text-red-600">{{ linkError }}</p>
            </div>

            <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileSelect" />
            <button type="button" @click="triggerFilePicker"
              class="w-full flex items-center justify-center gap-2 border-2 border-dark rounded-lg px-3 py-2 font-semibold text-[13px] hover:bg-gray-light transition">
              <Upload :size="14" :stroke-width="2.5" />
              แนบไฟล์
            </button>
          </div>

          <p v-if="submitError" class="text-[12px] text-red-600">{{ submitError }}</p>

          <!-- ปุ่มส่ง -->
          <button type="button" @click="handleSubmitAll" :disabled="submitting || !hasPending"
            class="w-full flex items-center justify-center gap-2 text-center border-dark border-2 bg-blue-600 p-2 text-[13px] text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-500 transition">
            <Send :size="14" :stroke-width="2.5" />
            {{ submitting ? 'กำลังส่ง...' : 'ส่งการบ้าน' }}
          </button>
        </template>
      </div>
    </main>
  </div>
</template>