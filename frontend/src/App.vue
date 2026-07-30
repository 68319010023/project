<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './supabase'
import LoadingSpinner from './components/LoadingSpinner.vue'

const router = useRouter()
const route = useRoute()

const isLoggedIn = ref(false)
const profile = ref(null)
const mobileMenuOpen = ref(false)
const aiPopupOpen = ref(false)
const appReady = ref(false)
const routeLoading = ref(false)

const initial = computed(() => (profile.value?.name ? profile.value.name.trim().charAt(0) : '?'))
const homePath = computed(() =>
  profile.value?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard'
)
const navLinks = computed(() => [
  { label: 'หน้าหลัก', to: homePath.value },
  { label: 'AI ติวเตอร์', to: '/ai-tutor' },
])
const onAiTutorPage = computed(() => route.path === '/ai-tutor')

function isActive(path) {
  return route.path === path
}

function goToAiTutor() {
  aiPopupOpen.value = false
  router.push('/ai-tutor')
}

async function loadSession() {
  const { data: { user } } = await supabase.auth.getUser()
  isLoggedIn.value = !!user

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single()
    profile.value = data
  } else {
    profile.value = null
  }
}

async function handleLogout() {
  await supabase.auth.signOut()
  isLoggedIn.value = false
  profile.value = null
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
router.beforeEach((to, from, next) => {
  if (to.path !== from.path) routeLoading.value = true
  next()
})
router.afterEach(() => {
  setTimeout(() => { routeLoading.value = false }, 250)
})
</script>

<template>
  <!-- splash เต็มจอ ตอนเช็ค session ครั้งแรก -->
  <div v-if="!appReady" class="min-h-screen flex items-center justify-center bg-[#FBF9F4]">
    <div class="flex flex-col items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-[#14213D] flex items-center justify-center">
        <span class="text-lg">🎓</span>
      </div>
      <LoadingSpinner :size="28" label="กำลังโหลด…" />
    </div>
  </div>

  <div v-else class="min-h-screen bg-[#FBF9F4]">
    <!-- แถบ progress บาง ๆ ตอนเปลี่ยนหน้า -->
    <div
      v-if="routeLoading"
      class="fixed top-0 left-0 right-0 h-0.5 bg-[#FF6B4A] z-50"
      style="animation: loadbar 0.8s ease-in-out infinite;"
    ></div>

    <header v-if="isLoggedIn" class="sticky top-0 z-40 bg-white border-b border-[#14213D]/10">
      <div class="flex items-center justify-between h-16 px-5 md:px-8">
        <div class="flex items-center gap-6">
          <router-link :to="homePath" class="w-9 h-9 rounded-xl bg-[#14213D] flex items-center justify-center shrink-0">
            <span class="text-sm">🎓</span>
          </router-link>

          <nav class="hidden md:flex items-center gap-1">
            <router-link
              v-for="link in navLinks" :key="link.to" :to="link.to"
              class="px-3 py-2 rounded-full text-sm font-medium transition-colors"
              :class="isActive(link.to) ? 'text-[#14213D] bg-[#14213D]/5' : 'text-[#14213D]/45 hover:text-[#14213D]/75'"
            >
              {{ link.label }}
            </router-link>
          </nav>
        </div>

        <div class="hidden md:flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[#0F766E]/10 flex items-center justify-center text-[#0F766E] text-xs font-semibold" style="font-family: 'Chakra Petch', sans-serif;">
            {{ initial }}
          </div>
          <button @click="handleLogout" class="flex items-center gap-1.5 bg-[#E5484D] text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-[#E5484D]/90 transition-colors">
            ออกจากระบบ
          </button>
        </div>

        <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden text-[#14213D] text-xl leading-none px-2" aria-label="เปิดเมนู">
          {{ mobileMenuOpen ? '✕' : '☰' }}
        </button>
      </div>

      <div v-if="mobileMenuOpen" class="md:hidden border-t border-[#14213D]/8 px-5 py-3 space-y-1">
        <router-link
          v-for="link in navLinks" :key="link.to" :to="link.to" @click="mobileMenuOpen = false"
          class="block px-3 py-2.5 rounded-full text-sm font-medium"
          :class="isActive(link.to) ? 'text-[#14213D] bg-[#14213D]/5' : 'text-[#14213D]/45'"
        >
          {{ link.label }}
        </router-link>
        <div class="flex items-center gap-3 px-3 pt-3 mt-1 border-t border-[#14213D]/8">
          <div class="w-8 h-8 rounded-full bg-[#0F766E]/10 flex items-center justify-center text-[#0F766E] text-xs font-semibold" style="font-family: 'Chakra Petch', sans-serif;">
            {{ initial }}
          </div>
          <span class="text-sm text-[#14213D]/70 flex-1 truncate">{{ profile?.name }}</span>
          <button @click="handleLogout" class="bg-[#E5484D] text-white text-sm font-medium rounded-full px-4 py-1.5">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>

    <router-view />

    <div v-if="isLoggedIn && !onAiTutorPage" class="fixed bottom-5 right-5 z-50">
      <div v-if="aiPopupOpen" class="mb-3 w-72 bg-[#14213D] rounded-2xl p-5 shadow-lg shadow-[#14213D]/20">
        <div class="flex items-start justify-between mb-2">
          <p class="font-semibold text-[#FBF9F4]" style="font-family: 'Chakra Petch', sans-serif;">AI ติวเตอร์ 24 ชม.</p>
          <button @click="aiPopupOpen = false" class="text-[#FBF9F4]/50 hover:text-[#FBF9F4] text-sm leading-none" aria-label="ปิด">✕</button>
        </div>
        <p class="text-sm text-[#FBF9F4]/60 mb-4">ถามคำถาม ทบทวนบทเรียน หรือขอคำแนะนำได้ทุกเวลา</p>
        <button @click="goToAiTutor" class="w-full bg-[#FF6B4A] text-[#4A1B0C] font-medium text-sm rounded-lg px-4 py-2 hover:bg-[#FF6B4A]/90 transition-colors">
          เริ่มคุยกับ AI
        </button>
      </div>
      <button @click="aiPopupOpen = !aiPopupOpen" class="w-14 h-14 rounded-full bg-[#FF6B4A] flex items-center justify-center shadow-lg shadow-[#FF6B4A]/30 hover:bg-[#FF6B4A]/90 transition-colors ml-auto" aria-label="เปิดแชท AI ติวเตอร์">
        <span class="text-xl text-[#4A1B0C]">{{ aiPopupOpen ? '✕' : '💬' }}</span>
      </button>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500&display=swap');

@keyframes loadbar {
  0% { transform: scaleX(0); transform-origin: left; }
  50% { transform: scaleX(1); transform-origin: left; }
  51% { transform-origin: right; }
  100% { transform: scaleX(0); transform-origin: right; }
}
</style>