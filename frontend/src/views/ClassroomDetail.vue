<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import CreateAssignmentModal from './CreateAssignmentModal.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')
const classroom = ref(null)
const students = ref([])
const isTeacher = ref(false)
const copied = ref(false)
const assignments = ref([])
const showAssignmentModal = ref(false)
const teacherName = ref('')

const activeTab = ref('stream') // 'stream' | 'coursework' | 'people'
const tabs = [
  { key: 'stream', label: 'สตรีม' },
  { key: 'coursework', label: 'งานของชั้นเรียน' },
  { key: 'people', label: 'บุคคล' },
]

// การบ้านที่ใกล้ครบกำหนด (ยังไม่เลยกำหนดส่ง) เอาไว้โชว์ในการ์ด "เร็วๆ นี้"
const upcomingAssignments = computed(() =>
  assignments.value
    .filter((a) => a.due_date && new Date(a.due_date) >= new Date())
    .slice(0, 5)
)

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

    // ชื่อครูผู้สอน (โชว์ในแท็บบุคคล)
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', classroomData.teacher_id)
      .single()
    teacherName.value = teacherProfile?.name || 'ไม่ระบุชื่อ'

    // ถ้าเป็นครูเจ้าของห้อง ดึงรายชื่อนักเรียนที่เข้าร่วมมาโชว์ด้วย
    if (isTeacher.value) {
      const { data: enrollments, error: enrollError } = await supabase
        .from('classroom_enrollments')
        .select('student_id, profiles ( name, email )')
        .eq('classroom_id', route.params.id)

      if (enrollError) throw enrollError
      students.value = enrollments || []
    }

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id, title, description, due_date, created_at, attachment_path, attachment_name')
      .eq('classroom_id', route.params.id)
      .order('due_date', { ascending: true })

    if (assignmentsError) throw assignmentsError
    assignments.value = assignmentsData || []

  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่พบห้องเรียนนี้ หรือคุณไม่มีสิทธิ์เข้าถึง'
  } finally {
    loading.value = false
  }
}

function handleAssignmentCreated(newAssignment) {
  // เพิ่มเข้า list ทันทีโดยไม่ต้อง fetch ใหม่ทั้งหมด
  assignments.value.push(newAssignment)
  assignments.value.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

async function copyCode() {
  await navigator.clipboard.writeText(classroom.value.class_code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

onMounted(fetchClassroom)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div v-if="loading" class="py-20 text-center text-[#8A8072]">กำลังโหลด...</div>

      <div v-else-if="errorMsg"
        class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-4 py-4 text-center text-sm font-medium text-[#B8402A]">
        {{ errorMsg }}
      </div>

      <div v-else class="space-y-5">
        <!-- banner หัวห้อง -->
        <div class="banner-card overflow-hidden">
          <div class="relative flex items-center justify-between gap-4 p-6 text-white sm:p-8">
            <div class="min-w-0">
              <h1 class="title-font truncate text-2xl font-bold sm:text-3xl">{{ classroom.name }}</h1>
            </div>
            <div class="hidden shrink-0 text-5xl opacity-90 sm:block">📓</div>
          </div>

          <div v-if="isTeacher" class="flex items-center gap-3 bg-white/95 px-6 py-3.5 backdrop-blur">
            <span class="text-sm text-[#8A8072]">รหัสห้อง:</span>
            <span class="title-font text-lg font-bold tracking-[0.2em] text-[#2A2521]">
              {{ classroom.class_code }}
            </span>
            <button @click="copyCode"
              class="ml-auto rounded-full bg-[#FF6B4A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#E0562F]">
              {{ copied ? 'คัดลอกแล้ว!' : 'คัดลอก' }}
            </button>
          </div>
        </div>

        <!-- แท็บ -->
        <div class="flex gap-1 border-b-2 border-[#E4DCC8]">
          <button
            v-for="tab in tabs" :key="tab.key"
            @click="activeTab = tab.key"
            class="title-font relative px-4 py-2.5 text-sm font-medium transition-colors"
            :class="activeTab === tab.key ? 'text-[#FF6B4A]' : 'text-[#8A8072] hover:text-[#2A2521]'"
          >
            {{ tab.label }}
            <span
              class="absolute -bottom-0.5 left-0 h-[2.5px] w-full rounded-full bg-[#FF6B4A] transition-transform duration-200"
              :class="activeTab === tab.key ? 'scale-x-100' : 'scale-x-0'"
            ></span>
          </button>
        </div>

        <!-- แท็บ: สตรีม -->
        <div v-if="activeTab === 'stream'" class="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section class="note-card p-6 lg:col-span-2">
            <div class="py-10 text-center">
              <p class="text-sm text-[#8A8072]">ยังไม่มีการประกาศในตอนนี้</p>
              <p class="mt-1 text-xs text-[#B0A692]">ฟีเจอร์ประกาศ/สตรีมกำลังจะมาเร็วๆ นี้</p>
            </div>
          </section>

          <aside class="note-card p-5">
            <h2 class="title-font mb-3 text-sm font-semibold text-[#2A2521]">เร็วๆ นี้</h2>

            <div v-if="upcomingAssignments.length === 0" class="py-6 text-center">
              <p class="text-sm text-[#8A8072]">ไม่มีงานที่ใกล้ครบกำหนด</p>
            </div>

            <ul v-else class="space-y-2.5">
              <li v-for="a in upcomingAssignments" :key="a.id"
                class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate text-[#2A2521]">{{ a.title }}</span>
                <span class="shrink-0 whitespace-nowrap rounded-full bg-[#FF6B4A]/10 px-2.5 py-0.5 text-xs font-medium text-[#B8402A]">
                  {{ formatDateShort(a.due_date) }}
                </span>
              </li>
            </ul>

            <button
              v-if="assignments.length > 0"
              @click="activeTab = 'coursework'"
              class="mt-4 w-full rounded-full border-2 border-[#E4DCC8] py-2 text-xs font-semibold text-[#8A8072] transition-colors hover:bg-[#E4DCC8]/30"
            >
              ดูทั้งหมด
            </button>
          </aside>
        </div>

        <!-- แท็บ: งานของชั้นเรียน -->
        <section v-else-if="activeTab === 'coursework'" class="note-card p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="title-font font-semibold text-[#2A2521]">งานของชั้นเรียน</h2>
            <button v-if="isTeacher" @click="showAssignmentModal = true"
              class="stamp-btn rounded-full bg-[#FF6B4A] px-4 py-2 text-xs font-semibold text-white active:scale-95">
              + สร้างการบ้าน
            </button>
          </div>

          <!-- รายการการบ้าน -->
          <div v-if="assignments.length === 0" class="py-8 text-center text-sm text-[#8A8072]">
            ยังไม่มีการบ้านในห้องนี้
          </div>
          <ul v-else class="space-y-2.5">
            <li v-for="a in assignments" :key="a.id">
              <router-link
                :to="`/classrooms/${route.params.id}/assignments/${a.id}`"
                class="block rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FFFDF8] px-4 py-3 transition-colors hover:border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/5"
              >
                <p class="text-sm font-medium text-[#2A2521]">{{ a.title }}</p>
                <p v-if="a.description" class="mt-0.5 truncate text-xs text-[#8A8072]">{{ a.description }}</p>

                <span v-if="a.attachment_path" class="mt-2 inline-flex items-center gap-1 text-xs text-[#8A8072]">
                  📎 {{ a.attachment_name || 'ไฟล์แนบ' }}
                </span>

                <div>
                  <span
                    v-if="a.due_date"
                    class="mt-1.5 inline-block rounded-full bg-[#FF6B4A]/10 px-2.5 py-0.5 text-xs font-medium text-[#B8402A]"
                  >
                    กำหนดส่ง: {{ formatDate(a.due_date) }}
                  </span>
                  <span v-else class="mt-1.5 inline-block rounded-full bg-[#E4DCC8]/50 px-2.5 py-0.5 text-xs font-medium text-[#8A8072]">
                    ไม่กำหนดเวลาส่ง
                  </span>
                </div>
              </router-link>
            </li>
          </ul>
        </section>

        <!-- แท็บ: บุคคล -->
        <section v-else-if="activeTab === 'people'" class="note-card p-6">
          <h2 class="title-font mb-4 font-semibold text-[#2A2521]">ครูผู้สอน</h2>
          <div class="mb-6 flex items-center gap-2.5 border-b-2 border-dashed border-[#E4DCC8] pb-5">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6B4A] text-[11px] font-semibold text-white">
              {{ teacherName.trim().charAt(0) }}
            </div>
            <span class="text-sm text-[#2A2521]">{{ teacherName }}</span>
          </div>

          <template v-if="isTeacher">
            <h2 class="title-font mb-4 font-semibold text-[#2A2521]">
              นักเรียน ({{ students.length }} คน)
            </h2>
            <div v-if="students.length === 0" class="py-6 text-center">
              <p class="text-sm text-[#8A8072]">ยังไม่มีนักเรียนเข้าร่วม</p>
              <p class="mt-1 text-xs text-[#B0A692]">แชร์รหัสห้องด้านบนให้นักเรียนได้เลย</p>
            </div>
            <ul v-else class="divide-y divide-dashed divide-[#E4DCC8]">
              <li v-for="s in students" :key="s.student_id" class="flex items-center gap-2.5 py-2.5 text-sm">
                <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-[11px] font-semibold text-white">
                  {{ (s.profiles?.name || '?').trim().charAt(0) }}
                </div>
                <span class="text-[#2A2521]">{{ s.profiles?.name || 'ไม่ระบุชื่อ' }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="text-sm text-[#8A8072]">รายชื่อนักเรียนแสดงให้เฉพาะครูผู้สอนเท่านั้น</p>
        </section>
      </div>
    </main>

    <CreateAssignmentModal
      v-if="classroom"
      v-model="showAssignmentModal"
      :classroom-id="classroom.id"
      @created="handleAssignmentCreated"
    />
  </div>
</template>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 2px 8px rgba(42, 37, 33, 0.06);
}
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #F1EADC;
  border-radius: 0 18px 0 18px;
}

.banner-card {
  border-radius: 18px;
  background: linear-gradient(135deg, #FF6B4A, #E0562F);
  box-shadow: 0 6px 20px rgba(255, 107, 74, 0.25);
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
}
</style>