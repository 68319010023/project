<script setup>
// แท็บ "ผู้ใช้": ค้นหา + กรองตามบทบาท
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase.js'
import { fmt, fmtDate, fullName, roleLabel, roleBadge, card, th } from '../../lib/adminFormat.js'

const error = ref('')
const users = ref([])
const search = ref('')
const roleFilter = ref('all')
const loadingUsers = ref(false)

const roleFilters = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'student', label: 'นักเรียน' },
  { key: 'teacher', label: 'ครู' },
  { key: 'admin', label: 'ผู้ดูแลระบบ' },
]

let usersReq = 0
async function loadUsers() {
  const req = ++usersReq
  loadingUsers.value = true
  const { data, error: e } = await supabase.rpc('admin_list_users', {
    p_search: search.value.trim() || null,
    p_role: roleFilter.value === 'all' ? null : roleFilter.value,
  })
  if (req !== usersReq) return // มีคำค้นใหม่กว่าแล้ว ทิ้งผลเก่า
  loadingUsers.value = false
  if (e) {
    console.error('loadUsers error:', e)
    error.value = 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ กรุณาลองใหม่'
    return
  }
  error.value = ''
  users.value = data ?? []
}

let timer
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(loadUsers, 300)
})
watch(roleFilter, loadUsers)
onMounted(loadUsers)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>

    <section :class="card" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3 justify-between">
        <div class="flex gap-2 flex-wrap">
          <button v-for="f in roleFilters" :key="f.key" type="button" @click="roleFilter = f.key"
            :aria-pressed="roleFilter === f.key"
            class="px-3.5 py-1.5 rounded-lg border-2 border-dark text-[12.5px] font-bold transition"
            :class="roleFilter === f.key ? 'bg-orange text-dark' : 'bg-white text-dark hover:bg-gray-light'">
            {{ f.label }}
          </button>
        </div>

        <div class="relative w-full sm:w-[240px]">
          <Search :size="15" :stroke-width="2.5"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
          <input v-model="search" type="text" placeholder="ค้นหาชื่อ / อีเมล..." aria-label="ค้นหาผู้ใช้"
            class="w-full pl-9 pr-8 py-2 rounded-lg border-2 border-dark bg-white text-[13px] text-dark placeholder:text-gray outline-none focus:bg-gray-light transition" />
          <button v-if="search" type="button" @click="search = ''" aria-label="ล้างคำค้นหา"
            class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-orange transition">
            <X :size="12" :stroke-width="3" />
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-[13px]">
          <thead>
            <tr>
              <th scope="col" :class="th">ชื่อ</th>
              <th scope="col" :class="th">อีเมล</th>
              <th scope="col" :class="th">สมัครเมื่อ</th>
              <th scope="col" :class="th">บทบาท</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-t-2 border-dark/10">
              <td class="py-2.5 pr-3 font-semibold text-dark">{{ fullName(u) }}</td>
              <td class="py-2.5 pr-3 text-gray">{{ u.email }}</td>
              <td class="py-2.5 pr-3 text-gray whitespace-nowrap">{{ fmtDate(u.created_at) }}</td>
              <td class="py-2.5">
                <span class="border-2 border-dark rounded-lg px-2 py-1 text-[11.5px] font-bold"
                  :class="roleBadge(u.role)">
                  {{ roleLabel(u.role) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="loadingUsers && users.length === 0" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</p>
        <p v-else-if="!loadingUsers && users.length === 0" class="text-center text-gray text-[13px] py-6">ไม่พบผู้ใช้</p>
      </div>
      <p v-if="users.length" class="text-[12px] text-gray">แสดง {{ fmt(users.length) }} รายการ</p>
    </section>
  </div>
</template>