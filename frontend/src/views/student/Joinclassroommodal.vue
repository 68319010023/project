<script setup>
import { ref, watch, nextTick } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'joined'])

const step = ref('form') // 'form' | 'success'
const code = ref('')
const loading = ref(false)
const errorMsg = ref('')
const inputRef = ref(null)
const joinedClassroom = ref(null)

function closeModal() {
  if (loading.value) return
  emit('update:modelValue', false)
}

function resetForm() {
  step.value = 'form'
  code.value = ''
  errorMsg.value = ''
  loading.value = false
  joinedClassroom.value = null
}

async function handleSubmit() {
  errorMsg.value = ''

  const trimmedCode = code.value.trim().toUpperCase()
  if (!trimmedCode) {
    errorMsg.value = 'กรุณากรอกรหัสห้องเรียน'
    return
  }

  loading.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      errorMsg.value = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
      return
    }

    // หาห้องเรียนจากรหัส
    const { data: classroom, error: findError } = await supabase
      .from('classrooms')
      .select('id, name, class_code')
      .eq('class_code', trimmedCode)
      .maybeSingle()

    if (findError) throw findError

    if (!classroom) {
      errorMsg.value = 'ไม่พบห้องเรียนที่ใช้รหัสนี้ กรุณาตรวจสอบอีกครั้ง'
      return
    }

    // เช็คว่าเข้าร่วมอยู่แล้วหรือยัง
    const { data: existing, error: existingError } = await supabase
      .from('classroom_enrollments')
      .select('classroom_id')
      .eq('classroom_id', classroom.id)
      .eq('student_id', user.id)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      errorMsg.value = 'คุณเข้าร่วมห้องเรียนนี้อยู่แล้ว'
      return
    }

    const { error: insertError } = await supabase
      .from('classroom_enrollments')
      .insert({
        classroom_id: classroom.id,
        student_id: user.id,
      })

    if (insertError) throw insertError

    joinedClassroom.value = classroom
    emit('joined', classroom)
    step.value = 'success'
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่สามารถเข้าร่วมห้องเรียนได้ กรุณาลองใหม่'
  } finally {
    loading.value = false
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') closeModal()
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      resetForm()
      window.addEventListener('keydown', handleKeydown)
      await nextTick()
      inputRef.value?.focus()
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[#2A2521]/40 px-4 backdrop-blur-sm"
        @mousedown.self="closeModal"
      >
        <Transition name="modal-pop" appear>
          <div class="note-card modal-card w-full max-w-md p-6 sm:p-8">
            <!-- ขั้นตอนกรอกรหัส -->
            <template v-if="step === 'form'">
              <div class="mb-6 flex items-start justify-between">
                <div>
                  <h1 class="title-font text-xl font-bold text-[#2A2521]">เข้าร่วมห้องเรียน</h1>
                  <p class="mt-1 text-sm text-[#8A8072]">กรอกรหัสห้องเรียนที่ได้รับจากครูผู้สอน</p>
                </div>
                <button
                  @click="closeModal"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/50 hover:text-[#2A2521]"
                  aria-label="ปิด"
                >
                  ✕
                </button>
              </div>

              <form @submit.prevent="handleSubmit" class="space-y-5">
                <div>
                  <label for="class-code" class="mb-1.5 block text-sm font-medium text-[#2A2521]">
                    รหัสห้องเรียน
                  </label>
                  <input
                    id="class-code"
                    ref="inputRef"
                    v-model="code"
                    type="text"
                    placeholder="เช่น A3F9K2"
                    maxlength="6"
                    class="title-font w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-4 py-3 text-center text-lg font-bold uppercase tracking-[0.3em] text-[#2A2521] placeholder-[#B0A692] outline-none transition-colors focus:border-[#FF6B4A]"
                    :disabled="loading"
                  />
                </div>

                <p
                  v-if="errorMsg"
                  class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-4 py-3 text-sm font-medium text-[#B8402A]"
                >
                  {{ errorMsg }}
                </p>

                <div class="flex gap-3">
                  <button
                    type="button"
                    @click="closeModal"
                    :disabled="loading"
                    class="flex-1 rounded-full border-2 border-[#E4DCC8] px-5 py-3 text-sm font-semibold text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/30 disabled:opacity-60"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    :disabled="loading"
                    class="stamp-btn flex-1 rounded-full bg-[#FF6B4A] px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
                  >
                    {{ loading ? 'กำลังเข้าร่วม...' : 'เข้าร่วมห้องเรียน' }}
                  </button>
                </div>
              </form>
            </template>

            <!-- ขั้นตอนสำเร็จ -->
            <template v-else-if="step === 'success' && joinedClassroom">
              <div class="mb-1 flex justify-center">
                <div class="flex h-14 w-14 items-center justify-center rounded-full bg-[#7C9473]/10 text-2xl">
                  ✓
                </div>
              </div>
              <h1 class="title-font mb-1 text-center text-xl font-bold text-[#2A2521]">
                เข้าร่วมห้องเรียนสำเร็จ
              </h1>
              <p class="mb-6 text-center text-sm text-[#8A8072]">
                คุณได้เข้าร่วม <span class="font-semibold text-[#2A2521]">{{ joinedClassroom.name }}</span> แล้ว
              </p>

              <button
                @click="closeModal"
                class="stamp-btn w-full rounded-full bg-[#FF6B4A] px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
              >
                เสร็จสิ้น
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.title-font {
  font-family: 'Kanit', sans-serif;
}

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  font-family: 'Sarabun', sans-serif;
}

.modal-card {
  box-shadow: 0 20px 50px rgba(42, 37, 33, 0.25);
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-pop-enter-active {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
}
.modal-pop-leave-active {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.modal-pop-enter-from {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
.modal-pop-leave-to {
  transform: scale(0.97);
  opacity: 0;
}
</style>