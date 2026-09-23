<script setup>
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { Settings, ChevronRight } from 'lucide-vue-next'
import NotificationBell from './NotificationBell.vue'
const emit = defineEmits(['open-create', 'open-join', 'update:searchQuery'])

const { profile } = useAuth()
const router = useRouter()

defineProps({
    searchQuery: { type: String, default: '' },
    showSearch: { type: Boolean, default: true },
    // [{ label: 'หน้ารวมห้องเรียน', to: '/student' }, { label: 'ชื่อห้อง' }]
    // ตัวสุดท้ายในลิสต์ถือเป็นหน้าปัจจุบัน (ไม่มี to = กดไม่ได้)
    breadcrumb: {
        type: Array,
        default: () => [{ label: 'หน้ารวมห้องเรียน', to: null }]
    }
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
        <div class="hidden md:flex items-center gap-1.5 ml-6 min-w-0">
            <template v-for="(crumb, i) in breadcrumb" :key="i">
                <router-link v-if="crumb.to" :to="crumb.to"
                    class="px-3.5 py-2 rounded-lg text-[14px] text-gray-300 font-semibold hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap">
                    {{ crumb.label }}
                </router-link>
                <span v-else
                    class="px-3.5 py-2 rounded-lg text-[14px] bg-purple text-dark font-semibold truncate max-w-[220px]">
                    {{ crumb.label }}
                </span>
                <ChevronRight v-if="i < breadcrumb.length - 1" :size="14" :stroke-width="2.5"
                    class="text-gray-500 shrink-0" />
            </template>
        </div>

        <div class="flex-1"></div>

        <input v-if="showSearch" :value="searchQuery" @input="emit('update:searchQuery', $event.target.value)"
            type="text" placeholder="ค้นหาห้องเรียน..."
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