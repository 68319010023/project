<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { getClassroomColorById } from '../../lib/classroomColors'
import AppNavbar from '../../components/AppNavbar.vue'
import {
  ArrowLeft, Calendar, Star, FileQuestion, Check, X,
  Users, Clock, CheckCircle2, Search,
} from 'lucide-vue-next'

const route = useRoute()

const classroomId = route.params.id
const quizId = route.params.quizId

const roomColor = getClassroomColorById(classroomId)

const {
  quizDetail, quizDetailLoading, loadQuizDetail,
  formatDate, isLate,
} = useClassroomDetail(classroomId)

// คำถามทั้งหมดของ quiz นี้ (ฝั่งครู เลยดึง correct_answer มาด้วยได้ ต่างจาก composable ฝั่งนักเรียน)
const questions = ref([])
const questionsLoading = ref(true)

// submission ของนักเรียนแต่ละคน พร้อม answers (jsonb array)
const submissions = ref([])
const submissionsLoading = ref(true)

// choices อาจเป็น array ของ string หรือ object -> รองรับทั้งสองแบบ (ใช้ pattern เดียวกับฝั่งนักเรียน)
function choiceLabel(c) {
  if (typeof c === 'string') return c
  return c?.text ?? c?.label ?? String(c)
}

function questionById(id) {
  return questions.value.find((q) => q.id === id)
}

function answerFor(sub, questionId) {
  return (sub.answers || []).find((a) => a.question_id === questionId) ?? null
}

// จำนวนข้ออัตนัยที่ยังไม่ได้ให้คะแนน (points_awarded ยังเป็น null) ของ submission นี้
function ungradedEssayCount(sub) {
  return (sub.answers || []).filter((a) => {
    const q = questionById(a.question_id)
    return q && q.type !== 'mc' && (a.points_awarded === null || a.points_awarded === undefined)
  }).length
}

async function loadQuestions() {
  questionsLoading.value = true
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('id, question, choices, type, points, correct_answer')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('loadQuestions error:', error.code, error.message, error.details, error.hint)
      questions.value = []
    } else {
      questions.value = data
    }
  } catch (err) {
    console.error('loadQuestions unexpected error:', err)
    questions.value = []
  } finally {
    questionsLoading.value = false
  }
}

async function loadSubmissions() {
  submissionsLoading.value = true
  try {
    const { data, error } = await supabase
      .from('quiz_submissions')
      .select('id, student_id, answers, score, is_graded, submitted_at, profiles:student_id(name, lastname, img)')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: true })

    if (error) {
      console.error('loadSubmissions error:', error.code, error.message, error.details, error.hint)
      submissions.value = []
    } else {
      submissions.value = data
    }
  } catch (err) {
    console.error('loadSubmissions unexpected error:', err)
    submissions.value = []
  } finally {
    submissionsLoading.value = false
  }
}

// --- สรุปตัวเลข + ค้นหา/กรอง ---
const pendingCount = computed(() => submissions.value.filter((s) => !s.is_graded).length)
const gradedCount = computed(() => submissions.value.filter((s) => s.is_graded).length)

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
      if (statusFilter.value === 'pending' && s.is_graded) return false
      if (statusFilter.value === 'graded' && !s.is_graded) return false
      if (!q) return true
      const fullName = `${s.profiles?.name ?? ''} ${s.profiles?.lastname ?? ''}`.toLowerCase()
      return fullName.includes(q)
    })
    // งานที่รอตรวจขึ้นก่อน (sort เสถียร ลำดับเวลาส่งเดิมยังคงอยู่ในแต่ละกลุ่ม)
    .sort((a, b) => Number(a.is_graded) - Number(b.is_graded))
})

// --- ตรวจข้ออัตนัย ---
const grading = reactive({})
const modalSub = ref(null)

function openModal(sub) {
  modalSub.value = sub
  if (!grading[sub.id]) openGrading(sub)
}

function closeModal() {
  if (modalSub.value && grading[modalSub.value.id]?.saving) return // กันปิดระหว่างบันทึก
  modalSub.value = null
}

function openGrading(sub) {
  const points = {}
  for (const a of sub.answers || []) {
    points[a.question_id] = a.points_awarded ?? null
  }
  grading[sub.id] = { open: true, points, saving: false, error: '' }
}

async function saveGrading(sub) {
  const g = grading[sub.id]
  if (!g) return

  const essayQuestions = questions.value.filter((q) => q.type !== 'mc')

  for (const q of essayQuestions) {
    const v = g.points[q.id]
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) {
      g.error = 'กรุณาให้คะแนนข้ออัตนัยให้ครบทุกข้อ'
      return
    }
    const num = Number(v)
    if (num < 0 || num > q.points) {
      g.error = `คะแนนแต่ละข้อต้องอยู่ระหว่าง 0 - คะแนนเต็มของข้อนั้น`
      return
    }
  }

  g.error = ''
  g.saving = true

  // rebuild answers: แทนที่ points_awarded เฉพาะข้ออัตนัย ข้อปรนัยคงของเดิม (ตรวจไปแล้วตอนส่ง)
  const newAnswers = (sub.answers || []).map((a) => {
    const q = questionById(a.question_id)
    if (q && q.type !== 'mc') {
      return { ...a, points_awarded: Number(g.points[a.question_id]) }
    }
    return a
  })

  const newScore = newAnswers.reduce((sum, a) => sum + (Number(a.points_awarded) || 0), 0)

  const { error } = await supabase
    .from('quiz_submissions')
    .update({ answers: newAnswers, score: newScore, is_graded: true })
    .eq('id', sub.id)

  g.saving = false

  if (error) {
    console.error('saveGrading error:', error.code, error.message, error.details, error.hint)
    g.error = 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'
    return
  }

  // อัปเดตในการ์ดทันทีโดยไม่ reload ทั้งหน้า
  sub.answers = newAnswers
  sub.score = newScore
  sub.is_graded = true
  g.open = false
}

onMounted(async () => {
  await loadQuizDetail(quizId)
  await Promise.all([loadQuestions(), loadSubmissions()])
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/teacher' },
      { label: quizDetail?.classrooms?.name ?? '...', to: `/classroom/${classroomId}` },
      { label: quizDetail?.title ?? '...' }
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

          <div v-if="quizDetailLoading" class="h-[80px] rounded-2xl bg-white/40 animate-pulse" />

          <template v-else-if="quizDetail">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 shrink-0 rounded-xl border-[3px] border-dark bg-white flex items-center justify-center
                          shadow-[3px_3px_0_#1a1a1a] -rotate-3">
                <FileQuestion :size="22" :stroke-width="2.5" class="text-dark" />
              </div>
              <h1 class="font-mali font-bold text-[26px] sm:text-3xl text-dark break-words min-w-0">{{ quizDetail.title }}</h1>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2.5">
              <span v-if="quizDetail.due_date"
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[11.5px] sm:text-[12.5px] font-semibold text-dark">
                <Calendar :size="14" :stroke-width="2.5" />
                ส่งภายใน {{ formatDate(quizDetail.due_date) }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[11.5px] sm:text-[12.5px] font-semibold text-dark">
                <Star :size="14" :stroke-width="2.5" />
                {{ quizDetail.max_score }} คะแนนเต็ม
              </span>
              <span v-if="!questionsLoading"
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-full px-3 py-1 bg-white text-[11.5px] sm:text-[12.5px] font-semibold text-dark">
                {{ questions.length }} ข้อ
              </span>
            </div>
          </template>
        </div>
      </div>

      <div class="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <p v-if="!quizDetailLoading && !quizDetail" class="text-center text-gray text-[14px] py-16">ไม่พบ Quiz นี้</p>

      <template v-else-if="quizDetail">
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
            นักเรียนที่ส่งแล้ว
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

        <!-- ===== Grid นักเรียนที่ส่งแล้ว ===== -->
        <div v-if="submissionsLoading || questionsLoading" class="flex flex-wrap gap-4">
          <div v-for="n in 3" :key="n" class="w-[250px] h-[72px] border-[3px] border-dark rounded-2xl bg-gray-light animate-pulse" />
        </div>

        <p v-else-if="submissions.length === 0"
          class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ยังไม่มีใครส่งแบบทดสอบนี้
        </p>

        <p v-else-if="filteredSubmissions.length === 0"
          class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ไม่พบนักเรียนที่ตรงกับเงื่อนไข
        </p>

        <div v-else class="flex flex-wrap gap-4">
          <button type="button" v-for="sub in filteredSubmissions" :key="sub.id" @click="openModal(sub)"
            class="w-[250px] border-[3px] border-dark rounded-2xl shadow-[4px_4px_0_#1a1a1a] overflow-hidden transition
                   hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] text-left"
            :class="sub.is_graded ? 'bg-white' : 'bg-[#fff0d6]'">
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
                <p v-if="isLate(quizDetail.due_date, sub.submitted_at)" class="text-[10.5px] font-bold text-red-600">
                  ส่งล่าช้า
                </p>
                <p v-else class="text-[10.5px] text-gray truncate">
                  {{ formatDate(sub.submitted_at) }}
                </p>
              </div>

              <span v-if="sub.is_graded"
                class="shrink-0 inline-flex items-center gap-0.5 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold bg-green-100 text-green-dark">
                <Check :size="10" :stroke-width="3" />
                {{ sub.score }}/{{ quizDetail.max_score }}
              </span>
              <span v-else
                class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold bg-orange text-dark">
                เหลือ {{ ungradedEssayCount(sub) }} ข้อ
              </span>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- ===== Modal ตรวจคำตอบ ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalSub" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="closeModal">
          <div role="dialog" aria-modal="true"
            class="modal-card w-full max-w-lg bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

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
                  :class="isLate(quizDetail.due_date, modalSub.submitted_at) ? 'text-red-600 font-bold' : 'text-gray'">
                  {{ isLate(quizDetail.due_date, modalSub.submitted_at) ? 'ส่งล่าช้า — ' : '' }}{{
                    formatDate(modalSub.submitted_at) }}
                </p>
              </div>
              <p v-if="modalSub.is_graded"
                class="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-bold text-green-dark border-2 border-dark rounded-lg px-2.5 py-1 bg-green-100">
                <Check :size="14" :stroke-width="3" />
                {{ modalSub.score }}/{{ quizDetail.max_score }}
              </p>
            </div>

            <!-- คำถามทั้งหมด -->
            <div class="pt-3 border-t-[3px] border-dashed border-dark/20 flex flex-col gap-3">
              <div v-for="(q, index) in questions" :key="q.id" class="border-2 border-dark rounded-xl p-3"
                :class="q.type === 'mc'
                  ? (answerFor(modalSub, q.id)?.is_correct ? 'bg-[#e8f5e9]' : 'bg-[#ffebee]')
                  : 'bg-white'">
                <div class="flex items-start gap-2.5">
                  <span class="w-7 h-7 shrink-0 rounded-full border-2 border-dark bg-white flex items-center justify-center
                               font-mali font-bold text-[13px]">
                    {{ index + 1 }}
                  </span>
                  <p class="flex-1 min-w-0 font-semibold text-[13.5px] text-dark whitespace-pre-wrap break-words pt-0.5">
                    {{ q.question }}
                  </p>
                  <span class="shrink-0 border-2 border-dark rounded-lg px-1.5 py-0.5 font-mono text-[10.5px] font-bold bg-white">
                    {{ q.type === 'mc' ? `${answerFor(modalSub, q.id)?.points_awarded ?? 0}/` : '' }}{{ q.points }} คะแนน
                  </span>
                </div>

                <!-- ปรนัย: อ่านอย่างเดียว -->
                <template v-if="q.type === 'mc'">
                  <p class="text-[13px] mt-2.5 flex items-center gap-1.5 font-semibold"
                    :class="answerFor(modalSub, q.id)?.is_correct ? 'text-green-dark' : 'text-red-600'">
                    <Check v-if="answerFor(modalSub, q.id)?.is_correct" :size="14" :stroke-width="3" />
                    <X v-else :size="14" :stroke-width="3" />
                    ตอบ: {{ answerFor(modalSub, q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                  <p v-if="!answerFor(modalSub, q.id)?.is_correct" class="text-[12px] text-dark mt-1">
                    เฉลย: <span class="font-bold">{{ q.correct_answer }}</span>
                  </p>
                </template>

                <!-- อัตนัย: คำตอบ + ช่องกรอกคะแนน -->
                <template v-else>
                  <p class="text-[13px] text-dark mt-2.5 whitespace-pre-wrap bg-gray-light rounded-lg border-2 border-dark/10 p-2.5">
                    {{ answerFor(modalSub, q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                  <div class="flex items-center gap-2 mt-2.5">
                    <label class="text-[12px] font-semibold text-dark">ให้คะแนน</label>
                    <input type="number" v-model="grading[modalSub.id].points[q.id]" min="0" :max="q.points"
                      class="w-20 border-2 border-dark rounded-lg px-2 py-1 text-[13px] font-mono font-bold outline-none focus:bg-gray-light" />
                    <span class="text-[12px] text-gray">/ {{ q.points }}</span>
                  </div>
                </template>
              </div>
            </div>

            <p v-if="grading[modalSub.id]?.error" class="text-[12px] text-red-600 font-semibold">
              {{ grading[modalSub.id].error }}
            </p>

            <div class="flex items-center gap-2">
              <button type="button" @click="saveGrading(modalSub)" :disabled="grading[modalSub.id]?.saving"
                class="flex-1 border-[3px] border-dark rounded-xl py-2 text-[13px] font-bold bg-purple shadow-[3px_3px_0_#1a1a1a]
                       hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
                {{ grading[modalSub.id]?.saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน' }}
              </button>
              <button type="button" @click="closeModal"
                class="border-2 border-dark rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-light transition">
                ปิด
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>