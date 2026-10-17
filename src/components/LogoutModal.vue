<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, X } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const { profile, signOut } = useAuth()

const signingOut = ref(false)
const cancelBtn = ref(null)

const avatarInitials = computed(
    () => (profile.value?.name?.[0] ?? '') + (profile.value?.lastname?.[0] ?? '')
)

function close() {
    if (signingOut.value) return
    emit('update:modelValue', false)
}

async function confirmSignOut() {
    signingOut.value = true
    try {
        await signOut()
        router.push('/login')
    } finally {
        signingOut.value = false
        emit('update:modelValue', false)
    }
}

// เปิด modal แล้วโฟกัสที่ปุ่ม "ยกเลิก" ก่อน กันเผลอกด Enter แล้วออกจากระบบ
watch(
    () => props.modelValue,
    async (open) => {
        if (!open) return
        await nextTick()
        cancelBtn.value?.focus()
    }
)
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="modelValue"
                class="fixed inset-0 z-50 bg-dark/50 backdrop-blur-[2px] flex items-center justify-center p-4"
                @click.self="close" @keydown.esc="close">

                <div role="dialog" aria-modal="true" aria-labelledby="logout-title"
                    class="relative w-full max-w-[380px] bg-white border-3 border-dark rounded-2xl shadow-offset
                           px-6 pt-8 pb-6 font-mitr text-center animate-[modalIn_0.2s_ease-out]">

                    <!-- ปุ่มปิด -->
                    <button type="button" @click="close" :disabled="signingOut" aria-label="ปิด"
                        class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full border-2 border-dark bg-white
                               flex items-center justify-center hover:bg-gray-light disabled:opacity-50 transition">
                        <X :size="14" :stroke-width="3" />
                    </button>

                    <!-- ไอคอน -->
                    <div class="mx-auto w-16 h-16 rounded-full border-3 border-dark bg-red-200 shadow-offset
                                flex items-center justify-center">
                        <LogOut :size="26" :stroke-width="2.5" class="text-red-600" />
                    </div>

                    <h3 id="logout-title" class="font-mali font-bold text-[20px] text-dark mt-6">
                        ออกจากระบบใช่หรือไม่?
                    </h3>
                    <p class="text-[13px] text-gray mt-1.5">คุณจะออกจากบัญชีนี้</p>

                    <!-- บัญชีที่จะออก -->
                    <div
                        class="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dark bg-gray-light text-left">
                        <div class="w-9 h-9 shrink-0 rounded-full border-2 border-dark overflow-hidden bg-purple-light
                                    flex items-center justify-center font-mali font-bold text-[12px] text-dark">
                            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover" alt="" />
                            <span v-else>{{ avatarInitials }}</span>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[13px] font-semibold text-dark truncate">
                                {{ profile?.name }} {{ profile?.lastname }}
                            </p>
                            <p class="text-[11.5px] text-gray truncate">{{ profile?.email }}</p>
                        </div>
                    </div>

                    <!-- ปุ่ม -->
                    <div class="flex gap-3 mt-6">
                        <button ref="cancelBtn" type="button" @click="close" :disabled="signingOut"
                            class="flex-1 px-4 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13.5px] font-bold
                                   shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5 hover:bg-gray-light
                                   active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition">
                            ยกเลิก
                        </button>
                        <button type="button" @click="confirmSignOut" :disabled="signingOut"
                            class="flex-1 px-4 py-2.5 rounded-xl border-2 border-dark bg-red-600 text-white text-[13.5px] font-bold
                                   shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5 hover:bg-red-700
                                   active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition">
                            {{ signingOut ? 'กำลังออก...' : 'ออกจากระบบ' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>