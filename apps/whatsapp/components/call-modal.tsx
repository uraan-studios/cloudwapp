import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";

interface CallModalProps {
  isOpen: boolean;
  type: 'incoming' | 'outgoing' | 'active';
  contactName: string;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ 
  isOpen, 
  type, 
  contactName, 
  onAccept, 
  onReject, 
  onEnd,
  isMuted,
  toggleMute
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef] pointer-events-auto">
        <DialogHeader>
          <DialogTitle className="text-center font-normal">
            {type === 'incoming' && 'Incoming Call'}
            {type === 'outgoing' && 'Calling...'}
            {type === 'active' && 'On Call'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-8 gap-4">
            <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-3xl">
                {contactName?.slice(0, 2).toUpperCase() || '?'}
            </div>
            <h2 className="text-xl font-medium">{contactName || 'Unknown'}</h2>
            <p className="text-[#8696a0] text-sm">
                {type === 'incoming' ? 'WhatsApp Audio Call' : 
                 type === 'outgoing' ? 'Ringing...' : '00:00'}
            </p>
        </div>

        <DialogFooter className="flex justify-center gap-8 sm:justify-center">
            {type === 'incoming' && (
                <>
                    <Button 
                        onClick={onReject}
                        className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 p-0 flex items-center justify-center"
                    >
                        <PhoneOff className="w-6 h-6" />
                    </Button>
                    <Button 
                        onClick={onAccept}
                        className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600 p-0 flex items-center justify-center"
                    >
                        <Phone className="w-6 h-6" />
                    </Button>
                </>
            )}

            {(type === 'outgoing' || type === 'active') && (
                <>
                     {type === 'active' && (
                        <Button 
                            onClick={toggleMute}
                            className={`rounded-full w-12 h-12 p-0 flex items-center justify-center ${isMuted ? 'bg-white text-black' : 'bg-gray-700 text-white'}`}
                        >
                            {isMuted ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}
                        </Button>
                     )}
                     <Button 
                        onClick={onEnd}
                        className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 p-0 flex items-center justify-center"
                    >
                        <PhoneOff className="w-6 h-6" />
                    </Button>
                </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
