// src/composables/useAuth.js
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)      // auth.users session
const profile = ref(null)   // profiles row (name, lastname, role, img, ...)
const loading = ref(true)

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
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    if (user.value) {
        await fetchProfile(user.value.id)
    }
    loading.value = false

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

export function useAuth() {
    return { user, profile, loading, initAuth, fetchProfile, signOut }
}