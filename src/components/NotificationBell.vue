<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ClipboardCheck, FileCheck, BookOpen, Trash2 } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const { profile } = useAuth()
const router = useRouter()

const notifications = ref([])
const isOpen = ref(false)
const loading = ref(true)

const PAGE_SIZE = 20
const hasMore = ref(true)
const loadingMore = ref(false)

const unreadCount = () => notifications.value.filter(n => !n.is_read).length
let channel = null

function subscribeToNotifications() {
    channel = supabase
        .channel('notifications-' + profile.value.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.value.id}`
        }, (payload) => {
            notifications.value.unshift(payload.new)
            // กันไม่ให้ list ที่แสดงบนจอบวมไม่มีที่สิ้นสุดจาก real-time
            if (notifications.value.length > PAGE_SIZE) {
                notifications.value = notifications.value.slice(0, PAGE_SIZE)
            }
        })
        .subscribe()
}

onUnmounted(() => {
    if (channel) supabase.removeChannel(channel)
})

async function loadNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.value.id)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

    if (!error) {
        notifications.value = data
        hasMore.value = data.length === PAGE_SIZE
    }
    loading.value = false
}

async function loadMore() {
    loadingMore.value = true

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.value.id)
        .order('created_at', { ascending: false })
        .range(notifications.value.length, notifications.value.length + PAGE_SIZE - 1)

    if (!error) {
        notifications.value = [...notifications.value, ...data]
        hasMore.value = data.length === PAGE_SIZE
    }
    loadingMore.value = false
}

async function markAsRead(notification) {
    if (!notification.is_read) {
        notification.is_read = true
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
    }
    isOpen.value = false
    if (notification.link) router.push(notification.link)
}

async function deleteNotification(event, notification) {
    event.stopPropagation() // กันไม่ให้ trigger markAsRead/navigate ตอนกดถังขยะ

    const previous = notifications.value
    notifications.value = notifications.value.filter(n => n.id !== notification.id)

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id)

    if (error) {
        console.error('deleteNotification error:', error)
        notifications.value = previous // rollback ถ้าลบไม่สำเร็จ
    }
}

const showDeleteAllModal = ref(false)
const dontAskAgain = ref(false)
const SKIP_CONFIRM_KEY = 'notif_skip_delete_all_confirm'

function requestDeleteAll() {
    if (localStorage.getItem(SKIP_CONFIRM_KEY) === 'true') {
        performDeleteAll()
        return
    }
    showDeleteAllModal.value = true
}

function cancelDeleteAll() {
    showDeleteAllModal.value = false
    dontAskAgain.value = false
}

async function confirmDeleteAll() {
    if (dontAskAgain.value) {
        localStorage.setItem(SKIP_CONFIRM_KEY, 'true')
    }
    showDeleteAllModal.value = false
    dontAskAgain.value = false
    await performDeleteAll()
}

async function performDeleteAll() {
    const previous = notifications.value
    notifications.value = []

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.value.id)

    if (error) {
        console.error('deleteAllNotifications error:', error)
        notifications.value = previous
    }
}

function iconFor(type) {
    if (type === 'new_submission' || type === 'resubmission') return FileCheck
    if (type === 'graded') return ClipboardCheck
    return BookOpen
}

onMounted(() => {
    loadNotifications()
    subscribeToNotifications()
})
</script>

<template>
    <div class="relative">
        <button type="button" @click="isOpen = !isOpen"
            class="relative p-2.5 rounded-lg hover:scale-110 transition-transform duration-200">
            <Bell :size="18" :stroke-width="2.5" class="text-white"
                :class="unreadCount() > 0 ? 'animate-bell-ring' : ''" />
            <span v-if="unreadCount() > 0"
                class="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-orange border-2 border-dark text-[9px] font-bold text-dark flex items-center justify-center animate-pulse">
                {{ unreadCount() > 9 ? '9+' : unreadCount() }}
            </span>
        </button>
        <div v-if="isOpen"
            class="absolute right-0 top-[48px] w-[320px] max-h-[400px] overflow-y-auto bg-white border-3 border-dark rounded-2xl shadow-offset z-40">

            <div v-if="notifications.length > 0"
                class="flex justify-between items-center px-3 py-2 border-b-2 border-dashed border-gray-200 sticky top-0 bg-white">
                <span class="text-[11px] text-gray">การแจ้งเตือน</span>
                <button type="button" @click="requestDeleteAll"
                    class="flex items-center gap-1 text-[11px] font-semibold text-danger border-2 border-danger rounded-lg px-2.5 py-1 hover:bg-red-50 transition">
                    <Trash2 :size="12" :stroke-width="2.5" />
                    ลบทั้งหมด
                </button>
            </div>

            <div v-if="loading" class="p-4 text-center text-gray text-[13px]">กำลังโหลด...</div>
            <div v-else-if="notifications.length === 0" class="p-4 text-center text-gray text-[13px]">
                ยังไม่มีการแจ้งเตือน
            </div>
            <div v-else v-for="n in notifications" :key="n.id"
                class="w-full text-left px-4 py-3 border-b-2 border-dashed border-gray-200 flex gap-3 hover:bg-purple-light/60 transition cursor-pointer group"
                :class="n.is_read ? 'bg-gray-100' : 'bg-purple-light/30'" @click="markAsRead(n)">
                <component :is="iconFor(n.type)" :size="16" :stroke-width="2.5" class="shrink-0 mt-0.5"
                    :class="n.is_read ? 'text-gray-400' : 'text-gray'" />
                <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-semibold truncate" :class="n.is_read ? 'text-gray-400' : ''">{{ n.title
                        }}</p>
                    <p class="text-[12px] truncate" :class="n.is_read ? 'text-gray-400' : 'text-gray'">{{ n.body }}</p>
                </div>
                <span v-if="!n.is_read" class="w-2 h-2 rounded-full bg-orange shrink-0 mt-1.5"></span>
                <button v-if="n.is_read" type="button" @click="deleteNotification($event, n)"
                    class="shrink-0 opacity-0 group-hover:opacity-100 transition-all w-7 h-7 rounded-full border-2 border-danger bg-white flex items-center justify-center hover:bg-danger group/trash">
                    <Trash2 :size="13" :stroke-width="2.5"
                        class="text-danger group-hover/trash:text-white transition-colors" />
                </button>
            </div>

            <button v-if="hasMore && !loading" type="button" @click="loadMore" :disabled="loadingMore"
                class="w-full py-3 text-[12px] text-purple font-semibold hover:bg-gray-100 transition disabled:opacity-50">
                {{ loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม' }}
            </button>
        </div>
    </div>
    <Teleport to="body">
        <div v-if="showDeleteAllModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6"
            @click.self="cancelDeleteAll">
            <div class="bg-white border-3 border-dark rounded-2xl shadow-offset max-w-[360px] w-full p-6">
                <div class="flex items-center gap-3 mb-3">
                    <div
                        class="w-10 h-10 rounded-full border-2 border-danger bg-red-50 flex items-center justify-center shrink-0">
                        <Trash2 :size="18" :stroke-width="2.5" class="text-danger" />
                    </div>
                    <h3 class="font-mali font-bold text-lg">ลบการแจ้งเตือนทั้งหมด</h3>
                </div>

                <p class="text-[13px] text-gray mb-4">
                    ต้องการลบการแจ้งเตือนทั้งหมดใช่ไหม? การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>

                <label class="flex items-center gap-2 mb-5 cursor-pointer select-none">
                    <input type="checkbox" v-model="dontAskAgain" class="w-4 h-4 accent-danger" />
                    <span class="text-[12.5px] text-gray">ไม่ต้องถามฉันอีก</span>
                </label>

                <div class="flex gap-3">
                    <button type="button" @click="cancelDeleteAll"
                        class="flex-1 px-4 py-2.5 rounded-[10px] border-2 border-dark bg-white font-semibold text-[13px] shadow-offset-sm hover:-translate-y-0.5 transition">
                        ยกเลิก
                    </button>
                    <button type="button" @click="confirmDeleteAll"
                        class="flex-1 px-4 py-2.5 rounded-[10px] border-2 border-dark bg-danger text-white font-semibold text-[13px] shadow-offset-sm hover:-translate-y-0.5 transition">
                        ลบทั้งหมด
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>