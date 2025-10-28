import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createTranscriptionSession } from '../services/geminiService';
import type { Blob } from '@google/genai';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { StopIcon } from './icons/StopIcon';

interface AudioTranscriberProps {
  onTranscriptionUpdate: (text: string) => void;
  disabled?: boolean;
}

const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] < 0 ? data[i] * 32768 : data[i] * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const AudioTranscriber: React.FC<AudioTranscriberProps> = ({ onTranscriptionUpdate, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Speak topic');
  const sessionPromiseRef = useRef<ReturnType<typeof createTranscriptionSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const transcribedTextRef = useRef<string>('');

  const stopRecording = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setStatusMessage('Speak topic');
  }, []);
  
  const handleMessage = (text: string) => {
    transcribedTextRef.current += text;
    onTranscriptionUpdate(transcribedTextRef.current);
  };
  
  const handleError = (error: Error) => {
      setStatusMessage('Error. Please retry.');
      console.error(error);
      stopRecording();
  };

  const handleClose = () => {
      // This is called when the session is closed, either manually or by the server.
      // We don't need to call stopRecording() here again to avoid cycles.
      setIsRecording(false);
  };

  const startRecording = async () => {
    transcribedTextRef.current = '';
    onTranscriptionUpdate('');
    setIsRecording(true);
    setStatusMessage('Listening...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = context;

        const source = context.createMediaStreamSource(stream);
        const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = scriptProcessor;
        
        sessionPromiseRef.current = createTranscriptionSession({ onMessage: handleMessage, onError: handleError, onClose: handleClose });

        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            }
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(context.destination);
        
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
  
  useEffect(() => {
    return () => {
        // Cleanup on unmount
        stopRecording();
    };
  }, [stopRecording]);

  return (
    <div className="flex items-center">
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
    </div>
  );
};