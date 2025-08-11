import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/enhanced-button';
import { Camera, RotateCcw, Check, X, AlertCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }

    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access not supported in this browser');
      }

      // Request camera access with environment facing (rear camera on mobile)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMessage = 'Camera access failed';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported in this browser.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob/data URL
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataURL);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const usePhoto = () => {
    if (!capturedImage || !canvasRef.current) return;

    // Convert data URL to File object
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        onCapture(file);
        onClose();
        
        toast({
          title: "Fotoğraf çekildi!",
          description: "Fiş fotoğrafı başarıyla alındı.",
        });
      }
    }, 'image/jpeg', 0.9);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Fiş Fotoğrafı Çek
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="text-center p-8 space-y-4">
              <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Kamera Erişimi Hatası</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={startCamera} variant="outline">
                Tekrar Dene
              </Button>
            </div>
          ) : isLoading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Kamera açılıyor...</p>
            </div>
          ) : capturedImage ? (
            // Show captured image with options
            <div className="space-y-4">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img 
                  src={capturedImage} 
                  alt="Captured receipt" 
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={retakePhoto}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Tekrar Çek
                </Button>
                <Button 
                  onClick={usePhoto}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Bu Fotoğrafı Kullan
                </Button>
              </div>
            </div>
          ) : (
            // Show live camera preview
            <div className="space-y-4">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-96"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Fişi kamera önüne yerleştirin ve fotoğraf çekin
                </p>
                <Button 
                  onClick={capturePhoto}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Camera className="h-5 w-5" />
                  Fotoğraf Çek
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            İptal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraModal;