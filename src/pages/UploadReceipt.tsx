import React, { useState, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { 
  Upload, 
  Camera, 
  CheckCircle, 
  Loader2, 
  Image as ImageIcon, 
  Store,
  Calendar,
  DollarSign,
  Receipt
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
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessed(false);
    
    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelect(droppedFile);
    }
  };

  const processReceipt = async () => {
    if (!file) return;

    setIsProcessing(true);
    
    // Mock OCR processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data
    const mockData: ReceiptData = {
      storeName: 'Migros',
      date: new Date().toISOString().split('T')[0],
      totalAmount: '124.50',
      items: 'Süt, Ekmek, Peynir, Domates, Makarna'
    };
    
    setReceiptData(mockData);
    setIsProcessing(false);
    setIsProcessed(true);
    
    toast({
      title: "Receipt Processed!",
      description: "Information extracted successfully. Please review and submit.",
    });
  };

  const submitReceipt = async () => {
    if (!receiptData.storeName || !receiptData.totalAmount) {
      toast({
        title: "Missing Information",
        description: "Please fill in the store name and total amount.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Submit to Supabase (points will be awarded automatically)
    const pointsEarned = 100;
    refreshProfile();
    
    toast({
      title: "Receipt Submitted!",
      description: `You earned ${pointsEarned} points! 🎉`,
    });
    
    navigate('/dashboard');
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
                            Processing...
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
                    <CheckCircle className="h-5 w-5 text-secondary" />
                    <span className="font-medium text-secondary-dark">Ready to Submit</span>
                  </div>
                  <p className="text-sm text-secondary-dark mb-3">
                    You'll earn 100 points for this receipt!
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