<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './supabase'
import LoadingSpinner from './components/LoadingSpinner.vue'
import { useProfile } from './composables/useProfile'

const router = useRouter()
const route = useRoute()

const publicPaths = ['/login', '/register']
const isPublicPage = computed(() => publicPaths.includes(route.path))
const onAiTutorPage = computed(() => route.path === '/ai-tutor')
const showHeader = computed(() => isLoggedIn.value && !isPublicPage.value)

// ⭐ ดึงมาจาก shared state ตัวเดียวกับที่ Profile.vue ใช้
// พอ Profile.vue แก้ชื่อ/รูป ตรงนี้จะอัปเดตตามทันทีโดยไม่ต้อง refresh
const { name, role, avatarUrl, isLoggedIn, loadProfile, clearProfile } = useProfile()

const mobileMenuOpen = ref(false)
const aiPopupOpen = ref(false)
const appReady = ref(false)
const routeLoading = ref(false)

// ⭐ ใช้ name/role จาก useProfile() ตรงๆ ไม่ใช่ profile.value อีกต่อไป
const initial = computed(() => (name.value ? name.value.trim().charAt(0) : '?'))
const homePath = computed(() =>
  role.value === 'teacher' ? '/teacher-dashboard' : '/student-dashboard'
)
const navLinks = computed(() => [
  { label: 'หน้าหลัก', to: homePath.value },
])

function isActive(path) {
  return route.path === path
}

function goToAiTutor() {
  aiPopupOpen.value = false
  router.push('/ai-tutor')
}

// ⭐ ใช้ loadProfile() จาก composable แทนการ query เอง
async function loadSession() {
  await loadProfile()
}

async function handleLogout() {
  await supabase.auth.signOut()
  clearProfile()
  mobileMenuOpen.value = false
  router.push('/login')
}

onMounted(async () => {
  await loadSession()
  appReady.value = true
})

supabase.auth.onAuthStateChange(() => {
  loadSession()
})

// แถบ progress บาง ๆ ตอนเปลี่ยนหน้า
router.beforeEach((to, from) => {
  if (to.path !== from.path) routeLoading.value = true
})
router.afterEach(() => {
  setTimeout(() => { routeLoading.value = false }, 250)
})
</script>

<template>
  <!-- splash เต็มจอ ตอนเช็ค session ครั้งแรก -->
  <div v-if="!appReady" class="notebook-page flex min-h-dvh items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="pencil-badge flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B4A] text-white">
        <span class="text-lg">✎</span>
      </div>
      <LoadingSpinner :size="28" label="กำลังโหลด…" />
    </div>
  </div>

  <div v-else class="notebook-page flex h-dvh flex-col overflow-hidden">
    <!-- แถบ progress บาง ๆ ตอนเปลี่ยนหน้า -->
    <div
      v-if="routeLoading"
      class="fixed top-0 left-0 right-0 h-0.5 bg-[#FF6B4A] z-50"
      style="animation: loadbar 0.8s ease-in-out infinite;"
    ></div>

    <header v-if="showHeader" class="relative z-40 shrink-0 border-b-2 border-[#E4DCC8] bg-[#FBF6EC]/95 backdrop-blur">
      <div class="flex h-16 items-center justify-between px-5 md:px-8">
        <div class="flex items-center gap-7">
          <router-link :to="homePath" class="flex shrink-0 items-center gap-2.5">
            <span class="pencil-badge flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B4A]">
              <span class="text-sm text-white">✎</span>
            </span>
            <span class="title-font hidden text-[15px] font-semibold tracking-tight text-[#2A2521] sm:inline">
              สมุดเรียน
            </span>
          </router-link>

          <nav class="hidden items-center gap-1 md:flex">
            <router-link
              v-for="link in navLinks" :key="link.to" :to="link.to"
              class="nav-link title-font relative px-1 py-2 text-sm font-medium transition-colors"
              :class="isActive(link.to) ? 'text-[#2A2521]' : 'text-[#8A8072] hover:text-[#2A2521]'"
            >
              {{ link.label }}
              <span
                class="absolute -bottom-0.5 left-0 h-[2.5px] w-full rounded-full bg-[#FF6B4A] transition-transform duration-200"
                :class="isActive(link.to) ? 'scale-x-100' : 'scale-x-0'"
              ></span>
            </router-link>
          </nav>
        </div>

        <div class="hidden items-center gap-4 md:flex">
          <router-link to="/profile" class="flex items-center gap-2.5 border-r-2 border-dashed border-[#E4DCC8] pr-4 transition-opacity hover:opacity-75">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              alt=""
              class="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <div v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-xs font-semibold text-white">
              {{ initial }}
            </div>
            <span class="max-w-[9rem] truncate text-sm font-medium text-[#6B6255]">{{ name }}</span>
          </router-link>
          <button @click="handleLogout" class="rounded-full border-2 border-[#2A2521] px-4 py-1.5 text-sm font-medium text-[#2A2521] transition-colors hover:bg-[#2A2521] hover:text-[#FBF6EC]">
            ออกจากระบบ
          </button>
        </div>

        <button @click="mobileMenuOpen = !mobileMenuOpen" class="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-[#2A2521] md:hidden" aria-label="เปิดเมนู">
          {{ mobileMenuOpen ? '✕' : '☰' }}
        </button>
      </div>

      <div v-if="mobileMenuOpen" class="space-y-1 border-t-2 border-dashed border-[#E4DCC8] px-5 py-3 md:hidden">
        <router-link
          v-for="link in navLinks" :key="link.to" :to="link.to" @click="mobileMenuOpen = false"
          class="block rounded-xl px-3 py-2.5 text-sm font-medium"
          :class="isActive(link.to) ? 'bg-[#FF6B4A]/10 text-[#FF6B4A]' : 'text-[#8A8072]'"
        >
          {{ link.label }}
        </router-link>
        <div class="mt-1 flex items-center gap-3 border-t border-dashed border-[#E4DCC8] px-3 pt-3">
          <router-link :to="'/profile'" @click="mobileMenuOpen = false" class="flex flex-1 min-w-0 items-center gap-3">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              alt=""
              class="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <div v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-xs font-semibold text-white">
              {{ initial }}
            </div>
            <span class="truncate text-sm text-[#6B6255]">{{ name }}</span>
          </router-link>
          <button @click="handleLogout" class="rounded-full border-2 border-[#2A2521] px-4 py-1.5 text-sm font-medium text-[#2A2521]">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>

    <div class="app-scroll min-h-0 flex-1 overflow-y-auto">
      <router-view />
    </div>

    <div v-if="isLoggedIn && !isPublicPage && !onAiTutorPage" class="fixed bottom-5 right-5 z-50">
      <div v-if="aiPopupOpen" class="note-card mb-3 w-72 p-5">
        <div class="mb-2 flex items-start justify-between">
          <p class="title-font font-semibold text-[#2A2521]">AI ติวเตอร์ 24 ชม.</p>
          <button @click="aiPopupOpen = false" class="text-sm leading-none text-[#B0A692] hover:text-[#2A2521]" aria-label="ปิด">✕</button>
        </div>
        <p class="mb-4 text-sm text-[#8A8072]">ถามคำถาม ทบทวนบทเรียน หรือขอคำแนะนำได้ทุกเวลา</p>
        <button @click="goToAiTutor" class="stamp-btn-sm w-full rounded-full bg-[#FF6B4A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#FF6B4A]/90">
          เริ่มคุยกับ AI
        </button>
      </div>
      <button
        @click="aiPopupOpen = !aiPopupOpen"
        class="fab-btn ml-auto flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#FF6B4A] transition-transform hover:scale-105 active:scale-90"
        :class="{ 'fab-pulse': !aiPopupOpen }"
        aria-label="เปิดแชท AI ติวเตอร์"
      >
        <span class="text-2xl text-white">{{ aiPopupOpen ? '✕' : '✎' }}</span>
      </button>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.app-scroll {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* old Edge/IE */
}
.app-scroll::-webkit-scrollbar {
  display: none; /* Chrome, Safari, new Edge */
}

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
  color: #2A2521;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.pencil-badge {
  box-shadow: 0 2px 0 #C94A2E;
}

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 6px 20px rgba(42, 37, 33, 0.1);
}
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #F1EADC;
  border-radius: 0 18px 0 18px;
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
}
.stamp-btn-sm {
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
}
.stamp-btn-sm:active {
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}

/* floating AI button: white circle with a soft breathing ring so it reads as tappable */
.fab-btn {
  position: relative;
  box-shadow: 0 6px 16px rgba(42, 37, 33, 0.25), 0 2px 0 #C94A2E;
}
.fab-pulse {
  animation: fab-bob 2.6s ease-in-out infinite;
}
.fab-pulse::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: #FF6B4A;
  opacity: 0.45;
  animation: fab-ring 2.6s ease-out infinite;
}

@keyframes fab-ring {
  0% { transform: scale(1); opacity: 0.35; }
  70% { transform: scale(1.55); opacity: 0; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes fab-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .fab-pulse,
  .fab-pulse::before {
    animation: none;
  }
}

@keyframes loadbar {
  0% { transform: scaleX(0); transform-origin: left; }
  50% { transform: scaleX(1); transform-origin: left; }
  51% { transform-origin: right; }
  100% { transform: scaleX(0); transform-origin: right; }
}
</style>