<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { Upload, GraduationCap, Presentation } from 'lucide-vue-next'
import AvatarPicker from '../components/AvatarPicker.vue'

const router = useRouter()

const step = ref(1) // 1 = ฟอร์ม, 2 = เลือกอวตาร
const form = ref({
    name: '',
    lastname: '',
    email: '',
    password: '',
    role: 'student'
})
const selectedAvatar = ref(null)
const customAvatarFile = ref(null)
const customAvatarPreview = ref(null)
const errorMsg = ref('')
const successMsg = ref('')
const fieldErrors = ref({})
const loading = ref(false)
const profileImageBucket = 'profile-images'
const maxAvatarSize = 5 * 1024 * 1024

function goToAvatarStep() {
    errorMsg.value = ''
    fieldErrors.value = {}
    const messages = []

    if (!form.value.name.trim()) {
        fieldErrors.value.name = true
    }
    if (!form.value.lastname.trim()) {
        fieldErrors.value.lastname = true
    }
    if (!form.value.email.trim()) {
        fieldErrors.value.email = true
    } else if (!/^\S+@\S+\.\S+$/.test(form.value.email.trim())) {
        fieldErrors.value.email = true
        messages.push('อีเมลไม่ถูกต้อง')
    }
    if (!form.value.password || form.value.password.length < 6) {
        fieldErrors.value.password = true
        messages.push('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร')
    }

    if (fieldErrors.value.name || fieldErrors.value.lastname || fieldErrors.value.email) {
        messages.unshift('กรุณากรอกชื่อ นามสกุล และอีเมลให้ครบ')
    }

    if (messages.length > 0) {
        errorMsg.value = messages.join(' / ')
        return
    }

    step.value = 2
}

function selectPresetAvatar(path) {
    customAvatarFile.value = null
    clearCustomAvatarPreview()
    selectedAvatar.value = path
}

function handleCustomAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        errorMsg.value = 'กรุณาเลือกรูป JPG, PNG หรือ WebP'
        event.target.value = ''
        return
    }

    if (file.size > maxAvatarSize) {
        errorMsg.value = 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB'
        event.target.value = ''
        return
    }

    errorMsg.value = ''
    customAvatarFile.value = file
    clearCustomAvatarPreview()
    customAvatarPreview.value = URL.createObjectURL(file)
    selectedAvatar.value = customAvatarPreview.value
}

function clearCustomAvatarPreview() {
    if (customAvatarPreview.value) {
        URL.revokeObjectURL(customAvatarPreview.value)
        customAvatarPreview.value = null
    }
}

async function uploadCustomAvatar(userId) {
    if (!customAvatarFile.value) return selectedAvatar.value

    const extension = customAvatarFile.value.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${userId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
        .from(profileImageBucket)
        .upload(filePath, customAvatarFile.value, {
            cacheControl: '3600',
            contentType: customAvatarFile.value.type,
            upsert: false
        })

    if (uploadError) {
        throw new Error('อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    }

    const { data } = supabase.storage.from(profileImageBucket).getPublicUrl(filePath)
    return data.publicUrl
}

onBeforeUnmount(clearCustomAvatarPreview)

async function handleRegister() {
    if (!selectedAvatar.value) {
        errorMsg.value = 'กรุณาเลือกอวตาร 1 แบบ'
        return
    }
    errorMsg.value = ''
    loading.value = true

    try {
        // 1. สมัคร auth.users
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: form.value.email,
            password: form.value.password
        })
        if (signUpError) throw signUpError

        // When email confirmation is enabled, Supabase can return a user-shaped
        // response for an existing email. Do not try to create its profile again.
        if (signUpData.user?.identities?.length === 0) {
            errorMsg.value = 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ'
            return
        }

        const userId = signUpData.user?.id
        if (!userId) {
            // กรณีโปรเจกต์เปิด "ยืนยันอีเมล" ไว้ จะยังไม่มี session ทันที
            successMsg.value = 'สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
            loading.value = false
            return
        }

        // 2. เพิ่มแถวใน profiles
        const avatarUrl = await uploadCustomAvatar(userId)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                name: form.value.name.trim(),
                lastname: form.value.lastname.trim(),
                email: form.value.email.trim(),
                role: form.value.role,
                img: avatarUrl
            }, { onConflict: 'id' })
        if (profileError) throw profileError

        if (signUpData.session) {
            router.replace(form.value.role === 'teacher' ? '/teacher' : '/student')
        } else {
            router.replace('/login')
        }
    } catch (err) {
        console.error(err)
        errorMsg.value = err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
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

                <!-- ปุ่มกลับ (ตำแหน่งเดียวกับ breadcrumb ของ AppNavbar) -->
                <div class="flex items-center ml-2 md:ml-6 min-w-0">
                    <router-link to="/"
                        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] text-gray-300 font-semibold hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap border-2">
                        กลับหน้าแรก
                    </router-link>
                </div>
            </div>
        </div>

        <!-- ========== เนื้อหา ========== -->
        <div
            class="auth-page min-h-[calc(100vh-70px)] md:min-h-[calc(100vh-90px)] flex items-start sm:items-center justify-center px-4 sm:px-6 py-8 sm:py-10">
            <div
                class="relative z-10 bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[420px] w-full p-5 sm:p-8">

                <h1 class="font-mali font-bold text-2xl text-center mb-1">สมัครสมาชิก</h1>
                <p class="text-center text-gray text-[13px] mb-6">
                    ขั้นตอน {{ step }} / 2 — {{ step === 1 ? 'กรอกข้อมูล' : 'เลือกอวตาร' }}
                </p>

                <!-- STEP 1: ฟอร์ม -->
                <form v-if="step === 1" @submit.prevent="goToAvatarStep" novalidate class="flex flex-col gap-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[13px] font-semibold">ชื่อ</label>
                            <input v-model="form.name" type="text"
                                class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                                :class="fieldErrors.name ? 'border-danger' : 'border-dark'" />
                        </div>
                        <div>
                            <label class="text-[13px] font-semibold">นามสกุล</label>
                            <input v-model="form.lastname" type="text"
                                class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                                :class="fieldErrors.lastname ? 'border-danger' : 'border-dark'" />
                        </div>
                    </div>

                    <div>
                        <label class="text-[13px] font-semibold">อีเมล</label>
                        <input v-model="form.email" type="email"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                            :class="fieldErrors.email ? 'border-danger' : 'border-dark'" />
                    </div>

                    <div>
                        <label class="text-[13px] font-semibold">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
                        <input v-model="form.password" type="password"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 text-[14px]"
                            :class="fieldErrors.password ? 'border-danger' : 'border-dark'" />
                    </div>

                    <div>
                        <label class="text-[13px] font-semibold">บทบาท</label>
                        <div class="flex gap-3 mt-1.5">
                            <label class="flex-1 flex items-center justify-center gap-2 border-2 border-dark rounded-lg py-2.5 cursor-pointer
               transition focus-within:ring-2 focus-within:ring-purple"
                                :class="form.role === 'student' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                                <input type="radio" value="student" v-model="form.role" class="sr-only" />
                                <GraduationCap :size="18" :stroke-width="2.5" />
                                นักเรียน
                            </label>
                            <label class="flex-1 flex items-center justify-center gap-2 border-2 border-dark rounded-lg py-2.5 cursor-pointer
               transition focus-within:ring-2 focus-within:ring-purple"
                                :class="form.role === 'teacher' ? 'bg-purple-light' : 'bg-white hover:bg-gray-light'">
                                <input type="radio" value="teacher" v-model="form.role" class="sr-only" />
                                <Presentation :size="18" :stroke-width="2.5" />
                                ครู
                            </label>
                        </div>
                    </div>

                    <button type="submit"
                        class="mt-2 px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                        ถัดไป: เลือกอวตาร
                    </button>
                </form>

                <!-- STEP 2: เลือกอวตาร -->
                <div v-else class="flex flex-col gap-5">
                    <div class="flex flex-col gap-2.5">
                        <p class="text-[12px] font-semibold text-dark">เลือกอวตาร</p>
                        <AvatarPicker :model-value="selectedAvatar" @update:model-value="selectPresetAvatar" />
                    </div>

                    <div class="flex items-center gap-3" aria-hidden="true">
                        <span class="flex-1 h-0.5 bg-dark/10"></span>
                        <span class="text-[11.5px] text-gray">หรือ</span>
                        <span class="flex-1 h-0.5 bg-dark/10"></span>
                    </div>

                    <label class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-dark cursor-pointer
              hover:bg-gray-light transition focus-within:ring-2 focus-within:ring-purple"
                        :class="loading && 'opacity-50 pointer-events-none'">
                        <img v-if="customAvatarPreview" :src="customAvatarPreview"
                            class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark object-cover"
                            alt="รูปที่อัปโหลด" />
                        <div v-else
                            class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
                            <Upload :size="18" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-[13.5px] font-semibold text-dark">
                                {{ customAvatarPreview ? 'เลือกไฟล์อื่น' : 'อัปโหลดรูปของฉัน' }}
                            </p>
                            <p class="text-[11.5px] text-gray">JPG, PNG หรือ WebP ไม่เกิน 5 MB</p>
                        </div>
                        <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"
                            :disabled="loading" @change="handleCustomAvatarChange" />
                    </label>

                    <div class="flex flex-col min-[400px]:flex-row gap-3">
                        <button type="button" @click="step = 1"
                            class="flex-1 px-6 py-3 rounded-[10px] border-2 border-dark bg-white text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                            ย้อนกลับ
                        </button>
                        <button type="button" @click="handleRegister" :disabled="!selectedAvatar || loading"
                            class="flex-1 px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0">
                            {{ loading ? 'กำลังสมัคร...' : 'ยืนยันสมัครสมาชิก' }}
                        </button>
                    </div>
                </div>

                <p v-if="errorMsg"
                    class="error-pop text-danger text-[13px] text-center mt-4 bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                    {{ errorMsg }}
                </p>
                <p v-if="successMsg"
                    class="error-pop text-green-dark text-[13px] text-center mt-4 bg-green-50 border-2 border-green-dark rounded-lg py-2 px-3">
                    {{ successMsg }}
                </p>

                <p class="text-center text-[13px] text-gray mt-6">
                    มีบัญชีอยู่แล้ว?
                    <router-link to="/login" class="text-purple font-semibold">เข้าสู่ระบบ</router-link>
                </p>
            </div>
        </div>
    </div>
</template>