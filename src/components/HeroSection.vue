<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Pencil, Trash2, Copy, Check, KeyRound } from 'lucide-vue-next'
import { getClassroomColorById } from '../lib/classroomColors'

const props = defineProps({
  classroom: { type: Object, required: true },
  classroomId: { type: String, required: true },
  canManage: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'delete'])

const roomColor = getClassroomColorById(props.classroomId)

// ข้อมูลครูเจ้าของห้อง (จาก select profiles:teacher_id(name, lastname, img))
const teacher = computed(() => props.classroom.profiles ?? null)
const teacherName = computed(() =>
  teacher.value ? `${teacher.value.name ?? ''} ${teacher.value.lastname ?? ''}`.trim() : ''
)
const teacherInitials = computed(
  () => (teacher.value?.name?.[0] ?? '') + (teacher.value?.lastname?.[0] ?? '')
)

// คัดลอกรหัสห้อง (เฉพาะครู)
const copied = ref(false)
let copyTimer = null

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.classroom.class_code)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch (err) {
    console.error('copyCode error:', err)
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div class="relative overflow-hidden border-b-3 border-dark px-4 sm:px-6 py-6 sm:py-10"
    :style="{ background: `linear-gradient(135deg, ${roomColor.from} 0%, ${roomColor.to} 100%)` }">

    <!-- ลายตกแต่งพื้นหลัง (ไม่รับคลิก) -->
    <div class="absolute inset-0 pointer-events-none opacity-[0.12]"
      style="background-image: radial-gradient(#1a1a1a 1.5px, transparent 1.5px); background-size: 18px 18px;" />
    <div class="absolute -right-10 -bottom-16 w-52 h-52 rounded-full border-[3px] border-dark/20 bg-white/30 pointer-events-none" />
    <div class="absolute right-24 -top-8 w-24 h-24 rounded-full border-[3px] border-dark/20 bg-white/20 pointer-events-none" />

    <div class="max-w-[1000px] mx-auto relative">
      <h1 class="font-mali text-2xl sm:text-3xl font-bold text-dark" :class="canManage ? 'pr-0 sm:pr-24 md:pr-56' : ''">
        {{ classroom.name }}
      </h1>

      <!-- แถวชิป: ระดับชั้น / ครู / รหัสห้อง -->
      <div class="mt-3 flex flex-wrap items-center gap-2.5">
        <!-- สติกเกอร์ระดับชั้น (เอียงนิด ๆ) -->
        <span v-if="classroom.grade_level"
          class="inline-block -rotate-3 font-bold text-[12px] sm:text-[13px] border-[3px] border-dark rounded-full px-3 py-1 bg-white
                 shadow-[3px_3px_0_#1a1a1a]">
          {{ classroom.grade_level }}
        </span>

        <!-- ครูผู้สอน -->
        <span v-if="teacherName"
          class="inline-flex items-center gap-2 border-2 border-dark rounded-full pl-1 pr-3 py-1 bg-white/80 text-[12px] sm:text-[13px] font-semibold text-dark">
          <span class="w-6 h-6 rounded-full border-2 border-dark overflow-hidden bg-purple-light flex items-center justify-center
                       text-[10px] font-bold font-mali">
            <img v-if="teacher?.img" :src="teacher.img" class="w-full h-full object-cover" alt="" />
            <span v-else>{{ teacherInitials }}</span>
          </span>
          ครู{{ teacherName }}
        </span>
      </div>

      <div v-if="canManage" class="mt-4 sm:mt-0 sm:absolute sm:top-0 sm:right-0 flex gap-2.5">
        <button type="button" title="แก้ไขห้องเรียน" @click="emit('edit')" class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border-2 border-dark bg-white
           text-[13px] font-bold text-dark shadow-offset-sm transition
           hover:-translate-y-0.5 hover:bg-purple-light active:translate-y-0">
          <Pencil :size="14" :stroke-width="2.5" />
          <span class="hidden sm:inline">แก้ไข</span>
        </button>
        <button type="button" title="ลบห้องเรียน" @click="emit('delete')" class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border-2 border-dark bg-white
           text-[13px] font-bold text-red-600 shadow-offset-sm transition
           hover:-translate-y-0.5 hover:bg-red-500 hover:text-white active:translate-y-0">
          <Trash2 :size="15" :stroke-width="2.5" />
          <span class="hidden sm:inline">ลบห้อง</span>
        </button>
      </div>
    </div>
  </div>
</template>