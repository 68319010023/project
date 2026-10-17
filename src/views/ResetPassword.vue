<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { KeyRound, Check, Eye, EyeOff } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'

// สถานะหน้า: checking = กำลังตรวจลิงก์ / ready = ตั้งรหัสผ่านได้ / invalid = ลิงก์ใช้ไม่ได้ / done = สำเร็จ
const state = ref('checking')

const password = ref('')
const confirm = ref('')
const showPw = ref(false)
const saving = ref(false)
const errorMsg = ref('')

const hint = computed(() => {
    if (password.value && password.value.length < 6) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'
    if (confirm.value && password.value !== confirm.value) return 'รหัสผ่านและการยืนยันไม่ตรงกัน'
    return ''
})
const canSave = computed(
    () => password.value.length >= 6 && password.value === confirm.value && !saving.value
)

let subscription = null
let timeoutId = null

onMounted(async () => {
    // ลิงก์ที่หมดอายุ/ใช้แล้ว Supabase จะแนบ error มาใน URL
    if (/error(_code|_description)?=/.test(window.location.hash + window.location.search)) {
        state.value = 'invalid'
        return
    }

    // เหตุการณ์ PASSWORD_RECOVERY ยิงตอน supabase-js อ่านลิงก์เสร็จ
    const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') state.value = 'ready'
    })
    subscription = data.subscription

    // เผื่อเหตุการณ์ถูกยิงไปก่อนที่หน้านี้จะโหลด
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session && state.value === 'checking') state.value = 'ready'

    // รอไม่เกิน 4 วินาที ถ้ายังไม่มีเซสชันถือว่าลิงก์ใช้ไม่ได้
    timeoutId = setTimeout(() => {
        if (state.value === 'checking') state.value = 'invalid'
    }, 4000)
})

onBeforeUnmount(() => {
    subscription?.unsubscribe()
    clearTimeout(timeoutId)
})

async function save() {
    if (!canSave.value) return

    errorMsg.value = ''
    saving.value = true

    try {
        const { error } = await supabase.auth.updateUser({ password: password.value })
        if (error) throw error

        // ออกจากเซสชันกู้คืนรหัสผ่าน แล้วให้เข้าสู่ระบบด้วยรหัสใหม่
        await supabase.auth.signOut()
        state.value = 'done'
    } catch (err) {
        console.error('reset password error:', err)
        errorMsg.value = /different|same/i.test(err?.message || '')
            ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'
            : 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <div
        class="auth-page min-h-screen flex items-start sm:items-center justify-center px-4 sm:px-6 pt-24 pb-8 sm:py-10 font-mitr">
        <router-link to="/login" class="auth-home-link">กลับหน้าเข้าสู่ระบบ</router-link>

        <div
            class="relative z-10 bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[480px] w-full p-5 sm:p-8">

            <div class="w-14 h-14 mx-auto rounded-xl border-2 border-dark bg-purple-light flex items-center justify-center">
                <KeyRound :size="26" :stroke-width="2.5" class="text-dark" />
            </div>
            <h1 class="font-mali font-bold text-2xl text-center mt-4 mb-1">ตั้งรหัสผ่านใหม่</h1>

            <!-- กำลังตรวจลิงก์ -->
            <p v-if="state === 'checking'" role="status" class="text-center text-gray text-[13px] mt-4">
                กำลังตรวจสอบลิงก์...
            </p>

            <!-- ลิงก์ใช้ไม่ได้ -->
            <div v-else-if="state === 'invalid'" class="flex flex-col gap-4 mt-4">
                <p role="alert"
                    class="text-danger text-[13px] text-center bg-red-50 border-2 border-danger rounded-lg py-2.5 px-3">
                    ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง
                </p>
                <router-link to="/forgot-password"
                    class="text-center px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                    ขอลิงก์ใหม่
                </router-link>
            </div>

            <!-- ตั้งรหัสผ่าน -->
            <template v-else-if="state === 'ready'">
                <p class="text-center text-gray text-[13px] mb-6">กรอกรหัสผ่านใหม่ของคุณ</p>

                <form @submit.prevent="save" novalidate class="flex flex-col gap-4">
                    <div>
                        <label for="new-password" class="text-[13px] font-semibold">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                        <input id="new-password" v-model="password" :type="showPw ? 'text' : 'password'"
                            autocomplete="new-password"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 border-dark text-[14px] outline-none focus:ring-2 focus:ring-purple" />
                    </div>
                    <div>
                        <label for="confirm-password" class="text-[13px] font-semibold">ยืนยันรหัสผ่านใหม่</label>
                        <input id="confirm-password" v-model="confirm" :type="showPw ? 'text' : 'password'"
                            autocomplete="new-password"
                            class="w-full mt-1 px-3 py-2.5 rounded-lg border-2 border-dark text-[14px] outline-none focus:ring-2 focus:ring-purple" />
                    </div>

                    <p v-if="hint" class="text-[12px] text-danger -mt-1">{{ hint }}</p>

                    <button type="button" @click="showPw = !showPw" :aria-pressed="showPw"
                        class="inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-dark hover:underline">
                        <component :is="showPw ? EyeOff : Eye" :size="14" :stroke-width="2.5" />
                        {{ showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน' }}
                    </button>

                    <p v-if="errorMsg" role="alert"
                        class="error-pop text-danger text-[13px] text-center bg-red-50 border-2 border-danger rounded-lg py-2 px-3">
                        {{ errorMsg }}
                    </p>

                    <button type="submit" :disabled="!canSave"
                        class="px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0">
                        {{ saving ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่' }}
                    </button>
                </form>
            </template>

            <!-- สำเร็จ -->
            <div v-else class="flex flex-col gap-4 mt-4">
                <p role="status"
                    class="text-[13px] text-dark border-2 border-dark rounded-xl bg-purple-light px-4 py-3 flex items-center gap-2.5">
                    <Check :size="16" :stroke-width="3" class="shrink-0" />
                    ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
                </p>
                <router-link to="/login"
                    class="text-center px-6 py-3 rounded-[10px] border-2 border-dark bg-orange text-dark font-semibold shadow-offset-sm hover:-translate-y-0.5 transition">
                    ไปหน้าเข้าสู่ระบบ
                </router-link>
            </div>
        </div>
    </div>
</template>