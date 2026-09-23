// src/composables/useAuth.js
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)      // auth.users session
const profile = ref(null)   // profiles row (name, lastname, role, img, ...)
const loading = ref(true)
let initialized = false



async function fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error('fetchProfile error:', error)
        profile.value = null
        return null
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
        // เช่น เน็ตหลุด/getSession throw — อย่าปล่อยให้ loading ค้าง true ตลอดไป
        console.error('initAuth unexpected error:', err)
        user.value = null
        profile.value = null
    } finally {
        // การันตีว่า loading จะกลับเป็น false เสมอ ไม่ว่า try จะสำเร็จหรือพัง
        // เพื่อไม่ให้ router guard (waitUntilAuthReady) ต้องพึ่ง timeout ค้างหน้าจอ
        loading.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
        user.value = session?.user ?? null
        if (user.value) {
            await fetchProfile(user.value.id)
        } else {
            profile.value = null
        }
    })
}

async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
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

    profile.value = data
    return { data }
}

export function useAuth() {
    return { user, profile, loading, initAuth, fetchProfile, signOut, updateProfile }
}