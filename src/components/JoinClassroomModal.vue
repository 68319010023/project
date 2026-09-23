<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits(['close', 'joined'])
const { profile } = useAuth()

const code = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleJoin() {
    const codeInput = code.value.trim().toUpperCase()
    if (!codeInput) {
        errorMsg.value = 'กรุณากรอกรหัสห้องเรียน'
        return
    }

    if (!profile.value?.id) {
        errorMsg.value = 'กรุณาเข้าสู่ระบบก่อนเข้าร่วมห้องเรียน'
        return
    }

    errorMsg.value = ''
    loading.value = true

    const { data: results, error: findError } = await supabase
        .rpc('find_classroom_by_code', { input_code: codeInput })

    const classroom = results?.[0]

    if (findError || !classroom) {
        errorMsg.value = 'ไม่พบห้องเรียนที่ใช้รหัสนี้'
        loading.value = false
        return
    }

    const { error: insertError } = await supabase
        .from('classroom_enrollments')
        .insert({
            classroom_id: classroom.id,
            student_id: profile.value.id,
            status: 'accepted',
            invited_by: 'code'
        })

    if (insertError) {
        errorMsg.value = insertError.code === '23505'
            ? 'คุณเข้าร่วมห้องนี้อยู่แล้ว'
            : insertError.message
        loading.value = false
        return
    }

    emit('joined', classroom)
    loading.value = false
}
</script>

<template>
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" @click.self="emit('close')">
        <div class="bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[420px] w-full p-7">
            <h2 class="font-mali font-bold text-xl mb-4">เข้าร่วมห้องเรียน</h2>

            <p v-if="errorMsg"
                class="text-danger text-[13px] mb-3 bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                {{ errorMsg }}
            </p>

            <label class="text-[13px] font-semibold">รหัสห้องเรียน</label>
            <input v-model="code" type="text" placeholder="เช่น A3F9K2" maxlength="6"
                class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 border-dark text-[14px] uppercase tracking-widest font-mono mb-5" />

            <div class="flex gap-3">
                <button type="button" @click="emit('close')"
                    class="flex-1 px-5 py-2.5 rounded-[10px] border-2 border-dark bg-white font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                    ยกเลิก
                </button>
                <button type="button" @click="handleJoin" :disabled="loading"
                    class="flex-1 px-5 py-2.5 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40">
                    {{ loading ? 'กำลังเข้าร่วม...' : 'เข้าร่วม' }}
                </button>
            </div>
        </div>
    </div>
</template>