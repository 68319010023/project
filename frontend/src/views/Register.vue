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
    // สมัครสมาชิกผ่าน Supabase Auth
    // ส่ง full_name และ role ไปใน options.data (raw_user_meta_data)
    // เพื่อให้ database trigger "handle_new_user" อ่านค่าไปสร้างแถวใน profiles ให้เองอัตโนมัติ
    // *** ไม่ต้อง insert เข้า profiles เองจากฝั่งนี้อีกแล้ว เพราะ trigger จัดการให้แล้ว ***
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
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
    <div class="w-full max-w-md p-8 bg-white rounded shadow-md">
      <h2 class="text-2xl font-bold mb-6 text-center">สมัครสมาชิก</h2>

      <form @submit.prevent="handleRegister">
        <div class="mb-4">
          <label for="fullName" class="block text-gray-700">ชื่อ-นามสกุล</label>
          <input
            v-model="fullName"
            type="text"
            id="fullName"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            required
          />
        </div>

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

        <div class="mb-4">
          <label for="password" class="block text-gray-700">รหัสผ่าน</label>
          <input
            v-model="password"
            type="password"
            id="password"
            minlength="6"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            required
          />
        </div>

        <div class="mb-6">
          <label for="role" class="block text-gray-700">บทบาท</label>
          <select
            v-model="role"
            id="role"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            required
          >
            <option value="student">นักเรียน (Student)</option>
            <option value="teacher">ครูผู้สอน (Teacher)</option>
          </select>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}
        </button>
      </form>

      <p v-if="errorMsg" class="mt-4 text-red-600 text-sm text-center">
        {{ errorMsg }}
      </p>
      <p v-if="successMsg" class="mt-4 text-green-600 text-sm text-center">
        {{ successMsg }}
      </p>

      <p class="mt-6 text-sm text-center text-gray-600">
        มีบัญชีอยู่แล้ว?
        <router-link to="/login" class="text-blue-500 hover:underline">เข้าสู่ระบบ</router-link>
      </p>
    </div>
  </div>
</template>