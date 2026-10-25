<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'
import { ArrowUp, ChevronDown, Bot, KeyRound, ClipboardList, CircleCheck, Dices, TrendingDown, Hourglass } from 'lucide-vue-next'
const mobileMenuOpen = ref(false)
const showScrollTop = ref(false)
const studentCount = ref(null)
const teacherCount = ref(null)
const totalCount = ref(null)
const activeRole = ref('teacher')
const featureCards = [
    { icon: Bot, band: 'bg-orange', who: 'ครู · นักเรียน', title: 'AI ติวเตอร์ประจำห้อง', desc: 'นักเรียนถามได้ทุกเวลา ส่วนครูได้รายงานจุดอ่อนรายคนที่ AI วิเคราะห์ให้', ai: true },
    { icon: KeyRound, band: 'bg-purple-light', who: 'นักเรียน', title: 'เข้าห้องด้วย Class Code', desc: 'กรอกรหัสหรือกดรับคำเชิญ ก็เข้าห้องได้ทันที' },
    { icon: ClipboardList, band: 'bg-orange', who: 'ครู · นักเรียน', title: 'การบ้านและคะแนน', desc: 'โพสต์งาน กำหนดส่ง ตรวจ และส่งคำแนะนำกลับ' },
    { icon: CircleCheck, band: 'bg-purple-light', who: 'ครู · นักเรียน', title: 'ควิซออนไลน์', desc: 'ตรวจอัตโนมัติ เห็นคะแนนทันทีหลังส่ง' },
    { icon: Dices, band: 'bg-orange', who: 'ครู', title: 'สุ่มเรียกชื่อ', desc: 'ให้ทุกคนมีโอกาสตอบ ไม่ใช่แค่คนที่ยกมือ' }
]
const faqOpen = ref(0)
const faqs = [
    { q: 'นักเรียนเข้าห้องเรียนได้อย่างไร', a: 'กรอก Class Code ที่ครูแจกให้ หรือกดยอมรับคำเชิญจากครูโดยตรง' },
    { q: 'AI ติวเตอร์ทำงานอย่างไร', a: 'คำถามถูกส่งผ่านเซิร์ฟเวอร์ของระบบไปยัง Google Gemini โดยกุญแจเชื่อมต่อไม่ถูกเก็บไว้ในฝั่งเบราว์เซอร์ ครูยังเห็นรายงานจุดอ่อนรายคนที่ AI สรุปให้ด้วย' },
    { q: 'ข้อมูลของฉันปลอดภัยไหม', a: 'ทุกตารางเปิดการควบคุมสิทธิ์ระดับแถว (RLS) ผู้ใช้จึงเห็นเฉพาะข้อมูลของตนเอง และระบบตรวจบทบาททุกครั้งก่อนเข้าหน้าจอทำงาน' },
    { q: 'ใช้บนมือถือได้ไหม', a: 'ได้ เว็บออกแบบให้แสดงผลได้ทั้งคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน' }
]


const show = (v) => (v === null ? '...' : v)
const stats = computed(() => [
    { value: show(studentCount.value), label: 'นักเรียน' },
    { value: show(teacherCount.value), label: 'ครู' },
    { value: show(totalCount.value), label: 'ผู้ใช้ทั้งหมด' }
])

const timeline = [
    { date: 'ส.ค. 2568', title: 'เริ่มต้นโครงงาน', desc: 'วิเคราะห์ปัญหาการเรียนออนไลน์และตั้งโจทย์วิจัย' },
    { date: 'ก.ย. 2568', title: 'ออกแบบระบบ', desc: 'ออกแบบฐานข้อมูลและ UI/UX ของระบบ' },
    { date: 'ต.ค. 2568', title: 'พัฒนาระบบ', desc: 'พัฒนา Frontend และ Backend เชื่อมต่อ Supabase' },
    { date: 'พ.ย. 2568', title: 'ทดสอบและส่งมอบ', desc: 'ทดสอบระบบกับผู้ใช้จริงและนำเสนอโครงงาน' }
]

const roleSteps = {
    teacher: [
        'สร้างห้องเรียน แล้วแชร์ Class Code ให้นักเรียน',
        'โพสต์การบ้านพร้อมวันกำหนดส่ง และสร้างควิซ',
        'ตรวจงาน ให้คะแนน และส่งคำแนะนำกลับ',
        'เปิดรายงาน AI ดูว่าใครอ่อนเรื่องไหน'
    ],
    student: [
        'สมัครสมาชิก แล้วกรอก Class Code เข้าห้อง',
        'ดูการบ้านและวันกำหนดส่งในหน้าเดียว',
        'ทำควิซและเห็นคะแนนทันที',
        'ถาม AI ติวเตอร์ได้ทุกเวลาที่ไม่เข้าใจ'
    ]
}

// ---- แอนิเมชันรายงาน AI ในการ์ด Hero ----
const reportBars = [
    { label: 'สมการเชิงเส้น', target: 85, bar: 'bg-purple', text: '' },
    { label: 'เศษส่วน', target: 62, bar: 'bg-orange', text: '' },
    { label: 'โจทย์ปัญหา', target: 38, bar: 'bg-danger', text: 'text-danger' }
]
const shown = ref(reportBars.map(() => 0))
const showTip = ref(false)
let raf = 0

function playReport() {
    cancelAnimationFrame(raf)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        shown.value = reportBars.map((b) => b.target)
        showTip.value = true
        return
    }
    shown.value = reportBars.map(() => 0)
    showTip.value = false
    const dur = 1100
    const stagger = 300
    const total = dur + stagger * (reportBars.length - 1)
    const start = performance.now()
    const tick = (now) => {
        const t = now - start
        shown.value = reportBars.map((b, i) => {
            const p = Math.min(Math.max((t - i * stagger) / dur, 0), 1)
            return Math.round(b.target * (1 - Math.pow(1 - p, 3)))
        })
        if (t < total) raf = requestAnimationFrame(tick)
        else showTip.value = true
    }
    raf = requestAnimationFrame(tick)
}

function handleScroll() {
    showScrollTop.value = window.scrollY > 500
}
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
    window.addEventListener('scroll', handleScroll)
    playReport()
    const { data, error } = await supabase.rpc('get_user_stats')
    if (error) {
        console.error('get_user_stats error:', error)
        return
    }
    const row = data?.[0]
    studentCount.value = row?.student_count ?? 0
    teacherCount.value = row?.teacher_count ?? 0
    totalCount.value = row?.total_count ?? 0
})
onUnmounted(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
    <div class="bg-white text-dark font-mitr overflow-x-hidden">

        <!-- ========== 1. NAVBAR ========== -->
        <div class="sticky top-0 z-30" style="overflow-anchor: none;">
            <div
                class="bg-dark border-b-4 border-purple h-[68px] md:h-[90px] flex items-center gap-2 md:gap-4 px-3 sm:px-4 md:px-6 relative">
                <div class="flex items-center gap-2 md:gap-3 min-w-0">
                    <img src="/img/logo.png"
                        class="w-10 h-10 sm:w-12 sm:h-12 md:w-20 md:h-20 hover:scale-110 transition-transform duration-200 object-cover"
                        alt="โลโก้">
                    <div class="flex flex-col leading-tight min-w-0">
                        <span
                            class="font-mali font-bold text-[10px] sm:text-xs md:text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
                        <span class="hidden sm:block font-mitr text-[10px] md:text-xs text-gray-400 whitespace-nowrap">by บารมี
                            ปะวะลัง</span>
                    </div>
                </div>
                <div class="hidden md:flex gap-1 absolute left-1/2 -translate-x-1/2">
                    <a href="#problem"
                        class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">ปัญหา</a>
                    <a href="#history"
                        class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">ความเป็นมา</a>
                    <a href="#faq"
                        class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">คำถามที่พบบ่อย</a>
                    <a href="#research"
                        class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">งานวิจัย</a>
                </div>

                <div class="flex-1"></div>

                <div class="hidden md:flex gap-2">
                    <router-link to="/login"
                        class="px-[18px] py-2 rounded-lg border-2 border-gray-500 text-white text-[13.5px] font-semibold whitespace-nowrap hover:border-white">เข้าสู่ระบบ</router-link>
                    <router-link to="/register"
                        class="px-[18px] py-2 rounded-lg border-2 border-dark bg-orange text-dark text-[13.5px] font-semibold whitespace-nowrap hover:bg-white">สมัครสมาชิก</router-link>
                </div>

                <button @click="mobileMenuOpen = !mobileMenuOpen"
                    class="md:hidden ml-1 w-9 h-9 flex items-center justify-center rounded-lg border-2 border-gray-500 text-white shrink-0">
                    <span v-if="!mobileMenuOpen">☰</span>
                    <span v-else>✕</span>
                </button>
            </div>
            <Transition name="slide-down">
                <div v-if="mobileMenuOpen"
                    class="absolute top-[68px] left-0 right-0 md:hidden bg-dark border-b-4 border-purple px-4 py-3 flex flex-col gap-1 z-40">
                    <a href="#problem" @click="mobileMenuOpen = false"
                        class="px-3.5 py-2.5 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white">ปัญหา</a>
                    <a href="#history" @click="mobileMenuOpen = false"
                        class="px-3.5 py-2.5 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white">ความเป็นมา</a>
                    <a href="#faq" @click="mobileMenuOpen = false"
                        class="px-3.5 py-2.5 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white">คำถามที่พบบ่อย</a>
                    <a href="#research" @click="mobileMenuOpen = false"
                        class="px-3.5 py-2.5 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white">งานวิจัย</a>

                    <div class="sm:hidden flex gap-2 mt-2 pt-2 border-t border-gray-700">
                        <router-link to="/login" @click="mobileMenuOpen = false"
                            class="flex-1 text-center px-3 py-2 rounded-lg border-2 border-gray-500 text-white text-[13px] font-semibold">เข้าสู่ระบบ</router-link>
                        <router-link to="/register" @click="mobileMenuOpen = false"
                            class="flex-1 text-center px-3 py-2 rounded-lg border-2 border-dark bg-orange text-dark text-[13px] font-semibold">สมัครสมาชิก</router-link>
                    </div>
                </div>
            </Transition>
        </div>

        <!-- ========== 2. HERO: ซ้ายข้อความ / ขวาตัวอย่างรายงาน AI ========== -->
        <section class="bg-[url('/img/bg.png')] bg-cover bg-center bg-no-repeat overflow-hidden">
            <div class="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-14 md:gap-10 items-center">

                <div class="text-center md:text-left">
                    <h1 class="text-outline text-[clamp(30px,5vw,50px)] leading-tight">
                        ห้องเรียนที่ไม่ทิ้งใครไว้ข้างหลัง แม้เรียนออนไลน์
                    </h1>
                    <p class="text-gray text-[14px] sm:text-[15.5px] max-w-[500px] mx-auto md:mx-0 mt-4 leading-loose">
                        ครูจัดห้อง สั่งงาน และสร้างควิซในที่เดียว ส่วน AI คอยบอกว่านักเรียนคนไหนติดตรงไหน
                        ไม่ใช่แค่รับการบ้านแล้วจบ
                    </p>
                    <div class="flex flex-col sm:flex-row gap-3 mt-7 justify-center md:justify-start">
                        <router-link to="/register"
                            class="text-center px-[26px] py-3 rounded-[10px] border-2 border-dark bg-orange text-dark text-[14.5px] font-semibold shadow-offset-sm hover:-translate-y-0.5 hover:shadow-offset-sm-hover transition">เริ่มใช้งานฟรี</router-link>
                        <a href="#features"
                            class="text-center px-[26px] py-3 rounded-[10px] border-2 border-dark bg-white text-dark text-[14.5px] font-semibold shadow-offset-sm hover:-translate-y-0.5 hover:shadow-offset-sm-hover transition">ดูว่าทำอะไรได้บ้าง</a>
                    </div>
                </div>

                <!-- การ์ดตัวอย่างรายงานจุดอ่อน (mock) -->
                <div class="relative max-w-[400px] w-full mx-auto md:mx-0 md:ml-auto">
                    <div @click="playReport" title="แตะเพื่อดูอีกครั้ง"
                        class="bg-white border-3 border-dark rounded-2xl shadow-offset p-5 text-left cursor-pointer select-none">
                        <div class="flex items-center justify-between gap-2">
                            <div class="font-mali font-bold text-[15px]">รายงาน AI รายบุคคล</div>
                            <span class="text-[11px] font-semibold bg-purple-light border-2 border-dark rounded-full px-2.5 py-0.5">ตัวอย่าง</span>
                        </div>
                        <div class="text-[12.5px] text-gray mt-0.5">นักเรียน: สมชาย · ควิซบทที่ 3</div>

                        <div class="mt-4 space-y-3">
                            <div v-for="(b, i) in reportBars" :key="b.label">
                                <div class="flex justify-between text-[12.5px]">
                                    <span>{{ b.label }}</span>
                                    <span class="font-semibold tabular-nums" :class="b.text">{{ shown[i] }}%</span>
                                </div>
                                <div class="h-3 mt-1 rounded-full border-2 border-dark bg-white overflow-hidden">
                                    <div class="h-full" :class="b.bar" :style="{ width: shown[i] + '%' }"></div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 bg-purple-light border-2 border-dark rounded-xl p-3 text-[12.5px] leading-relaxed transition-all duration-500"
                            :class="showTip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'">
                            <span class="font-semibold">AI แนะนำ:</span> ควรทบทวนโจทย์ปัญหา ลองเริ่มจากการแปลงโจทย์เป็นสมการทีละขั้น
                        </div>

                        <div class="mt-3 text-center text-[11px] text-gray">แตะการ์ดเพื่อดูอีกครั้ง</div>
                    </div>

                    <!-- การ์ดเล็กใต้การ์ดหลัก (ไม่แตะกัน) -->
                    <div class="hidden md:flex flex-wrap justify-center gap-4 mt-7">
                        <div class="flex items-center gap-2.5 -rotate-3 bg-white border-3 border-dark rounded-xl shadow-offset-sm px-3 py-2.5">
                            <span class="w-9 h-9 rounded-lg bg-purple-light border-2 border-dark flex items-center justify-center"><KeyRound :size="18" :stroke-width="2.25" /></span>
                            <div class="text-left leading-tight">
                                <div class="text-[11px] text-gray">Class Code</div>
                                <div class="font-mali font-bold text-[14px]">MATH-4821</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2.5 rotate-3 bg-white border-3 border-dark rounded-xl shadow-offset-sm px-3 py-2.5">
                            <span class="w-9 h-9 rounded-lg bg-orange border-2 border-dark flex items-center justify-center"><CircleCheck :size="18" :stroke-width="2.25" /></span>
                            <div class="text-left leading-tight">
                                <div class="text-[11px] text-gray">ควิซบทที่ 3</div>
                                <div class="font-mali font-bold text-[14px]">ส่งแล้ว 28/32 คน</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ========== สถิติ (หน้าสมุดโน้ต) ========== -->
        <section v-reveal class="max-w-[1000px] mx-auto px-4 sm:px-6 pt-14 sm:pt-16 pb-4">
            <div class="relative bg-white border-3 border-dark rounded-2xl shadow-offset -rotate-[0.6deg] pt-10 pb-6 overflow-visible"
                style="background-image: repeating-linear-gradient(transparent 0, transparent 35px, rgba(0,0,0,0.09) 35px, rgba(0,0,0,0.09) 36px);">

                <!-- ห่วงสมุดสันกระดาษ -->
                <div class="absolute -top-4 left-0 right-0 flex justify-around px-6 sm:px-10" aria-hidden="true">
                    <span v-for="n in 9" :key="n"
                        class="w-3.5 h-7 rounded-full border-3 border-dark bg-white" :class="n > 5 ? 'hidden sm:block' : ''"></span>
                </div>

                <!-- เส้นกั้นขอบสมุด -->
                <div class="hidden sm:block absolute top-0 bottom-0 left-9 w-[2px] bg-danger/60" aria-hidden="true"></div>

                <div class="sm:pl-14 px-5 sm:pr-8">
                    <h2 class="font-mali font-bold text-[18px] sm:text-[22px]">
                        <span class="bg-purple-light px-2 py-0.5 border-2 border-dark rounded-md">สถิติการใช้งานตอนนี้</span>
                    </h2>

                    <div class="grid grid-cols-3 mt-6">
                        <div v-for="(stat, i) in stats" :key="stat.label"
                            class="py-4 px-1 sm:px-2 text-center border-dark border-dashed border-l-2 first:border-l-0"
                            :class="i % 2 ? 'rotate-1' : '-rotate-1'">
                            <div class="font-mali font-bold text-3xl sm:text-5xl leading-none"
                                :class="i === 2 ? 'text-orange' : 'text-purple'">{{ stat.value }}</div>
                            <div class="inline-block mt-3 text-[12px] sm:text-[13px] text-dark px-2 py-0.5 bg-white border-2 border-dark rounded-md">{{ stat.label }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ========== 3. ปัญหา: ซ้ายเลขใหญ่ / ขวารายการ ========== -->
        <section id="problem" v-reveal class="scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div class="grid md:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-12 items-start">
                <div class="bg-dark border-3 border-dark rounded-2xl shadow-offset p-6 sm:p-8 text-white">
                    <div class="font-mali font-bold text-6xl sm:text-7xl text-orange leading-none">72%</div>
                    <p class="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-gray-300">
                        ของนักศึกษาบอกว่าการมีส่วนร่วมในชั้นเรียนที่ต่ำ ทำให้ประสบการณ์เรียนออนไลน์แย่ลง
                    </p>
                </div>

                <div class="text-left">
                    <h2 class="text-[clamp(24px,3vw,32px)] leading-snug">ทำไมถึงต้องมีระบบนี้</h2>
                    <p class="text-gray text-[14px] sm:text-[15px] leading-loose mt-3">
                        แพลตฟอร์มส่วนใหญ่เน้นส่งเนื้อหากับสั่งงาน ผู้เรียนจึงเหงา ไม่มีส่วนร่วม
                        และไม่มีใครช่วยเฉพาะตัว ขณะที่ครูก็มีงานตรวจและงานเอกสารจนดูแลทุกคนไม่ไหว
                    </p>
                    <ul class="mt-5 space-y-3">
                        <li class="flex gap-3 items-start bg-white border-3 border-dark rounded-xl p-4 shadow-offset-sm">
                            <span class="w-10 h-10 shrink-0 rounded-lg bg-purple-light border-2 border-dark flex items-center justify-center"><TrendingDown :size="20" :stroke-width="2.25" /></span>
                            <div>
                                <div class="font-semibold text-[14.5px]">ครู 1 คน ดูแลนักเรียนราว 40 คน</div>
                                <div class="text-[12.5px] text-gray mt-0.5">จึงไม่มีเวลาดูแลเป็นรายบุคคล</div>
                            </div>
                        </li>
                        <li class="flex gap-3 items-start bg-white border-3 border-dark rounded-xl p-4 shadow-offset-sm">
                            <span class="w-10 h-10 shrink-0 rounded-lg bg-purple-light border-2 border-dark flex items-center justify-center"><Hourglass :size="20" :stroke-width="2.25" /></span>
                            <div>
                                <div class="font-semibold text-[14.5px]">นักเรียนออนไลน์ 45% ส่งงานช้าหรือไม่ส่ง</div>
                                <div class="text-[12.5px] text-gray mt-0.5">เพราะไม่มีใครตามต่อเนื่อง</div>
                            </div>
                        </li>
                    </ul>
                    <p class="text-[11px] text-gray mt-4">
                        * อ้างอิง Frontiers in Education, "Engagement in Online Learning: Student Attitudes and Behavior During COVID-19" (2022)
                    </p>
                </div>
            </div>
        </section>

        <!-- ========== 4. ฟีเจอร์: แถบการ์ดเลื่อนจากขวาไปซ้ายวนลูป ========== -->
        <div class="bg-purple-light/40 border-y-3 border-dark">
            <section id="features" v-reveal class="scroll-mt-[88px] py-14 sm:py-20">
                <div class="max-w-[1100px] mx-auto px-4 sm:px-6 text-left">
                    <h2 class="text-[clamp(24px,3vw,32px)] leading-snug">ทุกอย่างที่ห้องเรียนต้องใช้ อยู่ในที่เดียว</h2>
                    <p class="text-gray text-[14px] sm:text-[15px] mt-2">ครูจัดการห้องได้ครบ ส่วนนักเรียนมี AI คอยช่วยตลอด</p>
                </div>

                <div class="marquee mt-4 overflow-hidden py-10" aria-label="ฟีเจอร์ของระบบ">
                    <div class="marquee-track flex w-max">
                        <div v-for="n in 2" :key="n" class="flex items-center gap-12 sm:gap-16 pr-12 sm:pr-16" :aria-hidden="n === 2 ? 'true' : null">
                            <template v-for="(f, i) in featureCards" :key="n + f.title">
                                <div class="float-wrap shrink-0"
                                    :style="{ animationDelay: (-i * 1.1) + 's', animationDuration: (5 + (i % 3)) + 's' }">
                                    <div class="flex items-center gap-4">
                                        <span class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full border-3 border-dark shadow-offset-sm flex items-center justify-center" :class="f.band">
                                            <component :is="f.icon" :size="26" :stroke-width="2.25" />
                                        </span>
                                        <div class="text-left">
                                            <div class="font-mali font-bold text-[24px] sm:text-[32px] leading-none whitespace-nowrap">{{ f.title }}</div>
                                            <p class="mt-1.5 text-[12.5px] sm:text-[13.5px] text-gray leading-snug max-w-[240px]">{{ f.desc }}</p>
                                        </div>
                                    </div>
                                </div>
                                <span class="w-3 h-3 rotate-45 bg-purple border-2 border-dark shrink-0" aria-hidden="true"></span>
                            </template>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- ========== 5. วิธีใช้ แยกตามบทบาท (กดสลับได้) ========== -->
        <section v-reveal class="max-w-[1100px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div class="grid md:grid-cols-[0.8fr_1.2fr] gap-8 md:gap-12 items-start">
                <div class="text-left">
                    <h2 class="text-[clamp(24px,3vw,32px)] leading-snug">เริ่มใช้ได้ภายในไม่กี่นาที</h2>
                    <p class="text-gray text-[14px] sm:text-[15px] leading-loose mt-3">เลือกบทบาทของคุณเพื่อดูขั้นตอน</p>
                    <div class="flex gap-2 mt-4">
                        <button type="button" @click="activeRole = 'teacher'"
                            :class="activeRole === 'teacher' ? 'bg-orange shadow-offset-sm' : 'bg-white'"
                            class="px-5 py-2 rounded-[10px] border-2 border-dark text-[14px] font-semibold transition">ครู</button>
                        <button type="button" @click="activeRole = 'student'"
                            :class="activeRole === 'student' ? 'bg-orange shadow-offset-sm' : 'bg-white'"
                            class="px-5 py-2 rounded-[10px] border-2 border-dark text-[14px] font-semibold transition">นักเรียน</button>
                    </div>
                </div>

                <ol class="space-y-3">
                    <li v-for="(step, i) in roleSteps[activeRole]" :key="activeRole + i"
                        class="flex items-center gap-4 bg-white border-3 border-dark rounded-xl p-4 shadow-offset-sm text-left">
                        <span class="w-9 h-9 shrink-0 rounded-full bg-purple-light border-2 border-dark flex items-center justify-center font-mali font-bold">{{ i + 1 }}</span>
                        <span class="text-[14px] sm:text-[15px] leading-relaxed">{{ step }}</span>
                    </li>
                </ol>
            </div>
        </section>

        <!-- ========== 6. ไทม์ไลน์ ========== -->
        <div class="bg-gray-800">
            <section id="history" v-reveal class="scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
                <h2 class="text-[clamp(24px,3vw,32px)] text-white text-left">ประวัติความเป็นมาของโครงงาน</h2>

                <div class="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-0 relative">
                    <div class="hidden md:block absolute top-[9px] left-0 right-0 h-[3px] bg-purple-light"></div>
                    <div v-for="item in timeline" :key="item.title" class="relative md:pr-6 pl-8 md:pl-0 text-left">
                        <div class="absolute left-0 top-1 md:top-0 w-5 h-5 rounded-full bg-purple border-3 border-dark"></div>
                        <div class="md:pt-8 text-[12px] text-gray-400 font-semibold">{{ item.date }}</div>
                        <h3 class="text-[16px] text-white mt-1">{{ item.title }}</h3>
                        <p class="text-sm mt-1.5 text-gray-400 leading-relaxed">{{ item.desc }}</p>
                    </div>
                </div>
            </section>
        </div>

        <!-- ========== คำถามที่พบบ่อย ========== -->
        <section id="faq" v-reveal class="scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div class="grid md:grid-cols-[0.8fr_1.2fr] gap-8 md:gap-12 items-start">
                <div class="text-left">
                    <h2 class="text-[clamp(24px,3vw,32px)] leading-snug">คำถามที่พบบ่อย</h2>
                    <p class="text-gray text-[14px] sm:text-[15px] leading-loose mt-3">เรื่องที่ครูและนักเรียนมักสงสัยก่อนเริ่มใช้งาน</p>
                </div>
                <div class="space-y-3">
                    <div v-for="(f, i) in faqs" :key="f.q" class="bg-white border-3 border-dark rounded-xl shadow-offset-sm text-left overflow-hidden">
                        <button type="button" @click="faqOpen = faqOpen === i ? -1 : i"
                            class="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left" :aria-expanded="faqOpen === i">
                            <span class="font-semibold text-[14.5px] sm:text-[15.5px]">{{ f.q }}</span>
                            <span class="w-8 h-8 shrink-0 rounded-full border-2 border-dark flex items-center justify-center transition-colors"
                                :class="faqOpen === i ? 'bg-orange' : 'bg-purple-light'">
                                <ChevronDown :size="18" :stroke-width="2.5" class="transition-transform duration-300" :class="faqOpen === i ? 'rotate-180' : ''" />
                            </span>
                        </button>
                        <div class="grid transition-all duration-300" :class="faqOpen === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                            <div class="overflow-hidden">
                                <p class="px-4 sm:px-5 pb-4 text-[13.5px] sm:text-[14px] text-gray leading-relaxed">{{ f.a }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ========== งานวิจัย ========== -->
        <section id="research" v-reveal class="scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
            <div class="bg-white border-3 border-dark rounded-[18px] p-6 sm:p-8 shadow-offset text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-[20px] sm:text-[24px]">งานวิจัยโครงงาน</h2>
                    <p class="text-[13px] sm:text-[14px] text-gray mt-2 leading-relaxed">
                        เอกสารฉบับสมบูรณ์อยู่ระหว่างจัดทำ จะเปิดให้ดาวน์โหลดเร็วๆ นี้
                    </p>
                </div>
                <span class="self-start sm:self-auto shrink-0 text-[12px] font-bold bg-purple-light border-2 border-dark px-3.5 py-1.5 rounded-full">เร็วๆ นี้</span>
            </div>
        </section>

        <!-- ========== 8. CTA ปิดท้าย ========== -->
        <section v-reveal class="max-w-[1100px] mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
            <div class="bg-dark border-3 border-dark rounded-2xl shadow-offset px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                <p class="text-white text-[16px] sm:text-[19px] leading-relaxed max-w-[520px]">
                    ให้ <span class="text-orange font-semibold">"ห้องเรียนของฉัน"</span> ช่วยดูแลนักเรียนทีละคน ไม่ปล่อยให้ใครหลุดจากการเรียนรู้
                </p>
                <router-link to="/register"
                    class="shrink-0 px-[26px] py-3 rounded-[10px] border-2 border-dark bg-orange text-dark text-[14.5px] font-semibold hover:bg-white transition">สมัครสมาชิก</router-link>
            </div>
        </section>

        <!-- ========== FOOTER ========== -->
        <footer class="bg-dark border-t-4 border-purple text-gray-300 px-4 sm:px-6 pt-10 pb-6">
            <div class="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr] gap-8 text-left">

                <div>
                    <div class="flex items-center gap-3">
                        <img src="/img/logo.png" class="w-12 h-12 object-cover" alt="โลโก้">
                        <span class="font-mali font-bold text-lg text-white">ห้องเรียนของฉัน</span>
                    </div>
                    <p class="text-[13px] text-gray-400 leading-relaxed mt-3 max-w-[320px]">
                        ระบบจัดการห้องเรียนที่มี AI ช่วยดูแลนักเรียนเป็นรายคน
                    </p>
                </div>

                <div>
                    <div class="font-mali font-bold text-white text-[15px]">เมนู</div>
                    <ul class="mt-3 space-y-2 text-[13.5px]">
                        <li><a href="#problem" class="hover:text-white">ปัญหา</a></li>
                        <li><a href="#features" class="hover:text-white">ฟีเจอร์</a></li>
                        <li><a href="#history" class="hover:text-white">ความเป็นมา</a></li>
                        <li><a href="#faq" class="hover:text-white">คำถามที่พบบ่อย</a></li>
                        <li><a href="#research" class="hover:text-white">งานวิจัย</a></li>
                    </ul>
                </div>

                <div>
                    <div class="font-mali font-bold text-white text-[15px]">เริ่มใช้งาน</div>
                    <ul class="mt-3 space-y-2 text-[13.5px]">
                        <li><router-link to="/login" class="hover:text-white">เข้าสู่ระบบ</router-link></li>
                        <li><router-link to="/register" class="hover:text-white">สมัครสมาชิก</router-link></li>
                    </ul>
                    <div class="text-[12px] text-gray-500 mt-4 leading-relaxed">
                        สร้างด้วย Vue.js 3, Supabase และ Google Gemini
                    </div>
                </div>
            </div>

            <div class="max-w-[1100px] mx-auto mt-8 pt-5 border-t border-gray-700 text-center text-[12px] sm:text-[12.5px] text-gray-500">
                © 2569 โครงงาน ระดับ ปวส. · พัฒนาโดย บารมี ปะวะลัง
            </div>
        </footer>

        <!-- ปุ่มเลื่อนขึ้นบนสุด -->
        <Transition name="fade-scale">
            <button v-if="showScrollTop" @click="scrollToTop" type="button" aria-label="เลื่อนขึ้นบนสุด"
                class="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-3 border-dark bg-orange text-dark flex items-center justify-center shadow-offset-sm hover:-translate-y-1 hover:shadow-offset transition-all">
                <ArrowUp :size="25" :stroke-width="2.5" class="animate-arrow-float" />
            </button>
        </Transition>

    </div>
</template>

