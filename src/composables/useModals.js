import { ref } from 'vue'

export const showCreate = ref(false)
export const showJoin = ref(false)
export const refreshTrigger = ref(0)

export function useClassroomModals() {
    return { showCreate, showJoin, refreshTrigger }
}