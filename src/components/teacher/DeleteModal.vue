<script setup>
import { AlertTriangle } from 'lucide-vue-next'

defineProps({
  classroom: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'close'])
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="!loading && emit('close')">
        <div role="dialog" aria-modal="true"
          class="modal-card w-full max-w-md bg-white border-3 border-dark rounded-2xl shadow-offset p-6 flex flex-col gap-4">

          <div class="flex items-center gap-3">
            <div class="w-10 h-10 shrink-0 rounded-full border-2 border-danger flex items-center justify-center">
              <AlertTriangle :size="20" :stroke-width="2.5" class="text-danger" />
            </div>
            <h3 class="font-mali font-bold text-[18px] text-dark">ลบห้องเรียน</h3>
          </div>

          <p class="text-[13.5px] text-gray leading-relaxed">
            ต้องการลบห้องเรียน
            <span class="font-bold text-dark">"{{ classroom.name }}"</span>
            ใช่ไหม
          </p>

          <p class="text-[12.5px] text-gray leading-relaxed">
            การบ้าน แบบทดสอบ งานที่นักเรียนส่ง ไฟล์แนบ และคะแนนทั้งหมดของห้องนี้จะถูกลบถาวร กู้คืนไม่ได้
          </p>

          <p v-if="error"
            class="text-[12.5px] text-danger font-semibold bg-red-50 border-2 border-danger rounded-lg px-3 py-2">
            {{ error }}
          </p>

          <div class="grid grid-cols-2 gap-3">
            <button type="button" @click="emit('close')" :disabled="loading"
              class="py-2.5 border-2 border-dark rounded-xl font-bold text-[14px] bg-white shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0">
              ยกเลิก
            </button>
            <button type="button" @click="emit('confirm')" :disabled="loading"
              class="py-2.5 border-2 border-dark rounded-xl font-bold text-[14px] text-white bg-danger shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0">
              {{ loading ? 'กำลังลบ...' : 'ลบห้องเรียน' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>