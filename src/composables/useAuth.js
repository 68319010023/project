// src/composables/useAuth.js
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)      // auth.users session
const profile = ref(null)   // profiles row (name, lastname, role, img, ...)
const loading = ref(true)
let initialized = false
let profileRequestId = 0

async function fetchProfile(userId) {
    const requestId = ++profileRequestId

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

    // มีคำขอใหม่กว่าเริ่มไปแล้ว ทิ้งผลของคำขอเก่านี้
    if (requestId !== profileRequestId) return data ?? null

    if (error) {
        console.error('fetchProfile error:', error)
        // error ชั่วคราว: เก็บโปรไฟล์เดิมไว้ (ถ้าเป็นของคนเดียวกัน) แทนการล้างทิ้ง
        if (profile.value?.id !== userId) profile.value = null
        return profile.value
    }

    profile.value = data
    return data
}

async function initAuth() {
    if (initialized) return
    initialized = true

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('initAuth getSession error:', sessionError)
        }

        user.value = session?.user ?? null
        if (user.value) {
            await fetchProfile(user.value.id)
        }
    } catch (err) {
        console.error('initAuth unexpected error:', err)
        user.value = null
        profile.value = null
    } finally {
        loading.value = false
    }

    // ห้าม async/await เรียก Supabase ตรงๆ ใน callback นี้ (เสี่ยง deadlock)
    supabase.auth.onAuthStateChange((event, session) => {
        user.value = session?.user ?? null

        if (!session?.user) {
            profile.value = null
            return
        }

        // ดึงโปรไฟล์แล้วใน initAuth / token แค่ต่ออายุ ไม่ต้องดึงซ้ำ
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return

        // กลับมาที่แท็บแล้ว SIGNED_IN ยิงซ้ำ ทั้งที่เป็นคนเดิมและโหลดแล้ว
        if (event === 'SIGNED_IN' && profile.value?.id === session.user.id) return

        const userId = session.user.id
        setTimeout(() => fetchProfile(userId), 0)
    })
}

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) {
            console.error('signOut error:', error)
        }
    } catch (err) {
        console.error('signOut unexpected error:', err)
    } finally {
        user.value = null
        profile.value = null
        loading.value = false
    }
}

async function updateProfile(updates) {
    if (!user.value) return { error: 'not logged in' }

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.value.id)
        .select()
        .maybeSingle()

    if (error) {
        console.error('updateProfile error:', error)
        return { error }
    }

    // RLS บล็อก = ไม่มี error แต่ไม่มีแถวถูกแก้ ห้ามเอา null ไปทับ profile
    if (!data) {
        const blocked = new Error('อัปเดตโปรไฟล์ไม่สำเร็จ (ไม่มีแถวถูกแก้ไข)')
        console.error('updateProfile blocked:', blocked)
        return { error: blocked }
    }

    profile.value = data
    return { data }
}

export function useAuth() {
    return { user, profile, loading, initAuth, fetchProfile, signOut, updateProfile }
}