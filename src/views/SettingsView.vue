<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Bell, BellOff, MessageCircle, LogOut } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { profile, signOut, updateProfile } = useAuth()

const savingNotif = ref(false)

async function toggleNotifications() {
    if (!profile.value) {
        return
    }

    savingNotif.value = true
    try {
        const nextValue = !profile.value.notifications_enabled
        const { error } = await updateProfile({ notifications_enabled: nextValue })
        if (error) {
            console.error('toggleNotifications error:', error)
        }
    } catch (err) {
        console.error('toggleNotifications unexpected error:', err)
    } finally {
        savingNotif.value = false
    }
}

async function handleSignOut() {
    await signOut()
    router.push('/login')
}

function contactStaff() {
    window.location.href = 'mailto:support@example.com?subject=ติดต่อเจ้าหน้าที่'
}
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
        <div class="sticky top-0 z-30 bg-dark border-b-4 border-purple h-[90px] flex items-center gap-4 px-6">
            <button type="button" @click="router.back()"
                class="w-10 h-10 rounded-lg border-2 border-gray-500 flex items-center justify-center text-white hover:border-white hover:scale-110 transition-transform duration-200 shrink-0">
                <ArrowLeft :size="20" :stroke-width="2.5" />
            </button>
            <span class="font-mali font-bold text-lg text-white whitespace-nowrap">ตั้งค่า</span>
        </div>

        <main class="max-w-[600px] mx-auto px-6 py-10">
            <div class="bg-white border-3 border-dark rounded-xl shadow-offset overflow-hidden mb-6">
                <div class="flex items-center justify-between px-5 py-4 border-b-2 border-dashed border-gray-200">
                    <div class="flex items-center gap-3">
                        <component :is="profile?.notifications_enabled ? Bell : BellOff" :size="20"
                            :stroke-width="2.5" class="text-dark shrink-0" />
                        <div>
                            <p class="font-semibold text-[15px]">การแจ้งเตือน</p>
                            <p class="text-[12.5px] text-gray-400">
                                {{ profile?.notifications_enabled ? 'เปิดอยู่' : 'ปิดอยู่' }}
                            </p>
                        </div>
                    </div>

                    <button type="button" @click="toggleNotifications" :disabled="savingNotif"
                        class="relative w-[52px] h-[28px] rounded-full border-2 border-dark transition-colors duration-200 shrink-0 disabled:opacity-50"
                        :class="profile?.notifications_enabled ? 'bg-purple' : 'bg-gray-200'">
                        <span
                            class="absolute top-[1px] w-[20px] h-[20px] rounded-full bg-white border-2 border-dark transition-all duration-200"
                            :class="profile?.notifications_enabled ? 'left-[26px]' : 'left-[1px]'"></span>
                    </button>
                </div>

                <button type="button" @click="contactStaff"
                    class="w-full flex items-center gap-3 px-5 py-4 hover:bg-purple-light/60 transition-colors border-b-2 border-dashed border-gray-200">
                    <MessageCircle :size="20" :stroke-width="2.5" class="text-dark shrink-0" />
                    <p class="font-semibold text-[15px]">ติดต่อเจ้าหน้าที่</p>
                </button>

                <button type="button" @click="handleSignOut"
                    class="w-full flex items-center gap-3 px-5 py-4 hover:bg-purple-light/60 transition-colors text-red-600">
                    <LogOut :size="20" :stroke-width="2.5" class="shrink-0" />
                    <p class="font-semibold text-[15px]">ออกจากระบบ</p>
                </button>
            </div>
        </main>
    </div>
</template>