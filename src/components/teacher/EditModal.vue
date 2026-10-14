<script setup>
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-vue-next'

const props = defineProps({
  classroom: { type: Object, required: true }, // { id, name, gradeLevel }
})

const emit = defineEmits(['close', 'saved'])

const name = ref(props.classroom.name ?? '')
const gradeLevel = ref(props.classroom.gradeLevel ?? '')
const saving = ref(false)
const errorMsg = ref('')
const fieldErrors = ref({})

async function handleSubmit() {
  errorMsg.value = ''
  fieldErrors.value = {}

  if (!name.value.trim()) {
    fieldErrors.value.name = 'กรุณากรอกชื่อห้องเรียน'
    return
  }

  saving.value = true

  try {
    const { data, error } = await supabase
      .from('classrooms')
      .update({
        name: name.value.trim(),
        grade_level: gradeLevel.value.trim(),
      })
      .eq('id', props.classroom.id)
      .select('id')
      .maybeSingle()

    if (error) throw error

    // RLS ที่ไม่อนุญาตจะไม่ throw error แต่คืนแถวว่าง — ต้องเช็คเองไม่งั้นดูเหมือนบันทึกสำเร็จทั้งที่ไม่เปลี่ยนจริง
    if (!data) throw new Error('บันทึกไม่สำเร็จ (ไม่มีสิทธิ์แก้ไขห้องนี้)')

    emit('saved')
    emit('close')
  } catch (err) {
    console.error('update classroom error:', err)
    errorMsg.value = err.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="!saving && emit('close')">
      <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 w-full max-w-md">
        <div class="flex items-center justify-between mb-5">
          <h2 class="font-mali text-xl font-bold text-dark">แก้ไขห้องเรียน</h2>
          <button type="button" @click="emit('close')" :disabled="saving"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition disabled:opacity-50">
            <X :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <div>
            <label class="block text-[13px] font-bold mb-1.5">ชื่อห้องเรียน *</label>
            <input v-model="name" type="text"
              class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              :class="fieldErrors.name ? 'border-danger' : 'border-dark'" />
            <p v-if="fieldErrors.name" class="text-danger text-[12px] mt-1">{{ fieldErrors.name }}</p>
          </div>

          <div>
            <label class="block text-[13px] font-bold mb-1.5">ระดับชั้น</label>
            <input v-model="gradeLevel" type="text"
              class="w-full border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
          </div>

          <p v-if="errorMsg" class="text-danger text-[13px] bg-red-50 border-2 border-danger rounded-lg px-3 py-2">
            {{ errorMsg }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="emit('close')" :disabled="saving"
              class="border-2 border-dark rounded-lg px-4 py-2.5 font-semibold text-[13.5px] hover:bg-gray-light transition disabled:opacity-50">
              ยกเลิก
            </button>
            <button type="submit" :disabled="saving"
              class="border-2 border-dark rounded-lg px-5 py-2.5 font-bold text-[13.5px] bg-orange shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0">
              {{ saving ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>