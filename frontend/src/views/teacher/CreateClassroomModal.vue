<script setup>
import { ref, watch, nextTick } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'created'])

const step = ref('form') // 'form' | 'success'
const name = ref('')
const gradeLevel = ref('')
const loading = ref(false)
const errorMsg = ref('')
const inputRef = ref(null)
const createdClassroom = ref(null)
const copied = ref(false)

// สุ่มรหัสห้องเรียน 6 ตัวอักษร (ตัวเลข + ตัวพิมพ์ใหญ่ ตัดอักษรที่สับสนออก)
function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function closeModal() {
  if (loading.value) return
  emit('update:modelValue', false)
}

function resetForm() {
  step.value = 'form'
  name.value = ''
  gradeLevel.value = ''
  errorMsg.value = ''
  loading.value = false
  createdClassroom.value = null
  copied.value = false
}

async function copyCode() {
  if (!createdClassroom.value) return
  await navigator.clipboard.writeText(createdClassroom.value.class_code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function handleSubmit() {
  errorMsg.value = ''

  const trimmedName = name.value.trim()
  if (!trimmedName) {
    errorMsg.value = 'กรุณากรอกชื่อวิชา'
    return
  }

  const trimmedGradeLevel = gradeLevel.value.trim()

  loading.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      errorMsg.value = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
      return
    }

    // พยายามสร้างห้องเรียน โดยสุ่มรหัสใหม่หากรหัสซ้ำ (unique constraint)
    const maxAttempts = 5
    let created = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const classCode = generateClassCode()

      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          teacher_id: user.id,
          name: trimmedName,
          class_code: classCode,
          grade_level: trimmedGradeLevel || null,
        })
        .select('id, name, class_code, grade_level')
        .single()

      if (!error) {
        created = data
        break
      }

      // 23505 = unique_violation ให้ลองรหัสใหม่ ถ้า error อื่นให้โยนออกไปเลย
      if (error.code !== '23505') {
        throw error
      }
    }

    if (!created) {
      throw new Error('ไม่สามารถสร้างรหัสห้องเรียนได้ กรุณาลองใหม่')
    }

    emit('created', created)
    createdClassroom.value = created
    step.value = 'success'
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่สามารถสร้างห้องเรียนได้ กรุณาลองใหม่'
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
            <!-- ขั้นตอนกรอกฟอร์ม -->
            <template v-if="step === 'form'">
              <div class="mb-6 flex items-start justify-between">
                <div>
                  <h1 class="title-font text-xl font-bold text-[#2A2521]">สร้างห้องเรียนใหม่</h1>
                  <p class="mt-1 text-sm text-[#8A8072]">ระบบจะสร้างรหัสห้องเรียนให้อัตโนมัติ</p>
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
                  <label for="classroom-name" class="mb-1.5 block text-sm font-medium text-[#2A2521]">
                    ชื่อวิชา
                  </label>
                  <input
                    id="classroom-name"
                    ref="inputRef"
                    v-model="name"
                    type="text"
                    placeholder="เช่น คณิตศาสตร์ "
                    class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-4 py-2.5 text-[#2A2521] placeholder-[#B0A692] outline-none transition-colors focus:border-[#FF6B4A]"
                    :disabled="loading"
                  />
                </div>

                <div>
                  <label for="classroom-grade" class="mb-1.5 block text-sm font-medium text-[#2A2521]">
                    ระดับชั้น <span class="font-normal text-[#B0A692]">(ไม่บังคับ)</span>
                  </label>
                  <input
                    id="classroom-grade"
                    v-model="gradeLevel"
                    type="text"
                    placeholder="เช่น ปวส.2/3"
                    class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-4 py-2.5 text-[#2A2521] placeholder-[#B0A692] outline-none transition-colors focus:border-[#FF6B4A]"
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
                    {{ loading ? 'กำลังสร้าง...' : 'สร้างห้องเรียน' }}
                  </button>
                </div>
              </form>
            </template>

            <!-- ขั้นตอนสำเร็จ โชว์รหัสห้อง -->
            <template v-else-if="step === 'success' && createdClassroom">
              <div class="mb-1 flex justify-center">
                <div class="flex h-14 w-14 items-center justify-center rounded-full bg-[#7C9473]/10 text-2xl">
                  ✓
                </div>
              </div>
              <h1 class="title-font mb-1 text-center text-xl font-bold text-[#2A2521]">
                สร้างห้องเรียนสำเร็จ
              </h1>
              <p class="mb-1 text-center text-sm text-[#8A8072]">
                {{ createdClassroom.name }}
              </p>
              <p v-if="createdClassroom.grade_level" class="mb-6 text-center text-xs text-[#B0A692]">
                ระดับชั้น: {{ createdClassroom.grade_level }}
              </p>
              <div v-else class="mb-6"></div>

              <div class="flex items-center gap-3 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FF6B4A]/5 px-4 py-3.5">
                <span class="text-sm text-[#8A8072]">รหัสห้อง:</span>
                <span class="title-font text-lg font-bold tracking-widest text-[#FF6B4A]">
                  {{ createdClassroom.class_code }}
                </span>
                <button
                  @click="copyCode"
                  class="stamp-btn ml-auto shrink-0 rounded-full bg-[#FF6B4A] px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
                >
                  {{ copied ? 'คัดลอกแล้ว!' : 'คัดลอก' }}
                </button>
              </div>

              <p class="mt-3 text-center text-xs text-[#B0A692]">
                แชร์รหัสนี้ให้นักเรียนเพื่อเข้าร่วมห้องเรียน
              </p>

              <button
                @click="closeModal"
                class="stamp-btn mt-6 w-full rounded-full bg-[#FF6B4A] px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
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