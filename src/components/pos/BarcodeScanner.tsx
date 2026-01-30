import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Barcode, Camera, X, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScanner({ onBarcodeScanned, isOpen, onClose }: BarcodeScannerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(err.message || 'Failed to access camera');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleManualEntry = () => {
    const barcode = prompt('Enter barcode manually:');
    if (barcode && barcode.trim()) {
      onBarcodeScanned(barcode.trim());
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription>
            Point your camera at a barcode to scan it
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4 text-center">
                <Camera className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Make sure you've allowed camera access
                </p>
              </div>
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            {!isLoading && !error && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 border-2 border-primary rounded-lg">
                  <div className="absolute inset-0 bg-primary/10" />
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />
                  
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-primary animate-pulse" style={{
                    animation: 'scanLine 2s ease-in-out infinite',
                    top: '50%',
                  }} />
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Position the barcode within the frame</p>
            <p className="mt-1">
              Note: For best results, ensure good lighting
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleManualEntry}
            >
              <Barcode className="mr-2 h-4 w-4" />
              Enter Manually
            </Button>
            <Button variant="outline" onClick={handleClose}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>

        <style>{`
          @keyframes scanLine {
            0%, 100% { transform: translateY(-40px); opacity: 0.5; }
            50% { transform: translateY(40px); opacity: 1; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// Hook for keyboard barcode scanner input
export function useBarcodeKeyboardScanner(onBarcode: (barcode: string) => void) {
  const bufferRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Clear timeout on each keystroke
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle Enter key - submit barcode
      if (e.key === 'Enter' && bufferRef.current.length >= 4) {
        onBarcode(bufferRef.current);
        bufferRef.current = '';
        return;
      }

      // Only accept alphanumeric characters for barcode
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        bufferRef.current += e.key;
      }

      // Clear buffer after 100ms of no input (barcode scanners are fast)
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 100);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onBarcode]);
}
