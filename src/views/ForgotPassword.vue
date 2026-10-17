<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Mail, Check } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'

const email = ref('')
const loading = ref(false)
const errorMsg = ref('')
const sent = ref(false)
const sentTo = ref('')

const emailValid = computed(() => /^\S+@\S+\.\S+$/.test(email.value.trim()))

// กันกดส่งซ้ำรัว ๆ (Supabase จำกัดจำนวนอีเมลต่อชั่วโมง)
const cooldown = ref(0)
let timer = null

function startCooldown() {
    cooldown.value = 60
    clearInterval(timer)
    timer = setInterval(() => {
        cooldown.value--
        if (cooldown.value <= 0) {
            clearInterval(timer)
            timer = null
        }
    }, 1000)
}

onBeforeUnmount(() => clearInterval(timer))

async function sendLink() {
    if (loading.value || cooldown.value > 0) return

    const target = email.value.trim()
    if (!emailValid.value) {
        errorMsg.value = 'กรุณากรอกอีเมลให้ถูกต้อง'
        return
    }

    errorMsg.value = ''
    loading.value = true

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(target, {
            redirectTo: `${window.location.origin}/reset-password`
        })
        if (error) throw error

        sentTo.value = target
        sent.value = true
        startCooldown()
    } catch (err) {
        console.error('resetPasswordForEmail error:', err)
        errorMsg.value =
            err?.status === 429
                ? 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
                : 'ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        loading.value = false
    }
}

function useAnotherEmail() {
    sent.value = false
    errorMsg.value = ''
}
</script>

<template>
    <div
        class="auth-page min-h-screen flex items-start sm:items-center justify-center px-4 sm:px-6 pt-24 pb-8 sm:py-10 font-mitr">
        <router-link to="/login" class="auth-home-link">กลับหน้าเข้าสู่ระบบ</router-link>

        <div
            class="relative z-10 bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[480px] w-full p-5 sm:p-8">

            <div class="w-14 h-14 mx-auto rounded-xl border-2 border-dark bg-purple-light flex items-center justify-center">
                <Mail :size="26" :stroke-width="2.5" class="text-dark" />
            </div>
            <h1 class="font-mali font-bold text-2xl text-center mt-4 mb-1">ลืมรหัสผ่าน</h1>

            <!-- ฟอร์มกรอกอีเมล -->
            <template v-if="!sent">
                <p class="text-center text-gray text-[13px] mb-6">
                    กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
                </p>

                <form @submit.prevent="sendLink" novalidate class="flex flex-col gap-4">
                    <div>
                        <label for="forgot-email" class="text-[13px] font-semibold">อีเมล</label>
                        <input id="forgot-email" v-model="email" type="email" autocomplete="email"
                            placeholder="name@example.com"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px] outline-none focus:ring-2 focus:ring-purple"
                            :class="errorMsg ? 'border-danger' : 'border-dark'" />
                    </div>

                    <p v-if="errorMsg" role="alert"
                        class="error-pop text-danger text-[13px] text-center bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                        {{ errorMsg }}
                    </p>

                    <button type="submit" :disabled="loading || !email.trim()"
                        class="px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0">
                        {{ loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่' }}
                    </button>
                </form>
            </template>

            <!-- ส่งแล้ว -->
            <div v-else class="flex flex-col gap-4 mt-4">
                <div role="status"
                    class="text-[13px] text-dark border-2 border-dark rounded-xl bg-purple-light px-4 py-3 flex gap-2.5">
                    <Check :size="16" :stroke-width="3" class="shrink-0 mt-0.5" />
                    <p>
                        หากอีเมล <span class="font-semibold break-all">{{ sentTo }}</span>
                        มีบัญชีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจสอบกล่องจดหมาย
                        (รวมถึงอีเมลขยะ) ลิงก์มีอายุจำกัด
                    </p>
                </div>

                <p v-if="errorMsg" role="alert"
                    class="error-pop text-danger text-[13px] text-center bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                    {{ errorMsg }}
                </p>

                <button type="button" @click="sendLink" :disabled="loading || cooldown > 0"
                    class="px-6 py-3 rounded-[10px] border-2 border-dark bg-white text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0">
                    {{ loading ? 'กำลังส่ง...' : cooldown > 0 ? `ส่งอีกครั้งได้ใน ${cooldown} วินาที` : 'ส่งลิงก์อีกครั้ง' }}
                </button>

                <button type="button" @click="useAnotherEmail"
                    class="text-[13px] text-purple font-semibold hover:underline">
                    ใช้อีเมลอื่น
                </button>
            </div>

            <p class="text-center text-[13px] text-gray mt-6">
                จำรหัสผ่านได้แล้วใช่หรือไม่?
                <router-link to="/login" class="text-purple font-semibold">เข้าสู่ระบบ</router-link>
            </p>
        </div>
    </div>
</template>