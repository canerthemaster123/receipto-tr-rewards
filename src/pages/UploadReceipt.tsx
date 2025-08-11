import React, { useState, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAppSettings } from '../hooks/useAppSettings';
import type { OCRResult } from '../types/ocr';

interface ReceiptData {
  storeName: string;
  date: string;
  purchaseTime: string;
  storeAddress: string;
  totalAmount: string;
  paymentMethod: string;
  items: string;
}

const UploadReceipt: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData>({
    storeName: '',
    date: '',
    purchaseTime: '',
    storeAddress: '',
    totalAmount: '',
    paymentMethod: '',
    items: ''
  });
  const { user, userProfile, updatePoints } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { getSetting } = useAppSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file before processing
    const validation = validateImageFile(selectedFile);
    if (!validation.isValid) {
      toast({
        title: t('toast.invalidFile'),
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessed(false);
    setOcrResult(null);
    
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
      const fakeOcr = localStorage.getItem('qa.fakeOcr') === '1';
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke<OCRResult>('ocr', {
        body: { imageUrl: publicUrl + (fakeOcr ? '?qa-fake-ocr=1' : '') }
      });

      if (ocrError) {
        throw new Error(`OCR failed: ${ocrError.message}`);
      }

      // Pre-fill form with OCR results
      const extractedData: ReceiptData = {
        storeName: ocrResult.merchant_brand || ocrResult.merchant_raw || '',
        date: ocrResult.purchase_date || new Date().toISOString().split('T')[0],
        purchaseTime: ocrResult.purchase_time || '',
        storeAddress: ocrResult.store_address || '',
        totalAmount: ocrResult.total ? ocrResult.total.toString() : '',
        paymentMethod: ocrResult.payment_method || '',
        items: ocrResult.items ? ocrResult.items.map(item => item.qty > 1 ? `${item.name} x${item.qty}` : item.name).join('\n') : ''
      };
      
      setReceiptData(extractedData);
      setOcrResult(ocrResult); // Store OCR result for later use
      setIsProcessed(true);
      
      toast({
        title: t('toast.receiptProcessed'),
        description: t('toast.receiptProcessedDesc'),
      });

    } catch (error) {
      console.error('OCR processing error:', error);
      
      // Fall back to manual entry
      setReceiptData({
        storeName: '',
        date: new Date().toISOString().split('T')[0],
        purchaseTime: '',
        storeAddress: '',
        totalAmount: '',
        paymentMethod: '',
        items: ''
      });
      setIsProcessed(true);
      
      toast({
        title: t('toast.ocrFailed'),
        description: error instanceof Error ? error.message : t('toast.enterManually'),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkForDuplicateReceipt = async (storeName: string, date: string, totalAmount: number) => {
    if (!user) return false;

    try {
      const { data: existingReceipts, error } = await supabase
        .from('receipts')
        .select('id, merchant, purchase_date, total')
        .eq('user_id', user.id)
        .eq('merchant', storeName.trim())
        .eq('purchase_date', date)
        .eq('total', totalAmount);

      if (error) {
        console.error('Error checking for duplicates:', error);
        return false;
      }

      return existingReceipts && existingReceipts.length > 0;
    } catch (error) {
      console.error('Error in duplicate check:', error);
      return false;
    }
  };

  const submitReceipt = async () => {
    if (!file || !user) {
      toast({
        title: t('common.error'),
        description: "Missing file or user authentication.",
        variant: "destructive",
      });
      return;
    }

    // Validate and sanitize input data
    const validation = validateReceiptData(receiptData);
    if (!validation.isValid) {
      toast({
        title: t('toast.invalidData'),
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate receipts based on app settings
    const dupEnforcementEnabled = getSetting('dup_enforcement_enabled', true);
    if (dupEnforcementEnabled) {
      const isDuplicate = await checkForDuplicateReceipt(
        validation.sanitizedData.storeName,
        validation.sanitizedData.date,
        validation.sanitizedData.totalAmount
      );

      if (isDuplicate) {
        toast({
          title: t('toast.duplicateReceipt'),
          description: t('toast.duplicateReceiptDesc'),
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }
    } else if (!dupEnforcementEnabled) {
      // Show warning toast when duplicates are allowed
      const isDuplicate = await checkForDuplicateReceipt(
        validation.sanitizedData.storeName,
        validation.sanitizedData.date,
        validation.sanitizedData.totalAmount
      );
      
      if (isDuplicate) {
        toast({
          title: "Duplicate Receipt Detected",
          description: "Duplicate upload allowed (test mode)",
          variant: "default",
        });
      }
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

      // Save receipt data to database (including new OCR fields)
      const insertData: any = {
        user_id: user.id,
        merchant: validation.sanitizedData.storeName,
        total: validation.sanitizedData.totalAmount,
        purchase_date: validation.sanitizedData.date,
        purchase_time: receiptData.purchaseTime,
        store_address: receiptData.storeAddress,
        payment_method: validation.sanitizedData.paymentMethod,
        items: validation.sanitizedData.items,
        image_url: imageUrl,
        status: getSetting('auto_approve_receipts', false) ? 'approved' : 'pending',
        points: 100 // Points awarded upon approval
      };

      // Add OCR-extracted fields if available
      if (ocrResult) {
        insertData.merchant_brand = ocrResult.merchant_brand;
        insertData.receipt_unique_no = ocrResult.receipt_unique_no;
        insertData.fis_no = ocrResult.fis_no;
      }

      const { error: dbError } = await supabase
        .from('receipts')
        .insert(insertData);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      toast({
        title: t('toast.receiptSubmitted'),
        description: t('toast.receiptSubmittedDesc'),
      });
      
      // Reset form state
      setFile(null);
      setPreviewUrl('');
      setOcrResult(null);
      setReceiptData({
        storeName: '',
        date: '',
        purchaseTime: '',
        storeAddress: '',
        totalAmount: '',
        paymentMethod: '',
        items: ''
      });
      setIsProcessed(false);
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting receipt:', error);
      toast({
        title: t('toast.submissionFailed'),
        description: error instanceof Error ? error.message : t('toast.unexpectedError'),
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
          {t('upload.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('upload.description')}
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
                  <h3 className="text-lg font-semibold mb-2">{t('upload.uploadReceiptImage')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('upload.dragAndDrop')}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="default"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {t('upload.chooseFile')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const cameraInput = document.getElementById('camera-input') as HTMLInputElement;
                        if (cameraInput) {
                          cameraInput.click();
                        }
                      }}
                    >
                      <Camera className="h-4 w-4" />
                      {t('upload.takePhoto')}
                    </Button>
                  </div>
                  <input
                    id="camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
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
                {t('upload.receiptPreview')}
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
                      {t('upload.changeImage')}
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
                            {t('upload.runningOCR')}
                          </>
                        ) : (
                          t('upload.processReceipt')
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
                {t('upload.receiptInformation')}
              </CardTitle>
              <CardDescription>
                {isProcessed 
                  ? t('upload.reviewExtracted')
                  : t('upload.infoAfterProcessing')
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">{t('upload.storeName')}</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="storeName"
                    placeholder={t('upload.storeNamePlaceholder')}
                    value={receiptData.storeName}
                    onChange={(e) => setReceiptData({...receiptData, storeName: e.target.value})}
                    className="pl-10"
                    disabled={!isProcessed}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{t('upload.purchaseDate')}</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseTime">Purchase Time</Label>
                  <Input
                    id="purchaseTime"
                    placeholder="14:32"
                    value={receiptData.purchaseTime}
                    onChange={(e) => setReceiptData({...receiptData, purchaseTime: e.target.value})}
                    disabled={!isProcessed}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeAddress">Store Address</Label>
                  <Input
                    id="storeAddress"
                    placeholder="Store location"
                    value={receiptData.storeAddress}
                    onChange={(e) => setReceiptData({...receiptData, storeAddress: e.target.value})}
                    disabled={!isProcessed}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">{t('upload.totalAmount')}</Label>
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
                <Label htmlFor="paymentMethod">{t('upload.paymentMethod')}</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="paymentMethod"
                    placeholder={t('upload.paymentMethodPlaceholder')}
                    value={receiptData.paymentMethod}
                    onChange={(e) => setReceiptData({...receiptData, paymentMethod: e.target.value})}
                    className="pl-10"
                    disabled={!isProcessed}
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('upload.paymentMethodHelper')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="items">{t('upload.items')}</Label>
                <Textarea
                  id="items"
                  placeholder={t('upload.itemsPlaceholder')}
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
                    <span className="font-medium">{t('upload.readyToSubmit')}</span>
                  </div>
                  <p className="text-sm mb-3">
                    {t('upload.earnPoints')}
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
                        {t('upload.submitting')}
                      </>
                    ) : (
                      t('upload.submitReceipt')
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