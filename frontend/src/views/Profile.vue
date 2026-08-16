<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { useProfile } from '../composables/useProfile'

const router = useRouter()
const { email, name, role, avatarUrl, loaded, loadProfile, setName, setAvatarUrl } = useProfile()

const localLoading = ref(true)

const savingProfile = ref(false)
const profileErrorMsg = ref('')
const profileSuccessMsg = ref('')

const uploadingAvatar = ref(false)
const avatarErrorMsg = ref('')

const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const passwordErrorMsg = ref('')
const passwordSuccessMsg = ref('')

const initial = () => (name.value ? name.value.trim().charAt(0) : '?')
const roleLabel = () => (role.value === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน')

async function init() {
  localLoading.value = true

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    router.push('/login')
    return
  }

  // ถ้ายังไม่เคยโหลด (เช่น เข้าหน้านี้เป็นหน้าแรกโดยไม่ผ่าน navbar) ให้โหลดก่อน
  if (!loaded.value) {
    await loadProfile()
  }

  localLoading.value = false
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

    // ⭐ อัปเดต state กลางทันที ไม่ต้อง refresh หน้า
    // ทุกที่ที่ใช้ useProfile() (รวมถึง Navbar ใน App.vue) จะเห็นชื่อใหม่ทันที
    setName(trimmedName)

    profileSuccessMsg.value = 'บันทึกข้อมูลแล้ว'
    setTimeout(() => { profileSuccessMsg.value = '' }, 2500)
  } catch (err) {
    console.error(err)
    profileErrorMsg.value = 'บันทึกไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    savingProfile.value = false
  }
}

async function uploadAvatar(event) {
  avatarErrorMsg.value = ''
  const file = event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    avatarErrorMsg.value = 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    avatarErrorMsg.value = 'ขนาดไฟล์ต้องไม่เกิน 2MB'
    return
  }

  uploadingAvatar.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('เซสชันหมดอายุ')

    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)
    if (updateError) throw updateError

    // ⭐ อัปเดต state กลางทันที ไม่ต้อง refresh หน้า
    setAvatarUrl(publicUrl)

    profileSuccessMsg.value = 'อัปเดตรูปโปรไฟล์แล้ว'
    setTimeout(() => { profileSuccessMsg.value = '' }, 2500)
  } catch (err) {
    console.error(err)
    avatarErrorMsg.value = 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    uploadingAvatar.value = false
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

onMounted(init)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div v-if="localLoading" class="py-20 text-center text-[#8A8072]">กำลังโหลดข้อมูล...</div>

      <div v-else>
        <div class="mb-6">
          <h1 class="title-font text-2xl font-bold text-[#2A2521]">โปรไฟล์ของฉัน</h1>
          <p class="mt-1.5 text-[#8A8072]">แก้ไขชื่อและรหัสผ่านของบัญชีคุณ</p>
        </div>

        <!-- Layout 2 คอลัมน์: ซ้าย = สรุปโปรไฟล์ (sticky) / ขวา = ฟอร์มต่างๆ -->
        <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          <!-- คอลัมน์ซ้าย: การ์ดสรุปโปรไฟล์ -->
          <div class="note-card lg:sticky lg:top-8 flex flex-col items-center px-6 py-8 text-center">
            <div class="relative">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                alt="avatar"
                class="h-24 w-24 rounded-full object-cover border-2 border-[#E4DCC8]"
              />
              <div
                v-else
                class="flex h-24 w-24 items-center justify-center rounded-full bg-[#FF6B4A] text-3xl font-semibold text-white"
              >
                {{ initial() }}
              </div>

              <label
                class="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white border-2 border-[#E4DCC8] text-sm shadow-sm hover:bg-[#F1EADC]"
              >
                📷
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  :disabled="uploadingAvatar"
                  @change="uploadAvatar"
                />
              </label>
            </div>

            <p class="title-font mt-4 truncate text-lg font-semibold text-[#2A2521]">{{ name || 'ไม่ระบุชื่อ' }}</p>
            <span class="mt-1.5 inline-block rounded-full bg-[#7C9473]/10 px-2.5 py-0.5 text-xs font-medium text-[#5C7355]">
              {{ roleLabel() }}
            </span>
            <p class="mt-3 truncate text-xs text-[#B0A692]">{{ email }}</p>

            <p v-if="uploadingAvatar" class="mt-3 text-xs text-[#8A8072]">กำลังอัปโหลด...</p>
            <p v-if="avatarErrorMsg" class="mt-3 text-xs text-[#B8402A]">{{ avatarErrorMsg }}</p>
          </div>

          <!-- คอลัมน์ขวา: ฟอร์มข้อมูลส่วนตัว + เปลี่ยนรหัสผ่าน วางเคียงกัน -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

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
                  class="stamp-btn w-full rounded-full bg-[#FF6B4A] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
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
                  class="stamp-btn w-full rounded-full bg-[#FF6B4A] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E4DCC8] disabled:text-[#B0A692] disabled:shadow-none"
                >
                  {{ savingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน' }}
                </button>
              </form>
            </section>

          </div>
        </div>
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