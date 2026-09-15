<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits(['close', 'created'])
const { profile } = useAuth()

const name = ref('')
const gradeLevel = ref('')
const loading = ref(false)
const errorMsg = ref('')

function generateCode(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ตัดตัวที่สับสนง่าย เช่น 0/O, 1/I
    let code = ''
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
}

async function handleCreate() {
    if (!name.value.trim()) {
        errorMsg.value = 'กรุณากรอกชื่อห้องเรียน'
        return
    }
    errorMsg.value = ''
    loading.value = true

    let attempt = 0
    while (attempt < 5) {
        const code = generateCode()
        const { data, error } = await supabase
            .from('classrooms')
            .insert({
                teacher_id: profile.value.id,
                name: name.value.trim(),
                grade_level: gradeLevel.value.trim() || null,
                class_code: code
            })
            .select()
            .single()

        if (!error) {
            emit('created', data)
            loading.value = false
            return
        }
        if (error.code === '23505') { // ชนกับรหัสห้องเดิม (unique) → สุ่มใหม่
            attempt++
            continue
        }
        errorMsg.value = error.message
        loading.value = false
        return
    }
    errorMsg.value = 'สร้างห้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    loading.value = false
}
</script>

<template>
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" @click.self="emit('close')">
        <div class="bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[420px] w-full p-7">
            <h2 class="font-mali font-bold text-xl mb-4">สร้างห้องเรียนใหม่</h2>

            <p v-if="errorMsg"
                class="text-danger text-[13px] mb-3 bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                {{ errorMsg }}
            </p>

            <label class="text-[13px] font-semibold">ชื่อห้องเรียน</label>
            <input v-model="name" type="text" placeholder="เช่น คณิตศาสตร์ ม.3/1"
                class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 border-dark text-[14px] mb-4" />

            <label class="text-[13px] font-semibold">ระดับชั้น (ถ้ามี)</label>
            <input v-model="gradeLevel" type="text" placeholder="เช่น ปวส.2/3"
                class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 border-dark text-[14px] mb-5" />

            <div class="flex gap-3">
                <button type="button" @click="emit('close')"
                    class="flex-1 px-5 py-2.5 rounded-[10px] border-2 border-dark bg-white font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                    ยกเลิก
                </button>
                <button type="button" @click="handleCreate" :disabled="loading"
                    class="flex-1 px-5 py-2.5 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40">
                    {{ loading ? 'กำลังสร้าง...' : 'สร้างห้อง' }}
                </button>
            </div>
        </div>
    </div>
</template>