<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Bell, BellOff, MessageCircle, LogOut, ChevronRight, Check, Camera, Pencil, ShieldCheck, Eye, EyeOff } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import AppNavbar from '../components/AppNavbar.vue'
import LogoutModal from '../components/LogoutModal.vue'
import AvatarModal from '../components/AvatarModal.vue'

const route = useRoute()
const router = useRouter()
const { profile, updateProfile } = useAuth()

const homePath = computed(() => {
    const role = profile.value?.role
    if (role === 'admin') return '/admin'
    if (role === 'teacher') return '/teacher'
    return '/student'
})
const notificationsOn = computed(() => !!profile.value?.notifications_enabled)



const breadcrumb = computed(() =>
    route.query.from === 'profile'
        ? [
            { label: 'หน้ารวมห้องเรียน', to: homePath.value },
            { label: 'โปรไฟล์ของฉัน', to: '/profile' },
            { label: 'หน้าตั้งค่า' },
        ]
        : [
            { label: 'หน้ารวมห้องเรียน', to: homePath.value },
            { label: 'หน้าตั้งค่า' },
        ]
)

// ============ หมวดใน sidebar (เก็บหมวดที่เปิดอยู่ใน URL: /settings?tab=...) ============
const tabs = [
    { key: 'account', label: 'บัญชี', icon: User, desc: 'แก้ไขรูปโปรไฟล์ ชื่อ และอีเมลของบัญชี' },
    { key: 'security', label: 'ความปลอดภัย', icon: ShieldCheck, desc: 'เปลี่ยนรหัสผ่านของบัญชี' },
    { key: 'notifications', label: 'การแจ้งเตือน', icon: Bell, desc: 'เลือกว่าจะรับการแจ้งเตือนหรือไม่' },
    { key: 'help', label: 'ความช่วยเหลือ', icon: MessageCircle, desc: 'พบปัญหาการใช้งาน แจ้งทีมงานได้' }
]

const activeTab = computed(() =>
    tabs.some((t) => t.key === route.query.tab) ? route.query.tab : 'account'
)
const activeMeta = computed(() => tabs.find((t) => t.key === activeTab.value))

function selectTab(key) {
    if (key === activeTab.value) return
    router.replace({ query: { ...route.query, tab: key } })
}

// ============ บัญชี (ชื่อ / นามสกุล / อีเมล) ============
const editName = ref('')
const editLastname = ref('')
const editEmail = ref('')

const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')
const pendingEmail = ref('')

const currentName = computed(() => profile.value?.name ?? '')
const currentLastname = computed(() => profile.value?.lastname ?? '')
const currentEmail = computed(() => profile.value?.email ?? '')

const isEditing = ref(false)

const nameChanged = computed(
    () =>
        editName.value.trim() !== currentName.value ||
        editLastname.value.trim() !== currentLastname.value
)
const emailChanged = computed(() => editEmail.value.trim() !== currentEmail.value)
const isDirty = computed(() => isEditing.value && (nameChanged.value || emailChanged.value))

const emailValid = computed(() => /^\S+@\S+\.\S+$/.test(editEmail.value.trim()))
const canSave = computed(
    () =>
        !!profile.value &&
        isDirty.value &&
        !!editName.value.trim() &&
        !!editLastname.value.trim() &&
        (!emailChanged.value || emailValid.value) &&
        !saving.value
)

function resetForm() {
    editName.value = currentName.value
    editLastname.value = currentLastname.value
    editEmail.value = currentEmail.value
}

function startEdit() {
    if (!profile.value) return
    resetForm()
    saveError.value = ''
    saveSuccess.value = ''
    pendingEmail.value = ''
    isEditing.value = true
}

function cancelEdit() {
    isEditing.value = false
    resetForm()
    saveError.value = ''
    saveSuccess.value = ''
}

// เติมฟอร์มเมื่อโปรไฟล์โหลดเสร็จ ตราบใดที่ยังไม่ได้อยู่ในโหมดแก้ไข
watch(
    profile,
    (p) => {
        if (p && !isEditing.value) resetForm()
    },
    { immediate: true, deep: true }
)

async function saveProfile() {
    if (!canSave.value) return

    saving.value = true
    saveError.value = ''
    saveSuccess.value = ''
    pendingEmail.value = ''

    const didNameChange = nameChanged.value
    const didEmailChange = emailChanged.value
    const newEmail = editEmail.value.trim()
    let nameSaved = false

    try {
        if (didNameChange) {
            const res = await updateProfile({
                name: editName.value.trim(),
                lastname: editLastname.value.trim()
            })
            if (res?.error) throw res.error
            nameSaved = true
            saveSuccess.value = 'บันทึกชื่อเรียบร้อยแล้ว'
        }

        if (didEmailChange) {
            const { error } = await supabase.auth.updateUser({ email: newEmail })
            if (error) throw error
            pendingEmail.value = newEmail
            editEmail.value = currentEmail.value
        }
        isEditing.value = false
    } catch (err) {
        console.error('saveProfile error:', err)
        if (nameSaved) {
            saveError.value = 'บันทึกชื่อแล้ว แต่เปลี่ยนอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        } else {
            saveSuccess.value = ''
            saveError.value = 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง'
        }
    } finally {
        saving.value = false
    }
}

// ============ รูปโปรไฟล์ (เปิด AvatarModal ตัวเดียวกับที่จัดการเองทั้งหมด) ============
const showAvatarModal = ref(false)

const avatarInitials = computed(
    () => (profile.value?.name?.[0] ?? '') + (profile.value?.lastname?.[0] ?? '')
)

// ============ ความปลอดภัย (เปลี่ยนรหัสผ่าน) ============
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const showPw = ref(false)
const pwSaving = ref(false)
const pwError = ref('')
const pwSuccess = ref('')

const pwHint = computed(() => {
    if (pwNew.value && pwNew.value.length < 6) return 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร'
    if (pwNew.value && pwCurrent.value && pwNew.value === pwCurrent.value)
        return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน'
    if (pwConfirm.value && pwNew.value !== pwConfirm.value) return 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน'
    return ''
})
const canChangePw = computed(
    () =>
        !!pwCurrent.value &&
        pwNew.value.length >= 6 &&
        pwNew.value === pwConfirm.value &&
        pwNew.value !== pwCurrent.value &&
        !pwSaving.value
)

function resetPwForm() {
    pwCurrent.value = ''
    pwNew.value = ''
    pwConfirm.value = ''
    showPw.value = false
}

// ออกจากหมวดนี้แล้วล้างรหัสผ่านที่พิมพ์ค้างไว้ทิ้ง
watch(activeTab, (t) => {
    if (t !== 'security') {
        resetPwForm()
        pwError.value = ''
        pwSuccess.value = ''
    }
})

async function changePassword() {
    if (!canChangePw.value) return

    pwSaving.value = true
    pwError.value = ''
    pwSuccess.value = ''

    try {
        // ใช้อีเมลจาก auth โดยตรง (ไม่พึ่ง profiles.email ที่อาจว่าง)
        const { data: userData, error: userError } = await supabase.auth.getUser()
        const authEmail = userData?.user?.email
        if (userError || !authEmail) throw userError || new Error('ไม่พบข้อมูลผู้ใช้')

        // ยืนยันรหัสผ่านปัจจุบันก่อน
        const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: pwCurrent.value
        })
        if (verifyError) {
            if (verifyError.status === 400) {
                pwError.value = 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
                return
            }
            throw verifyError
        }

        const { error } = await supabase.auth.updateUser({ password: pwNew.value })
        if (error) throw error

        resetPwForm()
        pwSuccess.value = 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'
    } catch (err) {
        console.error('changePassword error:', err)
        pwError.value = 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        pwSaving.value = false
    }
}

// ============ การแจ้งเตือน (บันทึกทันที) ============
const savingNotif = ref(false)
const notifError = ref('')

async function toggleNotifications() {
    if (!profile.value || savingNotif.value) return

    notifError.value = ''
    savingNotif.value = true
    try {
        const res = await updateProfile({ notifications_enabled: !notificationsOn.value })
        if (res?.error) {
            console.error('toggleNotifications error:', res.error)
            notifError.value = 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        }
    } catch (err) {
        console.error('toggleNotifications unexpected error:', err)
        notifError.value = 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        savingNotif.value = false
    }
}

// ============ ติดต่อเจ้าหน้าที่ ============
const SUPPORT_EMAIL = 'support@example.com' // TODO: เปลี่ยนเป็นอีเมลจริง

function contactStaff() {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('ติดต่อเจ้าหน้าที่')}`
}

// ============ ออกจากระบบ (ตัว modal จัดการเองใน LogoutModal.vue) ============
const showLogoutModal = ref(false)

const inputClass = `w-full px-3.5 py-2.5 rounded-xl border-2 border-dark bg-white text-[13.5px] text-dark
    outline-none focus:bg-gray-light focus:ring-2 focus:ring-purple transition`
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
              <AppNavbar :show-search="false" :breadcrumb="breadcrumb" />

        <main class="max-w-[960px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-6 items-start">

            <!-- ============ Sidebar หมวดตั้งค่า ============ -->
            <aside class="w-full lg:w-[240px] shrink-0">
                <nav aria-label="หมวดการตั้งค่า"
                    class="bg-white border-3 border-dark rounded-2xl shadow-offset p-2
                           flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">

                    <button v-for="t in tabs" :key="t.key" type="button" @click="selectTab(t.key)"
                        :aria-current="activeTab === t.key ? 'page' : undefined"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-[13.5px]
                               whitespace-nowrap text-left transition"
                        :class="activeTab === t.key
                            ? 'bg-dark text-white'
                            : 'text-dark hover:bg-dark/15'">
                        <component :is="t.icon" :size="16" :stroke-width="2.5" class="shrink-0" />
                        <span class="flex-1">{{ t.label }}</span>

                        <!-- จุดบอกว่ามีข้อมูลที่ยังไม่ได้บันทึกในหมวดบัญชี -->
                        <span v-if="t.key === 'account' && isDirty && activeTab !== 'account'"
                            class="w-2.5 h-2.5 rounded-full bg-orange border-2 border-dark"
                            aria-label="มีการแก้ไขที่ยังไม่ได้บันทึก"></span>
                    </button>

                    <div class="hidden lg:block h-0.5 bg-dark/10 my-1 mx-2"></div>

                    <button type="button" @click="showLogoutModal = true"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-600 font-semibold text-[13.5px]
                               whitespace-nowrap text-left hover:bg-red-200 transition">
                        <LogOut :size="16" :stroke-width="2.5" class="shrink-0" />
                        ออกจากระบบ
                    </button>
                </nav>
            </aside>

            <!-- ============ เนื้อหาของหมวดที่เลือก ============ -->
            <section class="flex-1 min-w-0 w-full bg-white border-3 border-dark rounded-2xl shadow-offset p-6">

                <header class="pb-4 mb-5 border-b-2 border-dark/10">
                    <h1 class="font-mali font-bold text-[20px] text-dark">{{ activeMeta.label }}</h1>
                    <p class="text-[13px] text-gray mt-1">{{ activeMeta.desc }}</p>
                </header>

                <!-- ---------- บัญชี ---------- -->
                <div v-if="activeTab === 'account'" class="flex flex-col gap-4 max-w-[520px]">

                    <!-- รูปโปรไฟล์ -->
                    <div class="flex items-center gap-4 pb-2">
                        <div class="w-16 h-16 shrink-0 rounded-full border-3 border-dark overflow-hidden bg-purple-light
                                    flex items-center justify-center font-mali font-bold text-lg text-dark">
                            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover"
                                alt="รูปโปรไฟล์" />
                            <span v-else>{{ avatarInitials }}</span>
                        </div>

                        <div class="flex flex-col gap-1.5 min-w-0">
                            <button type="button" :disabled="!profile" @click="showAvatarModal = true"
                                class="inline-flex items-center gap-1.5 self-start px-4 py-2 rounded-xl border-2 border-dark bg-white
                                       text-dark text-[13px] font-bold hover:bg-gray-light hover:-translate-y-0.5
                                       disabled:opacity-50 disabled:pointer-events-none transition">
                                <Camera :size="14" :stroke-width="2.5" />
                                เปลี่ยนรูปโปรไฟล์
                            </button>
                            <p class="text-[11.5px] text-gray">เลือกอวตาร หรืออัปโหลดรูปของคุณเอง</p>
                        </div>
                    </div>

                    <!-- ===== โหมดดูข้อมูล ===== -->
                    <template v-if="!isEditing">
                        <dl class="flex flex-col border-2 border-dark rounded-xl divide-y-2 divide-dark/10 overflow-hidden">
                            <div class="px-4 py-3">
                                <dt class="text-[12px] text-gray">ชื่อ</dt>
                                <dd class="text-[14.5px] font-semibold text-dark">{{ currentName || '-' }}</dd>
                            </div>
                            <div class="px-4 py-3">
                                <dt class="text-[12px] text-gray">นามสกุล</dt>
                                <dd class="text-[14.5px] font-semibold text-dark">{{ currentLastname || '-' }}</dd>
                            </div>
                            <div class="px-4 py-3">
                                <dt class="text-[12px] text-gray">อีเมล</dt>
                                <dd class="text-[14.5px] font-semibold text-dark break-all">{{ currentEmail || '-' }}</dd>
                            </div>
                        </dl>

                        <div role="status" class="flex flex-col gap-2 empty:hidden">
                            <p v-if="saveSuccess"
                                class="text-[12.5px] font-semibold text-dark inline-flex items-center gap-1.5">
                                <Check :size="14" :stroke-width="3" />
                                {{ saveSuccess }}
                            </p>
                            <p v-if="pendingEmail"
                                class="text-[12.5px] text-dark border-2 border-dark rounded-xl bg-purple-light px-3.5 py-2.5">
                                ส่งลิงก์ยืนยันไปที่ <span class="font-semibold break-all">{{ pendingEmail }}</span> แล้ว
                                กรุณาเปิดอีเมลเพื่อยืนยันการเปลี่ยน
                            </p>
                        </div>

                        <div>
                            <button type="button" @click="startEdit" :disabled="!profile"
                                class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 border-dark bg-orange text-dark text-[13px] font-bold
                                       shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5
                                       active:translate-y-0.5 active:shadow-none
                                       disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none transition">
                                <Pencil :size="14" :stroke-width="2.5" />
                                แก้ไขข้อมูล
                            </button>
                        </div>
                    </template>

                    <!-- ===== โหมดแก้ไข ===== -->
                    <form v-else class="flex flex-col gap-4" @submit.prevent="saveProfile" @keydown.esc="cancelEdit">

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label class="flex flex-col gap-1.5">
                                <span class="text-[12px] font-semibold text-dark">ชื่อ</span>
                                <input v-model="editName" type="text" placeholder="ชื่อ" autocomplete="given-name"
                                    :class="inputClass" />
                            </label>
                            <label class="flex flex-col gap-1.5">
                                <span class="text-[12px] font-semibold text-dark">นามสกุล</span>
                                <input v-model="editLastname" type="text" placeholder="นามสกุล"
                                    autocomplete="family-name" :class="inputClass" />
                            </label>
                        </div>

                        <label class="flex flex-col gap-1.5">
                            <span class="text-[12px] font-semibold text-dark">อีเมล</span>
                            <input v-model="editEmail" type="email" placeholder="name@example.com" autocomplete="email"
                                :class="inputClass" />
                            <span v-if="emailChanged && emailValid" class="text-[11.5px] text-gray">
                                เมื่อบันทึก ระบบจะส่งลิงก์ยืนยันไปที่อีเมลใหม่ และอีเมลจะเปลี่ยนหลังคุณกดยืนยัน
                            </span>
                            <span v-else-if="emailChanged && !emailValid" class="text-[11.5px] text-red-600">
                                รูปแบบอีเมลไม่ถูกต้อง
                            </span>
                        </label>

                        <div role="status" class="flex flex-col gap-2 empty:hidden">
                            <p v-if="saveSuccess"
                                class="text-[12.5px] font-semibold text-dark inline-flex items-center gap-1.5">
                                <Check :size="14" :stroke-width="3" />
                                {{ saveSuccess }}
                            </p>
                            <p v-if="saveError" class="text-[12.5px] text-red-600">{{ saveError }}</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-3 pt-1">
                            <button type="submit" :disabled="!canSave"
                                class="px-5 py-2.5 rounded-xl border-2 border-dark bg-purple text-dark text-[13px] font-bold
                                       shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5
                                       active:translate-y-0.5 active:shadow-none
                                       disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none transition">
                                {{ saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง' }}
                            </button>
                            <button type="button" @click="cancelEdit" :disabled="saving"
                                class="px-5 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13px] font-bold
                                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-50 transition">
                                ยกเลิก
                            </button>
                            <span v-if="isDirty && !saving" class="text-[12px] text-gray">มีการแก้ไขที่ยังไม่ได้บันทึก</span>
                        </div>
                    </form>
                </div>

                <!-- ---------- ความปลอดภัย ---------- -->
                <form v-else-if="activeTab === 'security'" class="flex flex-col gap-4 max-w-[520px]"
                    @submit.prevent="changePassword">

                    <label class="flex flex-col gap-1.5">
                        <span class="text-[12px] font-semibold text-dark">รหัสผ่านปัจจุบัน</span>
                        <input v-model="pwCurrent" :type="showPw ? 'text' : 'password'"
                            autocomplete="current-password" :class="inputClass" />
                    </label>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label class="flex flex-col gap-1.5">
                            <span class="text-[12px] font-semibold text-dark">รหัสผ่านใหม่</span>
                            <input v-model="pwNew" :type="showPw ? 'text' : 'password'"
                                autocomplete="new-password" :class="inputClass" />
                        </label>
                        <label class="flex flex-col gap-1.5">
                            <span class="text-[12px] font-semibold text-dark">ยืนยันรหัสผ่านใหม่</span>
                            <input v-model="pwConfirm" :type="showPw ? 'text' : 'password'"
                                autocomplete="new-password" :class="inputClass" />
                        </label>
                    </div>

                    <p v-if="pwHint" class="text-[11.5px] text-red-600 -mt-1">{{ pwHint }}</p>
                    <p v-else class="text-[11.5px] text-gray -mt-1">รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร</p>

                    <button type="button" @click="showPw = !showPw" :aria-pressed="showPw"
                        class="inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-dark hover:underline">
                        <component :is="showPw ? EyeOff : Eye" :size="14" :stroke-width="2.5" />
                        {{ showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน' }}
                    </button>

                    <div role="status" class="flex flex-col gap-2 empty:hidden">
                        <p v-if="pwSuccess"
                            class="text-[12.5px] font-semibold text-dark inline-flex items-center gap-1.5">
                            <Check :size="14" :stroke-width="3" />
                            {{ pwSuccess }}
                        </p>
                        <p v-if="pwError" class="text-[12.5px] text-red-600">{{ pwError }}</p>
                    </div>

                    <div>
                        <button type="submit" :disabled="!canChangePw"
                            class="px-5 py-2.5 rounded-xl border-2 border-dark bg-purple text-dark text-[13px] font-bold
                                   shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5
                                   active:translate-y-0.5 active:shadow-none
                                   disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none transition">
                            {{ pwSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน' }}
                        </button>
                    </div>
                </form>

                <!-- ---------- การแจ้งเตือน ---------- -->
                <div v-else-if="activeTab === 'notifications'" class="max-w-[520px]">
                    <button type="button" role="switch" :aria-checked="notificationsOn" @click="toggleNotifications"
                        :disabled="savingNotif || !profile"
                        class="w-full flex items-center gap-3.5 px-3 py-3 -mx-3 rounded-xl text-left
                               hover:bg-gray-light transition disabled:opacity-60 disabled:cursor-not-allowed">
                        <div class="w-11 h-11 shrink-0 rounded-xl border-2 border-dark flex items-center justify-center transition-colors"
                            :class="notificationsOn ? 'bg-purple-light' : 'bg-gray-light'">
                            <component :is="notificationsOn ? Bell : BellOff" :size="20" :stroke-width="2.5"
                                class="text-dark" />
                        </div>

                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-[14.5px] text-dark">รับการแจ้งเตือน</p>
                            <p class="text-[12.5px] text-gray">{{ notificationsOn ? 'เปิดอยู่' : 'ปิดอยู่' }}</p>
                        </div>

                        <span aria-hidden="true"
                            class="relative w-[52px] h-[28px] rounded-full border-2 border-dark shrink-0 transition-colors duration-200"
                            :class="notificationsOn ? 'bg-purple' : 'bg-gray-200'">
                            <span
                                class="absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full bg-white border-2 border-dark transition-transform duration-200"
                                :class="notificationsOn ? 'translate-x-[24px]' : 'translate-x-0'"></span>
                        </span>
                    </button>

                    <p class="text-[12px] text-gray mt-3">การเปลี่ยนแปลงในหมวดนี้จะบันทึกทันที ไม่ต้องกดบันทึก</p>
                    <p v-if="notifError" role="status" class="text-[12.5px] text-red-600 mt-2">{{ notifError }}</p>
                </div>

                <!-- ---------- ความช่วยเหลือ ---------- -->
                <div v-else-if="activeTab === 'help'" class="max-w-[520px]">
                    <button type="button" @click="contactStaff"
                        class="group w-full flex items-center gap-3.5 px-3 py-3 -mx-3 rounded-xl text-left
                               hover:bg-gray-light transition">
                        <div
                            class="w-11 h-11 shrink-0 rounded-xl border-2 border-dark bg-orange flex items-center justify-center">
                            <MessageCircle :size="20" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-[14.5px] text-dark">ติดต่อเจ้าหน้าที่</p>
                            <p class="text-[12.5px] text-gray">ส่งอีเมลถึงทีมงาน</p>
                        </div>
                        <ChevronRight :size="16" :stroke-width="2.5"
                            class="shrink-0 text-dark group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </section>
        </main>

        <AvatarModal v-model="showAvatarModal" />
        <LogoutModal v-model="showLogoutModal" />
    </div>
</template>