<script setup>
import { RouterView, useRoute } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth'
import { useClassroomModals } from './composables/useModals'
import CreateClassroomModal from './components/CreateClassroomModal.vue'
import JoinClassroomModal from './components/JoinClassroomModal.vue'

const route = useRoute()
const { profile } = useAuth()
const { showCreate, showJoin, refreshTrigger } = useClassroomModals()

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

    <button v-if="profile && route.name !== 'landing'" type="button"
        @click="profile.role === 'teacher' ? (showCreate = true) : (showJoin = true)"
        class="fixed bottom-8 right-8 z-40 w-16 h-16 rounded-full bg-orange border-3 border-dark 
               shadow-offset flex items-center justify-center text-dark
               hover:scale-110 active:scale-95 transition-transform duration-200">
        <Plus :size="28" :stroke-width="2.5" />
    </button>

    <CreateClassroomModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
    <JoinClassroomModal v-if="showJoin" @close="showJoin = false" @joined="onJoined" />
</template>