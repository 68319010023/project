<script setup>
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../composables/useAuth'

const props = defineProps({
  assignmentId: { type: String, required: true },
})

const emit = defineEmits(['close', 'submitted'])

const { user } = useAuth()

const file = ref(null)
const uploading = ref(false)
const errorMsg = ref('')

function handleFileChange(e) {
  file.value = e.target.files[0] || null
}

async function handleSubmit() {
  errorMsg.value = ''

  if (!file.value) {
    errorMsg.value = 'กรุณาเลือกไฟล์'
    return
  }

  uploading.value = true

  const studentId = user.value.id
  const originalName = file.value.name
  const extension = originalName.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.'))
    : ''
  const safeName = `${Date.now()}${extension}`
  const filePath = `${props.assignmentId}/${studentId}/${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('submission-files')
    .upload(filePath, file.value, { upsert: true })

  if (uploadError) {
    console.error('upload error:', uploadError)
    errorMsg.value = 'อัปโหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง'
    uploading.value = false
    return
  }

  const { error: insertError } = await supabase
    .from('assignment_submissions')
    .upsert(
      {
        assignment_id: props.assignmentId,
        student_id: studentId,
        file_url: filePath,
        original_filename: originalName,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' }
    )

  uploading.value = false

  if (insertError) {
    console.error('insert submission error:', insertError)
    errorMsg.value = 'บันทึกข้อมูลการส่งไม่สำเร็จ ลองใหม่อีกครั้ง'
    return
  }

  emit('submitted')
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white border-2 border-black rounded-xl p-6 w-full max-w-md">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-mali text-xl font-bold">ส่งการบ้าน</h2>
        <button @click="emit('close')" class="text-gray text-xl leading-none">✕</button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-bold mb-1">เลือกไฟล์</label>
          <input
            type="file"
            @change="handleFileChange"
            class="w-full border-2 border-black rounded-lg px-3 py-2"
          />
        </div>

        <p v-if="errorMsg" class="text-red-600 text-sm">{{ errorMsg }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="emit('close')"
            class="border-2 border-black rounded-lg px-4 py-2 font-bold"
          >
            ยกเลิก
          </button>
          <button
            @click="handleSubmit"
            :disabled="uploading"
            class="bg-black text-white rounded-lg px-4 py-2 font-bold disabled:opacity-50"
          >
            {{ uploading ? 'กำลังส่ง...' : 'ส่งการบ้าน' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>