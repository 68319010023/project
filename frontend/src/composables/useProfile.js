import { ref } from 'vue'
import { supabase } from '../supabase'

// ⭐ สำคัญ: ตัวแปรพวกนี้ประกาศไว้นอกฟังก์ชัน useProfile()
// ทำให้ทุก component ที่เรียก useProfile() ใช้ ref ตัวเดียวกันร่วมกัน (shared state)
// พอที่ไหนแก้ค่า ทุกที่ที่ import ไปใช้จะอัปเดตตามทันที ไม่ต้อง refresh หน้า
const email = ref('')
const name = ref('')
const role = ref('')
const avatarUrl = ref('')
const isLoggedIn = ref(false)
const loaded = ref(false)

export function useProfile() {

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      isLoggedIn.value = false
      name.value = ''
      role.value = ''
      email.value = ''
      avatarUrl.value = ''
      loaded.value = true
      return
    }

    isLoggedIn.value = true
    email.value = user.email

    const { data, error } = await supabase
      .from('profiles')
      .select('name, role, avatar_url')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      name.value = data.name || ''
      role.value = data.role || ''
      avatarUrl.value = data.avatar_url || ''
    }

    loaded.value = true
  }

  // เรียกหลังบันทึกชื่อสำเร็จ เพื่ออัปเดต state กลางทันที (ไม่ query ซ้ำ ประหยัด request)
  function setName(newName) {
    name.value = newName
  }

  // เรียกหลังอัปโหลดรูปสำเร็จ เพื่ออัปเดต state กลางทันที
  function setAvatarUrl(newUrl) {
    avatarUrl.value = newUrl
  }

  function clearProfile() {
    isLoggedIn.value = false
    name.value = ''
    role.value = ''
    email.value = ''
    avatarUrl.value = ''
  }

  return {
    email,
    name,
    role,
    avatarUrl,
    isLoggedIn,
    loaded,
    loadProfile,
    setName,
    setAvatarUrl,
    clearProfile,
  }
}