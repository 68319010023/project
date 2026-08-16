<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')

const assignment = ref(null)
const isTeacher = ref(false)
const classroomName = ref('')

// ฝั่งนักเรียน
const mySubmission = ref(null)
const submissionUrl = ref('')
const submissionFile = ref(null)
const fileInputRef = ref(null)
const submitting = ref(false)
const submitError = ref('')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ฝั่งครู
const roster = ref([]) // [{ student_id, name, submission }]
const savingScoreFor = ref(null)

const submittedCount = computed(() => roster.value.filter((r) => r.submission).length)

async function fetchData() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, description, due_date, attachment_path, attachment_name, classroom_id, created_at')
      .eq('id', route.params.assignmentId)
      .single()
    if (assignmentError) throw assignmentError
    assignment.value = assignmentData

    const { data: classroomData, error: classroomError } = await supabase
      .from('classrooms')
      .select('name, teacher_id')
      .eq('id', assignmentData.classroom_id)
      .single()
    if (classroomError) throw classroomError
    classroomName.value = classroomData.name
    isTeacher.value = classroomData.teacher_id === user.id

    if (isTeacher.value) {
      // รายชื่อนักเรียนในห้อง + สถานะการส่งของแต่ละคน
      const { data: enrollments, error: enrollError } = await supabase
        .from('classroom_enrollments')
        .select('student_id, profiles ( name )')
        .eq('classroom_id', assignmentData.classroom_id)
      if (enrollError) throw enrollError

      const { data: submissions, error: subError } = await supabase
        .from('assignment_submissions')
        .select('id, student_id, submission_url, file_path, file_name, submitted_at, score')
        .eq('assignment_id', assignmentData.id)
      if (subError) throw subError

      const submissionByStudent = new Map((submissions || []).map((s) => [s.student_id, s]))

      roster.value = (enrollments || []).map((e) => ({
        student_id: e.student_id,
        name: e.profiles?.name || 'ไม่ระบุชื่อ',
        submission: submissionByStudent.get(e.student_id) || null,
      }))
    } else {
      // การส่งงานของตัวเอง (ถ้ามี)
      const { data: submission, error: subError } = await supabase
        .from('assignment_submissions')
        .select('id, submission_url, file_path, file_name, submitted_at, score, feedback')
        .eq('assignment_id', assignmentData.id)
        .eq('student_id', user.id)
        .maybeSingle()
      if (subError) throw subError
      mySubmission.value = submission
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึง'
  } finally {
    loading.value = false
  }
}

function handleFileChange(e) {
  submitError.value = ''
  const selected = e.target.files[0]
  if (!selected) {
    submissionFile.value = null
    return
  }
  if (selected.size > MAX_FILE_SIZE) {
    submitError.value = 'ไฟล์ต้องมีขนาดไม่เกิน 10MB'
    e.target.value = ''
    submissionFile.value = null
    return
  }
  submissionFile.value = selected
}

function removeFile() {
  submissionFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function submitWork() {
  submitError.value = ''
  const trimmedUrl = submissionUrl.value.trim()

  if (!trimmedUrl && !submissionFile.value) {
    submitError.value = 'กรุณาใส่ลิงก์ หรือแนบไฟล์งานของคุณ'
    return
  }

  submitting.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('เซสชันหมดอายุ')

    let filePath = mySubmission.value?.file_path || null
    let fileName = mySubmission.value?.file_name || null

    // อัปโหลดไฟล์ก่อน (ถ้ามีไฟล์ใหม่แนบเข้ามา) เก็บแค่ path เพราะ bucket เป็น private
    if (submissionFile.value) {
      const fileExt = submissionFile.value.name.split('.').pop()
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
      const newPath = `${assignment.value.id}/${user.id}/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('submission-files')
        .upload(newPath, submissionFile.value)
      if (uploadError) throw uploadError

      filePath = newPath
      fileName = submissionFile.value.name
    }

    const { data, error } = await supabase
      .from('assignment_submissions')
      .upsert(
        {
          assignment_id: assignment.value.id,
          student_id: user.id,
          submission_url: trimmedUrl || null,
          file_path: filePath,
          file_name: fileName,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'assignment_id,student_id' }
      )
      .select()
      .single()

    if (error) throw error

    mySubmission.value = data
    submissionUrl.value = ''
    removeFile()
  } catch (err) {
    console.error(err)
    submitError.value = 'ส่งงานไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    submitting.value = false
  }
}

async function unsubmitWork() {
  if (!mySubmission.value) return
  submitting.value = true
  submitError.value = ''

  try {
    const { error } = await supabase
      .from('assignment_submissions')
      .delete()
      .eq('id', mySubmission.value.id)
    if (error) throw error

    mySubmission.value = null
  } catch (err) {
    console.error(err)
    submitError.value = 'ยกเลิกการส่งไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    submitting.value = false
  }
}

async function saveScore(row) {
  if (!row.submission) return
  savingScoreFor.value = row.student_id

  try {
    const { error } = await supabase
      .from('assignment_submissions')
      .update({ score: row.submission.score })
      .eq('id', row.submission.id)
    if (error) throw error
  } catch (err) {
    console.error(err)
  } finally {
    savingScoreFor.value = null
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const openingPath = ref(null)

// ไฟล์แนบของโจทย์การบ้าน (bucket: assignment-files) — private bucket ต้องขอ signed URL ทุกครั้งที่จะเปิด
async function openAssignmentAttachment() {
  if (!assignment.value?.attachment_path) return
  openingPath.value = assignment.value.attachment_path
  try {
    const { data, error } = await supabase.storage
      .from('assignment-files')
      .createSignedUrl(assignment.value.attachment_path, 60)
    if (error) throw error
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    console.error(err)
  } finally {
    openingPath.value = null
  }
}

// ไฟล์ที่นักเรียนส่ง (bucket: submission-files)
async function openSubmissionFile(path) {
  if (!path) return
  openingPath.value = path
  try {
    const { data, error } = await supabase.storage
      .from('submission-files')
      .createSignedUrl(path, 60)
    if (error) throw error
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    console.error(err)
  } finally {
    openingPath.value = null
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <router-link
        v-if="assignment"
        :to="`/classrooms/${assignment.classroom_id}`"
        class="mb-4 inline-block text-sm text-[#8A8072] hover:text-[#2A2521]"
      >
        ‹ {{ classroomName }}
      </router-link>

      <div v-if="loading" class="py-20 text-center text-[#8A8072]">กำลังโหลด...</div>

      <div v-else-if="errorMsg"
        class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-4 py-4 text-center text-sm font-medium text-[#B8402A]">
        {{ errorMsg }}
      </div>

      <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <!-- เนื้อหางาน -->
        <section class="note-card p-6 lg:col-span-2">
          <div class="mb-4 flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6B4A]/10 text-lg">
              📋
            </div>
            <div class="min-w-0">
              <h1 class="title-font text-xl font-bold text-[#2A2521]">{{ assignment.title }}</h1>
              <p class="mt-1 text-xs text-[#B0A692]">
                สร้างเมื่อ {{ formatDate(assignment.created_at) }}
                <template v-if="assignment.due_date"> · กำหนดส่ง {{ formatDate(assignment.due_date) }}</template>
              </p>
            </div>
          </div>

          <p v-if="assignment.description" class="whitespace-pre-line text-sm text-[#2A2521]">
            {{ assignment.description }}
          </p>
          <p v-else class="text-sm text-[#B0A692]">ไม่มีรายละเอียดเพิ่มเติม</p>

          <button
            v-if="assignment.attachment_path"
            @click="openAssignmentAttachment"
            :disabled="openingPath === assignment.attachment_path"
            class="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-[#E4DCC8] bg-[#FBF6EC] px-3.5 py-2.5 text-sm font-medium text-[#2A2521] transition-colors hover:border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/5 disabled:opacity-60"
          >
            📎 {{ openingPath === assignment.attachment_path ? 'กำลังเปิด...' : (assignment.attachment_name || 'ไฟล์แนบ') }}
          </button>
        </section>

        <!-- ฝั่งนักเรียน: ส่งงาน -->
        <aside v-if="!isTeacher" class="note-card h-fit p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="title-font text-sm font-semibold text-[#2A2521]">งานของคุณ</h2>
            <span
              v-if="mySubmission"
              class="rounded-full bg-[#7C9473]/10 px-2.5 py-0.5 text-xs font-medium text-[#4E5F49]"
            >
              ส่งแล้ว
            </span>
            <span v-else class="rounded-full bg-[#E4DCC8]/50 px-2.5 py-0.5 text-xs font-medium text-[#8A8072]">
              ยังไม่ส่ง
            </span>
          </div>

          <template v-if="mySubmission">
            <a
              v-if="mySubmission.submission_url"
              :href="mySubmission.submission_url"
              target="_blank"
              rel="noopener noreferrer"
              class="mb-1 block truncate rounded-xl border-2 border-[#E4DCC8] bg-[#FBF6EC] px-3 py-2 text-xs font-medium text-[#2A2521] hover:border-[#FF6B4A]/40"
            >
              🔗 {{ mySubmission.submission_url }}
            </a>
            <button
              v-if="mySubmission.file_path"
              @click="openSubmissionFile(mySubmission.file_path)"
              :disabled="openingPath === mySubmission.file_path"
              class="mb-1 block w-full truncate rounded-xl border-2 border-[#E4DCC8] bg-[#FBF6EC] px-3 py-2 text-left text-xs font-medium text-[#2A2521] hover:border-[#FF6B4A]/40 disabled:opacity-60"
            >
              📎 {{ openingPath === mySubmission.file_path ? 'กำลังเปิด...' : (mySubmission.file_name || 'ไฟล์ที่ส่ง') }}
            </button>
            <p class="mb-3 text-xs text-[#B0A692]">ส่งเมื่อ {{ formatDate(mySubmission.submitted_at) }}</p>

            <p v-if="mySubmission.score !== null" class="mb-3 text-sm font-medium text-[#2A2521]">
              คะแนน: <span class="text-[#FF6B4A]">{{ mySubmission.score }}</span>
            </p>

            <button
              @click="unsubmitWork"
              :disabled="submitting"
              class="w-full rounded-full border-2 border-[#E4DCC8] py-2 text-xs font-semibold text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/30 disabled:opacity-60"
            >
              {{ submitting ? 'กำลังยกเลิก...' : 'ยกเลิกการส่ง' }}
            </button>
          </template>

          <template v-else>
            <input
              v-model="submissionUrl"
              type="url"
              placeholder="วางลิงก์งานของคุณ เช่น https://github.com/..."
              class="mb-2 w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3 py-2 text-xs text-[#2A2521] placeholder-[#B0A692] outline-none transition-colors focus:border-[#FF6B4A]"
              :disabled="submitting"
            />

            <p class="mb-2 text-center text-[10px] uppercase tracking-wide text-[#B0A692]">หรือ</p>

            <div v-if="!submissionFile" class="mb-2">
              <label
                class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FBF6EC] px-3 py-3 text-xs text-[#8A8072] transition-colors hover:border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/5"
              >
                📎 แนบไฟล์ (สูงสุด 10MB)
                <input
                  ref="fileInputRef"
                  type="file"
                  class="hidden"
                  :disabled="submitting"
                  @change="handleFileChange"
                />
              </label>
            </div>
            <div
              v-else
              class="mb-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FFFDF8] px-3 py-2"
            >
              <span class="text-sm">📄</span>
              <span class="min-w-0 flex-1 truncate text-xs text-[#2A2521]">{{ submissionFile.name }}</span>
              <button
                type="button"
                @click="removeFile"
                :disabled="submitting"
                class="shrink-0 text-xs font-semibold text-[#B8402A] hover:underline"
              >
                ลบ
              </button>
            </div>

            <p v-if="submitError" class="mb-2 text-xs font-medium text-[#B8402A]">{{ submitError }}</p>
            <button
              @click="submitWork"
              :disabled="submitting"
              class="stamp-btn w-full rounded-full bg-[#FF6B4A] py-2 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              {{ submitting ? 'กำลังส่ง...' : 'ส่งงาน' }}
            </button>
          </template>
        </aside>

        <!-- ฝั่งครู: สถานะการส่งของนักเรียนทุกคน -->
        <section v-else class="note-card p-6 lg:col-span-3">
          <h2 class="title-font mb-4 font-semibold text-[#2A2521]">
            การส่งงาน ({{ submittedCount }}/{{ roster.length }} คน)
          </h2>

          <div v-if="roster.length === 0" class="py-8 text-center text-sm text-[#8A8072]">
            ยังไม่มีนักเรียนในห้องนี้
          </div>

          <ul v-else class="space-y-2.5">
            <li
              v-for="row in roster" :key="row.student_id"
              class="flex flex-col gap-2 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FFFDF8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-[11px] font-semibold text-white">
                  {{ row.name.trim().charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm text-[#2A2521]">{{ row.name }}</p>
                  <a
                    v-if="row.submission?.submission_url"
                    :href="row.submission.submission_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block truncate text-xs text-[#B8402A] hover:underline"
                  >
                    🔗 {{ row.submission.submission_url }}
                  </a>
                  <button
                    v-if="row.submission?.file_path"
                    @click="openSubmissionFile(row.submission.file_path)"
                    :disabled="openingPath === row.submission.file_path"
                    class="block truncate text-left text-xs text-[#B8402A] hover:underline disabled:opacity-60"
                  >
                    📎 {{ openingPath === row.submission.file_path ? 'กำลังเปิด...' : (row.submission.file_name || 'ไฟล์ที่ส่ง') }}
                  </button>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                <span
                  v-if="row.submission"
                  class="rounded-full bg-[#7C9473]/10 px-2.5 py-0.5 text-xs font-medium text-[#4E5F49]"
                >
                  ส่งแล้ว
                </span>
                <span v-else class="rounded-full bg-[#E4DCC8]/50 px-2.5 py-0.5 text-xs font-medium text-[#8A8072]">
                  ยังไม่ส่ง
                </span>

                <template v-if="row.submission">
                  <input
                    v-model.number="row.submission.score"
                    type="number"
                    placeholder="คะแนน"
                    class="w-16 rounded-lg border-2 border-[#E4DCC8] bg-[#FFFDF8] px-2 py-1 text-xs text-[#2A2521] outline-none focus:border-[#FF6B4A]"
                  />
                  <button
                    @click="saveScore(row)"
                    :disabled="savingScoreFor === row.student_id"
                    class="rounded-full bg-[#FF6B4A] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {{ savingScoreFor === row.student_id ? '...' : 'บันทึก' }}
                  </button>
                </template>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 2px 8px rgba(42, 37, 33, 0.06);
}
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #F1EADC;
  border-radius: 0 18px 0 18px;
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
}
</style>