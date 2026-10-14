<script setup>
import { Pencil, Trash2 } from 'lucide-vue-next'
import { getClassroomColorById } from '../lib/classroomColors'

const props = defineProps({
  classroom: { type: Object, required: true },
  classroomId: { type: String, required: true },
  canManage: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'delete'])

const roomColor = getClassroomColorById(props.classroomId)
</script>

<template>
  <div class="border-b-3 border-dark px-6 py-10"
    :style="{ background: `linear-gradient(135deg, ${roomColor.from} 0%, ${roomColor.to} 100%)` }">
    <div class="max-w-[1000px] mx-auto relative">
     <h1 class="font-mali text-3xl font-bold text-dark" :class="canManage ? 'pr-24 sm:pr-56' : ''">{{ classroom.name }}</h1>
      <span v-if="classroom.grade_level"
        class="inline-block mt-2 font-bold text-[13px] border-2 border-dark rounded-full px-3 py-1 bg-white/70">
        {{ classroom.grade_level }}
      </span>

      <div v-if="canManage" class="absolute top-0 right-0 flex gap-2.5">
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