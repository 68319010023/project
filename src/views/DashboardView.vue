<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import AppNavbar from '../components/AppNavbar.vue'
import ClassroomCardGrid from '../components/ClassroomCardGrid.vue'
import { useClassroomModals } from '../composables/useModals'

const { profile } = useAuth()
const { showCreate, showJoin, refreshTrigger } = useClassroomModals()
const searchQuery = ref('')
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
        <AppNavbar :search-query="searchQuery" @update:search-query="searchQuery = $event"
            @open-create="showCreate = true" @open-join="showJoin = true" />

        <main v-reveal class="max-w-[1200px] mx-auto px-6 py-10">
            <section class="bg-gradient-to-br from-purple-light to-purple border-3 border-dark rounded-xl p-8 mb-10 shadow-offset animate-float-slow">
                <p class="font-mali font-semibold text-[20px]">
                    สวัสดีคุณ {{ profile?.name }}
                    <span class="inline-block origin-[70%_70%] animate-wave text-4xl">👋</span>
                </p>
                <h1 class="font-mali font-bold text-[28px] mt-4">
                    {{ profile?.role === 'teacher' ? 'วันนี้มีห้องไหนต้องตรวจงานบ้าง?' : 'วันนี้เปิดสมุดหน้าไหนดี?' }}
                </h1>
            </section>

            <ClassroomCardGrid :key="refreshTrigger" :search-query="searchQuery"
                @open-create="showCreate = true" @open-join="showJoin = true" />
        </main>
    </div>
</template>