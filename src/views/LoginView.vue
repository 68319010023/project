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

        console.log("LOGIN DATA:", data)
        console.log("LOGIN ERROR:", error)

        if (error) throw error


        const profile = await fetchProfile(data.user.id)

        console.log("USER ID:", data.user.id)
        console.log("PROFILE DATA:", profile)


        if (profile?.role === 'teacher') {
            console.log("GO TEACHER")
            router.push('/teacher')
        } else {
            console.log("GO STUDENT")
            router.push('/student')
        }


    } catch (err) {
        console.error("LOGIN CATCH:", err)
        errorMsg.value = err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="auth-page min-h-screen flex items-start sm:items-center justify-center px-4 sm:px-6 pt-24 pb-8 sm:py-10 font-mitr">
        <router-link to="/" class="auth-home-link">กลับหน้าแรก</router-link>
        <div class="relative z-10 bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[420px] w-full p-5 sm:p-8">
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
                </div>

                <button type="submit" :disabled="loading"
                    class="mt-2 px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40">
                    {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
                </button>
            </form>

            <p v-if="errorMsg" class="error-pop text-danger text-[13px] text-center mt-4 bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                {{ errorMsg }}
            </p>

            <p class="text-center text-[13px] text-gray mt-6">
                ยังไม่มีบัญชี?
                <router-link to="/register" class="text-purple font-semibold">สมัครสมาชิก</router-link>
            </p>
        </div>
    </div>
</template>
