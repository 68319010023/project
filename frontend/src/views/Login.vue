<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function login() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (authError) throw authError

    const userId = authData.user?.id
    if (!userId) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    if (profile.role === 'teacher') {
      router.push('/teacher-dashboard')
    } else if (profile.role === 'student') {
      router.push('/student-dashboard')
    } else {
      router.push('/')
    }
  } catch (err) {
    console.error(err)
    if (err.message?.includes('Invalid login credentials')) {
      errorMsg.value = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    } else if (err.message?.includes('Email not confirmed')) {
      errorMsg.value = 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (เช็คกล่องจดหมาย)'
    } else {
      errorMsg.value = err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#FBF9F4] px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center mb-6">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-[#14213D] text-xl">
          🎓
        </div>
        <p class="mt-3 text-xs font-semibold tracking-widest text-[#14213D]/60" style="font-family: 'Chakra Petch', sans-serif;">
          SMART CLASSROOM
        </p>
      </div>

      <div class="w-full bg-white border border-[#14213D]/10 rounded-2xl p-7">
        <h2 class="text-lg font-semibold text-center text-[#14213D] mb-1" style="font-family: 'Chakra Petch', sans-serif;">
          ยินดีต้อนรับกลับ
        </h2>
        <p class="text-center text-sm text-[#14213D]/45 mb-6">เข้าสู่ระบบเพื่อไปยังห้องเรียนของคุณ</p>

        <form @submit.prevent="login" class="space-y-4">
          <div>
            <label for="email" class="block text-xs font-medium text-[#14213D]/60 mb-1.5">อีเมล</label>
            <input
              v-model="email"
              type="email"
              id="email"
              placeholder="you@example.com"
              class="w-full px-3.5 py-2.5 rounded-lg border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] placeholder-[#14213D]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition"
              required
            />
          </div>

          <div>
            <label for="password" class="block text-xs font-medium text-[#14213D]/60 mb-1.5">รหัสผ่าน</label>
            <input
              v-model="password"
              type="password"
              id="password"
              placeholder="••••••••"
              class="w-full px-3.5 py-2.5 rounded-lg border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] placeholder-[#14213D]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-[#14213D] text-[#FBF9F4] font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[#14213D]/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
          </button>
        </form>

        <p v-if="errorMsg" class="mt-4 text-[#993C1D] text-sm text-center bg-[#FAECE7] border border-[#F0997B] rounded-lg py-2 px-3">
          {{ errorMsg }}
        </p>

        <p class="mt-6 text-sm text-center text-[#14213D]/50">
          ยังไม่มีบัญชี?
          <router-link to="/register" class="text-[#0F766E] font-medium hover:underline">สมัครสมาชิก</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500&display=swap');
</style>