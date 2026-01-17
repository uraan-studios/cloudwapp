import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/eden-client";
import { ChatLayout } from "../components/chat-layout";
import { MessageBubble } from "../components/message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchBar } from "../components/sidebar/search-bar";
import { TabsList } from "../components/sidebar/tabs-list";
import { CallModal } from "../components/call-modal";
// Context Menu
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Paperclip, Image as ImageIcon, FileText, Mic, Phone, Video } from "lucide-react";

export const Route = createFileRoute('/')({
  component: Home,
})

// Types matching backend storage
interface Message {
  id: string;
  from: string;
  to: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "unknown";
  content: string;
  timestamp: number;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "incoming" | "outgoing";
  reactions?: Record<string, string>;
  context?: { message_id: string };
}

interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  customName?: string;
  isFavorite?: boolean;
  lastMessage?: Message;
  lastUserMsgTimestamp?: number;
}

function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const activeContactRef = useRef<Contact | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);
  
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Pagination State
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  
  // Rename Dialog State
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Search & Tabs State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const chatRef = useRef<ReturnType<typeof api.chat.subscribe>>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);

  const [attachmentDrafts, setAttachmentDrafts] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'document', caption: string }[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);

  // Template State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [buttonParams, setButtonParams] = useState<Record<number, string>>({});
  const [headerMedia, setHeaderMedia] = useState<{ file: File | null, id: string | null, type: string | null, preview: string | null }>({ file: null, id: null, type: null, preview: null });
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [isInteractiveDrawerOpen, setIsInteractiveDrawerOpen] = useState(false);
  const [interactiveDraft, setInteractiveDraft] = useState<{ body: string, footer: string, buttons: string[], header: string }>({ 
      body: "", 
      footer: "", 
      buttons: ["", ""],
      header: ""
  });

  // 24h Window Check
  const isWindowOpen = activeContact ? (Date.now() - (activeContact.lastUserMsgTimestamp || 0) < 24 * 60 * 60 * 1000) : true;

  // Call State
  const [callState, setCallState] = useState<{
      isOpen: boolean;
      type: 'incoming' | 'outgoing' | 'active';
      callId?: string;
      remoteSdp?: string;
      contactName: string;
      stream?: MediaStream;
  }>({
      isOpen: false,
      type: 'incoming',
      contactName: '',
  });
  const [isMuted, setIsMuted] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef(callState);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const scrollToMessage = (id: string) => {
      console.log(`[Chat] Scrolling to message: ${id}`);
      const element = document.getElementById(`msg-${id}`);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(id);
          setTimeout(() => setHighlightedMessageId(null), 2500);
      } else {
          console.warn(`[Chat] Message element msg-${id} not found in DOM`);
      }
  };
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("init");
  const [lastError, setLastError] = useState<string>("");
  const [iceState, setIceState] = useState<string>("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.type === 'active' && connectionStatus === 'connected') {
        interval = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    } else {
        // Don't reset duration on brief disconnects, only on end? 
        // For now keep behavior but only count when connected
        if (callState.type !== 'active') setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState.type, connectionStatus]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Attachment Handlers
  const handleAttachmentClick = (type: 'image' | 'document') => {
      if (fileInputRef.current) {
          const images = "image/jpeg,image/png,image/webp";
          const videos = "video/mp4,video/3gpp";
          fileInputRef.current.accept = type === 'image' ? `${images},${videos}` : "*/*";
          fileInputRef.current.multiple = true;
          fileInputRef.current.click();
      }
      setIsAttachmentOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const newDrafts = files.map(file => {
          let type: 'image' | 'video' | 'audio' | 'document' = "document";
          if (file.type.startsWith("image/")) type = "image";
          else if (file.type.startsWith("video/")) type = "video";
          else if (file.type.startsWith("audio/")) type = "audio";

          return {
              file,
              preview: URL.createObjectURL(file),
              type,
              caption: ""
          };
      });

      setAttachmentDrafts(prev => [...prev, ...newDrafts]);
      e.target.value = "";
  };

  const removeDraft = (index: number) => {
      setAttachmentDrafts(prev => {
          const next = [...prev];
          next.splice(index, 1);
          return next;
      });
      if (currentDraftIndex >= index && currentDraftIndex > 0) {
          setCurrentDraftIndex(currentDraftIndex - 1);
      }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
    } catch (e) {
        console.error("Error starting recording:", e);
        alert("Could not access microphone.");
    }
  };

  const stopAndSendRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
              const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
              
              const formData = new FormData();
              formData.append("file", audioFile);

              try {
                  const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                  if (res.ok) {
                      const data = await res.json();
                      chatRef.current?.send({
                          type: "audio",
                          to: activeContact!.id,
                          id: data.id,
                          caption: "",
                          fileName: "voice_note.ogg",
                          isVoiceNote: true
                      });
                  }
              } catch (e) { console.error(e); }
              
              mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const cancelRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
      }
  };

  // Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
        interval = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);
  
  const updateCaption = (text: string) => {
      setAttachmentDrafts(prev => prev.map((d, i) => i === currentDraftIndex ? { ...d, caption: text } : d));
  };

  // Auto-scroll
  useEffect(() => {
    if (!isLoadingMore) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeContact, isLoadingMore]);

  // Initial Load when Contact Changes
  useEffect(() => {
    if (activeContact && chatRef.current) {
        setMessages([]); 
        setHasMore(true); 
        setNextCursor(null);
        chatRef.current.send({ type: 'get_messages', contactId: activeContact.id, limit: 50 });
    }
  }, [activeContact?.id]);

  // Infinite Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget;
      if (scrollTop === 0 && hasMore && !isLoadingMore && activeContact && nextCursor) {
          setIsLoadingMore(true);
          console.log("Loading more messages before:", nextCursor);
          chatRef.current?.send({ 
              type: 'get_messages', 
              contactId: activeContact.id, 
              limit: 50, 
              beforeTimestamp: nextCursor 
          });
      }
  };

  // WebRTC Setup
  const setupWebRTC = async (isInitiator: boolean) => {
      console.log("Setting up WebRTC...");
      const pc = new RTCPeerConnection({
          iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              // Metered.ca - standard demo credentials
              {
                  urls: [
                      'turn:standard.relay.metered.ca:80',
                      'turn:standard.relay.metered.ca:80?transport=tcp',
                      'turn:standard.relay.metered.ca:443',
                      'turns:standard.relay.metered.ca:443'
                  ],
                  username: '83eebabf8b4cce9d5dbcb66a',
                  credential: '2D7JvfkOQtBdYW3R'
              }
          ]
      });
      peerConnectionRef.current = pc;
      
      // Log the remote ICE candidates from Meta for debugging
      pc.onicecandidate = (e) => {
          if (e.candidate) {
              console.log("📤 Local ICE Candidate:", e.candidate.candidate);
          }
      };

      pc.oniceconnectionstatechange = () => {
          console.log("ICE Connection State:", pc.iceConnectionState);
      };
      pc.onconnectionstatechange = () => {
          console.log("Connection State:", pc.connectionState);
      };

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = stream;
          console.log("✅ Microphone access granted");
          stream.getTracks().forEach(track => {
              console.log(`Add Track: kind=${track.kind}, enabled=${track.enabled}, label=${track.label}, id=${track.id}, readyState=${track.readyState}`);
              pc.addTrack(track, stream);
          });
      } catch (e) {
          console.error("❌ Error accessing mic:", e);
          alert("Could not access microphone");
          return null;
      }
      
      pc.onicecandidateerror = (event: any) => {
          console.error("❌ ICE Candidate Error:", event.url, event.errorCode, event.errorText);
          setLastError(`ICE Error: ${event.errorText} (${event.errorCode})`);
      };
      
      pc.oniceconnectionstatechange = () => {
          console.log("🔄 ICE Connection State Change:", pc.iceConnectionState);
          setConnectionStatus(pc.iceConnectionState);
          setIceState(pc.iceConnectionState);
          
          if (pc.iceConnectionState === 'connected') {
              console.log("✅ ICE Connected! Media should flow.");
              // Optional: Get stats
              pc.getStats().then(stats => {
                  stats.forEach(report => {
                      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                          console.log("📊 Outbound RTP Stats:", report);
                      }
                  });
              });
          }
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
              console.error("❌ ICE Connection Failed/Disconnected");
          }
      };

      pc.ontrack = (event) => {
          console.log("Received remote track");
          if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = event.streams[0];
              remoteAudioRef.current.play().catch(e => console.error("Auto-play failed", e));
          }
      };

      return pc;
  };

  const getDisplayName = (c: Contact) => c.customName || c.pushName || c.name || c.id;

  const formatSDP = (sdp: string) => {
      if (!sdp) return "";
      // Just normalize line endings to CRLF - JSON.parse already handles escape sequences
      return sdp.split(/\r?\n/).join('\r\n');
  };

  const sanitizeSDP = (sdp: string) => {
      return sdp.split(/\r?\n/)
          .filter(line => {
             // Remove TCP candidates as Meta only supports UDP
             // if (line.includes('a=candidate') && line.toLowerCase().includes('tcp')) return false;
             return true;
          })
          .join('\r\n');
  };

  const waitForIceGathering = (pc: RTCPeerConnection) => {
      const candidates = new Set<string>();
      
      pc.onicecandidate = (e) => {
          if (e.candidate && e.candidate.type) {
              candidates.add(e.candidate.type); // host, srflx, relay
              setIceState(prev => {
                  // Avoid parsing spam, just show types
                  const types = Array.from(candidates).join(', ');
                  return `Gathering: ${types}`;
              });
          }
      };

      return new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') {
              resolve();
              return;
          }
          const checkState = () => {
              if (pc.iceGatheringState === 'complete') {
                  pc.removeEventListener('icegatheringstatechange', checkState);
                  resolve();
              }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          // Fallback timeout in case gathering takes too long
          setTimeout(() => {
             console.log("ICE Gathering timed out (5s), proceeding with collected candidates");
             resolve();
          }, 5000); 
      });
  };

  const startCall = async () => {
      if (!activeContact) return;
      const pc = await setupWebRTC(true);
      if (!pc) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE candidates to be gathered
      await waitForIceGathering(pc);
      
      // Use result sdp from localDescription which contains candidates
      const finalSdp = pc.localDescription?.sdp || "";
      const sanitizedSDP = sanitizeSDP(finalSdp);
      
      console.log("Original SDP length:", finalSdp.length);
      console.log("Sanitized SDP length:", sanitizedSDP.length);

      setCallState({
          isOpen: true,
          type: 'outgoing',
          contactName: getDisplayName(activeContact),
      });

      chatRef.current?.send({ 
          type: 'call_start', 
          to: activeContact.id, 
          sdp: sanitizedSDP
      });
  };

  const acceptCall = async () => {
      if (!callState.remoteSdp || !callState.callId) return;

      const pc = await setupWebRTC(false);
      if (!pc) return;

      // Meta sends offer, we set it as remote
      const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp: callState.remoteSdp });
      await pc.setRemoteDescription(remoteDesc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE candidates
      await waitForIceGathering(pc);

      const finalSdp = pc.localDescription?.sdp || "";
      const sanitizedSDP = sanitizeSDP(finalSdp);

      setCallState(prev => ({ ...prev, type: 'active' }));

      chatRef.current?.send({ 
          type: 'call_accept', 
          callId: callState.callId, 
          sdp: sanitizedSDP
      });
      console.log("Accepted call with SDP:", sanitizedSDP);
  };

  const rejectCall = () => {
      if (callState.callId) {
          chatRef.current?.send({ type: 'call_reject', callId: callState.callId });
      }
      endCallCleanup();
  };

  const endCall = () => {
      rejectCall();
  };

  const endCallCleanup = () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnectionRef.current?.close();
      setCallState(prev => ({ ...prev, isOpen: false }));
  };

  const toggleMute = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !track.enabled;
          });
          setIsMuted(!isMuted);
      }
  };

  useEffect(() => {
    const chat = api.chat.subscribe();
    chatRef.current = chat;

    chat.subscribe((response: any) => {
      let parsed: any = {};
      
      try {
          // Handle Raw MessageEvent from WebSocket
          if (response && response.data && typeof response.data === 'string') {
               parsed = JSON.parse(response.data);
          } 
          // Handle potentially pre-parsed response (fallback)
          else if (response && response.data) {
               parsed = response.data;
          }
          else {
               parsed = response;
          }
      } catch (e) {
          console.error("WS Parse Error:", e);
          return;
      }

      console.log("WS Parsed:", parsed);
      
      const type = parsed.type;
      const data = parsed.data || parsed; // Unified data access

      if (type === "contacts") {
        setContacts(data.data || data); 
      } else if (type === "messages_loaded") {
          const { contactId, data: loadedMsgs, nextCursor: newCursor } = parsed;
          const currentContact = activeContactRef.current;
          if (currentContact && contactId === currentContact.id) {
              setMessages(prev => {
                  const merged = [...prev, ...loadedMsgs]; 
                  const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());
                  return unique.sort((a,b) => a.timestamp - b.timestamp);
              });
              setNextCursor(newCursor);
              setHasMore(!!newCursor);
              setIsLoadingMore(false);
          }
      } else if (type === "message") {
        const msg = data.data || data; 
        const currentContact = activeContactRef.current;
        if (currentContact && (msg.from === currentContact.id || msg.to === currentContact.id)) {
             setMessages((prev) => {
                if(prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg].sort((a,b) => a.timestamp - b.timestamp);
            });
        }
        
        setContacts(prev => {
            const list = [...prev];
            const contactId = msg.direction === 'incoming' ? msg.from : msg.to;
            const idx = list.findIndex(c => c.id === contactId);
            
            let updatedContact: Contact;
            if(idx >= 0) {
                updatedContact = { 
                    ...list[idx], 
                    lastMessage: msg,
                    lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : list[idx].lastUserMsgTimestamp
                };
                list.splice(idx, 1);
                list.unshift(updatedContact);
            } else {
                updatedContact = { 
                    id: contactId, 
                    lastMessage: msg,
                    lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : 0
                };
                list.unshift(updatedContact);
            }

            // Sync active contact if it matches
            if (activeContactRef.current?.id === contactId) {
                setActiveContact(updatedContact);
            }

            return list;
        });

      } else if (type === "error") {
          console.error("Backend Error:", data.message);
          alert(data.message || "An error occurred");
      } else if (type === "reaction") {
          const { messageId, from, emoji } = data || response;
          setMessages(prev => prev.map(m => {
              if (m.id === messageId) {
                  return { ...m, reactions: { ...m.reactions, [from]: emoji } };
              }
              return m;
          }));
      } else if (type === "status") {
          const { id, status } = data || response;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      } else if (type === "id_update") {
          const { oldId, newId } = data || response;
          setMessages(prev => prev.map(m => {
              let updated = m.id === oldId ? { ...m, id: newId } : m;
              if (updated.context?.message_id === oldId) {
                  updated = { ...updated, context: { ...updated.context, message_id: newId } };
              }
              return updated;
          }));
      } else if (type === "contact_update") {
          const { id, customName } = data || data.data || response.data;
          setContacts(prev => prev.map(c => c.id === id ? { ...c, customName } : c));
          if (activeContactRef.current?.id === id) {
              setActiveContact(prev => prev ? { ...prev, customName } : prev);
          }
      } 
      // Call Events
      else if (type === 'call_answered') {
          console.log("🔔 CALL_ANSWERED EVENT RECEIVED");
          console.log("Full parsed object:", JSON.stringify(parsed, null, 2));
          console.log("Data object:", JSON.stringify(data, null, 2));
          
          // Handshake for outgoing call
          const payload = data?.data || data;
          console.log("Extracted payload:", JSON.stringify(payload, null, 2));
          
          const { callId, sdp } = payload;
          console.log("Extracted values - callId:", callId, "sdp length:", sdp?.length);
          
          console.log("Current state - peerConnection exists:", !!peerConnectionRef.current);
          console.log("Current state - callState.callId:", callStateRef.current.callId);
          console.log("Current state - callState.type:", callStateRef.current.type);
          
          // Accept answer if:
          // 1. We have a peer connection AND
          // 2. Either callIds match OR we're in outgoing state (race condition - callId not arrived yet)
          const shouldProcess = peerConnectionRef.current && 
                               (callStateRef.current.callId === callId || 
                                callStateRef.current.type === 'outgoing');
          
          console.log("Should process:", shouldProcess);
          
          if (shouldProcess) {
              // Update callId if we don't have it yet (race condition fix)
              if (!callStateRef.current.callId && callId) {
                  console.log("📌 Storing callId from answer (race condition):", callId);
                  setCallState(prev => ({ ...prev, callId }));
              }
              
              const formattedSdp = formatSDP(sdp);
              
              console.log("✅ Processing handshake answer for outgoing call", { 
                  callId, 
                  originalSdpLength: sdp?.length, 
                  formattedSdpLength: formattedSdp.length,
                  snippet: formattedSdp.substring(0, 100)
              });

              if (formattedSdp && formattedSdp.length > 10) {
                  try {
                      // Validate it starts with v=
                      if (!formattedSdp.trim().startsWith('v=')) {
                           console.error("❌ Invalid SDP: Does not start with v=", formattedSdp.substring(0, 100));
                           return;
                      }
                      
                      console.log("Creating RTCSessionDescription with type: 'answer'");
                      const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp: formattedSdp });
                      console.log("Calling setRemoteDescription...");
                      
                      if (peerConnectionRef.current) {
                          peerConnectionRef.current.setRemoteDescription(remoteDesc)
                              .then(() => {
                                  console.log("✅ setRemoteDescription SUCCESS - call is now connecting");
                                  // Don't set to 'active' yet - wait for actual audio connection
                              })
                              .catch(e => {
                                  console.error("❌ Error in setRemoteDescription:", e);
                                  console.error("Error details:", e.message, e.name);
                              });
                      }
                  } catch(e) {
                      console.error("❌ DOMException creating RTCSessionDescription:", e);
                  }
              } else {
                  console.error("❌ Received call_answered but SDP is missing or too short", { payload, formattedSdpLength: formattedSdp.length });
              }
          } else {
              console.error("❌ Conditions not met for processing answer:");
              if (!peerConnectionRef.current) console.error("  - No peer connection");
              if (callStateRef.current.callId !== callId && callStateRef.current.type !== 'outgoing') {
                  console.error("  - CallId mismatch AND not in outgoing state");
                  console.error("    Current callId:", callStateRef.current.callId);
                  console.error("    Received callId:", callId);
                  console.error("    Current type:", callStateRef.current.type);
              }
          }
      }
      else if (type === 'call_incoming') {
          const callData = data.data || data || response.data;
          setCallState({
              isOpen: true,
              type: 'incoming',
              contactName: callData.fromName || callData.from || 'Unknown',
              callId: callData.id,
              remoteSdp: callData.sdp || callData.session?.sdp
          });
      }
      else if (type === 'call_ended') {
          console.log("Call ended by remote");
          endCallCleanup();
      }
      else if (type === 'call_created') {
          const { callId } = data || response;
          setCallState(prev => ({ ...prev, callId }));
      }
    });

    chat.on("open", () => {
      setStatus("Connected");
    });

    chat.on("close", () => {
      setStatus("Disconnected");
    });

    return () => {
      chat.close();
      chatRef.current = null;
    };
  }, []);
  
  // Filter messages for active chat
  const activeMessages = messages.filter(
      m => (activeContact && (m.from === activeContact.id || m.to === activeContact.id))
  );
  
  // Filter Contacts based on Search and Tabs
  const filteredContacts = contacts.filter(c => {
      // 1. Search Filter
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const name = getDisplayName(c).toLowerCase();
          const num = c.id.toLowerCase();
          if (!name.includes(q) && !num.includes(q)) return false;
      }

      // 2. Tab Filter
      if (activeTab === 'all') return true;
      if (activeTab === 'favs') return c.isFavorite;
      
      return true;
  });

  // Read Receipts Logic
  useEffect(() => {
      if (!activeContact || !chatRef.current) return;
      
      const unread = activeMessages.filter(m => m.direction === 'incoming' && m.status !== 'read');
      if (unread.length > 0) {
          unread.forEach(m => {
              chatRef.current?.send({ type: "read", messageId: m.id });
          });
          setMessages(prev => prev.map(m => 
            (m.direction === 'incoming' && m.from === activeContact.id && m.status !== 'read') 
            ? { ...m, status: 'read' } 
            : m
          ));
      }
  }, [activeMessages.length, activeContact?.id]);

  // Typing Indicator Logic
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputText(val);

      // Slash Command Shortcuts
      if (val === "/buttons" || val === "/quick") {
          setIsInteractiveDrawerOpen(true);
          setInputText("");
          return;
      }
      if (val === "/template" || val === "/temp") {
          openTemplateModal();
          setInputText("");
          return;
      }
      
      if (!activeContact) return;

      if (!isTyping) {
          setIsTyping(true);
          chatRef.current?.send({ type: "typing", to: activeContact.id, state: true });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          chatRef.current?.send({ type: "typing", to: activeContact.id, state: false });
      }, 2000);
  };

  const sendMessage = async () => {
    if (attachmentDrafts.length > 0) {
        for (const draft of attachmentDrafts) {
             if (!activeContact) continue;
             
             const formData = new FormData();
             formData.append("file", draft.file);

             try {
                const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                if (res.ok) {
                    const data = await res.json();
                    chatRef.current?.send({
                        type: draft.type,
                        to: activeContact.id,
                        id: data.id,
                        caption: draft.caption || "", 
                        fileName: draft.file.name
                    });
                }
             } catch(e) { console.error(e); }
        }
        setAttachmentDrafts([]);
        return;
    }

    if (!inputText.trim() || !activeContact) return;

    chatRef.current?.send({
      type: "text",
      to: activeContact.id,
      content: inputText,
      context: replyingTo ? { message_id: replyingTo.id } : undefined
    });
    
    setInputText("");
    setReplyingTo(null);
  };

  const handleCaptionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleReply = (msg: Message) => {
      setReplyingTo(msg);
  };

  const handleReact = (id: string, emoji: string) => {
      if(!activeContact) return;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions: { ...m.reactions, "me": emoji } } : m));
      chatRef.current?.send({ type: "reaction", to: activeContact.id, messageId: id, emoji });
  };

  const handleRenameClick = () => {
    if (!activeContact) return;
    const currentName = activeContact.customName || activeContact.pushName || activeContact.name || activeContact.id;
    setRenameValue(currentName);
    setIsRenameOpen(true);
  };

  const submitRename = () => {
    if (!activeContact) return;
    if (renameValue && renameValue !== (activeContact.customName || activeContact.pushName || activeContact.name || activeContact.id)) {
        const updated = { ...activeContact, customName: renameValue };
        setActiveContact(updated);
        setContacts(prev => prev.map(c => c.id === activeContact.id ? updated : c));
        
        chatRef.current?.send({ type: 'update_contact', contactId: activeContact.id, name: renameValue });
    }
    setIsRenameOpen(false);
  };
  
  const toggleFavorite = (c: Contact) => {
      setContacts(prev => prev.map(con => con.id === c.id ? { ...con, isFavorite: !con.isFavorite } : con));
      chatRef.current?.send({ type: 'toggle_favorite', contactId: c.id });
  };

  const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
          const res = await fetch("http://localhost:3000/templates");
          const data = await res.json();
          if (Array.isArray(data)) {
              setTemplates(data);
          }
      } catch (e) {
          console.error("Failed to fetch templates:", e);
      } finally {
          setIsLoadingTemplates(false);
      }
  };

  const openTemplateModal = () => {
      setIsTemplateModalOpen(true);
      if (templates.length === 0) fetchTemplates();
  };

  const handleSendTemplate = () => {
      if (!activeContact || !selectedTemplate) return;
      
      const components = [];

      // 1. Header
      if (headerMedia.id) {
          components.push({
              type: "header",
              parameters: [{
                  type: headerMedia.type?.toLowerCase(),
                  [headerMedia.type?.toLowerCase() || 'image']: { id: headerMedia.id }
              }]
          });
      } else if (headerParams.length > 0) {
          components.push({
              type: "header",
              parameters: headerParams.map(p => ({ type: "text", text: p }))
          });
      }

      // 2. Body
      if (templateParams.length > 0) {
          components.push({
              type: "body",
              parameters: templateParams.map(p => ({ type: "text", text: p }))
          });
      }

      // 3. Buttons
      const buttonComps = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
      if (buttonComps) {
          buttonComps.buttons.forEach((btn: any, index: number) => {
              if (btn.type === 'URL' && btn.url.includes('{{1}}')) {
                  components.push({
                      type: "button",
                      sub_type: "url",
                      index: index,
                      parameters: [{ type: "text", text: buttonParams[index] || "" }]
                  });
              }
          });
      }

      chatRef.current?.send({
          type: "template",
          to: activeContact.id,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.languageCode || selectedTemplate.language || "en_US",
          components: components
      });
      
      setIsTemplateModalOpen(false);
      setSelectedTemplate(null);
      setTemplateParams([]);
      setHeaderParams([]);
      setButtonParams({});
      setHeaderMedia({ file: null, id: null, type: null, preview: null });
  };

  const handleSendInteractive = () => {
      if (!activeContact || !interactiveDraft.body) return;

      const buttons = interactiveDraft.buttons
          .filter(b => b.trim() !== "")
          .map((b, i) => ({
              type: "reply",
              reply: { id: `btn_${i}`, title: b.trim() }
          }));

      if (buttons.length === 0) return;

      const interactive: any = {
          type: "button",
          body: { text: interactiveDraft.body },
          action: { buttons }
      };

      if (interactiveDraft.header) interactive.header = { type: "text", text: interactiveDraft.header };
      if (interactiveDraft.footer) interactive.footer = { text: interactiveDraft.footer };

      chatRef.current?.send({
          type: "interactive",
          to: activeContact.id,
          interactive
      });

      setIsInteractiveDrawerOpen(false);
      setInteractiveDraft({ body: "", footer: "", buttons: ["", ""], header: "" });
  };

  const renderSidebar = (
      <div className="flex flex-col h-full">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <TabsList 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
          />
          <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filteredContacts.length === 0 && <div className="p-4 text-gray-400 text-sm">No chats found</div>}
              {filteredContacts.map(c => (
                  <ContextMenu key={c.id}>
                    <ContextMenuTrigger>
                      <div 
                        onClick={() => setActiveContact(c)}
                        className={`flex items-center p-3 cursor-pointer hover:bg-[#202c33] ${activeContact?.id === c.id ? 'bg-[#2a3942]' : ''}`}
                      >
                          <div className="w-10 h-10 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white text-xs relative">
                              {c.id.slice(-2)}
                              {c.isFavorite && <span className="absolute -top-1 -right-1 text-xs">⭐</span>}
                          </div>
                          <div className="flex-1 border-b border-[#202c33] pb-3">
                              <div className="flex justify-between items-baseline">
                                  <span className="text-[#e9edef] text-base">{getDisplayName(c)}</span>
                                  <span className="text-[#8696a0] text-xs">
                                      {c.lastMessage && new Date(c.lastMessage.timestamp).toLocaleDateString()}
                                  </span>
                              </div>
                              <div className="text-[#8696a0] text-sm truncate">
                                  {c.lastMessage?.type === 'text' ? c.lastMessage.content : <i>{c.lastMessage?.type}</i>}
                              </div>
                          </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-[#202c33] border-gray-700 text-white">
                        <ContextMenuItem onClick={() => toggleFavorite(c)} className="hover:bg-[#2a3942]">
                            {c.isFavorite ? "Unfavorite" : "Favorite"}
                        </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
              ))}
          </div>
      </div>
  );

  const renderChat = activeContact ? (
      <div className="flex flex-col h-full relative">
        {/* Chat Header */}
        <div className="h-14 bg-[#202c33] flex items-center px-4 shrink-0 shadow-sm z-10 justify-between">
             <div className="flex items-center">
                 <div className="w-10 h-10 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white">
                     {activeContact.id.slice(-2)}
                 </div> 
                 <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                         <span className="text-[#e9edef] font-medium">{getDisplayName(activeContact)}</span>
                         <button onClick={handleRenameClick} className="text-gray-500 hover:text-white text-xs opacity-50 hover:opacity-100" title="Rename Contact">
                            ✎
                         </button>
                     </div>
                     <span className="text-[#8696a0] text-xs">{status}</span>
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <button onClick={startCall} className="text-[#8696a0] hover:text-[#e9edef]" title="Audio Call">
                     <Phone className="w-5 h-5" />
                 </button>
                 <button className="text-[#8696a0] hover:text-[#e9edef]" title="Video Call (Disabled)">
                     <Video className="w-5 h-5 opacity-50" />
                 </button>
             </div>
        </div>
        
        {/* Messages */}
        <div 
            className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:px-20 bg-[#0b141a]"
            onScroll={handleScroll}
        >
            {isLoadingMore && <div className="text-center text-xs text-gray-500 py-2">Loading more...</div>}
            {activeMessages.length === 0 && (
                <div className="text-center text-[#8696a0] mt-10 text-sm">
                    This is the start of your conversation with {activeContact.id}
                </div>
            )}
            {activeMessages.map(msg => (
                <MessageBubble 
                    key={msg.id} 
                    message={msg as any} 
                    onReply={handleReply}
                    onReact={handleReact}
                    onQuoteClick={scrollToMessage}
                    allMessages={activeMessages}
                    isHighlighted={highlightedMessageId === msg.id}
                />
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#202c33] min-h-[62px] flex flex-col px-4 py-2 gap-2 relative">
            {replyingTo && (
                <div className="bg-[#1d272d] p-2 rounded-t flex justify-between items-center border-l-4 border-teal-500">
                    <div className="flex flex-col text-sm">
                        <span className="text-teal-500 font-bold text-xs">{replyingTo.from === 'me' ? 'You' : activeContact.id}</span>
                        <span className="text-[#8696a0] truncate max-w-xs">{replyingTo.content}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
            )}
            
            {/* Media Editor Overlay */}
            {attachmentDrafts.length > 0 && attachmentDrafts[currentDraftIndex] && (
                <div className="fixed top-0 bottom-0 right-0 left-[400px] z-50 bg-[#0b141a] flex flex-col animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-4 bg-[#202c33] shrink-0">
                        <button onClick={() => setAttachmentDrafts([])} className="text-[#e9edef] hover:bg-[#374248] p-2 rounded-full">✕</button>
                        <span className="text-[#e9edef] font-medium truncate">{attachmentDrafts[currentDraftIndex].file.name}</span>
                        <div className="w-8"></div> {/* Spacer */}
                    </div>
    
                    {/* Main Preview */}
                    <div className="flex-1 min-h-0 flex items-center justify-center p-8 bg-[#0b141a] relative overflow-hidden">
                        {attachmentDrafts[currentDraftIndex].type === 'image' ? (
                            <img src={attachmentDrafts[currentDraftIndex].preview} className="max-w-full max-h-full object-contain shadow-lg" />
                        ) : attachmentDrafts[currentDraftIndex].type === 'video' ? (
                            <video src={attachmentDrafts[currentDraftIndex].preview} controls className="max-w-full max-h-full object-contain shadow-lg" />
                        ) : (
                             <div className="flex flex-col items-center gap-4 text-gray-400">
                                 <FileText className="w-24 h-24" />
                                 <span>No preview available</span>
                                 <span className="text-sm">{attachmentDrafts[currentDraftIndex].file.size} bytes</span>
                             </div>
                        )}
                    </div>
    
                    {/* Caption Bar */}
                    <div className="bg-[#202c33] p-2 flex justify-center shrink-0">
                        <input 
                            value={attachmentDrafts[currentDraftIndex].caption}
                            onChange={(e) => updateCaption(e.target.value)}
                            onKeyDown={handleCaptionKeyPress}
                            placeholder="Type a caption"
                            className="bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 w-full max-w-2xl text-center focus:outline-none placeholder-[#8696a0]"
                            autoFocus
                        />
                    </div>
    
                    {/* Thumbnails & Send */}
                    <div className="h-24 bg-[#202c33] border-t border-gray-700 flex items-center px-4 gap-2 shrink-0 overflow-x-auto pb-4 pt-2 justify-center relative">
                        {/* Add More Button */}
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded border border-gray-600 flex items-center justify-center hover:bg-[#374248] shrink-0"
                         >
                            <span className="text-2xl text-gray-400">+</span>
                         </button>
    
                         {/* Thumbs */}
                         {attachmentDrafts.map((draft, i) => (
                             <div 
                                key={i} 
                                onClick={() => setCurrentDraftIndex(i)}
                                className={`w-12 h-12 rounded overflow-hidden cursor-pointer relative shrink-0 ${currentDraftIndex === i ? 'ring-2 ring-teal-500' : 'opacity-70 hover:opacity-100'}`}
                             >
                                 {draft.type === 'image' ? (
                                     <img src={draft.preview} className="w-full h-full object-cover" />
                                 ) : draft.type === 'video' ? (
                                    <video src={draft.preview} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center"><FileText className="w-6 h-6 text-white"/></div>
                                 )}
                             </div>
                         ))}
    
                        <div className="absolute right-4 bottom-4">
                             <button 
                                onClick={sendMessage}
                                className="bg-teal-500 hover:bg-teal-600 text-white rounded-full p-3 shadow-lg"
                            >
                                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Attachment Menu */}
            {isAttachmentOpen && (
                <div className="absolute bottom-16 left-4 bg-[#233138] rounded-lg shadow-lg py-2 flex flex-col gap-1 w-40 animate-in fade-in slide-in-from-bottom-2 z-20">
                    <button 
                        onClick={() => handleAttachmentClick('image')}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#182229] text-[#e9edef] text-sm"
                    >
                        <ImageIcon className="w-5 h-5 text-purple-500" />
                        <span>Photos & Videos</span>
                    </button>
                    <button 
                        onClick={() => handleAttachmentClick('document')}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#182229] text-[#e9edef] text-sm"
                    >
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <span>Document</span>
                    </button>
                    <button 
                        onClick={() => { setIsInteractiveDrawerOpen(true); setIsAttachmentOpen(false); }}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#182229] text-[#e9edef] text-sm"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-orange-500"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"></path></svg>
                        <span>Quick Buttons</span>
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 w-full">
                <button 
                    onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                    className={`p-2 rounded-full transition-colors ${isAttachmentOpen ? "bg-[#2a3942] text-[#e9edef]" : "text-[#8696a0] hover:text-[#e9edef]"}`}
                    title="Attach"
                >
                    <Paperclip className="w-6 h-6 rotate-45" />
                </button>

                <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />
                
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 bg-[#2a3942] rounded-lg px-4 py-2 animate-in fade-in">
                        <span className="text-red-500 animate-pulse">● Rec</span>
                        <span className="text-[#e9edef] flex-1 text-center">
                            {formatTime(recordingDuration)}
                        </span>
                        <button onClick={cancelRecording} className="text-red-400 hover:text-red-300">
                             ✕
                        </button>
                        <button onClick={stopAndSendRecording} className="text-green-400 hover:text-green-300">
                             <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                        </button>
                    </div>
                ) : !isWindowOpen ? (
                    <div className="flex-1 flex items-center justify-between gap-4 bg-[#1f2428] rounded-lg px-4 py-2 border border-yellow-600/30">
                        <span className="text-yellow-500 text-xs flex items-center gap-2">
                            ⚠️ 24h Window Closed
                        </span>
                        <button 
                            onClick={openTemplateModal}
                            className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded shadow transition-colors font-medium"
                        >
                            Send Template
                        </button>
                    </div>
                ) : (
                    <>
                        <input 
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder="Type a message"
                            className="flex-1 bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 text-sm focus:outline-none placeholder-[#8696a0]"
                        />
                        {inputText.trim() ? (
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => {
                                        setInteractiveDraft(prev => ({ ...prev, body: inputText }));
                                        setIsInteractiveDrawerOpen(true);
                                    }}
                                    className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-all border border-orange-500/20"
                                    title="Add interactive buttons to this message"
                                >
                                    + Buttons
                                </button>
                                <button 
                                    onClick={sendMessage}
                                    className="p-2 rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors"
                                >
                                    <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><title>send</title><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={startRecording}
                                className="p-2 rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors"
                            >
                                <Mic className="w-6 h-6" />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
        {/* Template Drawer inside Chat */}
        <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ease-in-out border-t border-[#2a3942] shadow-2xl flex flex-col ${isTemplateModalOpen ? "h-[500px]" : "h-0"}`}>
        {isTemplateModalOpen && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                {/* Drawer Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33] shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedTemplate && (
                            <button 
                                onClick={() => { setSelectedTemplate(null); setTemplateParams([]); }}
                                className="mr-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                        )}
                        <span className="font-medium text-[#e9edef]">{selectedTemplate ? selectedTemplate.name : "Select Template"}</span>
                    </div>
                    <button 
                        onClick={() => { setIsTemplateModalOpen(false); setSelectedTemplate(null); }}
                        className="p-2 hover:bg-[#374248] rounded-full text-gray-400 transition-colors"
                    >
                         <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {!selectedTemplate ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             {isLoadingTemplates ? (
                                 <div className="text-gray-500 text-center col-span-2 py-8">Loading available templates...</div>
                             ) : templates.length === 0 ? (
                                 <div className="text-gray-500 text-center col-span-2 py-8">No templates found.</div>
                             ) : (
                                 templates.map((t: any) => (
                                     <div 
                                         key={t.name}
                                         onClick={async () => {
                                             setSelectedTemplate(t);
                                             
                                             // Reset States
                                             setTemplateParams([]);
                                             setHeaderParams([]);
                                             setButtonParams({});
                                             setHeaderMedia({ file: null, id: null, type: t.components.find((c: any) => c.type === 'HEADER')?.format || null, preview: null });

                                             // Parse Body Params
                                             const bodyComp = t.components.find((c: any) => c.type === 'BODY');
                                             if (bodyComp?.text) {
                                                 const matches = bodyComp.text.match(/{{(\d+)}}/g);
                                                 if (matches) setTemplateParams(new Array(matches.length).fill(""));
                                             }

                                             // Parse Header Params
                                             const headerComp = t.components.find((c: any) => c.type === 'HEADER');
                                             if (headerComp?.format === 'TEXT' && headerComp.text) {
                                                 const matches = headerComp.text.match(/{{(\d+)}}/g);
                                                 if (matches) setHeaderParams(new Array(matches.length).fill(""));
                                             }

                                             // Parse Button Params
                                             const buttonsComp = t.components.find((c: any) => c.type === 'BUTTONS');
                                             if (buttonsComp?.buttons) {
                                                 const newBtns: Record<number, string> = {};
                                                 buttonsComp.buttons.forEach((btn: any, i: number) => {
                                                     if (btn.type === 'URL' && btn.url.includes('{{1}}')) newBtns[i] = "";
                                                 });
                                                 setButtonParams(newBtns);
                                             }
                                         }}
                                         className="bg-[#111b21] p-4 rounded-lg border border-[#2a3942] hover:border-teal-600/50 cursor-pointer transition-all hover:bg-[#182229] group relative overflow-hidden"
                                     >
                                         <div className="flex justify-between items-start mb-2">
                                             <div className="font-medium text-teal-500 group-hover:text-teal-400 transition-colors uppercase text-xs tracking-wider">
                                                 {t.components?.find((c: any) => c.type === 'HEADER')?.format || "Standard"}
                                             </div>
                                             <div className="text-[10px] bg-[#202c33] px-2 py-0.5 rounded text-gray-400 border border-[#2a3942]">{t.language || t.languageCode || "en"}</div>
                                         </div>
                                         <h3 className="font-bold text-[#e9edef] mb-1">{t.name}</h3>
                                         <p className="text-sm text-[#8696a0] line-clamp-2">
                                             {t.components?.find((c: any) => c.type === 'BODY')?.text || "No preview"}
                                         </p>
                                     </div>
                                 ))
                             )}
                         </div>
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
                             {/* Preview Card */}
                             <div className="bg-[#e9edef] text-[#111b21] p-0 rounded-lg rounded-tl-none shadow border border-gray-300 relative max-w-sm overflow-hidden">
                                 {/* Header Preview */}
                                 {(() => {
                                     const h = selectedTemplate.components.find((c: any) => c.type === 'HEADER');
                                     if (!h) return null;
                                     if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(h.format)) {
                                         return (
                                             <div className="h-40 bg-gray-200 flex items-center justify-center border-b border-gray-300 overflow-hidden relative group">
                                                 {headerMedia.preview ? (
                                                     h.format === 'IMAGE' ? <img src={headerMedia.preview} className="w-full h-full object-cover" /> :
                                                     h.format === 'VIDEO' ? <video src={headerMedia.preview} className="w-full h-full object-cover" /> :
                                                     <div className="flex flex-col items-center text-gray-400"><FileText className="w-10 h-10" /><span>{headerMedia.file?.name}</span></div>
                                                 ) : (
                                                     <div className="flex flex-col items-center text-gray-400">
                                                         {h.format === 'IMAGE' && <ImageIcon className="w-12 h-12 mb-1" />}
                                                         {h.format === 'VIDEO' && <Video className="w-12 h-12 mb-1" />}
                                                         {h.format === 'DOCUMENT' && <FileText className="w-12 h-12 mb-1" />}
                                                         <span className="text-[10px] uppercase font-bold tracking-widest">{h.format} Header</span>
                                                     </div>
                                                 )}
                                             </div>
                                         );
                                     }
                                     if (h.format === 'TEXT') {
                                         let text = h.text || "";
                                         headerParams.forEach((p, i) => text = text.replace(`{{${i+1}}}`, p || `{{${i+1}}}`));
                                         return <div className="p-3 pb-0 font-bold text-sm">{text}</div>;
                                     }
                                     return null;
                                 })()}

                                 {/* Body Preview */}
                                 <div className="p-3 text-sm whitespace-pre-wrap">
                                     {(() => {
                                         let text = selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text || "";
                                         templateParams.forEach((param, i) => {
                                             text = text.replace(`{{${i+1}}}`, param || `{{${i+1}}}`);
                                         });
                                         return text;
                                     })()}
                                 </div>

                                 {/* Footer Preview */}
                                 {(() => {
                                     const f = selectedTemplate.components.find((c: any) => c.type === 'FOOTER');
                                     if (f) return <div className="px-3 pb-3 text-[11px] text-gray-500 uppercase tracking-tight">{f.text}</div>;
                                     return null;
                                 })()}

                                 {/* Buttons Preview */}
                                 {(() => {
                                     const b = selectedTemplate.components.find((c: any) => c.type === 'BUTTONS');
                                     if (b) {
                                         return (
                                             <div className="border-t border-gray-300 flex flex-col divide-y divide-gray-300">
                                                 {b.buttons.map((btn: any, i: number) => (
                                                     <div key={i} className="py-2.5 text-center text-teal-600 font-medium text-sm flex items-center justify-center gap-2 bg-white hover:bg-gray-50 cursor-default">
                                                         {btn.type === 'URL' && <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>}
                                                         {btn.type === 'PHONE_NUMBER' && <Phone className="w-4 h-4" />}
                                                         <span>{btn.text}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         );
                                     }
                                     return null;
                                 })()}
                                 <div className="text-[10px] text-gray-500 text-right p-1 px-3 bg-white/50">12:00 PM</div>
                             </div>

                             {/* Configuration Inputs */}
                             <div className="space-y-6">
                                 {/* Media Header Input */}
                                 {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.components.find((c: any) => c.type === 'HEADER')?.format) && (
                                     <div className="space-y-3">
                                         <h4 className="text-[#8696a0] uppercase text-xs font-bold tracking-widest">Header Media</h4>
                                         <div className="flex items-center gap-4">
                                            <Button 
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    const h = selectedTemplate.components.find((c: any) => c.type === 'HEADER');
                                                    if (h.format === 'IMAGE') input.accept = 'image/*';
                                                    if (h.format === 'VIDEO') input.accept = 'video/*';
                                                    if (h.format === 'DOCUMENT') input.accept = '*/*';
                                                    
                                                    input.onchange = async (e: any) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        
                                                        const preview = URL.createObjectURL(file);
                                                        setHeaderMedia({ file, id: null, type: h.format, preview });
                                                        
                                                        // Upload immediately
                                                        setIsUploadingHeader(true);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                                                            const data = await res.json();
                                                            if (data.id) setHeaderMedia(prev => ({ ...prev, id: data.id }));
                                                        } catch (err) { console.error(err); }
                                                        finally { setIsUploadingHeader(false); }
                                                    };
                                                    input.click();
                                                }}
                                                className="bg-[#2a3942] hover:bg-[#374248] text-[#e9edef] border-[#2a3942]"
                                            >
                                                {isUploadingHeader ? "Uploading..." : headerMedia.id ? "Change File" : "Choose File"}
                                            </Button>
                                            {headerMedia.id && <span className="text-xs text-green-500 flex items-center gap-1">✅ Ready</span>}
                                         </div>
                                     </div>
                                 )}

                                 {/* Header Text Vars */}
                                 {headerParams.length > 0 && (
                                     <div className="space-y-3">
                                         <h4 className="text-[#8696a0] uppercase text-xs font-bold tracking-widest">Header Variables</h4>
                                         <div className="grid gap-3">
                                             {headerParams.map((p, i) => (
                                                 <div key={i} className="space-y-1">
                                                     <Label className="text-[10px] text-teal-500 ml-1">Header Var {i+1}</Label>
                                                     <Input 
                                                         value={p}
                                                         onChange={(e) => {
                                                             const next = [...headerParams];
                                                             next[i] = e.target.value;
                                                             setHeaderParams(next);
                                                         }}
                                                         className="bg-[#2a3942] border-[#2a3942] text-[#e9edef] placeholder:text-gray-600 focus-visible:ring-teal-500"
                                                         placeholder="Enter value"
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {/* Body Vars */}
                                 <div className="space-y-3">
                                     <h4 className="text-[#8696a0] uppercase text-xs font-bold tracking-widest">Body Variables</h4>
                                     {templateParams.length > 0 ? (
                                         <div className="grid gap-3">
                                             {templateParams.map((p, i) => (
                                                 <div key={i} className="space-y-1">
                                                     <Label className="text-[10px] text-teal-500 ml-1">Body Var {i+1}</Label>
                                                     <Input 
                                                         value={p}
                                                         onChange={(e) => {
                                                             const next = [...templateParams];
                                                             next[i] = e.target.value;
                                                             setTemplateParams(next);
                                                         }}
                                                         className="bg-[#2a3942] border-[#2a3942] text-[#e9edef] placeholder:text-gray-600 focus-visible:ring-teal-500"
                                                         placeholder="Enter value"
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                     ) : <div className="text-xs text-gray-500 italic">No body variables</div>}
                                 </div>

                                 {/* Button Vars */}
                                 {Object.keys(buttonParams).length > 0 && (
                                      <div className="space-y-3">
                                         <h4 className="text-[#8696a0] uppercase text-xs font-bold tracking-widest">Button URL Suffixes</h4>
                                         <div className="grid gap-3">
                                             {Object.keys(buttonParams).map((idxString) => {
                                                 const idx = parseInt(idxString);
                                                 const btn = selectedTemplate.components.find((c: any) => c.type === 'BUTTONS').buttons[idx];
                                                 return (
                                                     <div key={idx} className="space-y-1">
                                                         <Label className="text-[10px] text-teal-500 ml-1">Button: {btn.text}</Label>
                                                         <Input 
                                                            value={buttonParams[idx]}
                                                            onChange={(e) => setButtonParams(prev => ({ ...prev, [idx]: e.target.value }))}
                                                            className="bg-[#2a3942] border-[#2a3942] text-[#e9edef] focus-visible:ring-teal-500"
                                                            placeholder="Enter URL suffix"
                                                         />
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                      </div>
                                 )}
                             </div>
                        </div>
                    )}
                </div>
                
                {/* Drawer Footer (Only for Config Mode) */}
                {selectedTemplate && (
                    <div className="p-4 border-t border-[#2a3942] bg-[#202c33] flex justify-end shrink-0">
                        <button 
                            onClick={handleSendTemplate}
                            disabled={isUploadingHeader || (templateParams.some(p => !p.trim()) && templateParams.length > 0) || (headerParams.some(p => !p.trim()) && headerParams.length > 0)}
                            className="bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2 rounded-full shadow transition-all font-medium flex items-center gap-2"
                        >
                            <span>Send Template</span>
                            <svg viewBox="0 0 24 24" height="18" width="18" fill="currentColor"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                        </button>
                    </div>
                )}
            </div>
        )}
    </div>

    {/* Interactive Buttons Drawer inside Chat */}
    <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ease-in-out border-t border-[#2a3942] shadow-2xl flex flex-col ${isInteractiveDrawerOpen ? "h-[550px]" : "h-0"}`}>
        {isInteractiveDrawerOpen && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33] shrink-0">
                    <span className="font-medium text-[#e9edef]">Create Quick Buttons</span>
                    <button 
                        onClick={() => setIsInteractiveDrawerOpen(false)}
                        className="p-2 hover:bg-[#374248] rounded-full text-gray-400 transition-colors"
                    >
                         <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Editor Side */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[#8696a0] text-[10px] uppercase font-bold tracking-wider">Header Text (Optional)</Label>
                                <Input 
                                    value={interactiveDraft.header}
                                    onChange={(e) => setInteractiveDraft(prev => ({ ...prev, header: e.target.value }))}
                                    placeholder="Add a header title"
                                    className="bg-[#2a3942] border-[#2a3942] focus:border-teal-500 text-[#e9edef] rounded px-3 py-2 text-sm focus:outline-none transition-colors h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#8696a0] text-[10px] uppercase font-bold tracking-wider">Body Message</Label>
                                <textarea 
                                    value={interactiveDraft.body}
                                    onChange={(e) => setInteractiveDraft(prev => ({ ...prev, body: e.target.value }))}
                                    placeholder="Type your message here..."
                                    className="w-full h-32 bg-[#2a3942] border-[#2a3942] focus:border-teal-500 text-[#e9edef] rounded-lg p-3 text-sm focus:outline-none transition-colors resize-none border"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#8696a0] text-[10px] uppercase font-bold tracking-wider">Footer Text (Optional)</Label>
                                <Input 
                                    value={interactiveDraft.footer}
                                    onChange={(e) => setInteractiveDraft(prev => ({ ...prev, footer: e.target.value }))}
                                    placeholder="Small text below message"
                                    className="bg-[#2a3942] border-[#2a3942] focus:border-teal-500 text-[#e9edef] rounded px-3 py-2 text-sm focus:outline-none transition-colors h-10"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[#8696a0] text-[10px] uppercase font-bold tracking-wider">Reply Buttons (Max 3)</Label>
                                    {interactiveDraft.buttons.length < 3 && (
                                        <button 
                                            onClick={() => setInteractiveDraft(prev => ({ ...prev, buttons: [...prev.buttons, ""] }))}
                                            className="text-teal-500 text-xs font-bold hover:text-teal-400 transition-colors"
                                        >
                                            + Add Button
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {interactiveDraft.buttons.map((b, i) => (
                                        <div key={i} className="flex gap-2 group">
                                            <Input 
                                                value={b}
                                                onChange={(e) => {
                                                    const next = [...interactiveDraft.buttons];
                                                    next[i] = e.target.value;
                                                    setInteractiveDraft(prev => ({ ...prev, buttons: next }));
                                                }}
                                                placeholder={`Button ${i+1} title`}
                                                maxLength={20}
                                                className="bg-[#2a3942] border-[#2a3942] focus:border-teal-500 text-[#e9edef] h-10"
                                            />
                                            {interactiveDraft.buttons.length > 1 && (
                                                <button 
                                                    onClick={() => {
                                                        const next = interactiveDraft.buttons.filter((_, idx) => idx !== i);
                                                        setInteractiveDraft(prev => ({ ...prev, buttons: next }));
                                                    }}
                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-40 group-hover:opacity-100"
                                                >✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Preview Side */}
                        <div className="flex flex-col items-center justify-center p-8 bg-[#111b21] rounded-2xl border border-[#2a3942]">
                            <h4 className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest mb-6">Live Preview</h4>
                            <div className="bg-[#e9edef] text-[#111b21] p-0 rounded-lg rounded-tl-none shadow-xl relative w-full max-w-[280px] overflow-hidden">
                                {interactiveDraft.header && (
                                    <div className="p-3 pb-1.5 font-bold text-sm border-b border-gray-200">
                                        {interactiveDraft.header}
                                    </div>
                                )}
                                <div className="p-3 text-sm whitespace-pre-wrap min-h-[40px]">
                                    {interactiveDraft.body || <span className="text-gray-400 italic">No message content...</span>}
                                </div>
                                {interactiveDraft.footer && (
                                    <div className="px-3 pb-3 text-[10px] text-gray-500 uppercase tracking-tight">
                                        {interactiveDraft.footer}
                                    </div>
                                )}
                                <div className="border-t border-gray-200 flex flex-col divide-y divide-gray-200">
                                    {interactiveDraft.buttons.map((btn, i) => btn.trim() && (
                                        <div key={i} className="py-2.5 text-center text-teal-600 font-medium text-sm bg-white">
                                            {btn}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[9px] text-gray-400 text-right p-1 px-2 bg-white/50">12:00 PM</div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-6 text-center italic">
                                This is how your interactive message will appear <br/> to the recipient on WhatsApp.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-[#2a3942] bg-[#202c33] flex justify-end gap-3 shrink-0">
                    <button 
                         onClick={() => setIsInteractiveDrawerOpen(false)}
                         className="px-6 py-2 text-[#8696a0] hover:text-[#e9edef] transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSendInteractive}
                        disabled={!interactiveDraft.body || interactiveDraft.buttons.every(b => !b.trim())}
                        className="bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-2 rounded-full shadow-lg transition-all font-medium flex items-center gap-2"
                    >
                        <span>Send Message</span>
                        <svg viewBox="0 0 24 24" height="18" width="18" fill="currentColor"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                    </button>
                </div>
            </div>
        )}
    </div>
      </div>
  ) : (
      <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0] border-b-[6px] border-[#4fb38e] box-border">
          <h1 className="text-3xl font-light text-[#e9edef] mt-10">WhatsApp Web</h1>
          <p className="mt-4">Select a chat to start messaging</p>
      </div>
  );

  return (
    <>
      <ChatLayout sidebar={renderSidebar} activeChat={renderChat} isConnected={status === "Connected"} />
      <audio 
          ref={remoteAudioRef} 
          className="fixed bottom-0 left-0 w-1 h-1 opacity-1 pointer-events-none" 
          playsInline 
          autoPlay 
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
      
      <CallModal 
          isOpen={callState.isOpen}
          type={callState.type}
          contactName={callState.contactName}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          isMuted={isMuted}
          toggleMute={toggleMute}
          duration={connectionStatus === 'connected' ? formatTime(callDuration) : connectionStatus}
      />

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Rename Contact</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set a custom name for this contact. This will be visible only to you.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-gray-300">
                Name
              </Label>
              <Input
                id="name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="col-span-3 bg-[#2a3942] border-gray-600 text-[#e9edef] focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white border-0">Cancel</Button>
            <Button type="submit" onClick={submitRename} className="bg-[#00a884] hover:bg-[#008f6f] text-white">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
