<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Calendar, Star, FileQuestion, Send, Clock, Check } from 'lucide-vue-next'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import AppNavbar from '../../components/AppNavbar.vue'

const route = useRoute()
const router = useRouter()
const classroomId = route.params.id
const quizId = route.params.quizId

const { user } = useAuth()

const {
  quizDetail, quizDetailLoading, loadQuizDetail,
  quizQuestions, quizQuestionsLoading, loadQuizQuestions,
  myQuizSubmission, myQuizSubmissionLoading, loadMyQuizSubmission,
  submitQuiz, formatDate, isLate,
} = useClassroomDetail(classroomId)

// { [questionId]: index ของตัวเลือก (ปรนัย) | ข้อความ (อัตนัย) }
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
const showConfirm = ref(false)

// choices อาจเป็น array ของ string หรือ array ของ object -> รองรับทั้งสองแบบ
function choiceLabel(c) {
  if (typeof c === 'string') return c
  return c?.text ?? c?.label ?? String(c)
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
    } else {
      submitError.value = error.message || 'ส่งข้อสอบไม่สำเร็จ ลองใหม่อีกครั้ง'
    }
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

  // โหลดคำถามเฉพาะตอนที่ยังไม่เคยส่ง
  if (quizDetail.value && !myQuizSubmission.value) {
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

    <div v-if="quizDetailLoading || myQuizSubmissionLoading" class="text-center text-gray-400 text-[13px] py-16">
      กำลังโหลด...
    </div>

    <div v-else-if="!quizDetail" class="flex flex-col items-center gap-4 text-center py-20">
      <p class="text-gray-400 text-[15px]">ไม่พบ Quiz นี้</p>
      <router-link :to="{ name: 'classroom-detail', params: { id: classroomId } }"
        class="px-5 py-2.5 rounded-lg border-2 border-dark bg-purple text-dark font-semibold text-[14px] shadow-offset-sm hover:-translate-y-0.5 transition">
        กลับหน้าห้องเรียน
      </router-link>
    </div>

    <main v-else class="max-w-[800px] mx-auto px-6 py-10 flex flex-col gap-6">

      <!-- หัวข้อ Quiz -->
      <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-6">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
            <FileQuestion :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="min-w-0">
            <h1 class="font-mali font-bold text-xl text-dark">{{ quizDetail.title }}</h1>
            <p class="text-[13px] text-gray-400 mt-1">
              {{ quizDetail.classrooms?.profiles?.name }} {{ quizDetail.classrooms?.profiles?.lastname }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-4 flex-wrap">
          <span v-if="quizDetail.due_date"
            class="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400 font-mono">
            <Calendar :size="14" :stroke-width="2.5" />
            ส่งภายใน {{ formatDate(quizDetail.due_date) }}
          </span>
          <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400 font-mono">
            <Star :size="14" :stroke-width="2.5" />
            {{ quizDetail.max_score }} คะแนน
          </span>
          <span v-if="!hasSubmitted && isLate(quizDetail.due_date)"
            class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-red-100 text-red-600">
            เลยกำหนดส่ง
          </span>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- ส่งแล้ว: โชว์ผลแทนฟอร์ม -->
      <!-- ============================================================ -->
      <div v-if="hasSubmitted" class="bg-white border-3 border-dark rounded-xl shadow-offset p-6 flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="font-mali font-bold text-[15px] text-dark">ผลการทำข้อสอบ</h2>
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
          class="rounded-xl border-2 border-gray-200 bg-gray-light/60 p-4 flex items-center gap-2">
          <Star :size="18" :stroke-width="2.5" class="text-green-dark" />
          <span class="font-mali font-bold text-2xl text-dark">
            {{ myQuizSubmission.score }}<span class="text-[15px] text-gray-400 font-normal">/{{ quizDetail.max_score }}</span>
          </span>
        </div>

        <div v-else class="rounded-xl border-2 border-gray-200 bg-gray-light/60 p-4 flex items-start gap-2">
          <Clock :size="16" :stroke-width="2.5" class="shrink-0 mt-0.5 text-purple" />
          <p class="text-[13px] text-dark leading-relaxed">
            ข้อสอบนี้มีข้ออัตนัย คะแนนจะแสดงหลังครูตรวจครบทุกข้อ
          </p>
        </div>

        <p v-if="myQuizSubmission.submitted_at" class="text-[12px] text-gray-400 font-mono">
          ส่งเมื่อ {{ formatDate(myQuizSubmission.submitted_at) }}
        </p>

        <router-link :to="{ name: 'classroom-detail', params: { id: classroomId } }"
          class="w-full text-center border-2 border-dark rounded-lg px-3 py-2 font-semibold text-[13px] hover:bg-gray-light transition">
          กลับหน้าห้องเรียน
        </router-link>
      </div>

      <!-- ============================================================ -->
      <!-- ยังไม่ส่ง: ฟอร์มทำข้อสอบ -->
      <!-- ============================================================ -->
      <template v-else>
        <div v-if="quizQuestionsLoading" class="text-center text-gray-400 text-[13px] py-10">
          กำลังโหลดข้อสอบ...
        </div>

        <div v-else-if="totalQuestions === 0"
          class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          Quiz นี้ยังไม่มีคำถาม
        </div>

        <template v-else>
          <div v-for="(q, index) in quizQuestions" :key="q.id"
            class="bg-white border-3 border-dark rounded-xl shadow-offset p-6 flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <p class="font-mali font-bold text-[16px] text-dark whitespace-pre-wrap">
                {{ index + 1 }}. {{ q.question }}
              </p>
              <div class="shrink-0 flex items-center gap-2">
                <span class="border-2 border-dark rounded-2xl px-2.5 py-0.5 font-mono text-[11px] font-bold"
                  :class="q.type === 'essay' ? 'bg-orange text-dark' : 'bg-purple-light text-dark'">
                  {{ q.type === 'essay' ? 'อัตนัย' : 'ปรนัย' }}
                </span>
                <span class="font-mono text-[11px] text-gray-400 whitespace-nowrap">{{ q.points }} คะแนน</span>
              </div>
            </div>

            <!-- ปรนัย -->
            <div v-if="q.type !== 'essay'" class="flex flex-col gap-2">
              <label v-for="(c, ci) in q.choices" :key="ci" class="block cursor-pointer">
                <input type="radio" class="sr-only peer" :name="`q-${q.id}`" :value="ci" v-model="answers[q.id]" />
                <div
                  class="flex items-center gap-3 border-2 border-dark rounded-lg px-4 py-2.5 text-[14px] text-dark transition hover:bg-gray-light peer-checked:bg-purple-light peer-focus-visible:ring-2 peer-focus-visible:ring-dark">
                  <span
                    class="w-4 h-4 shrink-0 rounded-full border-2 border-dark flex items-center justify-center"
                    :class="answers[q.id] === ci ? 'bg-dark' : 'bg-white'">
                    <Check v-if="answers[q.id] === ci" :size="10" :stroke-width="3.5" class="text-white" />
                  </span>
                  {{ choiceLabel(c) }}
                </div>
              </label>
            </div>

            <!-- อัตนัย -->
            <textarea v-else v-model="answers[q.id]" rows="5" placeholder="พิมพ์คำตอบของคุณ"
              class="w-full px-3 py-2 rounded-lg border-2 border-dark text-[14px] resize-y"></textarea>
          </div>

          <!-- ส่ง -->
          <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-5 flex flex-col gap-3">
            <div class="flex items-center justify-between text-[13px]">
              <span class="text-gray-400">ตอบแล้ว</span>
              <span class="font-mono font-bold text-dark">{{ answeredCount }}/{{ totalQuestions }} ข้อ</span>
            </div>

            <p v-if="submitError" class="text-[12px] text-red-600">{{ submitError }}</p>

            <button type="button" @click="handleSubmit" :disabled="submitting"
              class="w-full flex items-center justify-center gap-2 text-center border-dark border-2 bg-blue-600 p-2 text-[13px] text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-500 transition">
              <Send :size="14" :stroke-width="2.5" />
              {{ submitting ? 'กำลังส่ง...' : 'ส่งข้อสอบ' }}
            </button>
          </div>
        </template>
      </template>
      </main>

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