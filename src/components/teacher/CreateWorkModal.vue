<script setup>
import { ref } from 'vue'
import { X, ClipboardList, FileQuestion, ChevronLeft } from 'lucide-vue-next'
import AssignmentModal from './AssignmentModal.vue'
import QuizModal from './QuizModal.vue'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const emit = defineEmits(['close', 'created'])

// step: 'choose' | 'assignment' | 'quiz'
const step = ref('choose')

function chooseAssignment() {
  step.value = 'assignment'
}
function chooseQuiz() {
  step.value = 'quiz'
}
function backToChoose() {
  step.value = 'choose'
}

function handleCreated() {
  emit('created')
  emit('close')
}
</script>

<template>
  <!-- STEP: เลือกประเภทงาน -->
  <Teleport to="body">
    <div v-if="step === 'choose'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="emit('close')">
      <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 w-full max-w-md">
        <div class="flex items-center justify-between mb-5">
          <h2 class="font-mali text-xl font-bold text-dark">สร้างงานใหม่</h2>
          <button type="button" @click="emit('close')"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition">
            <X :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <p class="text-[13px] text-gray mb-4">เลือกประเภทงานที่ต้องการสร้างให้นักเรียน</p>

        <div class="flex flex-col gap-3">
          <button type="button" @click="chooseAssignment"
            class="flex items-center gap-3 border-2 border-dark rounded-xl px-4 py-4 text-left hover:bg-purple-light/40 hover:-translate-y-0.5 transition">
            <div class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
              <ClipboardList :size="20" :stroke-width="2.5" class="text-dark" />
            </div>
            <div class="min-w-0">
              <p class="font-mali font-bold text-[15px] text-dark">การบ้าน</p>
              <p class="text-[12px] text-gray">นักเรียนแนบไฟล์หรือลิงก์ส่งงาน ครูตรวจให้คะแนนเอง</p>
            </div>
          </button>

          <button type="button" @click="chooseQuiz"
            class="flex items-center gap-3 border-2 border-dark rounded-xl px-4 py-4 text-left hover:bg-purple-light/40 hover:-translate-y-0.5 transition">
            <div class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
              <FileQuestion :size="20" :stroke-width="2.5" class="text-dark" />
            </div>
            <div class="min-w-0">
              <p class="font-mali font-bold text-[15px] text-dark">แบบทดสอบ (Quiz)</p>
              <p class="text-[12px] text-gray">ตั้งคำถามปรนัย/อัตนัย ระบบตรวจปรนัยให้อัตโนมัติ</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- STEP: ฟอร์มการบ้าน (ใช้ AssignmentModal เดิม ไม่แก้อะไรเลย) -->
  <AssignmentModal v-if="step === 'assignment'" :classroom-id="classroomId" @close="emit('close')"
    @created="handleCreated" />

  <!-- STEP: ฟอร์ม Quiz -->
  <QuizModal v-if="step === 'quiz'" :classroom-id="classroomId" @close="emit('close')" @back="backToChoose"
    @created="handleCreated" />
</template>