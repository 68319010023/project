import { ref, computed } from 'vue'
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

  const quizzes = ref([])
  const quizzesLoading = ref(true)

  const quizDetail = ref(null)
  const quizDetailLoading = ref(true)

  const quizQuestions = ref([])          // ไม่มี correct_answer ติดมาด้วย (select เฉพาะที่จำเป็น)
  const quizQuestionsLoading = ref(true)

  const myQuizSubmission = ref(null)
  const myQuizSubmissionLoading = ref(true)

  const quizSubmissions = ref([])        // ทุก submission ของทุก quiz ในห้อง (ใช้ทั้งฝั่งครู/แสดงสถานะฝั่งนักเรียน)
  const quizSubmissionsLoading = ref(true)

  // --- สำหรับหน้ารายละเอียดงานเดี่ยว ---
  const assignmentDetail = ref(null)
  const assignmentDetailLoading = ref(true)

  const mySubmission = ref(null)          // แถว parent ใน assignment_submissions
  const mySubmissionLoading = ref(true)

  const submissionItems = ref([])         // รายการไฟล์/ลิงก์ของ mySubmission
  const submissionItemsLoading = ref(true)

  const memberCount = computed(() => members.value.length)
  const assignmentCount = computed(() => assignments.value.length)

  const submittedCount = computed(
    () => submissions.value.filter((s) => s.submitted_at).length
  )

  function mySubmittedCount(studentId) {
    return computed(
      () =>
        submissions.value.filter(
          (s) => s.student_id === studentId && s.submitted_at
        ).length
    )
  }

  const dueSoonCount = computed(() => {
    const now = new Date()
    const limit = new Date()
    limit.setDate(limit.getDate() + 3)
    return assignments.value.filter((a) => {
      if (!a.due_date) return false
      const due = new Date(a.due_date)
      return due >= now && due <= limit
    }).length
  })

  async function loadClassroom() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('id, name, class_code, grade_level, teacher_id, profiles:teacher_id(name, lastname, img)')
        .eq('id', classroomId)
        .single()

      if (error) {
        console.error('loadClassroom error:', error)
        classroom.value = null
      } else {
        classroom.value = data
      }
    } catch (err) {
      console.error('loadClassroom unexpected error:', err)
      classroom.value = null
    } finally {
      loading.value = false
    }
  }

  // ไฟล์ที่นักเรียนส่ง (bucket: submission-files)
  async function getSubmissionUrl(filePath) {
    try {
      const { data, error } = await supabase.storage
        .from('submission-files')
        .createSignedUrl(filePath, 60 * 5)

      if (error) {
        console.error('getSubmissionUrl error:', error)
        return null
      }
      return data.signedUrl
    } catch (err) {
      console.error('getSubmissionUrl unexpected error:', err)
      return null
    }
  }

  // ใหม่: ไฟล์แนบโจทย์ที่ครูอัปโหลดมา (bucket: assignment-files, private)
  async function getAssignmentAttachmentUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('assignment-files')
      .createSignedUrl(filePath, 60 * 5)

    if (error) {
      console.error('getAssignmentAttachmentUrl error:', error)
      return null
    }
    return data.signedUrl
  }

  async function loadMembers() {
    membersLoading.value = true
    try {
      const { data, error } = await supabase
        .from('classroom_enrollments')
        .select('student_id, profiles:student_id(name, lastname, img)')
        .eq('classroom_id', classroomId)
        .eq('status', 'accepted')

      if (error) {
        console.error('loadMembers error:', error)
        members.value = []
      } else {
        members.value = data
      }
    } catch (err) {
      console.error('loadMembers unexpected error:', err)
      members.value = []
    } finally {
      membersLoading.value = false
    }
  }

  // แก้แล้ว: เพิ่ม max_score กลับเข้ามา (คอลัมน์มีจริงแล้วหลัง migration)
  async function loadAssignments() {
    assignmentsLoading.value = true
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, max_score, attachment_url, attachment_name, created_at')
        .eq('classroom_id', classroomId)
        .order('due_date', { ascending: true })


      if (error) {
        console.error('loadAssignments error:', error)
        assignments.value = []
      } else {
        assignments.value = data
      }
    } catch (err) {
      console.error('loadAssignments unexpected error:', err)
      assignments.value = []
    } finally {
      assignmentsLoading.value = false
    }
  }


  async function loadQuizzes() {
    quizzesLoading.value = true
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, due_date, max_score, created_at')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('loadQuizzes error:', error)
        quizzes.value = []
      } else {
        quizzes.value = data
      }
    } catch (err) {
      console.error('loadQuizzes unexpected error:', err)
      quizzes.value = []
    } finally {
      quizzesLoading.value = false
    }
  }

  async function loadSubmissions() {
    submissionsLoading.value = true

    const assignmentIds = assignments.value.map((a) => a.id)
    if (assignmentIds.length === 0) {
      submissions.value = []
      submissionsLoading.value = false
      return
    }

    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, student_id, submitted_at, score, feedback, profiles:student_id(name, lastname)')
        .in('assignment_id', assignmentIds)

      if (error) {
        console.error('loadSubmissions error:', error)
        submissions.value = []
      } else {
        submissions.value = data
      }
    } catch (err) {
      console.error('loadSubmissions unexpected error:', err)
      submissions.value = []
    } finally {
      submissionsLoading.value = false
    }
  }

  // ============================================================
  // สำหรับหน้ารายละเอียดงานเดี่ยว (AssignmentDetailView)
  // ============================================================

  // แก้แล้ว: เพิ่ม max_score, attachment_url, attachment_name
  async function loadAssignmentDetail(assignmentId) {
    assignmentDetailLoading.value = true
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
        id, title, description, due_date, max_score,
        attachment_url, attachment_name, classroom_id,
        classrooms(name, profiles:teacher_id(name, lastname))
      `)
        .eq('id', assignmentId)
        .single()

      if (error) {
        console.error('loadAssignmentDetail error:', error)
        assignmentDetail.value = null
      } else {
        assignmentDetail.value = data
      }
    } catch (err) {
      console.error('loadAssignmentDetail unexpected error:', err)
      assignmentDetail.value = null
    } finally {
      assignmentDetailLoading.value = false
    }
  }

  async function loadMySubmission(assignmentId, studentId) {
    mySubmissionLoading.value = true
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('id, submitted_at, score, feedback')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (error) {
        console.error('loadMySubmission error:', error)
        mySubmission.value = null
      } else {
        mySubmission.value = data
      }
    } catch (err) {
      console.error('loadMySubmission unexpected error:', err)
      mySubmission.value = null
    } finally {
      mySubmissionLoading.value = false
    }

    if (mySubmission.value) {
      await loadSubmissionItems(mySubmission.value.id)
    } else {
      submissionItems.value = []
      submissionItemsLoading.value = false
    }
  }

  async function fetchSubmissionItems(submissionId) {
    try {
      const { data, error } = await supabase
        .from('submission_items')
        .select('id, type, url, label, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('fetchSubmissionItems error:', error)
        return []
      }
      return data
    } catch (err) {
      console.error('fetchSubmissionItems unexpected error:', err)
      return []
    }
  }

  async function loadSubmissionItems(submissionId) {
    submissionItemsLoading.value = true
    try {
      submissionItems.value = await fetchSubmissionItems(submissionId)
    } finally {
      submissionItemsLoading.value = false
    }
  }

  async function ensureSubmission(assignmentId, studentId) {
    if (mySubmission.value?.id) return mySubmission.value.id

    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .upsert(
          { assignment_id: assignmentId, student_id: studentId, submitted_at: new Date().toISOString() },
          { onConflict: 'assignment_id,student_id' }
        )
        .select('id, submitted_at, score, feedback')
        .single()

      if (error) {
        console.error('ensureSubmission error:', error)
        return null
      }

      mySubmission.value = data
      return data.id
    } catch (err) {
      console.error('ensureSubmission unexpected error:', err)
      return null
    }
  }

  async function addSubmissionItem(submissionId, { type, url, label }) {
    try {
      const { error } = await supabase
        .from('submission_items')
        .insert({ submission_id: submissionId, type, url, label })

      if (error) {
        console.error('addSubmissionItem error:', error)
        return { error }
      }

      await loadSubmissionItems(submissionId)
      return { error: null }
    } catch (err) {
      console.error('addSubmissionItem unexpected error:', err)
      return { error: err }
    }
  }

  async function deleteSubmissionItem(itemId, submissionId) {
    try {
      const { error } = await supabase
        .from('submission_items')
        .delete()
        .eq('id', itemId)

      if (error) {
        console.error('deleteSubmissionItem error:', error)
        return { error }
      }

      await loadSubmissionItems(submissionId)

      if (submissionItems.value.length === 0) {
        await unsubmit(submissionId)
      }

      return { error: null }
    } catch (err) {
      console.error('deleteSubmissionItem unexpected error:', err)
      return { error: err }
    }
  }

  async function unsubmit(submissionId) {
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .delete()
        .eq('id', submissionId)

      if (error) {
        console.error('unsubmit error:', error)
        return { error }
      }

      mySubmission.value = null
      submissionItems.value = []
      return { error: null }
    } catch (err) {
      console.error('unsubmit unexpected error:', err)
      return { error: err }
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  async function loadAll() {
    try {
      await Promise.all([loadClassroom(), loadMembers(), loadAssignments()])
      await loadSubmissions()
    } catch (err) {
      // ไม่ควรมาถึงจุดนี้แล้ว เพราะฟังก์ชันย่อยทุกตัวถูก catch ไว้แล้วในตัวเอง
      // เก็บไว้เป็น safety net เผื่อกรณีมีคนเพิ่มฟังก์ชันใหม่ในอนาคตแล้วลืมใส่ try/catch
      console.error('loadAll unexpected error:', err)
    }
  }

  function isLate(dueDate, comparedTo) {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const compare = comparedTo ? new Date(comparedTo) : new Date()
    return compare > due
  }


  function upcomingAssignments(studentId) {
    return computed(() => {
      const now = new Date()
      const limit = new Date()
      limit.setDate(limit.getDate() + 3)

      const mySubmittedIds = new Set(
        submissions.value
          .filter((s) => s.student_id === studentId && s.submitted_at)
          .map((s) => s.assignment_id)
      )

      return assignments.value
        .filter((a) => {
          if (!a.due_date) return false
          if (mySubmittedIds.has(a.id)) return false
          return new Date(a.due_date) <= limit
        })
        .map((a) => {
          const due = new Date(a.due_date)
          const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
          return {
            id: a.id,
            title: a.title,
            due_date: formatDate(a.due_date),
            daysLeft,
          }
        })
        .sort((a, b) => a.daysLeft - b.daysLeft)
    })
  }

  async function loadQuizDetail(quizId) {
    quizDetailLoading.value = true
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
        id, title, due_date, max_score, classroom_id,
        classrooms(name, profiles:teacher_id(name, lastname))
      `)
        .eq('id', quizId)
        .single()

      if (error) {
        console.error('loadQuizDetail error:', error)
        quizDetail.value = null
      } else {
        quizDetail.value = data
      }
    } catch (err) {
      console.error('loadQuizDetail unexpected error:', err)
      quizDetail.value = null
    } finally {
      quizDetailLoading.value = false
    }
  }

  // ⚠️ สำคัญ: select เฉพาะคอลัมน์ที่จำเป็น ห้ามมี correct_answer หลุดมาด้วยเด็ดขาด
  async function loadQuizQuestions(quizId) {
    quizQuestionsLoading.value = true
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('id, question, choices, type, points')
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('loadQuizQuestions error:', error)
        quizQuestions.value = []
      } else {
        quizQuestions.value = data
      }
    } catch (err) {
      console.error('loadQuizQuestions unexpected error:', err)
      quizQuestions.value = []
    } finally {
      quizQuestionsLoading.value = false
    }
  }

  async function loadMyQuizSubmission(quizId, studentId) {
    myQuizSubmissionLoading.value = true
    try {
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('id, answers, score, is_graded, submitted_at')
        .eq('quiz_id', quizId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (error) {
        console.error('loadMyQuizSubmission error:', error)
        myQuizSubmission.value = null
      } else {
        myQuizSubmission.value = data
      }
    } catch (err) {
      console.error('loadMyQuizSubmission unexpected error:', err)
      myQuizSubmission.value = null
    } finally {
      myQuizSubmissionLoading.value = false
    }
  }

  // ตรวจ + บันทึกคะแนนทั้งหมดเกิดขึ้นฝั่งเซิร์ฟเวอร์ผ่าน RPC — เฉลยไม่มีวันหลุดมาที่ frontend
  async function submitQuiz(quizId, answers) {
    try {
      const { data, error } = await supabase
        .rpc('submit_quiz', { p_quiz_id: quizId, p_answers: answers })
        .single()

      if (error) {
         console.error('submitQuiz error:', error.code, error.message, error.details, error.hint)
        return { error }
      }

      myQuizSubmission.value = {
        id: data.submission_id,
        score: data.score,
        is_graded: data.is_graded,
        submitted_at: new Date().toISOString(),
      }
      return { data, error: null }
    } catch (err) {
      console.error('submitQuiz unexpected error:', err)
      return { error: err }
    }
  }

  // โหลด quiz_submissions ทั้งหมดของห้อง (ใช้แสดง badge สถานะในลิสต์ ทั้งฝั่งครู/นักเรียน)
  async function loadQuizSubmissions() {
    quizSubmissionsLoading.value = true

    const quizIds = quizzes.value.map((q) => q.id)
    if (quizIds.length === 0) {
      quizSubmissions.value = []
      quizSubmissionsLoading.value = false
      return
    }

    try {
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('id, quiz_id, student_id, score, is_graded, submitted_at')
        .in('quiz_id', quizIds)

      if (error) {
        console.error('loadQuizSubmissions error:', error)
        quizSubmissions.value = []
      } else {
        quizSubmissions.value = data
      }
    } catch (err) {
      console.error('loadQuizSubmissions unexpected error:', err)
      quizSubmissions.value = []
    } finally {
      quizSubmissionsLoading.value = false
    }
  }

  return {
    classroom, loading,
    members, membersLoading,
    assignments, assignmentsLoading,
    submissions, submissionsLoading,
    memberCount, assignmentCount, submittedCount, mySubmittedCount, dueSoonCount, upcomingAssignments,
    loadAll, loadMembers, loadAssignments, loadSubmissions,
    getSubmissionUrl, formatDate, isLate,

    assignmentDetail, assignmentDetailLoading, loadAssignmentDetail,
    mySubmission, mySubmissionLoading, loadMySubmission,
    submissionItems, submissionItemsLoading, loadSubmissionItems, fetchSubmissionItems,
    ensureSubmission, addSubmissionItem, deleteSubmissionItem, unsubmit,
    getAssignmentAttachmentUrl, quizzes, quizzesLoading, loadQuizzes, quizDetail, quizDetailLoading, loadQuizDetail,
    quizQuestions, quizQuestionsLoading, loadQuizQuestions,
    myQuizSubmission, myQuizSubmissionLoading, loadMyQuizSubmission,
    submitQuiz,
    quizSubmissions, quizSubmissionsLoading, loadQuizSubmissions,
  }
}