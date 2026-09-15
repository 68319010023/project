import { createRouter, createWebHistory } from 'vue-router'
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

router.beforeEach(async (to) => {
    const { user, profile, loading, fetchProfile } = useAuth()

    // กัน race condition: รอ initAuth() เช็ค session เสร็จก่อนตัดสินใจ redirect
    while (loading.value) {
        await new Promise(resolve => setTimeout(resolve, 30))
    }

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
