import axios from 'axios';
import type {
  User,
  Sentence,
  Annotation,
  AuthToken,
  LoginCredentials,
  RegisterData,
  AnnotationCreate,
  AnnotationUpdate,
  AdminStats,
  Evaluation,
  EvaluationCreate,
  EvaluationUpdate,
  EvaluatorStats,
  MTQualityAssessment,
  MTQualityCreate,
  MTQualityUpdate,
  OnboardingTest,
  OnboardingTestAnswer,
  OnboardingTestResult,
  LanguageProficiencyQuestion,
  UserQuestionAnswer,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Auth storage
export const authStorage = {
  getToken: () => localStorage.getItem('access_token'),
  setToken: (token: string) => localStorage.setItem('access_token', token),
  removeToken: () => localStorage.removeItem('access_token'),
  getUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  setUser: (user: User) => localStorage.setItem('user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('user'),
};

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if not already on login/register pages
      const currentPath = window.location.pathname;
      const isOnAuthPage = currentPath === '/login' || currentPath === '/register';
      
      authStorage.removeToken();
      authStorage.removeUser();
      
      // Only redirect if user is not already on an auth page
      if (!isOnAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthToken> => {
    const response = await api.post('/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthToken> => {
    const response = await api.post('/register', userData);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    // Add cache-busting parameters to ensure we get fresh data
    const response = await api.get('/me', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      params: {
        _t: Date.now() // Cache buster
      }
    });
    return response.data;
  },

  markGuidelinesSeen: async (): Promise<User> => {
    const response = await api.put('/me/guidelines-seen');
    return response.data;
  },

  updateProfile: async (profileData: {
    first_name?: string;
    last_name?: string;
    preferred_language?: string;
    languages?: string[];
  }): Promise<User> => {
    const response = await api.put('/me/profile', profileData);
    return response.data;
  },
};

// Sentences API
export const sentencesAPI = {
  getSentences: async (skip = 0, limit = 100): Promise<Sentence[]> => {
    const response = await api.get(`/sentences?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getSentence: async (id: number): Promise<Sentence> => {
    const response = await api.get(`/sentences/${id}`);
    return response.data;
  },

  getNextSentence: async (): Promise<Sentence | null> => {
    const response = await api.get('/sentences/next');
    return response.data;
  },

  getUnannotatedSentences: async (skip = 0, limit = 50): Promise<Sentence[]> => {
    const response = await api.get(`/sentences/unannotated?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  createSentence: async (sentenceData: Omit<Sentence, 'id' | 'created_at' | 'is_active'>): Promise<Sentence> => {
    const response = await api.post('/sentences', sentenceData);
    return response.data;
  },

  bulkCreateSentences: async (sentencesData: Omit<Sentence, 'id' | 'created_at' | 'is_active'>[]): Promise<Sentence[]> => {
    const response = await api.post('/admin/sentences/bulk', sentencesData);
    return response.data;
  },

  importSentencesFromCSV: async (file: File): Promise<{
    message: string;
    imported_count: number;
    skipped_count: number;
    total_rows: number;
    errors: string[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/admin/sentences/import-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Annotations API
export const annotationsAPI = {
  createAnnotation: async (annotationData: AnnotationCreate): Promise<Annotation> => {
    const response = await api.post('/annotations', annotationData);
    return response.data;
  },

  updateAnnotation: async (id: number, annotationData: AnnotationUpdate): Promise<Annotation> => {
    const response = await api.put(`/annotations/${id}`, annotationData);
    return response.data;
  },

  uploadVoiceRecording: async (audioBlob: Blob, annotationId?: number): Promise<{ voice_recording_url: string; voice_recording_duration: number }> => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'voice_recording.webm');
    if (annotationId) {
      formData.append('annotation_id', annotationId.toString());
    }
    
    const response = await api.post('/annotations/upload-voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getMyAnnotations: async (skip = 0, limit = 100): Promise<Annotation[]> => {
    const response = await api.get(`/annotations?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  deleteAnnotation: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/annotations/${id}`);
    return response.data;
  },

  getAllAnnotations: async (skip = 0, limit = 100): Promise<Annotation[]> => {
    const response = await api.get(`/admin/annotations?skip=${skip}&limit=${limit}`);
    return response.data;
  },
};

// Admin API
export const adminAPI = {
  getStats: async (): Promise<AdminStats> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  getAllUsers: async (skip = 0, limit = 100, role?: string, active?: boolean, search?: string): Promise<User[]> => {
    let url = `/admin/users?skip=${skip}&limit=${limit}`;
    if (role) url += `&role=${role}`;
    if (active !== undefined) url += `&active=${active}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get(url);
    return response.data;
  },

  getUserDetails: async (userId: number): Promise<User> => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  createUser: async (userData: {
    email: string;
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    is_active?: boolean;
    is_admin?: boolean;
    is_evaluator?: boolean;
    languages?: string[];
    skip_onboarding?: boolean;
  }): Promise<User> => {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  updateUser: async (userId: number, userData: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    username: string;
    is_active: boolean;
    is_evaluator: boolean;
    languages: string[];
  }>): Promise<User> => {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  },

  deactivateUser: async (userId: number, reason?: string): Promise<User> => {
    const response = await api.put(`/admin/users/${userId}/deactivate`, {
      reason: reason || 'Admin deactivation',
      notify_user: false
    });
    return response.data;
  },

  resetUserPassword: async (userId: number, newPassword: string, forceChange = true): Promise<{ message: string }> => {
    const response = await api.post(`/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
      force_change: forceChange,
      notify_user: false
    });
    return response.data;
  },

  deleteUser: async (userId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  getAdminSentences: async (skip = 0, limit = 100, targetLanguage?: string, sourceLanguage?: string): Promise<Sentence[]> => {
    let url = `/admin/sentences?skip=${skip}&limit=${limit}`;
    if (targetLanguage) url += `&target_language=${targetLanguage}`;
    if (sourceLanguage) url += `&source_language=${sourceLanguage}`;
    const response = await api.get(url);
    return response.data;
  },

  getSentenceCountsByLanguage: async (): Promise<{[key: string]: number}> => {
    const response = await api.get('/admin/sentences/counts');
    return response.data;
  },

  getSentenceAnnotations: async (sentenceId: number): Promise<Annotation[]> => {
    const response = await api.get(`/admin/sentences/${sentenceId}/annotations`);
    return response.data;
  },

  toggleEvaluatorRole: async (userId: number): Promise<User> => {
    const response = await api.put(`/admin/users/${userId}/toggle-evaluator`);
    return response.data;
  },

  // Analytics endpoints
  getUserGrowthAnalytics: async (months: number = 6): Promise<Array<{month: string, users: number, annotations: number}>> => {
    const response = await api.get(`/admin/analytics/user-growth?months=${months}`);
    return response.data;
  },

  getErrorDistributionAnalytics: async (): Promise<Array<{type: string, count: number, color: string, description: string}>> => {
    const response = await api.get('/admin/analytics/error-distribution');
    return response.data;
  },

  getLanguageActivityAnalytics: async (): Promise<Array<{language: string, sentences: number, annotations: number}>> => {
    const response = await api.get('/admin/analytics/language-activity');
    return response.data;
  },

  getDailyActivityAnalytics: async (days: number = 7): Promise<Array<{date: string, annotations: number, evaluations: number}>> => {
    const response = await api.get(`/admin/analytics/daily-activity?days=${days}`);
    return response.data;
  },

  getUserRoleDistributionAnalytics: async (): Promise<Array<{role: string, count: number, color: string}>> => {
    const response = await api.get('/admin/analytics/user-roles');
    return response.data;
  },

  getQualityMetricsAnalytics: async (): Promise<{
    averageQuality: number;
    averageFluency: number;
    averageAdequacy: number;
    completionRate: number;
  }> => {
    const response = await api.get('/admin/analytics/quality-metrics');
    return response.data;
  },
};

// Machine Translation Quality Assessment API
export const mtQualityAPI = {
  // Get sentences pending MT quality assessment
  getPendingAssessments: async (skip = 0, limit = 50): Promise<Sentence[]> => {
    const response = await api.get(`/mt-quality/pending?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // Create MT quality assessment (AI-powered analysis)
  createAssessment: async (assessmentData: MTQualityCreate): Promise<MTQualityAssessment> => {
    const response = await api.post('/mt-quality/assess', assessmentData);
    return response.data;
  },

  // Update assessment with human feedback
  updateAssessment: async (id: number, updateData: MTQualityUpdate): Promise<MTQualityAssessment> => {
    const response = await api.put(`/mt-quality/${id}`, updateData);
    return response.data;
  },

  // Get evaluator's assessments
  getMyAssessments: async (skip = 0, limit = 100): Promise<MTQualityAssessment[]> => {
    const response = await api.get(`/mt-quality/my-assessments?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // Get evaluator statistics
  getEvaluatorStats: async (): Promise<EvaluatorStats> => {
    const response = await api.get('/mt-quality/stats');
    return response.data;
  },

  // Get all assessments (admin)
  getAllAssessments: async (skip = 0, limit = 100): Promise<MTQualityAssessment[]> => {
    const response = await api.get(`/admin/mt-quality?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // Get assessment details by sentence ID
  getAssessmentBySentence: async (sentenceId: number): Promise<MTQualityAssessment | null> => {
    try {
      const response = await api.get(`/mt-quality/sentence/${sentenceId}`);
      return response.data;
    } catch {
      return null;
    }
  },

  // Batch process sentences for quality assessment
  batchAssess: async (sentenceIds: number[]): Promise<MTQualityAssessment[]> => {
    const response = await api.post('/mt-quality/batch-assess', { sentence_ids: sentenceIds });
    return response.data;
  },
};

// Legacy Evaluations API (for backward compatibility)
export const evaluationsAPI = {
  createEvaluation: async (evaluationData: EvaluationCreate): Promise<Evaluation> => {
    const response = await api.post('/evaluations', evaluationData);
    return response.data;
  },

  updateEvaluation: async (id: number, evaluationData: EvaluationUpdate): Promise<Evaluation> => {
    const response = await api.put(`/evaluations/${id}`, evaluationData);
    return response.data;
  },

  getMyEvaluations: async (skip = 0, limit = 100): Promise<Evaluation[]> => {
    const response = await api.get(`/evaluations?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getPendingEvaluations: async (skip = 0, limit = 50): Promise<Annotation[]> => {
    const response = await api.get(`/evaluations/pending?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getEvaluatorStats: async (): Promise<EvaluatorStats> => {
    const response = await api.get('/evaluator/stats');
    return response.data;
  },

  getAllEvaluations: async (skip = 0, limit = 100): Promise<Evaluation[]> => {
    const response = await api.get(`/admin/evaluations?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getAnnotationEvaluations: async (annotationId: number): Promise<Evaluation[]> => {
    const response = await api.get(`/annotations/${annotationId}/evaluations`);
    return response.data;
  },
};

// Onboarding Test API
export const onboardingAPI = {
  createTest: async (language: string): Promise<OnboardingTest> => {
    const response = await api.post('/onboarding-tests', { language });
    return response.data;
  },

  submitTest: async (testId: number, answers: OnboardingTestAnswer[]): Promise<OnboardingTestResult> => {
    const response = await api.post(`/onboarding-tests/${testId}/submit`, {
      test_id: testId,
      answers
    });
    return response.data;
  },

  getMyTests: async (): Promise<OnboardingTest[]> => {
    const response = await api.get('/onboarding-tests/my-tests');
    return response.data;
  },

  getTest: async (testId: number): Promise<OnboardingTest> => {
    const response = await api.get(`/onboarding-tests/${testId}`);
    return response.data;
  },
};

// Language Proficiency Questions API
export const languageProficiencyAPI = {
  getQuestionsByLanguages: async (languages: string[]): Promise<LanguageProficiencyQuestion[]> => {
    // Capitalize language names to match database format
    const capitalizedLanguages = languages.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1));
    const languagesParam = capitalizedLanguages.join(',');
    const response = await api.get(`/language-proficiency-questions?languages=${encodeURIComponent(languagesParam)}`);
    return response.data;
  },

  submitAnswers: async (answers: UserQuestionAnswer[], sessionId: string, languages: string[]): Promise<OnboardingTestResult> => {
    // Capitalize language names to match database format
    const capitalizedLanguages = languages.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1));
    const response = await api.post('/language-proficiency-questions/submit', {
      test_session_id: sessionId,
      answers: answers.map(answer => ({
        question_id: answer.question_id,
        selected_answer: answer.selected_answer,
        test_session_id: sessionId
      })),
      languages: capitalizedLanguages
    });
    return response.data;
  },

  // Admin endpoints for managing questions
  getAllQuestions: async (): Promise<LanguageProficiencyQuestion[]> => {
    const response = await api.get('/admin/language-proficiency-questions');
    return response.data;
  },

  createQuestion: async (question: Omit<LanguageProficiencyQuestion, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<LanguageProficiencyQuestion> => {
    const response = await api.post('/admin/language-proficiency-questions', question);
    return response.data;
  },

  updateQuestion: async (id: number, question: Partial<LanguageProficiencyQuestion>): Promise<LanguageProficiencyQuestion> => {
    const response = await api.put(`/admin/language-proficiency-questions/${id}`, question);
    return response.data;
  },

  deleteQuestion: async (id: number): Promise<void> => {
    await api.delete(`/admin/language-proficiency-questions/${id}`);
  },
};

export default api;