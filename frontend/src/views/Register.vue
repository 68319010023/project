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
  <div class="notebook-page relative flex min-h-dvh items-center justify-center px-4 py-10">
    <div class="relative z-10 w-full max-w-sm">
      <div class="mb-7 flex flex-col items-center">
        <div class="pencil-badge flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B4A] text-xl text-white">
          ✎
        </div>
        <p class="title-font mt-3 text-xs font-semibold tracking-[0.2em] text-[#8A8072]">
          SMART CLASSROOM
        </p>
      </div>

      <div class="note-card w-full px-7 py-8">
        <h2 class="title-font mb-1 text-center text-[19px] font-semibold text-[#2A2521]">
          สร้างบัญชีใหม่
        </h2>
        <p class="mb-6 text-center text-[13px] text-[#8A8072]">เริ่มต้นห้องเรียนอัจฉริยะของคุณ</p>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label for="fullName" class="mb-1.5 block text-xs font-medium text-[#6B6255]">ชื่อ-นามสกุล</label>
            <input
              v-model="fullName"
              type="text"
              id="fullName"
              placeholder="เช่น สมชาย ใจดี"
              class="notebook-input w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
              required
            />
          </div>

          <div>
            <label for="email" class="mb-1.5 block text-xs font-medium text-[#6B6255]">อีเมล</label>
            <input
              v-model="email"
              type="email"
              id="email"
              placeholder="you@example.com"
              class="notebook-input w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
              required
            />
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-xs font-medium text-[#6B6255]">รหัสผ่าน</label>
            <input
              v-model="password"
              type="password"
              id="password"
              minlength="6"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              class="notebook-input w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
              required
            />
          </div>

          <div>
            <label for="role" class="mb-1.5 block text-xs font-medium text-[#6B6255]">บทบาท</label>
            <select
              v-model="role"
              id="role"
              class="notebook-input w-full appearance-none rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] transition focus:border-[#FF6B4A] focus:outline-none"
              required
            >
              <option value="student">นักเรียน (Student)</option>
              <option value="teacher">ครูผู้สอน (Teacher)</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="stamp-btn mt-2 w-full rounded-full bg-[#FF6B4A] px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
          >
            {{ loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}
          </button>
        </form>

        <p v-if="errorMsg" class="mt-4 rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3 py-2 text-center text-[13px] font-medium text-[#B8402A]">
          {{ errorMsg }}
        </p>
        <p v-if="successMsg" class="mt-4 rounded-xl border border-[#7C9473]/40 bg-[#7C9473]/10 px-3 py-2 text-center text-[13px] font-medium text-[#4E5F49]">
          {{ successMsg }}
        </p>

        <p class="mt-6 text-center text-[13px] text-[#8A8072]">
          มีบัญชีอยู่แล้ว?
          <router-link to="/login" class="font-semibold text-[#FF6B4A] hover:underline">เข้าสู่ระบบ</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.pencil-badge {
  box-shadow: 0 3px 0 #C94A2E;
}

.note-card {
  position: relative;
  border-radius: 22px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 2px 10px rgba(42, 37, 33, 0.06);
}

.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 22px;
  height: 22px;
  background: #F1EADC;
  border-radius: 0 22px 0 22px;
}

.notebook-input {
  font-family: 'Sarabun', sans-serif;
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
  font-family: 'Kanit', sans-serif;
}
.stamp-btn:not(:disabled):active {
  box-shadow: 0 1px 0 #C94A2E;
}
</style>