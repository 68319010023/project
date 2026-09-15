<script setup>
import { RouterView, useRoute } from 'vue-router'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth'
import { useClassroomModals } from './composables/useModals'
import CreateClassroomModal from './components/CreateClassroomModal.vue'
import JoinClassroomModal from './components/JoinClassroomModal.vue'

const route = useRoute()
const { profile } = useAuth()
const { showCreate, showJoin, refreshTrigger } = useClassroomModals()

const isDashboard = computed(() =>
  route.name === 'student-home' || route.name === 'teacher-home'
)

const showHint = ref(true)
let hintInterval = null

onMounted(() => {
  hintInterval = setInterval(() => {
    showHint.value = !showHint.value
  }, 3000)
})
onUnmounted(() => {
  clearInterval(hintInterval)
})

function onCreated() {
  showCreate.value = false
  refreshTrigger.value++
}
function onJoined() {
  showJoin.value = false
  refreshTrigger.value++
}
</script>

<template>
  <RouterView />

  <div v-if="profile && isDashboard" class="fixed bottom-12 right-12 z-40 w-16">
    <Transition name="fade-hint">
      <span v-if="showHint"
        class="absolute bottom-full right-0 mb-3 w-[180px] text-center bg-dark text-white text-[13px] font-mitr px-3 py-2 rounded-lg border-2 border-dark shadow-offset animate-bounce-slow">
        {{ profile.role === 'teacher' ? 'กดปุ่มเพื่อสร้างห้อง' : 'กดปุ่มเพื่อเอารหัสเข้าชั้นเรียน' }}
        <span class="absolute -bottom-[7px] right-6 w-3 h-3 bg-dark border-r-2 border-b-2 border-dark rotate-45"></span>
      </span>
    </Transition>

    <button type="button" @click="profile.role === 'teacher' ? (showCreate = true) : (showJoin = true)" class="w-16 h-16 rounded-full bg-orange border-3 border-dark 
               shadow-offset flex items-center justify-center text-dark shrink-0
               hover:scale-110 active:scale-95 transition-transform duration-200">
      <Plus :size="28" :stroke-width="2.5" />
    </button>
  </div>

  <CreateClassroomModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
  <JoinClassroomModal v-if="showJoin" @close="showJoin = false" @joined="onJoined" />
</template>