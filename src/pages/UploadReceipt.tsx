import React, { useState, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { validateImageFile, generateSecureFileName } from '../utils/fileValidation';
import { validateReceiptData } from '../utils/inputSanitization';
import { 
  Upload, 
  Camera, 
  CheckCircle, 
  Loader2, 
  Image as ImageIcon, 
  Store,
  Calendar,
  DollarSign,
  Receipt,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ReceiptData {
  storeName: string;
  date: string;
  totalAmount: string;
  items: string;
}

const UploadReceipt: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData>({
    storeName: '',
    date: '',
    totalAmount: '',
    items: ''
  });
  const { user, userProfile, updatePoints } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file before processing
    const validation = validateImageFile(selectedFile);
    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessed(false);
    
    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const processReceipt = async () => {
    if (!file || !user) return;

    setIsProcessing(true);
    
    try {
      // First upload the image to get a public URL for OCR
      const fileName = generateSecureFileName(file.name, user.id);
      
      // Check if file already exists, if so delete it first
      const { error: deleteError } = await supabase.storage
        .from('receipts')
        .remove([fileName]);
      
      console.log('Uploading file:', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL for OCR processing
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Call OCR edge function
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('ocr', {
        body: { imageUrl: publicUrl }
      });

      if (ocrError) {
        throw new Error(`OCR failed: ${ocrError.message}`);
      }

      // Pre-fill form with OCR results
      const extractedData: ReceiptData = {
        storeName: ocrResult.merchant || '',
        date: ocrResult.purchase_date || new Date().toISOString().split('T')[0],
        totalAmount: ocrResult.total ? ocrResult.total.toString() : '',
        items: '' // We can add item extraction later if needed
      };
      
      setReceiptData(extractedData);
      setIsProcessed(true);
      
      toast({
        title: "Receipt Processed!",
        description: "Information extracted successfully. Please review and submit.",
      });

    } catch (error) {
      console.error('OCR processing error:', error);
      
      // Fall back to manual entry
      setReceiptData({
        storeName: '',
        date: new Date().toISOString().split('T')[0],
        totalAmount: '',
        items: ''
      });
      setIsProcessed(true);
      
      toast({
        title: "OCR Failed",
        description: error instanceof Error ? error.message : "Please enter receipt details manually.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitReceipt = async () => {
    if (!file || !user) {
      toast({
        title: "Error",
        description: "Missing file or user authentication.",
        variant: "destructive",
      });
      return;
    }

    // Validate and sanitize input data
    const validation = validateReceiptData(receiptData);
    if (!validation.isValid) {
      toast({
        title: "Invalid Data",
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Use the already uploaded image from OCR processing
      let imageUrl = '';
      
      // Check if we already have a processed image URL, if not upload it
      if (isProcessed) {
        // Image was already uploaded during OCR, get the URL
        const fileName = generateSecureFileName(file.name, user.id);
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      } else {
        // Upload the image if OCR wasn't run
        const fileName = generateSecureFileName(file.name, user.id);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      // Save receipt data to database
      const { error: dbError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          merchant: validation.sanitizedData.storeName,
          total: validation.sanitizedData.totalAmount,
          purchase_date: validation.sanitizedData.date,
          items: validation.sanitizedData.items,
          image_url: imageUrl,
          status: 'pending',
          points: 100 // Points awarded upon approval
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      toast({
        title: "Receipt Submitted!",
        description: "Your receipt is being reviewed. Points will be awarded upon approval.",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting receipt:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Upload Receipt
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload your purchase receipt and earn 100 points instantly
        </p>
      </div>

      {/* Upload Area */}
      {!file && (
        <Card className="shadow-card">
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center transition-all hover:border-primary hover:bg-primary/5"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload Receipt Image</h3>
                  <p className="text-muted-foreground mb-4">
                    Drag and drop your receipt image here, or click to browse
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="default"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Choose File
                    </Button>
                    <Button variant="outline">
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </Button>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview and Processing */}
      {file && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl && (
                <div className="space-y-4">
                  <img 
                    src={previewUrl} 
                    alt="Receipt preview" 
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                    >
                      Change Image
                    </Button>
                    {!isProcessed && (
                      <Button
                        onClick={processReceipt}
                        disabled={isProcessing}
                        variant="default"
                        size="sm"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running OCR...
                          </>
                        ) : (
                          'Process Receipt'
                        )}
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt Information */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isProcessed ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <Store className="h-5 w-5" />
                )}
                Receipt Information
              </CardTitle>
              <CardDescription>
                {isProcessed 
                  ? "Review the extracted information and submit"
                  : "Information will appear after processing"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="storeName"
                    placeholder="e.g., Migros, CarrefourSA"
                    value={receiptData.storeName}
                    onChange={(e) => setReceiptData({...receiptData, storeName: e.target.value})}
                    className="pl-10"
                    disabled={!isProcessed}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Purchase Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    value={receiptData.date}
                    onChange={(e) => setReceiptData({...receiptData, date: e.target.value})}
                    className="pl-10"
                    disabled={!isProcessed}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount (₺)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={receiptData.totalAmount}
                    onChange={(e) => setReceiptData({...receiptData, totalAmount: e.target.value})}
                    className="pl-10"
                    disabled={!isProcessed}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="items">Items (Optional)</Label>
                <Textarea
                  id="items"
                  placeholder="List of purchased items..."
                  value={receiptData.items}
                  onChange={(e) => setReceiptData({...receiptData, items: e.target.value})}
                  className="min-h-20"
                  disabled={!isProcessed}
                />
              </div>

              {isProcessed && (
                <div className="bg-secondary-light p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-medium">Ready to Submit</span>
                  </div>
                  <p className="text-sm mb-3">
                    Your receipt will be reviewed by our team. Points will be awarded upon approval.
                  </p>
                  <Button
                    onClick={submitReceipt}
                    disabled={isProcessing}
                    variant="reward"
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit & Earn Points'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UploadReceipt;