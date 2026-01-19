import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from "react";
import { ChatLayout } from "../components/chat-layout";
import { CallModal } from "../components/call-modal";
import { useChat } from "../lib/chat-sdk";
import { useWebRTC } from "../lib/use-webrtc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatSidebar } from "../components/chat/sidebar";
import { ChatArea } from "../components/chat/chat-interface";
import { ContactProfile } from "../components/chat/contact-profile";

function Home() {
  const chatData = useChat();
  const { 
    activeContact, 
    sdk,
    callEvent,
    status
  } = chatData;

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Call States
  const [callState, setCallState] = useState<{
      isOpen: boolean;
      type: 'incoming' | 'outgoing' | 'active';
      callId?: string;
      remoteSdp?: string;
      contactName: string;
  }>({
      isOpen: false,
      type: 'incoming',
      contactName: '',
  });
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("init");
  const [lastError] = useState<string>("");
  const [iceState, setIceState] = useState<string>("");

  // Refs
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // WebRTC Hook
  const { createOffer, createAnswer, handleAnswer, cleanup: webrtcCleanup, toggleMute: webrtcToggleMute } = useWebRTC({
    onRemoteStream: (stream) => {
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch(console.error);
        }
    },
    onIceCandidate: () => {},
    onConnectionStateChange: (state) => setConnectionStatus(state),
    onIceConnectionStateChange: (state) => setIceState(state)
  });

  // Call duratings effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.type === 'active' && connectionStatus === 'connected') {
        interval = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    } else {
        if (callState.type !== 'active') setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState.type, connectionStatus]);

  // Handle Call Events from SDK
  useEffect(() => {
    if (!callEvent) return;
    const { type, data } = callEvent;

    if (type === 'call_answered') {
        if (data.sdp) handleAnswer(data.sdp);
    } else if (type === 'call_incoming') {
        setCallState({
            isOpen: true,
            type: 'incoming',
            contactName: data.fromName || data.from || 'Unknown',
            callId: data.id,
            remoteSdp: data.sdp || data.session?.sdp
        });
    } else if (type === 'call_ended') {
        endCallCleanup();
    } else if (type === 'call_created') {
        setCallState(prev => ({ ...prev, callId: data.callId }));
    }
  }, [callEvent]);

  // Fetch Notes/Starred on contact change
  useEffect(() => {
     if (activeContact) {
         sdk.getNotes(activeContact.id);
         sdk.getStarredMessages(activeContact.id);
     }
  }, [activeContact?.id]);

  const getDisplayName = (c: any) => c.customName || c.pushName || c.name || c.id;

  const startCall = async () => {
      if (!activeContact) return;
      const sdp = await createOffer();
      setCallState({ isOpen: true, type: 'outgoing', contactName: getDisplayName(activeContact) });
      sdk.startCall(activeContact.id, sdp);
  };

  const acceptCall = async () => {
      if (!callState.remoteSdp || !callState.callId) return;
      const sdp = await createAnswer(callState.remoteSdp);
      setCallState(prev => ({ ...prev, type: 'active' }));
      sdk.acceptCall(callState.callId, sdp);
  };

  const rejectCall = () => {
      if (callState.callId) sdk.rejectCall(callState.callId);
      endCallCleanup();
  };

  const endCallCleanup = () => {
      webrtcCleanup();
      setCallState(prev => ({ ...prev, isOpen: false }));
  };

  const toggleMute = () => {
      webrtcToggleMute(!isMuted);
      setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <ChatLayout 
        sidebar={<ChatSidebar chatData={chatData} onProfileOpen={() => setIsProfileOpen(true)} />} 
        activeChat={<ChatArea chatData={chatData} onProfileOpen={() => setIsProfileOpen(true)} onCallStart={startCall} />} 
        rightSidebar={isProfileOpen && activeContact ? <ContactProfile onClose={() => setIsProfileOpen(false)} chatData={chatData} /> : null} 
        isConnected={status === "Connected"} 
      />
      <audio ref={remoteAudioRef} className="fixed bottom-0 left-0 w-1 h-1 opacity-0 pointer-events-none" playsInline autoPlay />

      <CallModal 
          isOpen={callState.isOpen}
          type={callState.type}
          contactName={callState.contactName}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={rejectCall}
          isMuted={isMuted}
          toggleMute={toggleMute}
          duration={connectionStatus === 'connected' ? formatTime(callDuration) : connectionStatus}
      />

      {/* Connectivity Debugger */}
      {callState.isOpen && (
          <div className="fixed top-4 right-4 bg-black/80 text-white p-2 text-xs rounded z-50 max-w-xs font-mono border border-gray-700 shadow-xl">
              <div className="font-bold border-b border-gray-600 mb-1 pb-1">WebRTC Debugger</div>
              <div className={connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'}>Status: {connectionStatus}</div>
              <div>ICE State: {iceState}</div>
              {lastError && <div className="text-red-400 mt-1 border-t border-red-900 pt-1">{lastError}</div>}
              <div>Dur: {callDuration}s</div>
               <div className="mt-1 text-[10px] text-gray-400">
                   {iceState.includes('relay') && <span className="text-green-400">✅ Relay (TURN) Active</span>}
                   {!iceState.includes('srflx') && !iceState.includes('relay') && "⚠️ Critical: STUN/TURN Failed. Check Firewall."}
              </div>
          </div>
      )}
    </TooltipProvider>
  );
}

export const Route = createFileRoute('/')({
  component: Home,
});
