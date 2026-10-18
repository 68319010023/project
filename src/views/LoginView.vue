<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { fetchProfile } = useAuth()

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const fieldErrors = ref({})
const loading = ref(false)

async function handleLogin() {
    errorMsg.value = ''
    fieldErrors.value = {}

    if (!email.value.trim()) {
        fieldErrors.value.email = true
    }
    if (!password.value) {
        fieldErrors.value.password = true
    }
    if (fieldErrors.value.email || fieldErrors.value.password) {
        errorMsg.value = 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ'
        return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
        fieldErrors.value.email = true
        errorMsg.value = 'กรุณากรอกอีเมลให้ถูกต้อง'
        return
    }

    loading.value = true

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
        })

        if (error) throw error

        await fetchProfile(data.user.id)
        router.push({ name: 'landing' })

    } catch (err) {
        console.error("LOGIN CATCH:", err)
        errorMsg.value =
            err?.status === 429
                ? 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'
                : /confirm/i.test(err?.message || '')
                    ? 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
                    : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="font-mitr">

        <!-- ========== NAVBAR ========== -->
        <div class="sticky top-0 z-30">
            <div
                class="bg-dark border-b-4 border-purple h-[70px] md:h-[90px] flex items-center gap-2 md:gap-4 px-4 md:px-6">

                <!-- โลโก้ (ซ้ายสุด) -->
                <router-link to="/" class="flex items-center gap-2 md:gap-3">
                    <img src="/img/logo.png"
                        class="w-12 h-12 md:w-20 md:h-20 hover:scale-110 transition-transform duration-200 object-cover"
                        alt="โลโก้">
                    <div class="flex flex-col leading-tight">
                        <span
                            class="font-mali font-bold text-xs xs:text-sm md:text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
                        <span class="hidden sm:block font-mitr text-xs text-gray-400 whitespace-nowrap">by บารมี
                            ปะวะลัง</span>
                    </div>
                </router-link>

                <div class="flex items-center ml-2 md:ml-6 min-w-0">
                    <router-link to="/"
                        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] text-gray-300 font-semibold hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap border-2">

                        <span class="hidden sm:inline">กลับหน้าแรก</span>
                    </router-link>
                </div>
            </div>
        </div>

        <!-- ========== เนื้อหา ========== -->
        <div
            class="auth-page min-h-[calc(100vh-70px)] md:min-h-[calc(100vh-90px)] flex items-start sm:items-center justify-center px-4 sm:px-6 py-8 sm:py-10">
            <div
                class="relative z-10 bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[360px] w-full p-5 sm:p-8">
                <h1 class="font-mali font-bold text-2xl text-center mb-6">เข้าสู่ระบบ</h1>

                <form @submit.prevent="handleLogin" novalidate class="flex flex-col gap-4">
                    <div>
                        <label class="text-[13px] font-semibold">อีเมล</label>
                        <input v-model="email" type="email"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                            :class="fieldErrors.email ? 'border-danger' : 'border-dark'" />
                    </div>
                    <div>
                        <label class="text-[13px] font-semibold">รหัสผ่าน</label>
                        <input v-model="password" type="password"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                            :class="fieldErrors.password ? 'border-danger' : 'border-dark'" />
                        <div class="flex justify-end mt-1.5">
                            <router-link to="/forgot-password"
                                class="text-purple font-semibold text-[12.5px] hover:underline">ลืมรหัสผ่าน?</router-link>
                        </div>
                    </div>

                    <button type="submit" :disabled="loading"
                        class="mt-2 px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40">
                        {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
                    </button>
                </form>

                <p v-if="errorMsg"
                    class="error-pop text-danger text-[13px] text-center mt-4 bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                    {{ errorMsg }}
                </p>

                <p class="text-center text-[13px] text-gray mt-6">
                    ยังไม่มีบัญชี?
                    <router-link to="/register" class="text-purple font-semibold">สมัครสมาชิก</router-link>
                </p>
            </div>
        </div>
    </div>
</template>