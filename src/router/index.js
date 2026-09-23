import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior(_to, from, savedPosition) {

        if (from.matched.length === 0) {
            return { top: 0 }
        }
        return savedPosition || { top: 0 }
    },
    routes: [
        {
            path: '/',
            name: 'landing',
            component: () => import('../views/LandingView.vue'),
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
            meta: { guestOnly: true }
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('../views/RegisterView.vue'),
            meta: { guestOnly: true }
        },
        // placeholder ไว้ก่อน สร้างหน้าจริงทีหลัง
        {
            path: '/student',
            name: 'student-home',
            component: () => import('../views/DashboardView.vue'),
            meta: { requiresAuth: true, role: 'student' }
        },
        {
            path: '/teacher',
            name: 'teacher-home',
            component: () => import('../views/DashboardView.vue'),
            meta: { requiresAuth: true, role: 'teacher' }
        },
        {
            path: '/classroom/:id',
            name: 'classroom-detail',
            component: () => import('../views/ClassroomDetailView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/classroom/:id/assignment/:assignmentId',
            name: 'student-assignment-detail',
            component: () => import('../views/student/AssignmentDetailView.vue'),
            meta: { requiresAuth: true, role: 'student' },
        },
        {
            path: '/classroom/:id/assignment/:assignmentId/submissions',
            name: 'teacher-assignment-detail',
            component: () => import('../views/teacher/AssignmentDetailView.vue'),
            meta: { requiresAuth: true, role: 'teacher' },
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('../views/SettingsView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/profile',
            name: 'profile',
            component: () => import('../views/ProfileView.vue'),
            meta: { requiresAuth: true },
        },

    ],
})

// รอให้ initAuth() เช็ค session เสร็จก่อนตัดสินใจ redirect
// ใช้ watch แทนการ poll ด้วย setTimeout: รู้ทันทีที่ loading เปลี่ยนค่า (ไม่ต้องรอรอบถัดไป)
// และมี timeout กันเคสที่ loading ไม่มีวันเป็น false (เช่น initAuth() error แบบเงียบๆ)
// ไม่งั้นผู้ใช้จะติดอยู่หน้าเปล่าตลอดไปโดยไม่รู้สาเหตุ
function waitUntilAuthReady(loadingRef, timeoutMs = 8000) {
    if (!loadingRef.value) return Promise.resolve()

    return new Promise((resolve) => {
        let settled = false
        const stop = watch(loadingRef, (val) => {
            if (!val && !settled) {
                settled = true
                stop()
                clearTimeout(timer)
                resolve()
            }
        })

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true
                stop()
                console.error('waitUntilAuthReady: timeout รอ auth เกิน', timeoutMs, 'ms — ดำเนินการต่อโดยถือว่ายังไม่ล็อกอิน')
                resolve()
            }
        }, timeoutMs)
    })
}

router.beforeEach(async (to) => {
    const { user, profile, loading, fetchProfile } = useAuth()

    await waitUntilAuthReady(loading)

    const isLoggedIn = !!user.value

    if (to.meta.requiresAuth && !isLoggedIn) {
        return { name: 'login' }
    }

    if (to.meta.guestOnly && isLoggedIn) {
        return { name: 'landing' }
    }

    if (to.name === 'landing' && isLoggedIn) {
        let currentProfile = profile.value
        if (!currentProfile || currentProfile.id !== user.value.id) {
            currentProfile = await fetchProfile(user.value.id)
        }
        if (currentProfile) {
            return { name: currentProfile.role === 'teacher' ? 'teacher-home' : 'student-home' }
        }
    }

    if (to.meta.requiresAuth && to.meta.role && isLoggedIn) {
        let currentProfile = profile.value
        if (!currentProfile || currentProfile.id !== user.value.id) {
            currentProfile = await fetchProfile(user.value.id)
        }

        if (!currentProfile) {
            return { name: 'landing' }
        }

        if (currentProfile.role !== to.meta.role) {
            return { name: 'landing' }
        }
    }
})

export default router