<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { X, LogOut, School, Mail, Settings, LayoutGrid, Layers, ChevronRight, ChevronLeft, Presentation, GraduationCap, Search } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import AppNavbar from '../components/AppNavbar.vue'
import LogoutModal from '../components/LogoutModal.vue'

const { profile } = useAuth()

const isTeacher = computed(() => profile.value?.role === 'teacher')
const homePath = computed(() => (isTeacher.value ? '/teacher' : '/student'))
const avatarInitials = computed(
    () => (profile.value?.name?.[0] ?? '') + (profile.value?.lastname?.[0] ?? '')
)

const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'สวัสดีตอนเช้า'
    if (hour < 18) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
})

const todayLabel = computed(() =>
    new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })
)

const classroomsTitle = computed(() => (isTeacher.value ? 'ห้องเรียนที่สอนอยู่' : 'ห้องเรียนที่เข้าร่วม'))

// --- ห้องเรียนที่เข้าร่วม/สอนอยู่ ---
const classrooms = ref([])
const loadingClassrooms = ref(true)

async function loadClassrooms() {
    if (!profile.value) return

    loadingClassrooms.value = true
    const rpcName = isTeacher.value ? 'get_teacher_classrooms' : 'get_student_classrooms'
    const { data, error } = await supabase.rpc(rpcName)

    if (!error) {
        classrooms.value = data
    } else {
        console.error('loadClassrooms error:', error)
    }
    loadingClassrooms.value = false
}

const uniqueGradeLevels = computed(() => {
    const set = new Set(classrooms.value.map((c) => c.grade_level).filter(Boolean))
    return set.size
})

// --- ค้นหาห้องเรียน ---
const searchQuery = ref('')

const filteredClassrooms = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return classrooms.value
    return classrooms.value.filter(
        (c) =>
            c.name?.toLowerCase().includes(q) ||
            c.grade_level?.toLowerCase().includes(q)
    )
})

// --- แบ่งหน้า (หน้าละ 3 ห้อง) ---
const pageSize = 3
const currentPage = ref(1)

const totalPages = computed(() =>
    Math.max(1, Math.ceil(filteredClassrooms.value.length / pageSize))
)

const pagedClassrooms = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return filteredClassrooms.value.slice(start, start + pageSize)
})

// ค้นหาใหม่ให้กลับไปหน้า 1 / ถ้าจำนวนหน้าลดลงให้ไม่เกินหน้าสุดท้าย
watch(searchQuery, () => { currentPage.value = 1 })
watch(totalPages, (n) => { if (currentPage.value > n) currentPage.value = n })

// --- ออกจากระบบ ----
const showLogoutModal = ref(false)

onMounted(() => {
    if (profile.value) {
        loadClassrooms()
    }
    const stop = watch(profile, (val) => {
        if (val) {
            loadClassrooms()
            stop()
        }
    })
})
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
        <AppNavbar :show-search="false" :breadcrumb="[
            { label: 'หน้ารวมห้องเรียน', to: homePath },
            { label: 'โปรไฟล์ของฉัน' }
        ]" />

        <main class="max-w-[1100px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-6 items-start">

            <!-- ============ Sidebar ซ้าย ============ -->
            <aside class="w-full lg:w-[280px] shrink-0 flex flex-col gap-5">

                <!-- การ์ดโปรไฟล์ (พื้นเข้ม) -->
                <div
                    class="relative overflow-hidden bg-dark text-white border-3 border-dark rounded-2xl shadow-offset p-6">
                    <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 pointer-events-none">
                    </div>

                    <div class="relative w-16 h-16 rounded-full border-3 border-white overflow-hidden bg-purple-light
                                flex items-center justify-center font-mali font-bold text-lg text-dark">
                        <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover" alt="avatar" />
                        <span v-else>{{ avatarInitials }}</span>
                    </div>

                    <div class="relative mt-3">
                        <h2 class="font-mali font-bold text-[17px] truncate">{{ profile?.name }} {{ profile?.lastname }}</h2>

                        <p class="mt-3 inline-flex items-center gap-1.5 text-[12px] text-white/70 truncate max-w-full">
                            <Mail :size="12" :stroke-width="2.5" class="shrink-0" />
                            <span class="truncate">{{ profile?.email }}</span>
                        </p>
                    </div>

                    <span
                        class="relative mt-4 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-dark text-[12px] font-bold"
                        :class="isTeacher ? 'bg-orange text-dark' : 'bg-purple-light text-dark'">
                        <Presentation v-if="isTeacher" :size="14" :stroke-width="2.5" />
                        <GraduationCap v-else :size="14" :stroke-width="2.5" />
                        {{ isTeacher ? 'ครู' : 'นักเรียน' }}
                    </span>
                </div>

                <!-- เมนูนำทาง -->
                <nav class="bg-white border-3 border-dark rounded-2xl shadow-offset p-2 flex flex-col gap-1">
                
                    <a href="#my-classrooms"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-dark text-white font-semibold text-[13.5px] transition">
                        <LayoutGrid :size="16" :stroke-width="2.5" />
                        <span class="flex-1">{{ classroomsTitle }}</span>
                        <span v-if="!loadingClassrooms && classrooms.length"
                            class="min-w-[22px] h-[22px] px-1.5 rounded-full border-2 border-white bg-orange text-dark text-[11px] font-bold flex items-center justify-center">
                            {{ classrooms.length }}
                        </span>
                    </a>
                    <div class="h-0.5 bg-dark/10 my-1 mx-2"></div>
                    <router-link :to="{ path: '/settings', query: { from: 'profile' } }"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-dark font-semibold text-[13.5px] hover:bg-dark/15 transition">
                        <Settings :size="16" :stroke-width="2.5" />
                        ตั้งค่า
                    </router-link>
                    <button type="button" @click="showLogoutModal = true"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-600 font-semibold text-[13.5px] hover:bg-red-200 transition text-left">
                        <LogOut :size="16" :stroke-width="2.5" />
                        ออกจากระบบ
                    </button>
                </nav>
            </aside>

            <!-- ============ เนื้อหาหลักขวา ============ -->
            <div class="flex-1 min-w-0 w-full flex flex-col gap-5">

                <!-- คำทักทาย + ปุ่มหลัก -->
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 class="font-mali font-bold text-2xl text-dark">{{ greeting }}, {{ profile?.name }}</h1>
                        <p class="text-[13px] text-gray mt-1">{{ todayLabel }} · นี่คือภาพรวมบัญชีของคุณ</p>
                    </div>
                    <router-link :to="homePath"
                        class="shrink-0 self-start inline-flex items-center px-5 py-2.5 rounded-full border-3 border-dark bg-orange text-dark text-[13px] font-bold shadow-offset hover:-translate-y-0.5 transition">
                        ไปหน้ารวมห้องเรียน
                    </router-link>
                </div>

                <!-- Stat cards -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-5 flex items-center gap-3">
                        <div
                            class="w-11 h-11 shrink-0 rounded-xl border-2 border-dark bg-purple-light flex items-center justify-center">
                            <School :size="20" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <div class="min-w-0">
                            <p class="font-mali font-bold text-2xl text-dark leading-none">{{ classrooms.length }}</p>
                            <p class="text-[12px] text-gray mt-1">{{ isTeacher ? 'ห้องที่สอน' : 'ห้องที่เข้าร่วม' }}</p>
                        </div>
                    </div>

                    <div class="bg-white border-3 border-dark rounded-2xl shadow-offset p-5 flex items-center gap-3">
                        <div
                            class="w-11 h-11 shrink-0 rounded-xl border-2 border-dark bg-orange flex items-center justify-center">
                            <Layers :size="20" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <div class="min-w-0">
                            <p class="font-mali font-bold text-2xl text-dark leading-none">{{ uniqueGradeLevels }}</p>
                            <p class="text-[12px] text-gray mt-1">ระดับชั้นที่เกี่ยวข้อง</p>
                        </div>
                    </div>
                </div>

                <!-- รายชื่อห้องเรียน (แถวแบบรายการ) -->
                <section id="my-classrooms"
                    class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 scroll-mt-24">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h3 class="font-mali font-bold text-[16px] text-dark">
                            {{ classroomsTitle }}
                            <span v-if="!loadingClassrooms" class="text-[12.5px] text-gray font-mitr font-normal">
                                ({{ searchQuery.trim() ? `${filteredClassrooms.length} จาก ${classrooms.length}` :
                                    classrooms.length }} ห้อง)
                            </span>
                        </h3>

                        <!-- ช่องค้นหา -->
                        <div v-if="!loadingClassrooms && classrooms.length > 0" class="relative w-full sm:w-[220px]">
                            <Search :size="15" :stroke-width="2.5"
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
                            <input v-model="searchQuery" type="text" placeholder="ค้นหาห้องเรียน..." class="w-full pl-9 pr-8 py-2 rounded-lg border-2 border-dark bg-white text-[13px] text-dark
                                   placeholder:text-gray outline-none focus:bg-gray-light transition" />
                            <button v-if="searchQuery" type="button" @click="searchQuery = ''" aria-label="ล้างคำค้นหา"
                                class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-orange transition">
                                <X :size="12" :stroke-width="3" />
                            </button>
                        </div>
                    </div>

                    <div v-if="loadingClassrooms" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</div>
                    <p v-else-if="classrooms.length === 0"
                        class="border-2 border-dashed border-dark/30 rounded-xl p-8 mt-3 text-center text-gray text-[13px]">
                        ยังไม่มีห้องเรียน
                    </p>
                    <p v-else-if="filteredClassrooms.length === 0"
                        class="border-2 border-dashed border-dark/30 rounded-xl p-8 mt-3 text-center text-gray text-[13px]">
                        ไม่พบห้องเรียนที่ตรงกับ "{{ searchQuery }}"
                    </p>
                    <ul v-else class="flex flex-col gap-3">
                        <li v-for="c in pagedClassrooms" :key="c.id">
                            <router-link :to="{ name: 'classroom-detail', params: { id: c.id } }" class="group flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 border-dark
                                   hover:bg-gray-light hover:-translate-y-0.5 transition">
                                <div
                                    class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
                                    <School :size="16" :stroke-width="2.5" class="text-dark" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-[13.5px] font-semibold text-dark truncate">{{ c.name }}</p>
                                    <p v-if="c.grade_level" class="text-[11.5px] text-gray">ระดับชั้น {{ c.grade_level }}</p>
                                </div>
                                <span v-if="c.grade_level"
                                    class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold">
                                    {{ c.grade_level }}
                                </span>
                                <ChevronRight :size="16" :stroke-width="2.5"
                                    class="shrink-0 text-dark group-hover:translate-x-0.5 transition-transform" />
                            </router-link>
                        </li>
                    </ul>

                    <!-- เปลี่ยนหน้า -->
                    <div v-if="totalPages > 1"
                        class="mt-5 pt-4 border-t-2 border-dark/10 flex items-center justify-center gap-2">
                        <button type="button" @click="currentPage--" :disabled="currentPage === 1"
                            aria-label="หน้าก่อนหน้า" class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                               hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition">
                            <ChevronLeft :size="16" :stroke-width="3" />
                        </button>

                        <button v-for="p in totalPages" :key="p" type="button" @click="currentPage = p"
                            :aria-current="p === currentPage ? 'page' : undefined"
                            class="min-w-[36px] h-9 px-2 rounded-lg border-2 border-dark text-[13px] font-bold transition"
                            :class="p === currentPage
                                ? 'bg-orange text-dark'
                                : 'bg-white text-dark hover:bg-gray-light hover:-translate-y-0.5'">
                            {{ p }}
                        </button>

                        <button type="button" @click="currentPage++" :disabled="currentPage === totalPages"
                            aria-label="หน้าถัดไป" class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                               hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition">
                            <ChevronRight :size="16" :stroke-width="3" />
                        </button>
                    </div>
                </section>
            </div>
        </main>

        <LogoutModal v-model="showLogoutModal" />
    </div>
</template>