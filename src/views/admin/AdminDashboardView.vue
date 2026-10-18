<script setup>
// หน้า Admin (เปลือก): sidebar + เลือกแท็บ (เก็บใน URL ?tab=...) แต่ละแท็บโหลดข้อมูลของตัวเอง
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Users, UserCheck, School, Sparkles, ScrollText, LogOut } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import AppNavbar from '../../components/AppNavbar.vue'
import LogoutModal from '../../components/LogoutModal.vue'
import AdminOverviewTab from '../../components/admin/AdminOverviewTab.vue'
import AdminUsersTab from '../../components/admin/AdminUsersTab.vue'
import AdminRequestsTab from '../../components/admin/AdminRequestsTab.vue'
import AdminRoomsTab from '../../components/admin/AdminRoomsTab.vue'
import AdminAiTab from '../../components/admin/AdminAiTab.vue'
import AdminAuditTab from '../../components/admin/AdminAuditTab.vue'


const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'overview', label: 'ภาพรวม', icon: LayoutDashboard, desc: 'สรุปการใช้งานระบบและ AI เดือนนี้' },
  { key: 'users', label: 'ผู้ใช้', icon: Users, desc: 'ค้นหาและกรองผู้ใช้ตามบทบาท' },
  { key: 'requests', label: 'คำขอเป็นครู', icon: UserCheck, desc: 'อนุมัติหรือปฏิเสธผู้ที่ขอสิทธิ์ครู' },
  { key: 'rooms', label: 'ห้องเรียน', icon: School, desc: 'ดูและจัดการห้องเรียนทั้งหมด' },
  { key: 'ai', label: 'การใช้ AI', icon: Sparkles, desc: 'การใช้ AI แยกตามห้องเรียน เดือนนี้ (เวลาไทย)' },
  { key: 'audit', label: 'บันทึกการทำงาน', icon: ScrollText, desc: 'ประวัติการกระทำของแอดมิน' },
]

const activeTab = computed(() =>
  tabs.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview'
)
const activeMeta = computed(() => tabs.find((t) => t.key === activeTab.value))

function selectTab(key) {
  if (key !== activeTab.value) router.replace({ query: { ...route.query, tab: key } })
}

const showLogoutModal = ref(false)
const pendingCount = ref(0)
async function loadPendingCount() {
  const { data, error } = await supabase.rpc('admin_list_teacher_requests')
  if (!error) pendingCount.value = (data ?? []).length
}
onMounted(loadPendingCount)
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[{ label: 'ผู้ดูแลระบบ' }]" />

    <main class="w-full max-w-[1480px] mx-auto px-4 sm:px-6 xl:px-10 py-8 flex flex-col lg:flex-row gap-6 items-start">

      <!-- ============ Sidebar ============ -->
      <aside class="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-[114px]">
        <nav aria-label="เมนูผู้ดูแลระบบ"
          class="bg-white border-3 border-dark rounded-2xl shadow-offset p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          <button v-for="t in tabs" :key="t.key" type="button" @click="selectTab(t.key)"
            :aria-current="activeTab === t.key ? 'page' : undefined"
            class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-[13.5px] whitespace-nowrap text-left transition"
            :class="activeTab === t.key ? 'bg-dark text-white' : 'text-dark hover:bg-dark/15'">
            <component :is="t.icon" :size="16" :stroke-width="2.5" class="shrink-0" />
            {{ t.label }}
            <span v-if="t.key === 'requests' && pendingCount > 0"
              class="ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold text-center">
              {{ pendingCount }}
            </span>
          </button>

          <div class="hidden lg:block h-0.5 bg-dark/10 my-1 mx-2"></div>

          <button type="button" @click="showLogoutModal = true"
            class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-600 font-semibold text-[13.5px] whitespace-nowrap text-left hover:bg-red-200 transition">
            <LogOut :size="16" :stroke-width="2.5" class="shrink-0" />
            ออกจากระบบ
          </button>
        </nav>
      </aside>

      <!-- ============ เนื้อหา ============ -->
      <div class="flex-1 min-w-0 w-full flex flex-col gap-5">
        <div>
          <h1 class="font-mali font-bold text-2xl text-dark">{{ activeMeta.label }}</h1>
          <p class="text-[13px] text-gray mt-1">{{ activeMeta.desc }}</p>
        </div>

        <!-- แต่ละแท็บ mount ใหม่ทุกครั้งที่สลับ จึงโหลดข้อมูลสดเสมอ -->
        <AdminOverviewTab v-if="activeTab === 'overview'" @go-tab="selectTab" />
        <AdminUsersTab v-else-if="activeTab === 'users'" />
        <AdminRequestsTab v-else-if="activeTab === 'requests'" @changed="loadPendingCount" />
        
        <AdminRoomsTab v-else-if="activeTab === 'rooms'" />
        <AdminAiTab v-else-if="activeTab === 'ai'" />
        <AdminAuditTab v-else-if="activeTab === 'audit'" />
      </div>
    </main>

    <LogoutModal v-model="showLogoutModal" />
  </div>
</template>