<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
// ปรับ path ให้ตรงกับตำแหน่งไฟล์ supabase.js จริงในโปรเจกต์คุณ เช่น '../supabase' หรือ '@/supabase'
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
    // จังหวะที่ 1: ล็อกอินผ่าน Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (authError) throw authError

    const userId = authData.user?.id
    if (!userId) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่')
    }

    // จังหวะที่ 2: ดึง role จากตาราง profiles
    // (RLS policy "Users can view own profile" ที่ทำไว้ก่อนหน้านี้ จะอนุญาตให้ query แถวของตัวเองได้)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    // จังหวะที่ 3: redirect ตาม role
    if (profile.role === 'teacher') {
      router.push('/teacher-dashboard')
    } else if (profile.role === 'student') {
      router.push('/student-dashboard')
    } else {
      router.push('/')
    }
  } catch (err) {
    console.error(err)
    // แยกข้อความ error ให้เข้าใจง่ายขึ้นสำหรับกรณีที่พบบ่อย
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
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
    <div class="w-full max-w-md p-8 bg-white rounded shadow-md">
      <h2 class="text-2xl font-bold mb-6 text-center">Login</h2>

      <form @submit.prevent="login">
        <div class="mb-4">
          <label for="email" class="block text-gray-700">Email</label>
          <input
            v-model="email"
            type="email"
            id="email"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            required
          />
        </div>

        <div class="mb-6">
          <label for="password" class="block text-gray-700">Password</label>
          <input
            v-model="password"
            type="password"
            id="password"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            required
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'Login' }}
        </button>
      </form>

      <p v-if="errorMsg" class="mt-4 text-red-600 text-sm text-center">
        {{ errorMsg }}
      </p>
    </div>
    <a href="/register" class="text-blue-500 hover:underline">สมัครสมาชิก</a>
  </div>
</template>