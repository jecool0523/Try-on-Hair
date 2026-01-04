
import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { CameraOff, AlertTriangle } from 'lucide-react';

interface CameraFeedProps {
  isActive: boolean;
  onPostureDetected?: () => void; // Callback if we were doing real detection
}

export interface CameraFeedHandle {
  captureFrame: () => string | null;
  triggerPoseSuccess: () => void;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ isActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [poseState, setPoseState] = useState<'IDLE' | 'SUCCESS'>('IDLE');
  const [permissionError, setPermissionError] = useState(false);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (!videoRef.current) return null;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Mirror image horizontally on canvas to match user expectation
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      
      return canvas.toDataURL('image/jpeg', 0.9);
    },
    triggerPoseSuccess: () => {
        setPoseState('SUCCESS');
        setTimeout(() => setPoseState('IDLE'), 1000);
    }
  }));

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setPermissionError(false);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        // Suppress console error if it's just a permission issue, since we show UI for it
        console.warn("Camera access failed/denied:", err);
        setPermissionError(true);
      }
    };

    if (isActive) {
      startCamera();
    } else {
      // Stop tracks if not active
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {!permissionError ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100" // Mirror effect
          />
          
          {/* Glass Scan Grid Effect (Subtle) */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>

          {/* Posture Guide Overlay - Head and Shoulders for Hair */}
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-colors duration-300 p-4">
              <svg 
                viewBox="0 0 200 300" 
                className={`h-full max-h-[80%] w-auto transition-all duration-500 ${poseState === 'SUCCESS' ? 'stroke-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]' : 'stroke-white/40 border-dashed'}`}
                fill="none" 
                strokeWidth="2.0"
                strokeDasharray={poseState === 'SUCCESS' ? "0" : "8 5"}
              >
                 {/* Head oval and shoulders */}
                 <ellipse cx="100" cy="110" rx="55" ry="70" />
                 <path d="M 45,180 Q 20,200 10,280 L 190,280 Q 180,200 155,180" />
              </svg>
              {poseState === 'IDLE' && (
                <div className="absolute top-[20%] text-white/70 text-base font-medium tracking-widest uppercase animate-pulse drop-shadow-md bg-black/30 px-3 py-1 rounded backdrop-blur-sm">
                  Center Face
                </div>
              )}
              {poseState === 'SUCCESS' && (
                <div className="absolute top-[20%] text-green-400 text-xl font-bold tracking-widest uppercase animate-bounce drop-shadow-md">
                  Perfect
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
          <div className="bg-white/10 p-6 rounded-full mb-6 backdrop-blur-md border border-white/20">
            <CameraOff className="w-12 h-12 text-white/50" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Camera Access Denied</h3>
          <p className="text-white/60 mb-6 leading-relaxed">
            Please enable camera permissions in your browser settings to use the mirror features.
            <br/><span className="text-sm mt-2 block opacity-50">Alternatively, use the Upload button to select a photo.</span>
          </p>
          <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-400/10 px-4 py-2 rounded-lg border border-yellow-400/20">
            <AlertTriangle className="w-4 h-4" />
            <span>Check browser address bar for blocked icon</span>
          </div>
        </div>
      )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
export default CameraFeed;
