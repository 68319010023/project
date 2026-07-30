<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()

const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref('student')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function handleRegister() {
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: fullName.value,
          role: role.value,
        },
      },
    })

    if (authError) throw authError

    if (!authData.user) {
      throw new Error('ไม่สามารถสร้างผู้ใช้ได้ กรุณาลองใหม่')
    }

    successMsg.value = 'สมัครสมาชิกสำเร็จ! กำลังพาไปหน้าล็อกอิน...'

    setTimeout(() => {
      router.push('/login')
    }, 1500)
  } catch (err) {
    console.error(err)
    if (err.message?.includes('already registered')) {
      errorMsg.value = 'อีเมลนี้ถูกใช้สมัครไปแล้ว'
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
          สร้างบัญชีใหม่
        </h2>
        <p class="text-center text-sm text-[#14213D]/45 mb-6">เริ่มต้นห้องเรียนอัจฉริยะของคุณ</p>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label for="fullName" class="block text-xs font-medium text-[#14213D]/60 mb-1.5">ชื่อ-นามสกุล</label>
            <input
              v-model="fullName"
              type="text"
              id="fullName"
              placeholder="เช่น สมชาย ใจดี"
              class="w-full px-3.5 py-2.5 rounded-lg border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] placeholder-[#14213D]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition"
              required
            />
          </div>

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
              minlength="6"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              class="w-full px-3.5 py-2.5 rounded-lg border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] placeholder-[#14213D]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition"
              required
            />
          </div>

          <div>
            <label for="role" class="block text-xs font-medium text-[#14213D]/60 mb-1.5">บทบาท</label>
            <select
              v-model="role"
              id="role"
              class="w-full px-3.5 py-2.5 rounded-lg border border-[#14213D]/15 bg-[#FBF9F4] text-[#14213D] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition appearance-none"
              required
            >
              <option value="student">นักเรียน (Student)</option>
              <option value="teacher">ครูผู้สอน (Teacher)</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-[#14213D] text-[#FBF9F4] font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[#14213D]/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {{ loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}
          </button>
        </form>

        <p v-if="errorMsg" class="mt-4 text-[#993C1D] text-sm text-center bg-[#FAECE7] border border-[#F0997B] rounded-lg py-2 px-3">
          {{ errorMsg }}
        </p>
        <p v-if="successMsg" class="mt-4 text-[#0F6E56] text-sm text-center bg-[#E1F5EE] border border-[#5DCAA5] rounded-lg py-2 px-3">
          {{ successMsg }}
        </p>

        <p class="mt-6 text-sm text-center text-[#14213D]/50">
          มีบัญชีอยู่แล้ว?
          <router-link to="/login" class="text-[#0F766E] font-medium hover:underline">เข้าสู่ระบบ</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500&display=swap');
</style>