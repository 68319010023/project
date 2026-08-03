<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()

const loading = ref(true)
const email = ref('')
const name = ref('')
const role = ref('')

const savingProfile = ref(false)
const profileErrorMsg = ref('')
const profileSuccessMsg = ref('')

const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const passwordErrorMsg = ref('')
const passwordSuccessMsg = ref('')

const initial = computed(() => (name.value ? name.value.trim().charAt(0) : '?'))
const roleLabel = computed(() => (role.value === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'))

async function fetchProfile() {
  loading.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    email.value = user.email

    const { data, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single()
    if (error) throw error

    name.value = data.name || ''
    role.value = data.role || ''
  } catch (err) {
    console.error(err)
    profileErrorMsg.value = 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  profileErrorMsg.value = ''
  profileSuccessMsg.value = ''

  const trimmedName = name.value.trim()
  if (!trimmedName) {
    profileErrorMsg.value = 'กรุณากรอกชื่อ-นามสกุล'
    return
  }

  savingProfile.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')

    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmedName })
      .eq('id', user.id)
    if (error) throw error

    profileSuccessMsg.value = 'บันทึกข้อมูลแล้ว'
    setTimeout(() => { profileSuccessMsg.value = '' }, 2500)
  } catch (err) {
    console.error(err)
    profileErrorMsg.value = 'บันทึกไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  passwordErrorMsg.value = ''
  passwordSuccessMsg.value = ''

  if (newPassword.value.length < 6) {
    passwordErrorMsg.value = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordErrorMsg.value = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    return
  }

  savingPassword.value = true

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) throw error

    passwordSuccessMsg.value = 'เปลี่ยนรหัสผ่านแล้ว'
    newPassword.value = ''
    confirmPassword.value = ''
    setTimeout(() => { passwordSuccessMsg.value = '' }, 2500)
  } catch (err) {
    console.error(err)
    passwordErrorMsg.value = err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    savingPassword.value = false
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-xl px-4 py-8 sm:py-10">
      <div v-if="loading" class="py-20 text-center text-[#8A8072]">กำลังโหลดข้อมูล...</div>

      <div v-else class="space-y-6">
        <div>
          <h1 class="title-font text-2xl font-bold text-[#2A2521]">โปรไฟล์ของฉัน</h1>
          <p class="mt-1.5 text-[#8A8072]">แก้ไขชื่อและรหัสผ่านของบัญชีคุณ</p>
        </div>

        <!-- ID card -->
        <div class="note-card flex items-center gap-4 px-6 py-5">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FF6B4A] text-xl font-semibold text-white">
            {{ initial }}
          </div>
          <div class="min-w-0">
            <p class="title-font truncate text-lg font-semibold text-[#2A2521]">{{ name || 'ไม่ระบุชื่อ' }}</p>
            <span class="mt-1 inline-block rounded-full bg-[#7C9473]/10 px-2.5 py-0.5 text-xs font-medium text-[#5C7355]">
              {{ roleLabel }}
            </span>
          </div>
        </div>

        <!-- ข้อมูลส่วนตัว -->
        <section class="note-card p-6">
          <h2 class="title-font mb-4 font-semibold text-[#2A2521]">ข้อมูลส่วนตัว</h2>

          <form @submit.prevent="saveProfile" class="space-y-4">
            <div>
              <label for="email" class="mb-1.5 block text-xs font-medium text-[#6B6255]">อีเมล</label>
              <input
                id="email"
                :value="email"
                type="email"
                disabled
                class="w-full cursor-not-allowed rounded-xl border-2 border-[#E4DCC8] bg-[#F1EADC] px-3.5 py-2.5 text-sm text-[#8A8072]"
              />
            </div>

            <div>
              <label for="name" class="mb-1.5 block text-xs font-medium text-[#6B6255]">ชื่อ-นามสกุล</label>
              <input
                id="name"
                v-model="name"
                type="text"
                placeholder="เช่น สมชาย ใจดี"
                class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
                :disabled="savingProfile"
              />
            </div>

            <p v-if="profileErrorMsg" class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3.5 py-2 text-[13px] font-medium text-[#B8402A]">
              {{ profileErrorMsg }}
            </p>
            <p v-if="profileSuccessMsg" class="rounded-xl border border-[#7C9473]/40 bg-[#7C9473]/10 px-3.5 py-2 text-[13px] font-medium text-[#4E5F49]">
              {{ profileSuccessMsg }}
            </p>

            <button
              type="submit"
              :disabled="savingProfile"
              class="stamp-btn rounded-full bg-[#FF6B4A] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
            >
              {{ savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
            </button>
          </form>
        </section>

        <!-- เปลี่ยนรหัสผ่าน -->
        <section class="note-card p-6">
          <h2 class="title-font mb-4 font-semibold text-[#2A2521]">เปลี่ยนรหัสผ่าน</h2>

          <form @submit.prevent="changePassword" class="space-y-4">
            <div>
              <label for="new-password" class="mb-1.5 block text-xs font-medium text-[#6B6255]">รหัสผ่านใหม่</label>
              <input
                id="new-password"
                v-model="newPassword"
                type="password"
                minlength="6"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
                :disabled="savingPassword"
              />
            </div>

            <div>
              <label for="confirm-password" class="mb-1.5 block text-xs font-medium text-[#6B6255]">ยืนยันรหัสผ่านใหม่</label>
              <input
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                minlength="6"
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                class="w-full rounded-xl border-2 border-[#E4DCC8] bg-[#FFFDF8] px-3.5 py-2.5 text-sm text-[#2A2521] placeholder-[#B0A692] transition focus:border-[#FF6B4A] focus:outline-none"
                :disabled="savingPassword"
              />
            </div>

            <p v-if="passwordErrorMsg" class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-3.5 py-2 text-[13px] font-medium text-[#B8402A]">
              {{ passwordErrorMsg }}
            </p>
            <p v-if="passwordSuccessMsg" class="rounded-xl border border-[#7C9473]/40 bg-[#7C9473]/10 px-3.5 py-2 text-[13px] font-medium text-[#4E5F49]">
              {{ passwordSuccessMsg }}
            </p>

            <button
              type="submit"
              :disabled="savingPassword"
              class="stamp-btn rounded-full bg-[#FF6B4A] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
            >
              {{ savingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน' }}
            </button>
          </form>
        </section>
      </div>
    </main>
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

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 2px 8px rgba(42, 37, 33, 0.06);
}
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #F1EADC;
  border-radius: 0 18px 0 18px;
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
}
</style>