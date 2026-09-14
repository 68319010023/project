import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export function useClassroomDetail(classroomId) {
  const classroom = ref(null)
  const loading = ref(true)

  const members = ref([])
  const membersLoading = ref(true)

  const assignments = ref([])
  const assignmentsLoading = ref(true)

  const submissions = ref([])
  const submissionsLoading = ref(true)

  async function loadClassroom() {
    loading.value = true
    const { data, error } = await supabase
      .from('classrooms')
      .select('id, name, class_code, teacher_id, profiles:teacher_id(name, lastname)')
      .eq('id', classroomId)
      .single()

    if (error) {
      console.error('loadClassroom error:', error)
      classroom.value = null
    } else {
      classroom.value = data
    }
    loading.value = false
  }

  async function getSubmissionUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('submission-files')
      .createSignedUrl(filePath, 60 * 5) 

    if (error) {
      console.error('getSubmissionUrl error:', error)
      return null
    }
    return data.signedUrl
  }

  async function loadMembers() {
    membersLoading.value = true
    const { data, error } = await supabase
      .from('classroom_enrollments')
      .select('student_id, profiles:student_id(name, lastname)')
      .eq('classroom_id', classroomId)
      .eq('status', 'accepted')

    if (error) {
      console.error('loadMembers error:', error)
      members.value = []
    } else {
      members.value = data
    }
    membersLoading.value = false
  }

  async function loadAssignments() {
    assignmentsLoading.value = true
    const { data, error } = await supabase
      .from('assignments')
      .select('id, title, description, due_date')
      .eq('classroom_id', classroomId)
      .order('due_date', { ascending: true })

    if (error) {
      console.error('loadAssignments error:', error)
      assignments.value = []
    } else {
      assignments.value = data
    }
    assignmentsLoading.value = false
  }

  async function loadSubmissions() {
    submissionsLoading.value = true

    const assignmentIds = assignments.value.map((a) => a.id)
    if (assignmentIds.length === 0) {
      submissions.value = []
      submissionsLoading.value = false
      return
    }

    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, student_id, file_url, original_filename, submitted_at, profiles:student_id(name, lastname)')
      .in('assignment_id', assignmentIds)

    if (error) {
      console.error('loadSubmissions error:', error)
      submissions.value = []
    } else {
      submissions.value = data
    }
    submissionsLoading.value = false
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  async function loadAll() {
    await Promise.all([loadClassroom(), loadMembers(), loadAssignments()])
    await loadSubmissions()
  }

  return {
    classroom,
    loading,
    members,
    membersLoading,
    assignments,
    assignmentsLoading,
    submissions,
    submissionsLoading,
    loadAll,
    loadAssignments,
    loadSubmissions,
    getSubmissionUrl,
    formatDate,
  }
}