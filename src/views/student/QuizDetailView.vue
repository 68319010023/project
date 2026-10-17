<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Calendar, Star, FileQuestion, Send, Clock, Check, X,
  ArrowLeft, ChevronLeft, ChevronRight, Hourglass, ListOrdered,
} from 'lucide-vue-next'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import { getClassroomColorById } from '../../lib/classroomColors'
import AppNavbar from '../../components/AppNavbar.vue'

const route = useRoute()
const router = useRouter()
const classroomId = route.params.id
const quizId = route.params.quizId

const { user } = useAuth()

const roomColor = getClassroomColorById(classroomId)

const {
  quizDetail, quizDetailLoading, loadQuizDetail,
  quizQuestions, quizQuestionsLoading, loadQuizQuestions,
  myQuizSubmission, myQuizSubmissionLoading, loadMyQuizSubmission,
  submitQuiz, formatDate, isLate,
} = useClassroomDetail(classroomId)

// { [questionId]: index ของตัวเลือก (ปรนัย) | ข้อความ (อัตนัย) }
// เก็บไว้ที่ระดับ component จึงไม่หายเมื่อสลับหน้า
const answers = ref({})
const submitting = ref(false)
const submitError = ref('')

const hasSubmitted = computed(() => !!myQuizSubmission.value)
const totalQuestions = computed(() => quizQuestions.value.length)

function isAnswered(q) {
  const v = answers.value[q.id]
  if (q.type === 'essay') return typeof v === 'string' && v.trim() !== ''
  return v !== undefined && v !== null
}

const answeredCount = computed(() => quizQuestions.value.filter(isAnswered).length)
const unansweredCount = computed(() => totalQuestions.value - answeredCount.value)
const progressPercent = computed(() =>
  totalQuestions.value ? Math.round((answeredCount.value / totalQuestions.value) * 100) : 0
)
const showConfirm = ref(false)

// --- แบ่งหน้า (หน้าละ 5 ข้อ) ---
const pageSize = 5
const currentPage = ref(1)
const questionsTop = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(totalQuestions.value / pageSize)))
const startIndex = computed(() => (currentPage.value - 1) * pageSize)
const pagedQuestions = computed(() =>
  quizQuestions.value.slice(startIndex.value, startIndex.value + pageSize)
)
const isLastPage = computed(() => currentPage.value >= totalPages.value)

async function setPage(p) {
  currentPage.value = Math.min(Math.max(1, p), totalPages.value)
  await nextTick()
  questionsTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// กระโดดไปข้อที่เลือก (สลับหน้าให้เองถ้าอยู่คนละหน้า)
async function goToQuestion(index) {
  currentPage.value = Math.floor(index / pageSize) + 1
  await nextTick()
  const q = quizQuestions.value[index]
  document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// --- ข้อมูลสำหรับ UI ---
const teacherProfile = computed(() => quizDetail.value?.classrooms?.profiles ?? null)
const teacherName = computed(() =>
  teacherProfile.value ? `${teacherProfile.value.name ?? ''} ${teacherProfile.value.lastname ?? ''}`.trim() : ''
)
const teacherInitials = computed(
  () => (teacherProfile.value?.name?.[0] ?? '') + (teacherProfile.value?.lastname?.[0] ?? '')
)

const dueChip = computed(() => {
  const due = quizDetail.value?.due_date
  if (!due) return null

  if (hasSubmitted.value) {
    return isLate(due, myQuizSubmission.value?.submitted_at)
      ? { text: 'ส่งล่าช้า', cls: 'bg-[#ffcdd2]' }
      : { text: 'ส่งตรงเวลา', cls: 'bg-[#c8e6c9]' }
  }
  if (isLate(due)) return { text: 'เลยกำหนดส่งแล้ว', cls: 'bg-[#ffcdd2]' }

  const daysLeft = Math.ceil((new Date(due) - new Date()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 1) return { text: 'ส่งภายในพรุ่งนี้!', cls: 'bg-orange' }
  if (daysLeft <= 3) return { text: `เหลืออีก ${daysLeft} วัน`, cls: 'bg-orange' }
  return { text: `เหลืออีก ${daysLeft} วัน`, cls: 'bg-white' }
})

// ตัวอักษรหน้าตัวเลือก ก ข ค ง ...
const CHOICE_LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ']
const choiceLetter = (i) => CHOICE_LETTERS[i] ?? String(i + 1)

// choices อาจเป็น array ของ string หรือ array ของ object -> รองรับทั้งสองแบบ
function choiceLabel(c) {
  if (typeof c === 'string') return c
  return c?.text ?? c?.label ?? String(c)
}
// ดึงคำตอบที่ตอบไปแล้ว (พร้อม is_correct/points_awarded) ของคำถามข้อนี้ จาก submission ที่ส่งไปแล้ว
function answerFor(questionId) {
  return (myQuizSubmission.value?.answers || []).find((a) => a.question_id === questionId) ?? null
}

// ⚠️ จุดเดียวที่กำหนดรูปแบบ p_answers ที่ส่งให้ submit_quiz
// ต้องตรงกับที่ฟังก์ชันใน Supabase อ่าน ถ้าไม่ตรงให้แก้ที่นี่ที่เดียว
function buildAnswers() {
  return quizQuestions.value.map((q) => {
    const v = answers.value[q.id]
    return {
      question_id: q.id,
      answer: q.type === 'essay' ? (v ?? '').trim() : (v ?? null),
    }
  })
}

// กดปุ่ม "ส่งข้อสอบ" -> แค่เปิด modal ยืนยัน
function handleSubmit() {
  submitError.value = ''

  if (!user.value) {
    submitError.value = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
    router.push('/login')
    return
  }

  if (isLate(quizDetail.value?.due_date)) {
    submitError.value = 'เลยกำหนดส่งแบบทดสอบนี้แล้ว ไม่สามารถส่งได้'
    return
  }
  showConfirm.value = true
}

// กดยืนยันใน modal -> ส่งจริง
async function confirmSubmit() {
  submitting.value = true
  const { error } = await submitQuiz(quizId, buildAnswers())
  submitting.value = false
  showConfirm.value = false

  if (error) {
    // 23505 = unique violation (quiz_id, student_id) -> เคยส่งไปแล้ว
    if (error.code === '23505') {
      submitError.value = 'คุณส่งข้อสอบนี้ไปแล้ว'
      await loadMyQuizSubmission(quizId, user.value.id)
    } else if (error.message?.includes('เลยกำหนดส่ง')) {
      submitError.value = 'เลยกำหนดส่งแบบทดสอบนี้แล้ว ไม่สามารถส่งได้'
    } else {
      submitError.value = error.message || 'ส่งข้อสอบไม่สำเร็จ ลองใหม่อีกครั้ง'
    }
  } else {
    // ส่งสำเร็จ: กลับไปหน้าแรกของผลลัพธ์ แล้วเลื่อนขึ้นบน
    currentPage.value = 1
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(async () => {
  if (!user.value) {
    router.push('/login')
    return
  }

  await Promise.all([
    loadQuizDetail(quizId),
    loadMyQuizSubmission(quizId, user.value.id),
  ])

  // โหลดคำถามเสมอ — ใช้ทั้งตอนทำข้อสอบ และตอนแสดงผลรายข้อหลังส่งแล้ว
  if (quizDetail.value) {
    await loadQuizQuestions(quizId)
  }
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">

    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/student' },
      { label: quizDetail?.classrooms?.name ?? '...', to: `/classroom/${classroomId}` },
      { label: quizDetail?.title ?? '...' }
    ]" />

    <div v-if="quizDetailLoading || myQuizSubmissionLoading" class="text-center text-gray text-[13px] py-16">
      กำลังโหลด...
    </div>

    <div v-else-if="!quizDetail" class="flex flex-col items-center gap-4 text-center py-20">
      <p class="text-gray text-[15px]">ไม่พบ Quiz นี้</p>
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

        <div class="max-w-[800px] mx-auto relative">
          <router-link :to="{ name: 'classroom-detail', params: { id: classroomId }, query: { tab: 'assignments' } }"
            class="inline-flex items-center gap-1.5 mb-4 h-8 px-3 rounded-full border-2 border-dark bg-white text-[12.5px] font-bold text-dark
                   shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
            <ArrowLeft :size="14" :stroke-width="3" />
            กลับห้องเรียน
          </router-link>

          <div class="flex items-start gap-3">
            <div class="w-12 h-12 shrink-0 rounded-xl border-[3px] border-dark bg-white flex items-center justify-center
                        shadow-[3px_3px_0_#1a1a1a] -rotate-3">
              <FileQuestion :size="22" :stroke-width="2.5" class="text-dark" />
            </div>
            <h1 class="font-mali font-bold text-3xl text-dark break-words min-w-0">{{ quizDetail.title }}</h1>
          </div>

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

            <span v-if="quizDetail.due_date"
              class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[12.5px] font-semibold text-dark">
              <Calendar :size="14" :stroke-width="2.5" />
              ส่งภายใน {{ formatDate(quizDetail.due_date) }}
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
              {{ quizDetail.max_score }} คะแนน
            </span>

            <span v-if="totalQuestions > 0"
              class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[12.5px] font-semibold text-dark">
              <ListOrdered :size="14" :stroke-width="2.5" />
              {{ totalQuestions }} ข้อ
            </span>
          </div>
        </div>
      </div>

      <main class="max-w-[800px] mx-auto px-6 py-8 flex flex-col gap-6">

        <!-- ============================================================ -->
        <!-- ส่งแล้ว: การ์ดสรุปผล -->
        <!-- ============================================================ -->
        <div v-if="hasSubmitted"
          class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <h2 class="font-mali font-bold text-[16px] text-dark">ผลการทำข้อสอบ</h2>
            <div class="flex items-center gap-2">
              <span v-if="isLate(quizDetail.due_date, myQuizSubmission.submitted_at)"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-red-100 text-red-600">
                ส่งล่าช้า
              </span>
              <span v-if="myQuizSubmission.is_graded"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-green-100 text-green-dark">
                ✓ ตรวจแล้ว
              </span>
              <span v-else
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light text-dark">
                ส่งแล้ว (รอครูตรวจ)
              </span>
            </div>
          </div>

          <div v-if="myQuizSubmission.is_graded"
            class="rounded-xl border-[3px] border-dark bg-[#c8e6c9] p-4 flex items-end gap-2">
            <Star :size="22" :stroke-width="2.5" class="text-dark mb-1.5" />
            <span class="text-[44px] leading-none font-bold text-dark">{{ myQuizSubmission.score }}</span>
            <span class="text-[20px] leading-none font-bold text-dark/50 mb-1">/ {{ quizDetail.max_score }}</span>
          </div>

          <div v-else class="rounded-xl border-[3px] border-dark bg-[#fff0d6] p-4 flex items-start gap-2">
            <Clock :size="16" :stroke-width="2.5" class="shrink-0 mt-0.5 text-dark" />
            <p class="text-[13px] text-dark leading-relaxed">
              ข้อสอบนี้มีข้ออัตนัย คะแนนจะแสดงหลังครูตรวจครบทุกข้อ
            </p>
          </div>

          <p v-if="myQuizSubmission.submitted_at" class="text-[12px] text-gray font-mono">
            ส่งเมื่อ {{ formatDate(myQuizSubmission.submitted_at) }}
          </p>
        </div>

        <!-- ============================================================ -->
        <!-- ยังไม่ส่ง: แถบความคืบหน้า (ลอยติดบน) + ตัวนำทางข้อ -->
        <!-- ============================================================ -->
        <template v-if="!hasSubmitted && !quizQuestionsLoading && totalQuestions > 0">
          <div
            class="sticky top-3 z-10 bg-white border-[3px] border-dark rounded-2xl shadow-[4px_4px_0_#1a1a1a] px-4 py-3">
            <div class="flex items-center justify-between text-[13px] mb-2">
              <span class="font-semibold text-dark">ตอบแล้ว</span>
              <span class="font-mono font-bold text-dark">{{ answeredCount }}/{{ totalQuestions }} ข้อ</span>
            </div>
            <div class="h-3 border-2 border-dark rounded-full bg-white overflow-hidden">
              <div class="h-full bg-green-dark transition-all duration-500" :style="{ width: progressPercent + '%' }" />
            </div>
          </div>

          <div v-if="totalQuestions > 1"
            class="bg-white border-[3px] border-dark rounded-2xl shadow-[4px_4px_0_#1a1a1a] px-4 py-3">
            <p class="text-[12px] font-bold text-gray font-mono uppercase mb-2">ไปยังข้อ</p>
            <div class="flex flex-wrap gap-2">
              <button v-for="(q, i) in quizQuestions" :key="q.id" type="button" @click="goToQuestion(i)"
                :title="isAnswered(q) ? `ข้อ ${i + 1} ตอบแล้ว` : `ข้อ ${i + 1} ยังไม่ตอบ`"
                class="w-9 h-9 rounded-lg border-2 border-dark text-[13px] font-bold transition hover:-translate-y-0.5"
                :class="isAnswered(q) ? 'bg-[#c8e6c9]' : 'bg-[#ffd699]'">
                {{ i + 1 }}
              </button>
            </div>
            <p class="text-[11.5px] text-gray mt-2">
              <span
                class="inline-block w-2.5 h-2.5 rounded-sm border border-dark bg-[#c8e6c9] align-middle mr-1" />ตอบแล้ว
              <span
                class="inline-block w-2.5 h-2.5 rounded-sm border border-dark bg-[#ffd699] align-middle ml-3 mr-1" />ยังไม่ตอบ
            </p>
          </div>
        </template>

        <!-- ============================================================ -->
        <!-- รายการคำถาม (หน้าละ 5 ข้อ) -->
        <!-- ============================================================ -->
        <div ref="questionsTop" class="scroll-mt-4 flex flex-col gap-6">
          <div v-if="quizQuestionsLoading" class="text-center text-gray text-[13px] py-10">
            {{ hasSubmitted ? 'กำลังโหลดรายละเอียด...' : 'กำลังโหลดข้อสอบ...' }}
          </div>

          <div v-else-if="totalQuestions === 0"
            class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
            Quiz นี้ยังไม่มีคำถาม
          </div>

          <template v-else>
            <!-- ---------- โหมดทำข้อสอบ ---------- -->
            <template v-if="!hasSubmitted">
              <div v-for="(q, i) in pagedQuestions" :key="q.id" :id="`q-${q.id}`"
                class="scroll-mt-24 bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4">
                <div class="flex items-start gap-3">
                  <span
                    class="w-10 h-10 shrink-0 rounded-full border-[3px] border-dark flex items-center justify-center font-mali font-bold text-[16px] transition"
                    :class="isAnswered(q) ? 'bg-[#c8e6c9]' : 'bg-[#ffd699]'">
                    {{ startIndex + i + 1 }}
                  </span>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1.5">
                      <span
                        class="border-2 border-dark rounded-2xl px-2.5 py-0.5 font-mono text-[11px] font-bold text-dark"
                        :class="q.type === 'essay' ? 'bg-orange' : 'bg-purple-light'">
                        {{ q.type === 'essay' ? 'อัตนัย' : 'ปรนัย' }}
                      </span>
                      <span class="font-mono text-[11px] text-gray whitespace-nowrap">{{ q.points }} คะแนน</span>
                    </div>
                    <p class="font-mali font-bold text-[16px] text-dark whitespace-pre-wrap break-words">{{ q.question
                      }}</p>
                  </div>
                </div>

                <!-- ปรนัย -->
                <div v-if="q.type !== 'essay'" class="flex flex-col gap-2.5">
                  <label v-for="(c, ci) in q.choices" :key="ci" class="block cursor-pointer">
                    <input type="radio" class="sr-only peer" :name="`q-${q.id}`" :value="ci" v-model="answers[q.id]" />
                    <div class="flex items-center gap-3 border-[3px] border-dark rounded-xl px-4 py-2.5 text-[14px] text-dark transition
                             peer-focus-visible:ring-2 peer-focus-visible:ring-dark peer-focus-visible:ring-offset-2"
                      :class="answers[q.id] === ci
                        ? 'bg-purple-light shadow-[3px_3px_0_#1a1a1a] -translate-y-0.5'
                        : 'bg-white hover:bg-gray-light hover:-translate-y-0.5'">
                      <span
                        class="w-8 h-8 shrink-0 rounded-full border-2 border-dark flex items-center justify-center font-mali font-bold text-[14px] transition"
                        :class="answers[q.id] === ci ? 'bg-dark text-white' : 'bg-white text-dark'">
                        <Check v-if="answers[q.id] === ci" :size="14" :stroke-width="3.5" />
                        <span v-else>{{ choiceLetter(ci) }}</span>
                      </span>
                      <span class="min-w-0 break-words">{{ choiceLabel(c) }}</span>
                    </div>
                  </label>
                </div>

                <!-- อัตนัย -->
                <div v-else class="flex flex-col gap-1.5">
                  <textarea v-model="answers[q.id]" rows="6" placeholder="พิมพ์คำตอบของคุณที่นี่..."
                    class="w-full px-4 py-3 rounded-xl border-[3px] border-dark text-[14px] leading-relaxed resize-y outline-none focus:bg-gray-light transition"></textarea>
                  <p class="text-right text-[11.5px] text-gray font-mono">
                    {{ (answers[q.id] || '').length }} ตัวอักษร
                  </p>
                </div>
              </div>
            </template>

            <!-- ---------- โหมดดูผลรายข้อ ---------- -->
            <template v-else>
              <div v-for="(q, i) in pagedQuestions" :key="q.id"
                class="bg-white border-[3px] border-dark rounded-2xl shadow-[4px_4px_0_#1a1a1a] p-4">
                <div class="flex items-start justify-between gap-3">
                  <p class="font-semibold text-[14px] text-dark whitespace-pre-wrap break-words min-w-0">
                    {{ startIndex + i + 1 }}. {{ q.question }}
                  </p>
                  <span
                    class="shrink-0 font-mono text-[11.5px] font-bold border-2 border-dark rounded-lg px-2 py-0.5 bg-white">
                    {{ answerFor(q.id)?.points_awarded ?? 0 }}/{{ q.points }} คะแนน
                  </span>
                </div>

                <!-- ปรนัย: บอกแค่ถูก/ผิด ไม่โชว์เฉลย -->
                <template v-if="q.type === 'mc'">
                  <p class="text-[13px] mt-2.5 flex items-center gap-1.5 font-semibold"
                    :class="answerFor(q.id)?.is_correct ? 'text-green-dark' : 'text-red-600'">
                    <Check v-if="answerFor(q.id)?.is_correct" :size="14" :stroke-width="3" />
                    <X v-else :size="14" :stroke-width="3" />
                    คำตอบของคุณ: {{ answerFor(q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                </template>

                <!-- อัตนัย -->
                <template v-else>
                  <p
                    class="text-[13px] text-dark mt-2.5 whitespace-pre-wrap bg-gray-light rounded-lg border-2 border-dark/10 p-2.5">
                    {{ answerFor(q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                  <p v-if="answerFor(q.id)?.points_awarded === null || answerFor(q.id)?.points_awarded === undefined"
                    class="text-[12px] text-purple mt-1.5 font-semibold">
                    รอครูตรวจข้อนี้
                  </p>
                </template>
              </div>
            </template>

            <!-- เปลี่ยนหน้า -->
            <div v-if="totalPages > 1" class="flex flex-col items-center gap-2">
              <div class="flex items-center justify-center gap-2">
                <button type="button" aria-label="หน้าก่อนหน้า" :disabled="currentPage === 1"
                  @click="setPage(currentPage - 1)"
                  class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                         hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition">
                  <ChevronLeft :size="16" :stroke-width="3" />
                </button>

                <button v-for="p in totalPages" :key="p" type="button" @click="setPage(p)"
                  :aria-current="p === currentPage ? 'page' : undefined"
                  class="min-w-[36px] h-9 px-2 rounded-lg border-2 border-dark text-[13px] font-bold transition" :class="p === currentPage
                    ? 'bg-orange text-dark'
                    : 'bg-white text-dark hover:bg-gray-light hover:-translate-y-0.5'">
                  {{ p }}
                </button>

                <button type="button" aria-label="หน้าถัดไป" :disabled="isLastPage" @click="setPage(currentPage + 1)"
                  class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                         hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition">
                  <ChevronRight :size="16" :stroke-width="3" />
                </button>
              </div>
              <p class="text-[12px] text-gray font-mono">
                หน้า {{ currentPage }}/{{ totalPages }} · ข้อ {{ startIndex + 1 }}-{{ Math.min(startIndex + pageSize,
                totalQuestions) }}
              </p>
            </div>

            <!-- ปุ่มไปหน้าถัดไป (ยังไม่ถึงหน้าสุดท้าย) -->
            <button v-if="!hasSubmitted && !isLastPage" type="button" @click="setPage(currentPage + 1)" class="w-full flex items-center justify-center gap-2 border-[3px] border-dark bg-orange p-2.5 text-[14px] text-dark rounded-xl font-bold
                     shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-0.5 transition">
              หน้าถัดไป
              <ChevronRight :size="16" :stroke-width="3" />
            </button>

            <!-- ส่ง (หน้าสุดท้ายเท่านั้น) -->
            <div v-if="!hasSubmitted && isLastPage"
              class="bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-5 flex flex-col gap-3">
              <div class="flex items-center justify-between text-[13px]">
                <span class="text-gray">ตอบแล้ว</span>
                <span class="font-mono font-bold text-dark">{{ answeredCount }}/{{ totalQuestions }} ข้อ</span>
              </div>

              <p v-if="unansweredCount > 0"
                class="text-[12.5px] text-dark bg-[#fff0d6] border-2 border-dark rounded-lg px-3 py-1.5">
                ยังไม่ได้ตอบ {{ unansweredCount }} ข้อ ใช้ปุ่ม "ไปยังข้อ" ด้านบนเพื่อกลับไปตอบได้
              </p>

              <p v-if="submitError" class="text-[12px] text-red-600">{{ submitError }}</p>

              <button type="button" @click="handleSubmit" :disabled="submitting || isLate(quizDetail.due_date)"
                class="w-full flex items-center justify-center gap-2 text-center border-dark border-[3px] bg-blue-600 p-2.5 text-[14px] text-white rounded-xl font-bold
                       shadow-[4px_4px_0_#1a1a1a] hover:bg-blue-500 hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
                <Send :size="15" :stroke-width="2.5" />
                {{ submitting ? 'กำลังส่ง...' : 'ส่งข้อสอบ' }}
              </button>
            </div>

            <!-- หลังส่งแล้ว: ปุ่มกลับ -->
            <router-link v-if="hasSubmitted" :to="{ name: 'classroom-detail', params: { id: classroomId } }" class="w-full text-center border-[3px] border-dark rounded-xl px-3 py-2.5 font-bold text-[14px] bg-white
                     shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-0.5 transition">
              กลับหน้าห้องเรียน
            </router-link>
          </template>
        </div>
      </main>
    </template>

    <!-- Modal ยืนยันการส่ง -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="!submitting && (showConfirm = false)">
          <div role="dialog" aria-modal="true"
            class="modal-card w-full max-w-md bg-white border-3 border-dark rounded-2xl shadow-offset p-6 flex flex-col gap-4">
            <h3 class="font-mali font-bold text-[17px] text-dark">ส่งข้อสอบ?</h3>

            <div v-if="unansweredCount > 0"
              class="rounded-lg border-2 border-dark bg-orange px-3 py-2 text-[13px] text-dark font-semibold">
              ยังตอบไม่ครบ {{ unansweredCount }} ข้อ
            </div>

            <p class="text-[13.5px] text-gray leading-relaxed">
              ส่งแล้วจะแก้ไขคำตอบไม่ได้
            </p>

            <div class="flex items-center justify-end gap-2">
              <button type="button" @click="showConfirm = false" :disabled="submitting"
                class="px-4 py-2 border-2 border-dark rounded-lg font-semibold text-[13px] hover:bg-gray-light transition disabled:opacity-50">
                กลับไปตรวจ
              </button>
              <button type="button" @click="confirmSubmit" :disabled="submitting"
                class="flex items-center gap-2 px-4 py-2 border-2 border-dark bg-blue-600 text-white rounded-lg font-semibold text-[13px] hover:bg-blue-500 transition disabled:opacity-50">
                <Send :size="14" :stroke-width="2.5" />
                {{ submitting ? 'กำลังส่ง...' : 'ส่งข้อสอบ' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>