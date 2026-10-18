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

        {
            path: '/classroom/:id/quiz/:quizId',
            name: 'student-quiz-detail',
            component: () => import('../views/student/QuizDetailView.vue'),
            meta: { requiresAuth: true, role: 'student' },
        },
        {
            path: '/classroom/:id/quiz/:quizId/submissions',
            name: 'teacher-quiz-detail',
            component: () => import('../views/teacher/QuizDetailView.vue'),
            meta: { requiresAuth: true, role: 'teacher' },
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('../views/ForgotPassword.vue')
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: () => import('../views/ResetPassword.vue')
        },
        {
            path: '/admin',
            name: 'admin-home',
            component: () => import('../views/admin/AdminDashboardView.vue'),
            meta: { requiresAuth: true, role: 'admin' },
        },
        {
            path: '/teacher/pending',
            name: 'teacher-pending',
            component: () => import('../views/TeacherPendingView.vue'),
            meta: { requiresAuth: true, pendingPage: true },
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

// ผู้ขอเป็นครูคือ role = 'student' + teacher_status = 'pending' (หรือ 'rejected')
// ครูจริงคือ role = 'teacher' เท่านั้น (admin_approve_teacher เป็นคนเปลี่ยน role ให้)
const TEACHER_REQUEST_OPEN = ['pending', 'rejected']

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

    // หน้าที่ต้องรู้ role ของผู้ใช้: landing, หน้าที่กำหนด role, หน้ารออนุมัติ
    const needsProfile = isLoggedIn && (to.name === 'landing' || to.meta.role || to.meta.pendingPage)
    if (!needsProfile) return

    let currentProfile = profile.value
    if (!currentProfile || currentProfile.id !== user.value.id) {
        currentProfile = await fetchProfile(user.value.id)
    }

    if (!currentProfile) {
        return to.name === 'landing' ? undefined : { name: 'landing' }
    }

    const role = currentProfile.role
    const requestOpen = role === 'student' && TEACHER_REQUEST_OPEN.includes(currentProfile.teacher_status)

    if (to.name === 'landing') {
        if (role === 'admin') return { name: 'admin-home' }
        if (role === 'teacher') return { name: 'teacher-home' }
        return { name: requestOpen ? 'teacher-pending' : 'student-home' }
    }

    if (to.meta.pendingPage) {
        if (role === 'teacher') return { name: 'teacher-home' }
        if (!requestOpen) return { name: 'landing' }
        return
    }

    if (to.meta.role) {
        if (role !== to.meta.role) return { name: 'landing' }
        // ผู้ขอเป็นครูที่ยังไม่อนุมัติ ถูกล็อกไว้ที่หน้ารออนุมัติ (เหมือนพฤติกรรมเดิม)
        if (to.meta.role === 'student' && requestOpen) return { name: 'teacher-pending' }
    }
})
    


export default router