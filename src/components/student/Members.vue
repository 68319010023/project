<script setup>
import { ref, computed } from 'vue'
import { Users, Search } from 'lucide-vue-next'

const props = defineProps({
  classroom: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  membersLoading: { type: Boolean, default: false },
  currentUserId: { type: String, default: null },
})

const search = ref('')

const isMe = (m) => !!props.currentUserId && m.student_id === props.currentUserId

const filteredMembers = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = !q
    ? props.members
    : props.members.filter((m) => {
      const fullName = `${m.profiles?.name ?? ''} ${m.profiles?.lastname ?? ''}`.toLowerCase()
      return fullName.includes(q)
    })

  return [...list].sort((a, b) => Number(isMe(b)) - Number(isMe(a)))
})

function initials(m) {
  return (m.profiles?.name?.[0] ?? '') + (m.profiles?.lastname?.[0] ?? '')
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <div v-if="classroom" class="bg-purple-light border-3 border-dark rounded-2xl shadow-offset p-5 mb-6
                                  flex items-center gap-4">
      <div class="w-12 h-12 shrink-0 rounded-full border-3 border-dark bg-white overflow-hidden">
        <img v-if="classroom.profiles?.img" :src="classroom.profiles.img" class="w-full h-full object-cover"
          alt="ครู" />
      </div>
      <div>
        <p class="text-[11px] font-bold text-gray font-mono uppercase">ครูประจำวิชา</p>
        <p class="font-mali font-bold text-[17px] text-dark">
          {{ classroom.profiles?.name }} {{ classroom.profiles?.lastname }}
        </p>
      </div>
    </div>


    <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
      <h2 class="font-mali text-xl font-bold text-dark flex items-center gap-2">
        <Users :size="20" :stroke-width="2.5" />
        เพื่อนร่วมห้อง
        <span class="text-[13px] text-gray font-mitr font-normal">({{ members.length }} คน)</span>
      </h2>

      <div class="relative">
        <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
        <input v-model="search" type="text" placeholder="ค้นหาชื่อเพื่อน..." class="pl-9 pr-3 py-2 text-[13.5px] border-3 border-dark rounded-xl
                      bg-white focus:outline-none focus:bg-purple-light/30 transition w-[220px]" />
      </div>
    </div>

    <div v-if="membersLoading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="n in 8" :key="n" class="h-[84px] border-3 border-dark rounded-xl bg-gray-light animate-pulse" />
    </div>

    <p v-else-if="members.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีเพื่อนในห้องนี้
    </p>

    <p v-else-if="filteredMembers.length === 0" class="text-gray text-[13.5px] py-6 text-center">
      ไม่พบชื่อ "{{ search }}"
    </p>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="member in filteredMembers" :key="member.student_id" class="relative bg-white border-3 border-dark rounded-xl p-3
         flex items-center gap-3 hover:-translate-y-1 transition" :class="isMe(member)
          ? 'shadow-[5px_5px_0_#1a1a1a] hover:shadow-[7px_7px_0_#1a1a1a]'
          : 'shadow-offset hover:shadow-offset-lg'">
        <span v-if="isMe(member)" class="absolute -top-2.5 right-3 font-mono text-[13.5px] font-bold bg-orange
           border-2 border-dark rounded-md px-1.5 py-px rotate-3 ">
          คุณ
        </span>
        <div class="w-9 h-9 shrink-0 rounded-full border-2 border-dark bg-purple-light overflow-hidden
              flex items-center justify-center font-mali font-bold text-[13px]">
          <img v-if="member.profiles?.img" :src="member.profiles.img" class="w-full h-full object-cover"
            alt="เพื่อนร่วมห้อง" />
          <span v-else>{{ initials(member) }}</span>
        </div>
        <p class="min-w-0 text-[13.5px] font-medium truncate">
          {{ member.profiles?.name }} {{ member.profiles?.lastname }}
        </p>
      </div>
    </div>
  </div>
</template>