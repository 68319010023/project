<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Hourglass, XCircle, LogOut, Check, X } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth.js'

const router = useRouter()
const { user, profile, fetchProfile, signOut } = useAuth()
const rejected = computed(() => profile.value?.teacher_status === 'rejected')

// ถามฐานข้อมูลทุก 15 วินาที และตอนกลับมาที่แท็บ เมื่ออนุมัติแล้วพาเข้าหน้าครูเอง
async function refresh() {
  if (!user.value) return
  const p = await fetchProfile(user.value.id)
  if (p?.role === 'teacher') {
    router.replace('/teacher')
  }
}

let timer
onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15000)
  window.addEventListener('focus', refresh)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('focus', refresh)
})

async function logout() {
  await signOut()
  router.replace('/')
}
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">

    <!-- ========== NAVBAR ========== -->
    <div class="sticky top-0 z-30">
      <div
        class="bg-dark border-b-4 border-purple h-[70px] md:h-[90px] flex items-center gap-2 md:gap-4 px-4 md:px-6">

        <router-link to="/" class="flex items-center gap-2 md:gap-3">
          <img src="/img/logo.png"
            class="w-12 h-12 md:w-20 md:h-20 hover:scale-110 transition-transform duration-200 object-cover"
            alt="โลโก้">
          <div class="flex flex-col leading-tight">
            <span
              class="font-mali font-bold text-xs xs:text-sm md:text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
            <span class="hidden sm:block font-mitr text-xs text-gray-400 whitespace-nowrap">by บารมี
              ปะวะลัง</span>
          </div>
        </router-link>

        <div class="flex items-center ml-2 md:ml-6 min-w-0">
          <button type="button" @click="logout"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] text-gray-300 font-semibold hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap">
            <LogOut :size="16" :stroke-width="2.5" />
            <span class="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========== เนื้อหา ========== -->
    <div
      class="relative overflow-hidden min-h-[calc(100vh-70px)] md:min-h-[calc(100vh-90px)] flex items-center justify-center px-4 sm:px-6 py-10">

      <!-- ของตกแต่งพื้นหลัง (ลอยเบาๆ) -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0">
        <div
          class="pending-deco pending-float-a hidden sm:block w-24 h-24 rounded-2xl bg-orange border-[3px] border-dark top-[12%] left-[7%] rotate-12">
        </div>
        <div
          class="pending-deco pending-float-b w-14 h-14 rounded-full bg-purple border-[3px] border-dark top-[18%] right-[9%]">
        </div>
        <div
          class="pending-deco pending-float-b hidden sm:block w-16 h-16 rounded-xl bg-purple-light border-[3px] border-dark bottom-[14%] left-[12%] -rotate-12">
        </div>
        <div
          class="pending-deco pending-float-a w-20 h-20 rounded-full bg-orange border-[3px] border-dark bottom-[10%] right-[7%]">
        </div>
        <div
          class="pending-deco pending-float-c hidden md:block w-8 h-8 rounded-md bg-white border-[3px] border-dark top-[55%] left-[3%]">
        </div>
        <div
          class="pending-deco pending-float-c hidden md:block w-6 h-6 rounded-full bg-purple border-[3px] border-dark top-[8%] left-[45%]">
        </div>
      </div>

      <!-- การ์ดหลัก -->
      <div
        class="pending-pop-in relative z-10 w-full max-w-[400px] bg-white border-[3px] border-dark rounded-2xl shadow-[6px_6px_0_#1a1a1a] p-6 sm:p-8 flex flex-col items-center text-center">

        <!-- ป้ายสถานะ -->
        <span
          class="pending-fade-up inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-dark text-[12px] font-bold"
          :class="rejected ? 'bg-[#ffcdd2]' : 'bg-[#fff0d6]'" style="animation-delay: 0.15s">
          <span class="relative flex w-2.5 h-2.5">
            <span v-if="!rejected"
              class="absolute inline-flex w-full h-full rounded-full bg-orange opacity-75 animate-ping"></span>
            <span class="relative inline-flex w-2.5 h-2.5 rounded-full border border-dark"
              :class="rejected ? 'bg-[#f44336]' : 'bg-orange'"></span>
          </span>
          {{ rejected ? 'ไม่ได้รับการอนุมัติ' : 'กำลังรอตรวจสอบ' }}
        </span>

        <!-- ไอคอนหลัก + วงคลื่น -->
        <div class="pending-fade-up relative mt-6 w-20 h-20 flex items-center justify-center"
          style="animation-delay: 0.25s">
          <template v-if="!rejected">
            <span class="pending-ring absolute inset-0 rounded-full border-[3px] border-orange"></span>
            <span class="pending-ring absolute inset-0 rounded-full border-[3px] border-orange"
              style="animation-delay: 1.1s"></span>
          </template>

          <div class="relative w-20 h-20 rounded-full border-[3px] border-dark flex items-center justify-center"
            :class="rejected ? 'bg-[#ffcdd2] pending-shake' : 'bg-[#fff0d6]'">
            <XCircle v-if="rejected" :size="36" :stroke-width="2.5" />
            <Hourglass v-else :size="36" :stroke-width="2.5" class="pending-hourglass" />
          </div>
        </div>

        <!-- หัวข้อ + คำอธิบาย -->
        <div class="pending-fade-up mt-5" style="animation-delay: 0.35s">
          <template v-if="rejected">
            <h1 class="font-mali font-bold text-xl text-dark">คำขอไม่ได้รับการอนุมัติ</h1>
            <p class="text-[13.5px] text-gray leading-relaxed mt-2">
              ผู้ดูแลระบบไม่อนุมัติบัญชีครูของคุณ หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </template>
          <template v-else>
            <h1 class="font-mali font-bold text-xl text-dark">รออนุมัติ</h1>
            <p class="text-[13.5px] text-gray leading-relaxed mt-2">
              บัญชีครูของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ เมื่ออนุมัติแล้วหน้านี้จะพาคุณเข้าสู่ระบบครูให้อัตโนมัติ
            </p>
          </template>
        </div>

        <!-- ขั้นตอน 3 ขั้น -->
        <ol class="pending-fade-up mt-7 w-full flex items-start justify-center" style="animation-delay: 0.5s">
          <!-- 1: ส่งคำขอ (เสร็จเสมอ) -->
          <li class="flex flex-col items-center gap-1.5 w-[76px]">
            <span
              class="pending-step-pop w-8 h-8 rounded-full border-2 border-dark bg-[#c8e6c9] flex items-center justify-center"
              style="animation-delay: 0.7s">
              <Check :size="16" :stroke-width="3" />
            </span>
            <span class="text-[11.5px] font-semibold text-dark">ส่งคำขอ</span>
          </li>

          <span class="flex-1 max-w-[44px] h-[3px] mt-[14px] rounded bg-dark"></span>

          <!-- 2: ตรวจสอบ -->
          <li class="flex flex-col items-center gap-1.5 w-[76px]">
            <span v-if="rejected"
              class="pending-step-pop w-8 h-8 rounded-full border-2 border-dark bg-[#c8e6c9] flex items-center justify-center"
              style="animation-delay: 0.9s">
              <Check :size="16" :stroke-width="3" />
            </span>
            <span v-else
              class="pending-step-pulse w-8 h-8 rounded-full border-2 border-dark bg-orange flex items-center justify-center font-mali font-bold text-[13px]">
              2
            </span>
            <span class="text-[11.5px] font-semibold text-dark">ตรวจสอบ</span>
          </li>

          <span class="flex-1 max-w-[44px] h-[3px] mt-[14px] rounded overflow-hidden"
            :class="rejected ? 'bg-dark' : 'bg-dark/15'">
            <span v-if="!rejected" class="pending-shimmer block h-full w-1/2 bg-orange"></span>
          </span>

          <!-- 3: ผลการอนุมัติ -->
          <li class="flex flex-col items-center gap-1.5 w-[76px]">
            <span v-if="rejected"
              class="pending-step-pop w-8 h-8 rounded-full border-2 border-dark bg-[#ffcdd2] flex items-center justify-center"
              style="animation-delay: 1.1s">
              <X :size="16" :stroke-width="3" />
            </span>
            <span v-else
              class="w-8 h-8 rounded-full border-2 border-dashed border-dark/40 bg-white flex items-center justify-center font-mali font-bold text-[13px] text-dark/40">
              3
            </span>
            <span class="text-[11.5px] font-semibold" :class="rejected ? 'text-dark' : 'text-gray'">
              {{ rejected ? 'ไม่อนุมัติ' : 'อนุมัติ' }}
            </span>
          </li>
        </ol>

        <!-- เช็กสถานะอัตโนมัติ -->
        <p v-if="!rejected" class="pending-fade-up mt-6 inline-flex items-center gap-2 text-[12px] text-gray"
          style="animation-delay: 0.65s">
          <span class="pending-dots"><i></i><i></i><i></i></span>
          ตรวจสอบสถานะให้อัตโนมัติ ไม่ต้องรีเฟรช
        </p>
      </div>
    </div>
  </div>
</template>

