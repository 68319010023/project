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

        <main class="max-w-[960px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

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
            <section class="flex-1 min-w-0 w-full bg-white border-3 border-dark rounded-2xl shadow-offset p-4 sm:p-6">

                <header class="pb-4 mb-5 border-b-2 border-dark/10">
                    <h1 class="font-mali font-bold text-[18px] sm:text-[20px] text-dark">{{ activeMeta.label }}</h1>
                    <p class="text-[12.5px] sm:text-[13px] text-gray mt-1">{{ activeMeta.desc }}</p>
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
                            <input v-model="editEmail" type="email" placeholder="you@example.com" autocomplete="email"
                                :class="inputClass" />
                        </label>

                        <div role="alert" v-if="saveError" class="text-[12.5px] text-red-600 bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2">
                            {{ saveError }}
                        </div>

                        <div class="flex flex-col sm:flex-row gap-3">
                            <button type="button" @click="cancelEdit"
                                class="flex-1 px-5 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13px] font-bold hover:bg-gray-light transition">
                                ยกเลิก
                            </button>
                            <button type="submit" :disabled="!canSave"
                                class="flex-1 px-5 py-2.5 rounded-xl border-2 border-dark bg-orange text-dark text-[13px] font-bold
                                       hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0">
                                {{ saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
                            </button>
                        </div>
                    </form>
                </div>

                <!-- ---------- ความปลอดภัย ---------- -->
                <div v-else-if="activeTab === 'security'" class="max-w-[520px] flex flex-col gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[12px] font-semibold text-dark">รหัสผ่านปัจจุบัน</label>
                        <div class="relative">
                            <input v-model="pwCurrent" :type="showPw ? 'text' : 'password'" :class="inputClass" />
                            <button type="button" @click="showPw = !showPw" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark">
                                <Eye v-if="!showPw" :size="16" :stroke-width="2.5" />
                                <EyeOff v-else :size="16" :stroke-width="2.5" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[12px] font-semibold text-dark">รหัสผ่านใหม่</label>
                        <input v-model="pwNew" type="password" :class="inputClass" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[12px] font-semibold text-dark">ยืนยันรหัสผ่านใหม่</label>
                        <input v-model="pwConfirm" type="password" :class="inputClass" />
                    </div>

                    <p v-if="pwHint" class="text-[12.5px] text-gray">{{ pwHint }}</p>
                    <div role="alert" v-if="pwError" class="text-[12.5px] text-red-600 bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2">
                        {{ pwError }}
                    </div>
                    <div role="status" v-if="pwSuccess" class="text-[12.5px] text-dark bg-green-50 border-2 border-green-300 rounded-xl px-3 py-2">
                        {{ pwSuccess }}
                    </div>

                    <button type="button" @click="changePassword" :disabled="!canChangePw"
                        class="self-start px-5 py-2.5 rounded-xl border-2 border-dark bg-orange text-dark text-[13px] font-bold
                               shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none
                               disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none transition">
                        {{ pwSaving ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน' }}
                    </button>
                </div>

                <!-- ---------- การแจ้งเตือน ---------- -->
                <div v-else-if="activeTab === 'notifications'" class="max-w-[520px] flex flex-col gap-4">
                    <div class="bg-white border-2 border-dark rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p class="font-semibold text-[14px] text-dark">รับการแจ้งเตือน</p>
                            <p class="text-[12px] text-gray">เปิดหรือปิดแจ้งเตือนสำหรับกิจกรรมต่าง ๆ</p>
                        </div>
                        <button type="button" @click="toggleNotifications" :disabled="savingNotif"
                            class="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-dark transition-colors"
                            :class="notificationsOn ? 'bg-orange' : 'bg-gray-200'">
                            <span class="inline-block h-5 w-5 rounded-full bg-white border-2 border-dark transition-transform"
                                :class="notificationsOn ? 'translate-x-6' : 'translate-x-0.5'"></span>
                        </button>
                    </div>
                    <div v-if="notifError" class="text-[12.5px] text-red-600 bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2">
                        {{ notifError }}
                    </div>
                </div>

                <!-- ---------- ความช่วยเหลือ ---------- -->
                <div v-else-if="activeTab === 'help'" class="max-w-[520px] flex flex-col gap-4">
                    <div class="bg-purple-light border-2 border-dark rounded-xl p-4">
                        <p class="text-[14px] font-semibold text-dark">พบปัญหาการใช้งาน</p>
                        <p class="text-[12.5px] text-gray mt-1">กรุณาติดต่อเจ้าหน้าที่เพื่อช่วยเหลือ</p>
                    </div>
                    <button type="button" @click="contactStaff"
                        class="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13px] font-bold hover:bg-gray-light transition">
                        <MessageCircle :size="14" :stroke-width="2.5" />
                        ติดต่อเจ้าหน้าที่
                    </button>
                </div>
            </section>
        </main>

        <AvatarModal v-if="showAvatarModal" @close="showAvatarModal = false" />
        <LogoutModal v-model="showLogoutModal" />
    </div>
</template>