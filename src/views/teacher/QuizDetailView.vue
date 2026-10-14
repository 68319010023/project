<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import AppNavbar from '../../components/AppNavbar.vue'
import { ArrowLeft, Calendar, Star, FileQuestion, Check, X, Pencil } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const classroomId = route.params.id
const quizId = route.params.quizId

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

function cancelGrading(subId) {
  if (grading[subId]) grading[subId].open = false
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

    <div class="max-w-[1000px] mx-auto px-6 py-8">
      <router-link :to="{ name: 'classroom-detail', params: { id: classroomId }, query: { tab: 'assignments' } }"
        class="inline-flex items-center gap-1.5 text-[13px] text-gray font-semibold hover:text-dark transition mb-4">
        <ArrowLeft :size="15" :stroke-width="2.5" />
        กลับไปหน้าห้องเรียน
      </router-link>

      <div v-if="quizDetailLoading" class="h-[140px] border-3 border-dark rounded-2xl bg-gray-light animate-pulse" />

      <template v-else-if="quizDetail">
        <!-- หัวข้อ Quiz -->
        <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 mb-6">
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
              <FileQuestion :size="18" :stroke-width="2.5" class="text-dark" />
            </div>
            <div class="min-w-0">
              <h1 class="font-mali font-bold text-2xl text-dark">{{ quizDetail.title }}</h1>
            </div>
          </div>

          <div class="flex items-center gap-4 mt-4 flex-wrap">
            <span v-if="quizDetail.due_date" class="inline-flex items-center gap-1.5 text-[12.5px] text-gray font-mono">
              <Calendar :size="14" :stroke-width="2.5" />
              ส่งภายใน {{ formatDate(quizDetail.due_date) }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray font-mono">
              <Star :size="14" :stroke-width="2.5" />
              {{ quizDetail.max_score }} คะแนนเต็ม
            </span>
          </div>
        </div>

        <!-- Grid นักเรียนที่ส่งแล้ว -->
        <h2 class="font-mali font-bold text-[17px] mb-3">
          นักเรียนที่ส่งแล้ว
          <span class="text-[13px] text-gray font-mitr font-normal">({{ submissions.length }} คน)</span>
        </h2>

        <div v-if="submissionsLoading || questionsLoading" class="grid grid-cols-1 gap-4">
          <div v-for="n in 3" :key="n" class="h-[140px] border-3 border-dark rounded-xl bg-gray-light animate-pulse" />
        </div>

        <p v-else-if="submissions.length === 0"
          class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ยังไม่มีใครส่งแบบทดสอบนี้
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
                <p v-if="isLate(quizDetail.due_date, sub.submitted_at)" class="text-[10px] font-bold text-red-600">
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
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalSub" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="closeModal">
          <div role="dialog" aria-modal="true"
            class="modal-card w-full max-w-lg bg-white border-3 border-dark rounded-2xl shadow-offset p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

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
                class="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-bold text-green-dark">
                <Check :size="14" :stroke-width="3" />
                {{ modalSub.score }}/{{ quizDetail.max_score }}
              </p>
            </div>

            <!-- คำถามทั้งหมด -->
            <div class="pt-3 border-t-2 border-dashed border-gray-200 flex flex-col gap-3">
              <div v-for="(q, index) in questions" :key="q.id" class="border-2 border-gray-200 rounded-lg p-3">
                <div class="flex items-start justify-between gap-3">
                  <p class="font-semibold text-[13.5px] text-dark whitespace-pre-wrap">
                    {{ index + 1 }}. {{ q.question }}
                  </p>
                  <span class="shrink-0 font-mono text-[11px] text-gray">{{ q.points }} คะแนน</span>
                </div>

                <!-- ปรนัย: อ่านอย่างเดียว -->
                <template v-if="q.type === 'mc'">
                  <p class="text-[13px] mt-2 flex items-center gap-1.5"
                    :class="answerFor(modalSub, q.id)?.is_correct ? 'text-green-dark' : 'text-red-600'">
                    <Check v-if="answerFor(modalSub, q.id)?.is_correct" :size="14" :stroke-width="3" />
                    <X v-else :size="14" :stroke-width="3" />
                    ตอบ: {{ answerFor(modalSub, q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                  <p v-if="!answerFor(modalSub, q.id)?.is_correct" class="text-[12px] text-gray mt-1">
                    เฉลย: {{ q.correct_answer }}
                  </p>
                </template>

                <!-- อัตนัย: คำตอบ + ช่องกรอกคะแนน -->
                <template v-else>
                  <p class="text-[13px] text-dark mt-2 whitespace-pre-wrap bg-gray-light/60 rounded-lg p-2.5">
                    {{ answerFor(modalSub, q.id)?.answer || '(ไม่ได้ตอบ)' }}
                  </p>
                  <div class="flex items-center gap-2 mt-2">
                    <label class="text-[12px] font-semibold text-gray">ให้คะแนน</label>
                    <input type="number" v-model="grading[modalSub.id].points[q.id]" min="0" :max="q.points"
                      class="w-20 border-2 border-dark rounded-lg px-2 py-1 text-[13px] font-mono font-bold" />
                    <span class="text-[12px] text-gray">/ {{ q.points }}</span>
                  </div>
                </template>
              </div>
            </div>

            <p v-if="grading[modalSub.id]?.error" class="text-[11.5px] text-red font-semibold">
              {{ grading[modalSub.id].error }}
            </p>

            <div class="flex items-center gap-2">
              <button type="button" @click="saveGrading(modalSub)" :disabled="grading[modalSub.id]?.saving"
                class="flex-1 border-2 border-dark rounded-lg py-1.5 text-[12.5px] font-bold bg-purple hover:opacity-90 transition disabled:opacity-50">
                {{ grading[modalSub.id]?.saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน' }}
              </button>
              <button type="button" @click="closeModal"
                class="border-2 border-dark rounded-lg px-4 py-1.5 text-[12.5px] font-semibold hover:bg-gray-light transition">
                ปิด
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>