<script setup>
import { ref, watch, nextTick } from 'vue'
import { supabase } from '../supabase'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  classroomId: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue', 'created'])

const title = ref('')
const description = ref('')
const dueDate = ref('')
const file = ref(null)
const fileInputRef = ref(null)
const titleInputRef = ref(null)

const uploading = ref(false)
const errorMsg = ref('')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function closeModal() {
  if (uploading.value) return
  emit('update:modelValue', false)
}

function resetForm() {
  title.value = ''
  description.value = ''
  dueDate.value = ''
  file.value = null
  errorMsg.value = ''
  uploading.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function handleFileChange(e) {
  errorMsg.value = ''
  const selected = e.target.files[0]
  if (!selected) {
    file.value = null
    return
  }
  if (selected.size > MAX_FILE_SIZE) {
    errorMsg.value = 'ไฟล์ต้องมีขนาดไม่เกิน 10MB'
    e.target.value = ''
    file.value = null
    return
  }
  file.value = selected
}

function removeFile() {
  file.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function handleSubmit() {
  errorMsg.value = ''

  const trimmedTitle = title.value.trim()
  if (!trimmedTitle) {
    errorMsg.value = 'กรุณากรอกชื่องาน'
    return
  }

  uploading.value = true

  try {
    let attachmentUrl = null
    let attachmentName = null

    // อัปโหลดไฟล์แนบก่อน (ถ้ามี) แล้วค่อย insert แถวการบ้าน
    if (file.value) {
      const fileExt = file.value.name.split('.').pop()
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
      const filePath = `${props.classroomId}/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(filePath, file.value)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('assignment-files')
        .getPublicUrl(filePath)

      attachmentUrl = urlData.publicUrl
      attachmentName = file.value.name
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        classroom_id: props.classroomId,
        title: trimmedTitle,
        description: description.value.trim(),
        due_date: dueDate.value ? new Date(dueDate.value).toISOString() : null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      })
      .select()
      .single()

    if (error) throw error

    emit('created', data)
    resetForm()
    emit('update:modelValue', false)
  } catch (err) {
    console.error(err)
    errorMsg.value = 'สร้างงานไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    uploading.value = false
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
      titleInputRef.value?.focus()
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-[#2A2521]/40 px-4 py-6 backdrop-blur-sm"
        @mousedown.self="closeModal"
      >
        <Transition name="modal-pop" appear>
          <div class="note-card modal-card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div class="mb-6 flex items-start justify-between">
              <div>
                <h1 class="title-font text-xl font-bold text-[#2A2521]">สร้างการบ้าน</h1>
                <p class="mt-1 text-sm text-[#8A8072]">แนบไฟล์ให้นักเรียนดาวน์โหลดได้ (ไม่บังคับ)</p>
              </div>
              <button
                @click="closeModal"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/50 hover:text-[#2A2521]"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-4">
              <div>
                <label class="mb-1.5 block text-xs font-medium text-[#6B6255]">ชื่องาน</label>
                <input
                  ref="titleInputRef"
                  v-model="title"
                  type="text"
                  placeholder="เช่น แบบฝึกหัดบทที่ 3"
                  class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] outline-none transition-colors focus:border-[#FF6B4A]"
                  :disabled="uploading"
                />
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-medium text-[#6B6255]">รายละเอียด (ไม่บังคับ)</label>
                <textarea
                  v-model="description"
                  rows="2"
                  class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] outline-none transition-colors focus:border-[#FF6B4A]"
                  :disabled="uploading"
                ></textarea>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-medium text-[#6B6255]">กำหนดส่ง (ไม่บังคับ)</label>
                <input
                  v-model="dueDate"
                  type="datetime-local"
                  class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] outline-none transition-colors focus:border-[#FF6B4A]"
                  :disabled="uploading"
                />
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-medium text-[#6B6255]">ไฟล์แนบ (ไม่บังคับ)</label>

                <div v-if="!file">
                  <label
                    class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FBF6EC] px-4 py-4 text-sm text-[#8A8072] transition-colors hover:border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/5"
                  >
                    📎 แนบไฟล์ (สูงสุด 10MB)
                    <input
                      ref="fileInputRef"
                      type="file"
                      class="hidden"
                      :disabled="uploading"
                      @change="handleFileChange"
                    />
                  </label>
                </div>

                <div
                  v-else
                  class="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5"
                >
                  <span class="text-sm">📄</span>
                  <span class="min-w-0 flex-1 truncate text-sm text-[#2A2521]">{{ file.name }}</span>
                  <button
                    type="button"
                    @click="removeFile"
                    :disabled="uploading"
                    class="shrink-0 text-xs font-semibold text-[#B8402A] hover:underline"
                  >
                    ลบ
                  </button>
                </div>
              </div>

              <p
                v-if="errorMsg"
                class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#B8402A]"
              >
                {{ errorMsg }}
              </p>

              <div class="flex gap-3 pt-1">
                <button
                  type="button"
                  @click="closeModal"
                  :disabled="uploading"
                  class="flex-1 rounded-full border-2 border-[#E4DCC8] px-5 py-2.5 text-sm font-semibold text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/30 disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  :disabled="uploading"
                  class="stamp-btn flex-1 rounded-full bg-[#FF6B4A] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
                >
                  {{ uploading ? 'กำลังสร้าง...' : 'สร้างการบ้าน' }}
                </button>
              </div>
            </form>
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