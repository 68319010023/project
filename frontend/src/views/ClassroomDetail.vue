<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')
const classroom = ref(null)
const students = ref([])
const isTeacher = ref(false)
const copied = ref(false)

async function fetchClassroom() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: classroomData, error: classroomError } = await supabase
      .from('classrooms')
      .select('id, name, class_code, teacher_id')
      .eq('id', route.params.id)
      .single()

    if (classroomError) throw classroomError
    classroom.value = classroomData
    isTeacher.value = classroomData.teacher_id === user.id

    // ถ้าเป็นครูเจ้าของห้อง ดึงรายชื่อนักเรียนที่เข้าร่วมมาโชว์ด้วย
    if (isTeacher.value) {
      const { data: enrollments, error: enrollError } = await supabase
        .from('classroom_enrollments')
        .select('student_id, profiles ( name, email )')
        .eq('classroom_id', route.params.id)

      if (enrollError) throw enrollError
      students.value = enrollments || []
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่พบห้องเรียนนี้ หรือคุณไม่มีสิทธิ์เข้าถึง'
  } finally {
    loading.value = false
  }
}

async function copyCode() {
  await navigator.clipboard.writeText(classroom.value.class_code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

onMounted(fetchClassroom)
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-8">
    <div class="mx-auto max-w-2xl">
      <button @click="router.back()" class="mb-4 text-sm text-gray-500 hover:underline">
        ‹ ย้อนกลับ
      </button>

      <div v-if="loading" class="py-16 text-center text-gray-400">กำลังโหลด...</div>

      <div v-else-if="errorMsg" class="rounded-xl bg-red-50 border border-red-100 px-4 py-4 text-center text-red-600">
        {{ errorMsg }}
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl bg-white p-6 shadow-sm border">
          <h1 class="text-2xl font-bold text-gray-800">{{ classroom.name }}</h1>

          <!-- โชว์รหัสห้องเฉพาะครูเจ้าของห้องเท่านั้น -->
          <div v-if="isTeacher" class="mt-4 flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3">
            <span class="text-sm text-gray-600">รหัสห้อง:</span>
            <span class="text-lg font-mono font-bold text-blue-600 tracking-widest">
              {{ classroom.class_code }}
            </span>
            <button
              @click="copyCode"
              class="ml-auto text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600"
            >
              {{ copied ? 'คัดลอกแล้ว!' : 'คัดลอก' }}
            </button>
          </div>
        </div>

        <!-- รายชื่อนักเรียน (ครูเห็นเท่านั้น) -->
        <div v-if="isTeacher" class="rounded-2xl bg-white p-6 shadow-sm border">
          <h2 class="font-semibold text-gray-800 mb-3">
            นักเรียนในห้องนี้ ({{ students.length }} คน)
          </h2>
          <div v-if="students.length === 0" class="text-sm text-gray-400 py-4 text-center">
            ยังไม่มีนักเรียนเข้าร่วม แชร์รหัสห้องด้านบนให้นักเรียนได้เลย
          </div>
          <ul v-else class="divide-y">
            <li v-for="s in students" :key="s.student_id" class="py-2 text-sm text-gray-700">
              {{ s.profiles?.name || 'ไม่ระบุชื่อ' }}
            </li>
          </ul>
        </div>

        <!-- placeholder เผื่อทำ lessons/quizzes/assignments ทีหลัง -->
        <div class="rounded-2xl bg-white p-6 shadow-sm border text-center text-sm text-gray-400">
          เนื้อหา / แบบทดสอบ / การบ้าน — จะเพิ่มทีหลัง
        </div>
      </div>
    </div>
  </div>
</template>