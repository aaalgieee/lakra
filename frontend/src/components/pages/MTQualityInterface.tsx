import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  Brain, 
  Star, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Save,
  User,
  FileText
} from 'lucide-react';
import { mtQualityAPI } from '../../services/supabase-api';
import type { Sentence, MTQualityAssessment, MTQualityCreate } from '../../types';

interface RatingButtonsProps {
  value?: number;
  onChange: (value: number) => void;
  label: string;
}

const RatingButtons: React.FC<RatingButtonsProps> = ({ value, onChange, label }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`w-10 h-10 rounded-full border-2 font-medium text-sm transition-all ${
              value === rating
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
};

const MTQualityInterface: React.FC = () => {
  const navigate = useNavigate();
  const { sentenceId } = useParams();
  
  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [assessment, setAssessment] = useState<MTQualityAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [startTime] = useState(new Date());
  
  // Human evaluation state
  const [humanFeedback, setHumanFeedback] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [evaluationScores, setEvaluationScores] = useState({
    fluency: undefined as number | undefined,
    adequacy: undefined as number | undefined,
    overall: undefined as number | undefined
  });

  const loadSentence = useCallback(async () => {
    if (!sentenceId) return;
    
    setIsLoading(true);
    try {
      // Get pending sentences and find the one we need
      const pendingSentences = await mtQualityAPI.getPendingAssessments(0, 100);
      const targetSentence = pendingSentences.find(s => s.id === parseInt(sentenceId));
      
      if (targetSentence) {
        setSentence(targetSentence);
        
        // Check if already assessed
        const existingAssessment = await mtQualityAPI.getAssessmentBySentence(targetSentence.id);
        if (existingAssessment) {
          setAssessment(existingAssessment);
          setHumanFeedback(existingAssessment.human_feedback || '');
          setCorrectionNotes(existingAssessment.correction_notes || '');
          setEvaluationScores({
            fluency: existingAssessment.fluency_score,
            adequacy: existingAssessment.adequacy_score,
            overall: existingAssessment.overall_quality_score
          });
        }
      } else {
        setMessage('Sentence not found or already assessed');
        navigate('/evaluator');
      }
    } catch (error) {
      console.error('Error loading sentence:', error);
      setMessage('Error loading sentence');
    } finally {
      setIsLoading(false);
    }
  }, [sentenceId, navigate]);

  const loadNextSentence = useCallback(async () => {
    setIsLoading(true);
    try {
      const pendingSentences = await mtQualityAPI.getPendingAssessments(0, 1);
      if (pendingSentences.length > 0) {
        const nextSentence = pendingSentences[0];
        setSentence(nextSentence);
        setAssessment(null);
        setHumanFeedback('');
        setCorrectionNotes('');
        setEvaluationScores({ fluency: undefined, adequacy: undefined, overall: undefined });
      } else {
        setMessage('No pending sentences to assess');
        navigate('/evaluator');
      }
    } catch (error) {
      console.error('Error loading next sentence:', error);
      setMessage('Error loading sentence');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (sentenceId) {
      loadSentence();
    } else {
      loadNextSentence();
    }
  }, [sentenceId, loadSentence, loadNextSentence]);

  const handleScoreChange = (field: keyof typeof evaluationScores, value: number) => {
    setEvaluationScores(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!sentence) return;

    // Validation
    if (!evaluationScores.fluency || !evaluationScores.adequacy || !evaluationScores.overall) {
      setMessage('Please provide all required scores before submitting');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      
      const assessmentData: MTQualityCreate = {
        sentence_id: sentence.id,
        fluency_score: evaluationScores.fluency,
        adequacy_score: evaluationScores.adequacy,
        overall_quality_score: evaluationScores.overall,
        human_feedback: humanFeedback || undefined,
        correction_notes: correctionNotes || undefined,
        time_spent_seconds: timeSpent
      };

      const result = await mtQualityAPI.createAssessment(assessmentData);
      setAssessment(result);
      setMessage('Evaluation submitted successfully! ✨');
      
      // Auto-navigate to next after delay
      setTimeout(() => {
        navigate('/evaluator');
      }, 2000);
      
    } catch (error) {
      console.error('Error creating assessment:', error);
      setMessage('Error creating assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAssessment = async () => {
    if (!assessment) return;

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      
      const updateData = {
        fluency_score: evaluationScores.fluency,
        adequacy_score: evaluationScores.adequacy,
        overall_quality_score: evaluationScores.overall,
        human_feedback: humanFeedback,
        correction_notes: correctionNotes,
        time_spent_seconds: (assessment.time_spent_seconds || 0) + timeSpent
      };

      const result = await mtQualityAPI.updateAssessment(assessment.id, updateData);
      setAssessment(result);
      setMessage('Evaluation updated successfully! ✨');
      
    } catch (error) {
      console.error('Error updating assessment:', error);
      setMessage('Error updating assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading MT Quality Evaluation...</p>
        </div>
      </div>
    );
  }

  if (!sentence) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No sentence to evaluate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/evaluator')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">MT Quality Evaluation</h1>
          </div>
          <p className="text-gray-600">
            Evaluate machine translation quality based on fluency, adequacy, and overall quality
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') || message.includes('Please')
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Translation Pair */}
          <div className="space-y-6">
            {/* Translation Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Translation Pair</h2>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {sentence.source_language} → {sentence.target_language}
                  </span>
                  {sentence.domain && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {sentence.domain}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Source Text ({sentence.source_language})</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-900 leading-relaxed">{sentence.source_text}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Machine Translation ({sentence.target_language})</h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-900 leading-relaxed">{sentence.machine_translation}</p>
                  </div>
                </div>

                {sentence.reference_translation && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Reference Translation (Optional)</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-gray-900 leading-relaxed">{sentence.reference_translation}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Evaluation Guidelines */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Evaluation Guidelines</h2>
              
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Fluency (1-5)</h3>
                  <p className="text-gray-600">How well-formed and readable is the translation? Consider grammar, syntax, and naturalness.</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Adequacy (1-5)</h3>
                  <p className="text-gray-600">How well does the translation preserve the meaning of the source text?</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Overall Quality (1-5)</h3>
                  <p className="text-gray-600">Combined assessment considering both fluency and adequacy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Evaluation Form */}
          <div className="space-y-6">
            {/* Quality Scores */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Quality Scores</h2>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  {assessment?.time_spent_seconds ? `${assessment.time_spent_seconds}s` : 'Starting...'}
                </div>
              </div>

              <div className="space-y-6">
                <RatingButtons
                  value={evaluationScores.fluency}
                  onChange={(value) => handleScoreChange('fluency', value)}
                  label="Fluency Score"
                />
                
                <RatingButtons
                  value={evaluationScores.adequacy}
                  onChange={(value) => handleScoreChange('adequacy', value)}
                  label="Adequacy Score"
                />
                
                <RatingButtons
                  value={evaluationScores.overall}
                  onChange={(value) => handleScoreChange('overall', value)}
                  label="Overall Quality Score"
                />
              </div>
            </div>

            {/* Feedback Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Feedback & Corrections</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    General Feedback
                  </label>
                  <textarea
                    value={humanFeedback}
                    onChange={(e) => setHumanFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Share your thoughts on the translation quality..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correction Notes
                  </label>
                  <textarea
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Suggest specific corrections or improvements..."
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {assessment ? (
                <button
                  onClick={handleUpdateAssessment}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Evaluation
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Submit Evaluation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MTQualityInterface;
