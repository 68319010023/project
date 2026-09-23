<script setup>
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { X, Paperclip, Link2, Upload } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const emit = defineEmits(['close', 'created'])

const title = ref('')
const description = ref('')
const dueDateDate = ref('')
const dueDateTime = ref('23:59')
const maxScore = ref(100)
const saving = ref(false)
const errorMsg = ref('')
const fieldErrors = ref({})

// --- แนบไฟล์ หรือ ลิงก์ (เลือกได้อย่างใดอย่างหนึ่ง) ---
const attachmentMode = ref('file') // 'file' | 'link'
const attachmentFile = ref(null)
const attachmentLink = ref('')
const maxFileSize = 10 * 1024 * 1024 // 10 MB

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (file.size > maxFileSize) {
    errorMsg.value = 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB'
    event.target.value = ''
    return
  }
  errorMsg.value = ''
  attachmentFile.value = file
}

function clearAttachmentFile() {
  attachmentFile.value = null
}

async function uploadAttachment() {
  if (!attachmentFile.value) return { attachment_url: null, attachment_name: null }

  const extension = attachmentFile.value.name.split('.').pop()?.toLowerCase() || 'file'
  const filePath = `${props.classroomId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from('assignment-files')
    .upload(filePath, attachmentFile.value, {
      cacheControl: '3600',
      contentType: attachmentFile.value.type,
      upsert: false,
    })

  if (error) throw new Error('อัปโหลดไฟล์แนบไม่สำเร็จ กรุณาลองใหม่')

  return { attachment_url: filePath, attachment_name: attachmentFile.value.name }
}

async function handleSubmit() {
  errorMsg.value = ''
  fieldErrors.value = {}

  if (!title.value.trim()) {
    fieldErrors.value.title = 'กรุณากรอกชื่อ'
  }
  if (maxScore.value === null || maxScore.value === '' || maxScore.value <= 0) {
    fieldErrors.value.maxScore = 'กรุณากรอกคะแนนเต็มให้ถูกต้อง'
  }
  if (attachmentMode.value === 'link' && attachmentLink.value.trim() && !/^https?:\/\//.test(attachmentLink.value.trim())) {
    fieldErrors.value.attachmentLink = 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://'
  }

  if (Object.keys(fieldErrors.value).length > 0) return

  saving.value = true


  try {
    let attachment_url = null
    let attachment_name = null

    if (attachmentMode.value === 'file' && attachmentFile.value) {
      const result = await uploadAttachment()
      attachment_url = result.attachment_url
      attachment_name = result.attachment_name
    } else if (attachmentMode.value === 'link' && attachmentLink.value.trim()) {
      attachment_url = attachmentLink.value.trim()
      attachment_name = attachmentLink.value.trim()
    }

    const due_date = dueDateDate.value
      ? `${dueDateDate.value}T${dueDateTime.value || '23:59'}:00`
      : null

    const { error } = await supabase.from('assignments').insert({
      classroom_id: props.classroomId,
      title: title.value.trim(),
      description: description.value.trim() || null,
      due_date,
      max_score: maxScore.value,
      attachment_url,
      attachment_name,
    })

    if (error) throw error

    emit('created')
    emit('close')
  } catch (err) {
    console.error('create assignment error:', err)
    errorMsg.value = err.message || 'สร้างการบ้านไม่สำเร็จ ลองใหม่อีกครั้ง'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
      <div
        class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-5">
          <h2 class="font-mali text-xl font-bold text-dark">สร้างการบ้าน</h2>
          <button type="button" @click="emit('close')"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition">
            <X :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <div>
            <label class="block text-[13px] font-bold mb-1.5">ชื่อ *</label>
            <input v-model="title" type="text"
              class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              :class="fieldErrors.title ? 'border-danger' : 'border-dark'" placeholder="เช่น แบบฝึกหัดบทที่ 3" />
            <p v-if="fieldErrors.title" class="text-danger text-[12px] mt-1">{{ fieldErrors.title }}</p>
          </div>

          <div>
            <label class="block text-[13px] font-bold mb-1.5">รายละเอียด</label>
            <textarea v-model="description" rows="3"
              class="w-full border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[13px] font-bold mb-1.5">กำหนดส่ง</label>
              <div class="flex gap-2">
                <input v-model="dueDateDate" type="date"
                  class="flex-1 min-w-0 border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
                <input v-model="dueDateTime" type="time"
                  class="w-[110px] border-2 border-dark rounded-lg px-2 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-bold mb-1.5">คะแนนเต็ม *</label>
              <input v-model.number="maxScore" type="number" min="1"
                class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
                :class="fieldErrors.maxScore ? 'border-danger' : 'border-dark'" />
              <p v-if="fieldErrors.maxScore" class="text-danger text-[12px] mt-1">{{ fieldErrors.maxScore }}</p>
            </div>
          </div>

          <!-- แนบไฟล์ / ลิงก์ -->
          <div>
            <label class="block text-[13px] font-bold mb-1.5">เอกสารประกอบ (ถ้ามี)</label>
            <div class="flex gap-2 mb-2">
              <button type="button" @click="attachmentMode = 'file'; attachmentLink = ''"
                class="flex-1 flex items-center justify-center gap-1.5 border-2 border-dark rounded-lg py-2 text-[13px] font-semibold transition"
                :class="attachmentMode === 'file' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                <Paperclip :size="14" :stroke-width="2.5" />
                แนบไฟล์
              </button>
              <button type="button" @click="attachmentMode = 'link'; clearAttachmentFile()"
                class="flex-1 flex items-center justify-center gap-1.5 border-2 border-dark rounded-lg py-2 text-[13px] font-semibold transition"
                :class="attachmentMode === 'link' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                <Link2 :size="14" :stroke-width="2.5" />
                แนบลิงก์
              </button>
            </div>

            <div v-if="attachmentMode === 'file'">
              <label v-if="!attachmentFile"
                class="flex items-center justify-center gap-2 border-2 border-dashed border-dark rounded-lg py-3 text-[13px] font-semibold text-gray cursor-pointer hover:bg-gray-light transition">
                <Upload :size="15" :stroke-width="2.5" />
                เลือกไฟล์ (สูงสุด 10 MB)
                <input type="file" class="sr-only" @change="handleFileChange" />
              </label>
              <div v-else class="flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-gray-light">
                <Paperclip :size="14" :stroke-width="2.5" class="shrink-0 text-gray" />
                <span class="flex-1 min-w-0 text-[13px] truncate">{{ attachmentFile.name }}</span>
                <button type="button" @click="clearAttachmentFile"
                  class="shrink-0 w-6 h-6 rounded-full border-2 border-dark flex items-center justify-center hover:bg-white transition">
                  <X :size="12" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <input v-else v-model="attachmentLink" type="text"
              class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              :class="fieldErrors.attachmentLink ? 'border-danger' : 'border-dark'" placeholder="https://..." />
            <p v-if="fieldErrors.attachmentLink" class="text-danger text-[12px] mt-1">{{ fieldErrors.attachmentLink }}
            </p>
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
              {{ saving ? 'กำลังบันทึก...' : 'สร้างการบ้าน' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>