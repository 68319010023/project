<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { X, Paperclip, Link2, Upload, Plus } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  assignmentId: { type: String, default: null }, // มีค่า = โหมดแก้ไข
})

const emit = defineEmits(['close', 'created', 'updated'])

const isEdit = computed(() => !!props.assignmentId)

const title = ref('')
const description = ref('')
const dueDateDate = ref('')
const dueDateTime = ref('23:59')
const maxScore = ref(100)
const saving = ref(false)
const loading = ref(false)
const loadFailed = ref(false)
const errorMsg = ref('')
const fieldErrors = ref({})
const originalMaxScore = ref(null)

const maxFileSize = 10 * 1024 * 1024 // 10 MB ต่อไฟล์
const maxItems = 10

// รายการเอกสารประกอบทั้งหมด
// { key, kind: 'existing'|'file'|'link', url?, label, file? }
const items = ref([])
const originalItems = ref([]) // ไฟล์เดิมตอนเปิดฟอร์ม (ไว้ลบไฟล์ที่ถูกเอาออก)

const showLinkInput = ref(false)
const linkDraft = ref('')
const linkError = ref('')

function isStoragePath(url) {
  return !!url && !/^https?:\/\//.test(url)
}

onMounted(async () => {
  if (!isEdit.value) return
  loading.value = true

  const [aRes, attRes] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, description, due_date, max_score')
      .eq('id', props.assignmentId)
      .single(),
    supabase
      .from('assignment_attachments')
      .select('id, type, url, label, created_at')
      .eq('assignment_id', props.assignmentId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  ])

  loading.value = false

  if (aRes.error || !aRes.data || attRes.error) {
    console.error('load assignment error:', aRes.error, attRes.error)
    loadFailed.value = true
    errorMsg.value = 'โหลดข้อมูลงานไม่สำเร็จ'
    return
  }

  const data = aRes.data
  title.value = data.title || ''
  description.value = data.description || ''
  maxScore.value = data.max_score
  originalMaxScore.value = data.max_score

  // ตัดจากสตริงตรงๆ เพื่อให้ได้ค่าเดียวกับที่กรอกไว้ตอนสร้าง (ไม่แปลง timezone ซ้ำ)
  if (data.due_date) {
    dueDateDate.value = data.due_date.slice(0, 10)
    dueDateTime.value = data.due_date.slice(11, 16) || '23:59'
  }

  const existing = (attRes.data || []).map((row) => ({
    key: row.id,
    kind: 'existing',
    type: row.type,
    url: row.url,
    label: row.label || row.url,
  }))
  items.value = existing
  originalItems.value = existing.map((e) => ({ ...e }))
})

function handleFilesChange(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (files.length === 0) return

  errorMsg.value = ''
  for (const file of files) {
    if (items.value.length >= maxItems) {
      errorMsg.value = `แนบได้สูงสุด ${maxItems} รายการ`
      break
    }
    if (file.size > maxFileSize) {
      errorMsg.value = `"${file.name}" ใหญ่เกิน 10 MB จึงไม่ถูกเพิ่ม`
      continue
    }
    items.value.push({
      key: crypto.randomUUID(),
      kind: 'file',
      label: file.name,
      file,
    })
  }
}

function addLink() {
  linkError.value = ''
  const url = linkDraft.value.trim()
  if (!/^https?:\/\//.test(url)) {
    linkError.value = 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://'
    return
  }
  if (items.value.length >= maxItems) {
    linkError.value = `แนบได้สูงสุด ${maxItems} รายการ`
    return
  }
  items.value.push({ key: crypto.randomUUID(), kind: 'link', url, label: url })
  linkDraft.value = ''
  showLinkInput.value = false
}

function cancelLink() {
  linkDraft.value = ''
  linkError.value = ''
  showLinkInput.value = false
}

function removeItem(key) {
  items.value = items.value.filter((i) => i.key !== key)
}

async function uploadOne(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'file'
  const filePath = `${props.classroomId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from('assignment-files')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (error) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ กรุณาลองใหม่`)
  return filePath
}

async function removeStorageFiles(paths) {
  if (!paths.length) return
  try {
    await supabase.storage.from('assignment-files').remove(paths)
  } catch (e) {
    console.warn('remove storage files failed:', e)
  }
}

async function handleSubmit() {
  errorMsg.value = ''
  fieldErrors.value = {}

  if (!title.value.trim()) {
    fieldErrors.value.title = 'กรุณากรอกชื่อ'
  }
  if (maxScore.value === null || maxScore.value === '' || maxScore.value <= 0) {
    fieldErrors.value.maxScore = 'กรุณากรอกคะแนนเต็มให้ถูกต้อง'
  }
  if (Object.keys(fieldErrors.value).length > 0) return

  saving.value = true
  const uploadedPaths = [] // ไว้ลบทิ้งถ้าบันทึกไม่สำเร็จ

  try {
    // โหมดแก้ไข: ถ้าลดคะแนนเต็ม เตือนเมื่อมีนักเรียนที่ได้คะแนนสูงกว่าค่าใหม่
    if (isEdit.value && originalMaxScore.value !== null && maxScore.value < originalMaxScore.value) {
      const { count } = await supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_id', props.assignmentId)
        .gt('score', maxScore.value)

      if (count > 0) {
        const ok = window.confirm(
          `มีนักเรียน ${count} คนที่ได้คะแนนสูงกว่า ${maxScore.value} ที่คุณกำลังตั้งเป็นคะแนนเต็มใหม่ ต้องการบันทึกต่อหรือไม่?`
        )
        if (!ok) {
          saving.value = false
          return
        }
      }
    }

    // อัปโหลดไฟล์ใหม่ทั้งหมดแบบขนาน
    const newFiles = items.value.filter((i) => i.kind === 'file')
    const results = await Promise.allSettled(newFiles.map((i) => uploadOne(i.file)))

    const pathByKey = {}
    let uploadError = null
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        pathByKey[newFiles[idx].key] = r.value
        uploadedPaths.push(r.value)
      } else if (!uploadError) {
        uploadError = r.reason
      }
    })
    if (uploadError) throw uploadError

    // ประกอบรายการสุดท้าย (คงลำดับตามที่เห็นบนหน้าจอ)
    const finalItems = items.value.map((i) => {
      if (i.kind === 'file') {
        return { type: 'file', url: pathByKey[i.key], label: i.label }
      }
      if (i.kind === 'link') {
        return { type: 'link', url: i.url, label: i.label }
      }
      return { type: i.type, url: i.url, label: i.label }
    })

    const due_date = dueDateDate.value
      ? `${dueDateDate.value}T${dueDateTime.value || '23:59'}:00`
      : null

    let assignmentId = props.assignmentId

    if (isEdit.value) {
      const { error } = await supabase.rpc('update_assignment', {
        p_assignment_id: assignmentId,
        p_title: title.value.trim(),
        p_description: description.value.trim() || null,
        p_due_date: due_date,
        p_max_score: maxScore.value,
      })
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          classroom_id: props.classroomId,
          title: title.value.trim(),
          description: description.value.trim() || null,
          due_date,
          max_score: maxScore.value,
        })
        .select('id')
        .single()
      if (error) throw error
      assignmentId = data.id
    }

    // บันทึกไฟล์แนบทั้งชุด (โหมดสร้างข้ามได้ถ้าไม่มีไฟล์)
    if (isEdit.value || finalItems.length > 0) {
      const { error: attError } = await supabase.rpc('set_assignment_attachments', {
        p_assignment_id: assignmentId,
        p_items: finalItems,
      })
      if (attError) throw attError
    }

    // ลบไฟล์เก่าที่ถูกเอาออกจาก Storage
    if (isEdit.value) {
      const keptUrls = new Set(finalItems.map((i) => i.url))
      const toRemove = originalItems.value
        .filter((o) => isStoragePath(o.url) && !keptUrls.has(o.url))
        .map((o) => o.url)
      await removeStorageFiles(toRemove)
    }

    emit(isEdit.value ? 'updated' : 'created')
    emit('close')
  } catch (err) {
    console.error('save assignment error:', err)
    // อัปโหลดไปแล้วแต่บันทึกไม่สำเร็จ → ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง
    await removeStorageFiles(uploadedPaths)
    errorMsg.value =
      err.message ||
      (isEdit.value ? 'บันทึกการแก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง' : 'สร้างการบ้านไม่สำเร็จ ลองใหม่อีกครั้ง')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
      <div
        class="bg-white border-3 border-dark rounded-2xl shadow-offset p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-5">
          <h2 class="font-mali text-xl font-bold text-dark">{{ isEdit ? 'แก้ไขการบ้าน' : 'สร้างการบ้าน' }}</h2>
          <button type="button" @click="emit('close')"
            class="w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light transition">
            <X :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <p v-if="loading" class="text-gray text-[13px] py-6 text-center">กำลังโหลด...</p>
        <p v-else-if="loadFailed" class="text-danger text-[13px] bg-red-50 border-2 border-danger rounded-lg px-3 py-2">
          {{ errorMsg }}
        </p>

        <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <div>
            <label class="block text-[13px] font-bold mb-1.5">ชื่อ *</label>
            <input v-model="title" type="text"
              class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              :class="fieldErrors.title ? 'border-danger' : 'border-dark'" placeholder="เช่น แบบฝึกหัดบทที่ 3" />
            <p v-if="fieldErrors.title" class="text-danger text-[12px] mt-1">{{ fieldErrors.title }}</p>
          </div>

          <div>
            <label class="block text-[13px] font-bold mb-1.5">รายละเอียด</label>
            <textarea v-model="description" rows="3"
              class="w-full border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[13px] font-bold mb-1.5">กำหนดส่ง</label>
              <div class="flex gap-2">
                <input v-model="dueDateDate" type="date"
                  class="flex-1 min-w-0 border-2 border-dark rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
                <input v-model="dueDateTime" type="time"
                  class="w-[110px] border-2 border-dark rounded-lg px-2 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition" />
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-bold mb-1.5">คะแนนเต็ม *</label>
              <input v-model.number="maxScore" type="number" min="1"
                class="w-full border-2 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:bg-purple-light/20 transition"
                :class="fieldErrors.maxScore ? 'border-danger' : 'border-dark'" />
              <p v-if="fieldErrors.maxScore" class="text-danger text-[12px] mt-1">{{ fieldErrors.maxScore }}</p>
            </div>
          </div>

          <!-- เอกสารประกอบ (หลายไฟล์/ลิงก์) -->
          <div>
            <label class="block text-[13px] font-bold mb-1.5">
              เอกสารประกอบ (ถ้ามี)
              <span class="font-normal text-gray text-[12px]">· {{ items.length }}/{{ maxItems }}</span>
            </label>

            <ul v-if="items.length > 0" class="flex flex-col gap-2 mb-2">
              <li v-for="item in items" :key="item.key"
                class="flex items-center gap-2 border-2 border-dark rounded-lg px-3 py-2 bg-gray-light">
                <component :is="item.kind === 'link' || item.type === 'link' ? Link2 : Paperclip" :size="14"
                  :stroke-width="2.5" class="shrink-0 text-gray" />
                <span class="flex-1 min-w-0 text-[13px] truncate">{{ item.label }}</span>
                <span v-if="item.kind !== 'existing'"
                  class="shrink-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-dark bg-purple-light">ใหม่</span>
                <button type="button" @click="removeItem(item.key)" title="เอาออก"
                  class="shrink-0 w-6 h-6 rounded-full border-2 border-dark flex items-center justify-center hover:bg-white transition">
                  <X :size="12" :stroke-width="2.5" />
                </button>
              </li>
            </ul>

            <div class="flex gap-2">
              <label
                class="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-dark rounded-lg py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-gray-light transition"
                :class="items.length >= maxItems ? 'opacity-40 pointer-events-none' : ''">
                <Upload :size="14" :stroke-width="2.5" />
                แนบไฟล์เพิ่ม
                <input type="file" multiple class="sr-only" @change="handleFilesChange" />
              </label>
              <button type="button" @click="showLinkInput = !showLinkInput" :disabled="items.length >= maxItems"
                class="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-dark rounded-lg py-2.5 text-[13px] font-semibold hover:bg-gray-light transition disabled:opacity-40"
                :class="showLinkInput ? 'bg-purple-light' : ''">
                <Link2 :size="14" :stroke-width="2.5" />
                แนบลิงก์เพิ่ม
              </button>
            </div>
            <p class="text-[11px] text-gray mt-1.5">เลือกหลายไฟล์พร้อมกันได้ ไฟล์ละไม่เกิน 10 MB</p>

            <div v-if="showLinkInput" class="mt-2 flex gap-2">
              <input v-model="linkDraft" type="text" placeholder="https://..." @keydown.enter.prevent="addLink"
                class="flex-1 min-w-0 border-2 rounded-lg px-3 py-2 text-[13.5px] focus:outline-none focus:bg-purple-light/20 transition"
                :class="linkError ? 'border-danger' : 'border-dark'" />
              <button type="button" @click="addLink"
                class="shrink-0 inline-flex items-center gap-1 border-2 border-dark rounded-lg px-3 py-2 text-[13px] font-bold bg-orange hover:bg-white transition">
                <Plus :size="13" :stroke-width="3" />
                เพิ่ม
              </button>
              <button type="button" @click="cancelLink"
                class="shrink-0 border-2 border-dark rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-gray-light transition">
                ยกเลิก
              </button>
            </div>
            <p v-if="linkError" class="text-danger text-[12px] mt-1">{{ linkError }}</p>
          </div>

          <p v-if="errorMsg" class="text-danger text-[13px] bg-red-50 border-2 border-danger rounded-lg px-3 py-2">
            {{ errorMsg }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="emit('close')"
              class="border-2 border-dark rounded-lg px-4 py-2.5 font-semibold text-[13.5px] hover:bg-gray-light transition">
              ยกเลิก
            </button>
            <button type="submit" :disabled="saving"
              class="border-2 border-dark rounded-lg px-5 py-2.5 font-bold text-[13.5px] bg-orange shadow-offset-sm hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0">
              {{ saving ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'สร้างการบ้าน') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>