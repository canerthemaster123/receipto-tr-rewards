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
      
      // Extract the file path from the full URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(fileName, 300); // 5 minutes expiry

      if (error) {
        throw error;
      }

      setSignedUrl(data.signedUrl);
    } catch (error) {
      console.error('Error generating signed URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to load receipt image',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!signedUrl) return;

    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Generate filename: merchant_date_id.jpg
      const cleanMerchant = merchant.replace(/[^a-zA-Z0-9]/g, '_');
      const downloadFileName = `${cleanMerchant}_${purchaseDate}_${receiptId.slice(0, 8)}.jpg`;
      link.download = downloadFileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: 'Success',
        description: 'Receipt downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast({
        title: 'Error',
        description: 'Failed to download receipt',
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
                onError={() => {
                  toast({
                    title: 'Error',
                    description: 'Failed to load receipt image',
                    variant: 'destructive',
                  });
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