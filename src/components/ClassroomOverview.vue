<script setup>
import { Users, ClipboardList, CheckCircle2, Clock, ArrowRight, PartyPopper } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  memberCount: { type: Number, default: 0 },
  assignmentCount: { type: Number, default: 0 },
  submittedCount: { type: Number, default: 0 },
  dueSoonCount: { type: Number, default: 0 },
  submittedLabel: { type: String, default: 'ส่งแล้ว' },
  loading: { type: Boolean, default: false },
  upcomingAssignments: { type: Array, default: () => [] },
})

const emit = defineEmits(['go-tab'])

const stats = () => [
  { key: 'assignments', label: 'งานทั้งหมด', value: props.assignmentCount, icon: ClipboardList, bg: 'bg-white' },
  { key: 'submitted', label: props.submittedLabel, value: props.submittedCount, icon: CheckCircle2, bg: 'bg-purple-light' },
  { key: 'members', label: 'สมาชิก', value: props.memberCount, icon: Users, bg: 'bg-white' },
]
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div v-for="n in 3" :key="n" class="h-[120px] border-[3px] border-dark rounded-xl bg-gray-light animate-pulse" />
    </div>

    <template v-else>
      <!-- สถิติสรุปตัวเอง -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="s in stats()" :key="s.key" :class="s.bg" class="border-[3px] border-dark rounded-xl p-5 shadow-[6px_6px_0_rgba(0,0,0,0.2)]
                    hover:-translate-y-1 hover:shadow-[8px_8px_0_rgba(0,0,0,0.25)] transition">
          <component :is="s.icon" class="w-6 h-6 mb-3" :stroke-width="2.5" />
          <p class="text-[32px] leading-none font-bold">{{ s.value }}</p>
          <p class="text-[13px] text-gray mt-2">{{ s.label }}</p>
        </div>
      </div>

      <!-- งานใกล้ครบกำหนด แบบละเอียด -->
      <div class="mt-6">
        <h3 class="font-mali font-bold text-[16px] mb-3 flex items-center gap-2">
          <Clock :size="18" :stroke-width="2.5" />
          งานที่ใกล้ครบกำหนด
        </h3>

        <!-- เคส 1: ห้องนี้ยังไม่มีงานเลยสักชิ้น (ทั้งการบ้านและ Quiz) -->
        <div v-if="assignmentCount === 0"
          class="border-[3px] border-dashed border-dark/30 rounded-xl p-6 text-center text-[13.5px] text-gray flex flex-col items-center gap-2">
          <ClipboardList :size="22" :stroke-width="2.5" class="text-gray-400" />
          ครูยังไม่ได้มอบหมายงานในห้องนี้
        </div>

        <!-- เคส 2: มีการบ้าน แต่ทำครบ/ไม่มีงานใกล้ครบกำหนดแล้ว -->
        <div v-else-if="upcomingAssignments.length === 0"
          class="border-[3px] border-dashed border-dark/30 rounded-xl p-6 text-center text-[13.5px] text-gray flex flex-col items-center gap-2">
          <PartyPopper :size="22" :stroke-width="2.5" class="text-purple" />
          ไม่มีงานใกล้ครบกำหนดแล้ว เก่งมาก!
        </div>

        <ul v-else class="flex flex-col gap-2.5">
          <li v-for="a in upcomingAssignments" :key="a.id">
            <router-link :to="a.kind === 'quiz'
              ? { name: 'student-quiz-detail', params: { id: classroomId, quizId: a.id } }
              : { name: 'student-assignment-detail', params: { id: classroomId, assignmentId: a.id } }" class="flex items-center justify-between gap-3 border-[3px] border-dark rounded-xl px-4 py-3
             hover:-translate-y-0.5 transition" :class="a.daysLeft <= 1 ? 'bg-red-50' : 'bg-orange/10'">
              <div class="min-w-0">
                <p class="font-semibold text-[14px] truncate">{{ a.title }}</p>
                <p class="text-[12px] text-gray mt-0.5">กำหนดส่ง {{ a.due_date }}</p>
              </div>
              <span class="shrink-0 font-mono text-[12px] font-bold border-2 border-dark rounded-lg px-2.5 py-1"
                :class="a.daysLeft <= 1 ? 'bg-red-200 text-red-800' : 'bg-orange text-dark'">
                {{ a.daysLeft <= 0 ? 'เลยกำหนด' : `เหลือ ${a.daysLeft} วัน` }} </span>
            </router-link>
          </li>
        </ul>
      </div>

    </template>
  </div>
</template>