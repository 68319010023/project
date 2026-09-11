<script setup>
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'

const emit = defineEmits(['open-create', 'open-join'])
const { profile, signOut } = useAuth()
const router = useRouter()

async function handleSignOut() {
    await signOut()
    router.push('/login')
}
</script>

<template>
    <div class="sticky top-0 z-30 bg-dark border-b-4 border-purple h-[90px] flex items-center gap-4 px-6">
          <div class="flex items-center gap-3">
                <img src="/img/logo.png" class="w-20 h-20  hover:scale-110 transition-transform duration-200 object-cover " alt="โลโก้">
                <div class="flex flex-col leading-tight">
                    <span class="font-mali font-bold text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
                    <span class="font-mitr text-xs text-gray-400 whitespace-nowrap">by บารมี</span>
                </div>
  </div>
        <div class="hidden md:flex gap-1 ml-6">
            <span class="px-3.5 py-2 rounded-lg text-[14px] bg-purple text-dark font-semibold">หน้ารวมห้องเรียน</span>
            <span class="px-3.5 py-2 rounded-lg text-[14px] text-gray-500 cursor-not-allowed">ปฏิทินงาน (เร็วๆ นี้)</span>
            <span class="px-3.5 py-2 rounded-lg text-[14px] text-gray-500 cursor-not-allowed">งานของฉัน (เร็วๆ นี้)</span>
        </div>

        <div class="flex-1"></div>

        <button type="button" @click="emit(profile?.role === 'teacher' ? 'open-create' : 'open-join')"
            class="px-4 py-2 rounded-lg border-2 border-dark bg-orange text-dark text-[13.5px] font-semibold whitespace-nowrap hover:bg-white">
            {{ profile?.role === 'teacher' ? '+ สร้างห้อง' : '+ เข้าร่วมห้อง' }}
        </button>

        <button type="button" @click="handleSignOut"
            class="px-3 py-2 rounded-lg border-2 border-gray-500 text-white text-[13px] whitespace-nowrap hover:border-white">
            ออกจากระบบ
        </button>

        <div class="w-[38px] h-[38px] rounded-full border-2 border-white overflow-hidden bg-purple-light shrink-0 hover:scale-110 transition-transform duration-200">
            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover  " alt="avatar" />
        </div>
  
    </div>
</template>