<script setup>
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRouter, useRoute } from 'vue-router'
import { Settings, ChevronRight, Search, X } from 'lucide-vue-next'
import NotificationBell from './NotificationBell.vue'
const emit = defineEmits(['open-create', 'open-join', 'update:searchQuery'])

const { profile } = useAuth()
const router = useRouter()
const route = useRoute()

const props = defineProps({
    searchQuery: { type: String, default: '' },
    showSearch: { type: Boolean, default: true },
    // [{ label: 'หน้ารวมห้องเรียน', to: '/student' }, { label: 'ชื่อห้อง' }]
    // ตัวสุดท้ายในลิสต์ถือเป็นหน้าปัจจุบัน (ไม่มี to = กดไม่ได้)
    breadcrumb: {
        type: Array,
        default: () => [{ label: 'หน้ารวมห้องเรียน', to: null }]
    }
})


const effectiveBreadcrumb = computed(() => {
    if (route.path === '/settings') {
        if (route.query.from === 'profile') {
            const role = profile.value?.role
            const homePath = role === 'teacher' ? '/teacher' : role === 'admin' ? '/admin' : '/student'
            return [
                { label: 'หน้ารวมห้องเรียน', to: homePath },
                { label: 'โปรไฟล์', to: '/profile' },
                { label: 'หน้าตั้งค่า' },
            ]
        }

        return [
            { label: 'โปรไฟล์ของฉัน', to: '/profile' },
            { label: 'หน้าตั้งค่า' },
        ]
    }

    return props.breadcrumb
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
            <template v-for="(crumb, i) in effectiveBreadcrumb" :key="i">
                <router-link v-if="crumb.to" :to="crumb.to"
                    class="px-3.5 py-2 rounded-lg text-[14px] text-gray-300 font-semibold hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap">
                    {{ crumb.label }}
                </router-link>
                <span v-else
                    class="px-3.5 py-2 rounded-lg text-[14px] bg-purple text-dark font-semibold truncate max-w-[220px]">
                    {{ crumb.label }}
                </span>
                <ChevronRight v-if="i < effectiveBreadcrumb.length - 1" :size="14" :stroke-width="2.5"
                    class="text-gray-500 shrink-0" />
            </template>
        </div>

        <div class="flex-1"></div>

        <div v-if="showSearch" class="relative hidden md:block ml-4 w-[220px]">
            <Search :size="15" :stroke-width="2.5"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input :value="searchQuery" @input="emit('update:searchQuery', $event.target.value)" type="text"
                placeholder="ค้นหาห้องเรียน..."
                class="w-full pl-9 pr-8 py-2 rounded-lg bg-white/10 border-2 border-gray-600 text-white text-[13px] placeholder-gray-400 focus:border-purple outline-none transition" />
            <button v-if="searchQuery" type="button" @click="emit('update:searchQuery', '')" aria-label="ล้างคำค้นหา"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-gray-300 hover:bg-orange hover:text-dark transition">
                <X :size="12" :stroke-width="3" />
            </button>
        </div>
        <NotificationBell />

        <button v-if="profile?.role !== 'admin'" type="button" @click="goToSettings"
            class="w-[38px] h-[38px]  flex items-center justify-center text-white hover:scale-110 transition-transform duration-200 shrink-0">
            <Settings :size="20" :stroke-width="2" />
        </button>

        <button v-if="profile?.role !== 'admin'" type="button" @click="goToProfile"
            class="w-[38px] h-[38px] rounded-full border-2 border-white overflow-hidden bg-purple-light shrink-0 hover:scale-110 transition-transform duration-200">
            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover" alt="avatar" />
        </button>
        <div v-else
            class="w-[38px] h-[38px] rounded-full border-2 border-white overflow-hidden bg-purple-light shrink-0">
            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover" alt="avatar" />
        </div>

    </div>
</template>