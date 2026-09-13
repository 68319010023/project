<script setup>
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const emit = defineEmits(['close', 'created'])

const title = ref('')
const description = ref('')
const dueDate = ref('')
const saving = ref(false)
const errorMsg = ref('')

async function handleSubmit() {
  errorMsg.value = ''

  if (!title.value.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อการบ้าน'
    return
  }

  saving.value = true

  const { error } = await supabase.from('assignments').insert({
    classroom_id: props.classroomId,
    title: title.value.trim(),
    description: description.value.trim() || null,
    due_date: dueDate.value || null,
  })

  saving.value = false

  if (error) {
    console.error('create assignment error:', error)
    errorMsg.value = 'สร้างการบ้านไม่สำเร็จ ลองใหม่อีกครั้ง'
    return
  }

  emit('created')
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white border-2 border-black rounded-xl p-6 w-full max-w-md">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-mali text-xl font-bold">สร้างการบ้าน</h2>
        <button @click="emit('close')" class="text-gray text-xl leading-none">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-bold mb-1">ชื่อการบ้าน *</label>
          <input
            v-model="title"
            type="text"
            class="w-full border-2 border-black rounded-lg px-3 py-2"
            placeholder="เช่น แบบฝึกหัดบทที่ 3"
          />
        </div>

        <div>
          <label class="block text-sm font-bold mb-1">รายละเอียด</label>
          <textarea
            v-model="description"
            rows="3"
            class="w-full border-2 border-black rounded-lg px-3 py-2"
            placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
          />
        </div>

        <div>
          <label class="block text-sm font-bold mb-1">กำหนดส่ง</label>
          <input
            v-model="dueDate"
            type="date"
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
            type="submit"
            :disabled="saving"
            class="bg-black text-white rounded-lg px-4 py-2 font-bold disabled:opacity-50"
          >
            {{ saving ? 'กำลังบันทึก...' : 'สร้างการบ้าน' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>