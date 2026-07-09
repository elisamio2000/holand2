'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type LiveCallType = 'voice' | 'video';
export type LiveCallStatus = 'idle' | 'connecting' | 'active' | 'ended';

export function useLiveCall() {
  const [isActive, setIsActive] = useState(false);
  const [callType, setCallType] = useState<LiveCallType>('voice');
  const [partnerName, setPartnerName] = useState<string | undefined>();
  const [status, setStatus] = useState<LiveCallStatus>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const endCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('ended');
    setIsActive(false);
    setDurationSec(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setPartnerName(undefined);
    setStatus('idle');
  }, []);

  const startCall = useCallback((type: LiveCallType, name?: string) => {
    setCallType(type);
    setPartnerName(name);
    setIsActive(true);
    setStatus('connecting');
    setDurationSec(0);
    setTimeout(() => setStatus('active'), 1200);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    isActive,
    callType,
    partnerName,
    status,
    durationSec,
    isMuted,
    isCameraOff,
    startCall,
    endCall,
    toggleMute: () => setIsMuted((v) => !v),
    toggleCamera: () => setIsCameraOff((v) => !v),
  };
}
