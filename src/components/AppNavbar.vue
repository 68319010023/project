<script setup>
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import NotificationBell from './NotificationBell.vue'
const emit = defineEmits(['open-create', 'open-join', 'update:searchQuery'])

const { profile } = useAuth()
const router = useRouter()

defineProps({
    searchQuery: { type: String, default: '' }
})

function goToProfile() {
    router.push('/profile')
}
function goToSettings() {
    router.push('/settings')
}
</script>

<template>
    <div class="sticky top-0 z-30 bg-dark border-b-4 border-purple h-[90px] flex items-center gap-4 px-6">
        <div class="flex items-center gap-3">
            <img src="/img/logo.png" class="w-20 h-20  hover:scale-110 transition-transform duration-200 object-cover "
                alt="โลโก้">
            <div class="flex flex-col leading-tight">
                <span class="font-mali font-bold text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
                <span class="font-mitr text-xs text-gray-400 whitespace-nowrap">by บารมี ปะวะลัง</span>
            </div>
        </div>
        <div class="hidden md:flex gap-1 ml-6">
            <span class="px-3.5 py-2 rounded-lg text-[14px] bg-purple text-dark font-semibold">หน้ารวมห้องเรียน</span>

        </div>

        <div class="flex-1"></div>

        <input :value="searchQuery" @input="emit('update:searchQuery', $event.target.value)" type="text"
            placeholder="ค้นหาห้องเรียน..."
            class="hidden md:block ml-4 px-3.5 py-2 rounded-lg bg-white/10 border-2 border-gray-600 text-white text-[13px] placeholder-gray-400 focus:border-purple outline-none w-[220px]" />
        <NotificationBell />

        <button type="button" @click="goToSettings"
            class="w-[38px] h-[38px]  flex items-center justify-center text-white hover:scale-110 transition-transform duration-200 shrink-0">
            <Settings :size="20" :stroke-width="2" />
        </button>

        <button type="button" @click="goToProfile"
            class="w-[38px] h-[38px] rounded-full border-2 border-white overflow-hidden bg-purple-light shrink-0 hover:scale-110 transition-transform duration-200">
            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover" alt="avatar" />
        </button>

    </div>
</template>