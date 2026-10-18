<script setup>
// แท็บ "บันทึกการทำงาน": ประวัติการกระทำของแอดมิน
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { fmtDateTime, roleLabel, card } from '../../lib/adminFormat.js'

const error = ref('')
const auditLog = ref([])
const loadingAudit = ref(false)

async function loadAudit() {
  loadingAudit.value = true
  const { data, error: e } = await supabase.rpc('admin_list_audit_log', { p_limit: 100 })
  loadingAudit.value = false
  if (e) {
    console.error('loadAudit error:', e)
    error.value = 'โหลดบันทึกการทำงานไม่สำเร็จ (ตรวจว่ารัน admin-upgrade.sql แล้ว)'
    return
  }
  error.value = ''
  auditLog.value = data ?? []
}

onMounted(loadAudit)

function auditText(a) {
  const d = a.detail ?? {}
  if (a.action === 'set_role') {
    return `เปลี่ยนบทบาท ${d.target_name || d.target_email || 'ผู้ใช้'} จาก ${roleLabel(d.from)} เป็น ${roleLabel(d.to)}`
  }
  if (a.action === 'delete_classroom') {
    return `ลบห้องเรียน "${d.name ?? '-'}"${d.grade_level ? ` (${d.grade_level})` : ''}`
  }
  if (a.action === 'approve_teacher') {
    return `อนุมัติ ${d.target_name || d.email || 'ผู้ใช้'} เป็นครู`
  }
  if (a.action === 'reject_teacher') {
    return `ปฏิเสธคำขอเป็นครูของ ${d.target_name || d.email || 'ผู้ใช้'}`
  }
  return a.action
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <p v-if="error" role="alert" class="text-[13px] text-red-600">{{ error }}</p>

    <section :class="card">
      <p v-if="loadingAudit && auditLog.length === 0" class="text-center text-gray text-[13px] py-6">กำลังโหลด...</p>
      <p v-else-if="auditLog.length === 0"
        class="border-2 border-dashed border-dark/30 rounded-xl p-6 text-center text-gray text-[13px]">
        ยังไม่มีบันทึกการทำงาน
      </p>
      <ul v-else class="divide-y-2 divide-dark/10">
        <li v-for="a in auditLog" :key="a.id" class="py-3 flex flex-col gap-0.5">
          <p class="text-[13.5px] font-semibold text-dark">{{ auditText(a) }}</p>
          <p class="text-[12px] text-gray">
            โดย {{ a.admin_name || 'ผู้ดูแลระบบ' }} · {{ fmtDateTime(a.created_at) }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>