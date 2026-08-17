import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior(_to, _from, savedPosition) {
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
            component: () => import('../views/LandingView.vue'),
            meta: { requiresAuth: true, role: 'student' }
        },
        {
            path: '/teacher',
            name: 'teacher-home',
            component: () => import('../views/LandingView.vue'),
            meta: { requiresAuth: true, role: 'teacher' }
        },
    ],
})

router.beforeEach(async (to) => {
    const { data: { session } } = await supabase.auth.getSession()
    const isLoggedIn = !!session

    // หน้าที่ต้องล็อกอินก่อน
    if (to.meta.requiresAuth && !isLoggedIn) {
        return { name: 'login' }
    }

    // หน้า login/register ไม่ควรเข้าได้ถ้าล็อกอินอยู่แล้ว
    if (to.meta.guestOnly && isLoggedIn) {
        return { name: 'landing' }
    }

    // เช็ค role เฉพาะหน้าที่ระบุ role ไว้
 if (to.meta.requiresAuth && to.meta.role && isLoggedIn) {
    const { fetchProfile } = useAuth()

    const profile = await fetchProfile(session.user.id)

    if (!profile) {
        console.log('ไม่พบ profile')
        return { name: 'landing' }
    }

    if (profile.role !== to.meta.role) {
        console.log('role ไม่ตรง:', profile.role)
        return { name: 'landing' }
    }
}
})

export default router
