import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Download, Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReceiptImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  fileName: string;
  merchant: string;
  purchaseDate: string;
  receiptId: string;
}

export const ReceiptImageModal: React.FC<ReceiptImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  fileName,
  merchant,
  purchaseDate,
  receiptId
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && imageUrl) {
      generateSignedUrl();
    }
  }, [isOpen, imageUrl]);

  const generateSignedUrl = async () => {
    if (!imageUrl) return;

    try {
      setLoading(true);
      
      // Extract the file path from the full URL - handle both formats
      let filePath = '';
      
      if (imageUrl.includes('/storage/v1/object/public/receipts/')) {
        // Public URL format
        const urlParts = imageUrl.split('/storage/v1/object/public/receipts/');
        filePath = urlParts[1];
      } else if (imageUrl.includes('/receipts/')) {
        // Simple format
        const urlParts = imageUrl.split('/receipts/');
        filePath = urlParts[1];
      } else {
        // Last resort: take filename from end of URL
        const urlParts = imageUrl.split('/');
        filePath = urlParts[urlParts.length - 1];
      }

      if (!filePath) {
        throw new Error('Could not extract file path from URL');
      }

      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(filePath, 300); // 5 minutes expiry

      if (error) {
        console.error('Supabase signed URL error:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      setSignedUrl(data.signedUrl);
    } catch (error) {
      console.error('Error generating signed URL:', error);
      
      // Fallback: try to use the original URL if it's accessible
      if (imageUrl) {
        try {
          const testResponse = await fetch(imageUrl, { method: 'HEAD' });
          if (testResponse.ok) {
            setSignedUrl(imageUrl);
            return;
          }
        } catch (testError) {
          console.error('Original URL also inaccessible:', testError);
        }
      }
      
      toast({
        title: 'Error',
        description: 'Failed to load receipt image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!signedUrl) return;

    try {
      // Mobile detection
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

      // Generate filename: merchant_date_id.jpg
      const cleanMerchant = merchant.replace(/[^a-zA-Z0-9]/g, '_');
      const downloadFileName = `${cleanMerchant}_${purchaseDate}_${receiptId.slice(0, 8)}.jpg`;

      if (isIOSSafari) {
        // iOS Safari fallback: open in new tab with instructions
        window.open(signedUrl, '_blank');
        toast({
          title: 'Download Instructions',
          description: 'Long press the image and select "Save to Photos" to download',
        });
        return;
      }

      // Try direct download approach for modern browsers
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadFileName;
        
        // Force download attribute support check
        if (typeof link.download !== 'undefined') {
          // Modern browsers with download attribute support
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up blob URL
          window.URL.revokeObjectURL(downloadUrl);
          
          toast({
            title: 'Success',
            description: 'Receipt downloaded successfully',
          });
        } else {
          // Fallback for browsers without download attribute
          throw new Error('Download attribute not supported');
        }
      } catch (downloadError) {
        console.warn('Direct download failed, trying fallback:', downloadError);
        
        // Fallback: open in new tab
        window.open(signedUrl, '_blank');
        
        if (isMobile) {
          toast({
            title: 'Download Instructions',
            description: 'Tap and hold the image, then select "Save Image" to download',
          });
        } else {
          toast({
            title: 'Download Instructions', 
            description: 'Right-click the image and select "Save image as..." to download',
          });
        }
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to download receipt. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Receipt - {merchant}
            </span>
            <div className="flex items-center gap-2">
              {signedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : signedUrl ? (
            <div className="flex justify-center">
              <img
                src={signedUrl}
                alt={`Receipt from ${merchant}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  console.error('Image failed to load:', signedUrl);
                  toast({
                    title: 'Image Load Error',
                    description: 'Failed to display receipt image. You can still try downloading it.',
                    variant: 'destructive',
                  });
                  // Hide the broken image
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Image loaded successfully');
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No image available for this receipt</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">{merchant}</p>
              <p className="text-sm text-muted-foreground">Purchase Date: {purchaseDate}</p>
            </div>
            {signedUrl && (
              <Button
                variant="default"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Receipt
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};