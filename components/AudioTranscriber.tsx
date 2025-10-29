import React, { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { StopIcon } from './icons/StopIcon';

interface AudioTranscriberProps {
  onTranscriptionUpdate: (text: string) => void;
  disabled?: boolean;
}

export const AudioTranscriber: React.FC<AudioTranscriberProps> = ({ onTranscriptionUpdate, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // The transcription logic will be handled in the 'onstop' event listener
    }
    setIsRecording(false);
  }, []);

  const startRecording = async () => {
    onTranscriptionUpdate(''); // Clear previous transcription
    setStatusMessage('Listening...');
    setIsRecording(true);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setStatusMessage('Transcribing...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const transcription = await transcribeAudio(audioBlob);
          onTranscriptionUpdate(transcription);
          setStatusMessage(null); // Clear message on success
        } catch (error) {
          console.error('Transcription failed:', error);
          setStatusMessage('Transcription failed. Retry.');
        } finally {
            // Clean up the stream tracks
            stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      setStatusMessage('Mic access denied');
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        className={`p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 ${
          isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {isRecording ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
      </button>
      {statusMessage && <span className="text-sm text-gray-500">{statusMessage}</span>}
    </div>
  );
};
