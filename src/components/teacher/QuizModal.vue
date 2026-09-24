<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { X, ChevronLeft, Plus, Trash2, CircleCheck } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const emit = defineEmits(['close', 'back', 'created'])

const title = ref('')
const dueDateDate = ref('')
const dueDateTime = ref('23:59')

const saving = ref(false)
const errorMsg = ref('')
const fieldErrors = ref({}) // { title: msg, [questionTempId]: msg }

function newQuestion(type = 'mc') {
  return {
    tempId: crypto.randomUUID(),
    type,               // 'mc' | 'essay'
    question: '',
    choices: ['', ''],  // ใช้เฉพาะ type === 'mc'
    correctIndex: null, // index ใน choices ที่ถูก (ใช้เฉพาะ mc)
    points: 1,
  }
}

const questions = ref([newQuestion()])

const maxScore = computed(() =>
  questions.value.reduce((sum, q) => sum + (Number(q.points) || 0), 0)
)

function addQuestion(type) {
  questions.value.push(newQuestion(type))
}

function removeQuestion(tempId) {
  if (questions.value.length <= 1) return // ต้องมีอย่างน้อย 1 ข้อเสมอ
  questions.value = questions.value.filter((q) => q.tempId !== tempId)
}

function addChoice(q) {
  if (q.choices.length >= 6) return
  q.choices.push('')
}
function removeChoice(q, idx) {
  if (q.choices.length <= 2) return // ปรนัยต้องมีอย่างน้อย 2 ตัวเลือก
  q.choices.splice(idx, 1)
  if (q.correctIndex === idx) q.correctIndex = null
  else if (q.correctIndex > idx) q.correctIndex -= 1
}

function validate() {
  fieldErrors.value = {}
  let ok = true

  if (!title.value.trim()) {
    fieldErrors.value.title = 'กรุณากรอกชื่อแบบทดสอบ'
    ok = false
  }

  for (const q of questions.value) {
    if (!q.question.trim()) {
      fieldErrors.value[q.tempId] = 'กรุณากรอกคำถาม'
      ok = false
      continue
    }
    if (!q.points || q.points <= 0) {
      fieldErrors.value[q.tempId] = 'กรุณากรอกคะแนนของข้อนี้ให้ถูกต้อง'
      ok = false
      continue
    }
    if (q.type === 'mc') {
      const filledChoices = q.choices.filter((c) => c.trim())
      if (filledChoices.length < 2) {
        fieldErrors.value[q.tempId] = 'ปรนัยต้องมีตัวเลือกอย่างน้อย 2 ข้อ'
        ok = false
        continue
      }
      if (q.correctIndex === null || !q.choices[q.correctIndex]?.trim()) {
        fieldErrors.value[q.tempId] = 'กรุณาเลือกคำตอบที่ถูกต้อง'
        ok = false
        continue
      }
    }
  }

  return ok
}

async function handleSubmit() {
  errorMsg.value = ''
  if (!validate()) return

  saving.value = true

  try {
    const due_date = dueDateDate.value
      ? `${dueDateDate.value}T${dueDateTime.value || '23:59'}:00`
      : null

    // 1. สร้างแถว quiz หลัก
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        classroom_id: props.classroomId,
        title: title.value.trim(),
        due_date,
        max_score: maxScore.value,
      })
      .select('id')
      .single()

    if (quizError) throw quizError

    // 2. สร้างคำถามทั้งหมด (ปรนัย + อัตนัย)
    const questionRows = questions.value.map((q) => ({
      quiz_id: quiz.id,
      question: q.question.trim(),
      type: q.type,
      points: Number(q.points),
      choices: q.type === 'mc' ? q.choices.filter((c) => c.trim()) : null,
      correct_answer: q.type === 'mc' ? q.choices[q.correctIndex].trim() : null,
    }))

    const { error: questionsError } = await supabase
      .from('quiz_questions')
      .insert(questionRows)

    if (questionsError) throw questionsError

    emit('created')
  } catch (err) {
    console.error('create quiz error:', err)
    errorMsg.value = err.message || 'สร้างแบบทดสอบไม่สำเร็จ ลองใหม่อีกครั้ง'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
      <div
        class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center gap-2 mb-5">
          <button type="button" @click="emit('back')"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition shrink-0">
            <ChevronLeft :size="16" :stroke-width="2.5" />
          </button>
          <h2 class="font-mali text-xl font-bold text-dark flex-1">สร้างแบบทดสอบ</h2>
          <button type="button" @click="emit('close')"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition shrink-0">
            <X :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-5">
          <!-- ชื่อ + กำหนดส่ง -->
          <div>
            <label class="block text-[13px] font-bold mb-1.5">ชื่อแบบทดสอบ *</label>
            <input v-model="title" type="text"
              class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              :class="fieldErrors.title ? 'border-danger' : 'border-dark'" placeholder="เช่น แบบทดสอบบทที่ 3" />
            <p v-if="fieldErrors.title" class="text-danger text-[12px] mt-1">{{ fieldErrors.title }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[13px] font-bold mb-1.5">กำหนดส่ง (ถ้ามี)</label>
              <div class="flex gap-2">
                <input v-model="dueDateDate" type="date"
                  class="flex-1 min-w-0 border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
                <input v-model="dueDateTime" type="time"
                  class="w-[110px] border-2 border-dark rounded-lg px-2 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-bold mb-1.5">คะแนนเต็ม</label>
              <div
                class="border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] bg-gray-light font-mono font-bold">
                {{ maxScore }} คะแนน
                <span class="text-[11px] text-gray font-normal font-mitr">(รวมจากทุกข้ออัตโนมัติ)</span>
              </div>
            </div>
          </div>

          <hr class="border-t-2 border-dashed border-gray-200" />

          <!-- รายการคำถาม -->
          <div v-for="(q, qIndex) in questions" :key="q.tempId"
            class="border-2 border-dark rounded-xl p-4 flex flex-col gap-3 bg-gray-light/40">
            <div class="flex items-center justify-between">
              <span class="font-mali font-bold text-[14px]">ข้อที่ {{ qIndex + 1 }}</span>
              <div class="flex items-center gap-2">
                <div class="flex border-2 border-dark rounded-lg overflow-hidden text-[11.5px] font-semibold">
                  <button type="button" @click="q.type = 'mc'"
                    class="px-2.5 py-1 transition" :class="q.type === 'mc' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                    ปรนัย
                  </button>
                  <button type="button" @click="q.type = 'essay'"
                    class="px-2.5 py-1 transition border-l-2 border-dark" :class="q.type === 'essay' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                    อัตนัย
                  </button>
                </div>
                <button type="button" @click="removeQuestion(q.tempId)" :disabled="questions.length <= 1"
                  class="w-7 h-7 rounded-full border-2 border-danger flex items-center justify-center text-danger hover:bg-red-50 transition disabled:opacity-30 disabled:hover:bg-white">
                  <Trash2 :size="13" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <textarea v-model="q.question" rows="2"
              class="w-full border-2 border-dark rounded-lg px-3 py-2 text-[13.5px] bg-white focus:outline-none focus:bg-purple-light/20 transition"
              placeholder="พิมพ์คำถาม..." />

            <!-- ตัวเลือกปรนัย -->
            <div v-if="q.type === 'mc'" class="flex flex-col gap-2">
              <div v-for="(choice, cIndex) in q.choices" :key="cIndex" class="flex items-center gap-2">
                <button type="button" @click="q.correctIndex = cIndex" title="เลือกเป็นคำตอบที่ถูก"
                  class="shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition"
                  :class="q.correctIndex === cIndex ? 'border-green-dark bg-green-100 text-green-dark' : 'border-dark text-gray hover:bg-gray-light'">
                  <CircleCheck :size="15" :stroke-width="2.5" />
                </button>
                <input v-model="q.choices[cIndex]" type="text"
                  class="flex-1 min-w-0 border-2 border-dark rounded-lg px-3 py-1.5 text-[13px] bg-white focus:outline-none focus:bg-purple-light/20 transition"
                  :placeholder="`ตัวเลือกที่ ${cIndex + 1}`" />
                <button type="button" @click="removeChoice(q, cIndex)" :disabled="q.choices.length <= 2"
                  class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-light transition disabled:opacity-30">
                  <X :size="13" :stroke-width="2.5" />
                </button>
              </div>
              <button type="button" @click="addChoice(q)" :disabled="q.choices.length >= 6"
                class="self-start inline-flex items-center gap-1 text-[12px] font-semibold text-purple hover:text-dark transition disabled:opacity-40">
                <Plus :size="13" :stroke-width="2.5" />
                เพิ่มตัวเลือก
              </button>
              <p class="text-[11px] text-gray">คลิกวงกลมหน้าตัวเลือกเพื่อกำหนดคำตอบที่ถูก</p>
            </div>
            <p v-else class="text-[11.5px] text-gray bg-white border-2 border-dashed border-gray-200 rounded-lg px-3 py-2">
              ข้ออัตนัย — นักเรียนพิมพ์คำตอบเอง ครูต้องเข้ามาตรวจให้คะแนนทีหลัง
            </p>

            <div class="flex items-center gap-2">
              <label class="text-[12.5px] font-semibold text-gray">คะแนนข้อนี้</label>
              <input v-model.number="q.points" type="number" min="1"
                class="w-20 border-2 border-dark rounded-lg px-2 py-1 text-[13px] bg-white focus:outline-none focus:bg-purple-light/20 transition" />
            </div>

            <p v-if="fieldErrors[q.tempId]" class="text-danger text-[12px]">{{ fieldErrors[q.tempId] }}</p>
          </div>

          <div class="flex gap-2">
            <button type="button" @click="addQuestion('mc')"
              class="flex-1 inline-flex items-center justify-center gap-1.5 border-2 border-dashed border-dark rounded-lg py-2.5 text-[13px] font-semibold hover:bg-gray-light transition">
              <Plus :size="14" :stroke-width="2.5" />
              เพิ่มข้อปรนัย
            </button>
            <button type="button" @click="addQuestion('essay')"
              class="flex-1 inline-flex items-center justify-center gap-1.5 border-2 border-dashed border-dark rounded-lg py-2.5 text-[13px] font-semibold hover:bg-gray-light transition">
              <Plus :size="14" :stroke-width="2.5" />
              เพิ่มข้ออัตนัย
            </button>
          </div>

          <p v-if="errorMsg" class="text-danger text-[13px] bg-red-50 border-2 border-danger rounded-lg px-3 py-2">
            {{ errorMsg }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="emit('close')"
              class="border-2 border-dark rounded-lg px-4 py-2.5 font-semibold text-[13.5px] hover:bg-gray-light transition">
              ยกเลิก
            </button>
            <button type="submit" :disabled="saving"
              class="border-2 border-dark rounded-lg px-5 py-2.5 font-bold text-[13.5px] bg-orange shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0">
              {{ saving ? 'กำลังบันทึก...' : 'สร้างแบบทดสอบ' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>