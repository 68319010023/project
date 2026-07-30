<script setup>
import { ref, onMounted } from 'vue'
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

// เช็คตอนเปิดหน้า login: ถ้า login อยู่แล้วให้เด้งไป dashboard เลย
onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    router.replace(profile?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard')
  }
})
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
          ยินดีต้อนรับกลับ
        </h2>
        <p class="mb-6 text-center text-[13px] text-[#8A8072]">เข้าสู่ระบบเพื่อไปยังห้องเรียนของคุณ</p>

        <form @submit.prevent="login" class="space-y-4">
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
              placeholder="••••••••"
              class="notebook-input w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="stamp-btn mt-2 w-full rounded-full bg-[#FF6B4A] px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
          >
            {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
          </button>
        </form>

        <p v-if="errorMsg" class="mt-4 rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3 py-2 text-center text-[13px] font-medium text-[#B8402A]">
          {{ errorMsg }}
        </p>

        <p class="mt-6 text-center text-[13px] text-[#8A8072]">
          ยังไม่มีบัญชี?
          <router-link to="/register" class="font-semibold text-[#FF6B4A] hover:underline">สมัครสมาชิก</router-link>
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