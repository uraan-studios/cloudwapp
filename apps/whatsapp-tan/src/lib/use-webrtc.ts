import { useRef, useCallback } from 'react';

interface WebRTCOptions {
    onRemoteStream: (stream: MediaStream) => void;
    onIceCandidate: (candidate: RTCIceCandidate) => void;
    onConnectionStateChange: (state: RTCPeerConnectionState) => void;
    onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
}

export function useWebRTC(options: WebRTCOptions) {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const setupPeerConnection = useCallback(async () => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
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

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                options.onIceCandidate(e.candidate);
            }
        };

        pc.onconnectionstatechange = () => options.onConnectionStateChange(pc.connectionState);
        pc.oniceconnectionstatechange = () => options.onIceConnectionStateChange(pc.iceConnectionState);

        pc.ontrack = (event) => {
            options.onRemoteStream(event.streams[0]);
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        } catch (e) {
            console.error("Error accessing mic:", e);
            throw e;
        }

        pcRef.current = pc;
        return pc;
    }, [options]);

    const waitForIce = useCallback((pc: RTCPeerConnection) => {
        return new Promise<void>((resolve) => {
            if (pc.iceGatheringState === 'complete') return resolve();
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            setTimeout(resolve, 5000);
        });
    }, []);

    const createOffer = useCallback(async () => {
        const pc = await setupPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc);
        return pc.localDescription?.sdp || "";
    }, [setupPeerConnection, waitForIce]);

    const createAnswer = useCallback(async (remoteSdp: string) => {
        const pc = await setupPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: remoteSdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIce(pc);
        return pc.localDescription?.sdp || "";
    }, [setupPeerConnection, waitForIce]);

    const handleAnswer = useCallback(async (answerSdp: string) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    }, []);

    const cleanup = useCallback(() => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        pcRef.current = null;
        localStreamRef.current = null;
    }, []);

    const toggleMute = useCallback((muted: boolean) => {
        localStreamRef.current?.getAudioTracks().forEach(track => {
            track.enabled = !muted;
        });
    }, []);

    return {
        createOffer,
        createAnswer,
        handleAnswer,
        cleanup,
        toggleMute,
        pc: pcRef.current,
        localStream: localStreamRef.current
    };
}
