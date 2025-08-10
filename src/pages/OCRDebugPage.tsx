import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Textarea } from '../components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Copy, Download, FileText, Settings } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ParsedOCRResult {
  merchant_raw: string;
  merchant_brand: string;
  purchase_date: string;
  purchase_time: string | null;
  store_address: string | null;
  total: number;
  items: {
    name: string;
    qty?: number;
    unit_price?: number;
    line_total?: number;
    raw_line: string;
    product_code?: string;
  }[];
  payment_method: string | null;
  raw_text: string;
}

const OCRDebugPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedOCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Since we can't directly import OCR functions in frontend, 
  // we'll create a simplified version for testing
  const parseOCRText = (text: string): ParsedOCRResult => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Extract merchant (usually first few lines)
    const merchant = lines.find(line => 
      /^(MİGROS|MIGROS|BİM|A101|ŞOK|CARREFOUR|REAL|MACRO)/i.test(line)
    ) || lines[0] || '';

    // Extract date
    const datePattern = /(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})/;
    const dateMatch = text.match(datePattern);
    const purchase_date = dateMatch ? dateMatch[1] : '';

    // Extract time
    const timePattern = /\b([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?\b/;
    const timeMatch = text.match(timePattern);
    const purchase_time = timeMatch ? timeMatch[0] : null;

    // Extract total
    const totalPattern = /TOPLAM[\s:]*₺?(\d+[,\.]\d{2})/i;
    const totalMatch = text.match(totalPattern);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // Extract address (lines with street indicators)
    const store_address = lines.find(line =>
      /\b(Cad\.|Caddesi|Mah\.|Mahallesi|Sk\.|Sokak|No\b|Blok)\b/i.test(line)
    ) || null;

    // Extract payment method
    const paymentPattern = /(\*{4}\s*\d{4}|\d{4}\s*\*{4}|\d{4}\s*\*+\s*\d{4})/;
    const paymentMatch = text.match(paymentPattern);
    const payment_method = paymentMatch ? paymentMatch[0] : null;

    // Extract items (simplified)
    const items = lines
      .filter(line => {
        // Skip header/footer lines
        if (/^(MİGROS|MIGROS|BİM|A101|ŞOK|CARREFOUR|VERGİ|MERSIS|TEL|TOPLAM|SAAT|TARİH)/i.test(line)) return false;
        if (/^\d+[,\.]\d{2}$/.test(line)) return false; // Just prices
        if (line.length < 3) return false;
        
        // Include lines that look like items
        return /[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}/.test(line);
      })
      .slice(0, 10) // Limit to first 10 potential items
      .map(line => {
        const priceMatch = line.match(/(\d+[,\.]\d{2})$/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : undefined;
        
        const qtyMatch = line.match(/(\d+(?:[,\.]\d+)?)\s*[xX×]\s*(\d+(?:[,\.]\d+)?)/);
        let qty: number | undefined;
        let unit_price: number | undefined;
        
        if (qtyMatch) {
          qty = parseFloat(qtyMatch[1].replace(',', '.'));
          unit_price = parseFloat(qtyMatch[2].replace(',', '.'));
        }

        const name = line.replace(/\d+[,\.]\d{2}$/, '').trim();
        
        return {
          name,
          qty,
          unit_price,
          line_total: price,
          raw_line: line
        };
      });

    return {
      merchant_raw: merchant.replace(/[^A-ZÇĞİÖŞÜa-zçğıöşü\s]/g, '').trim(),
      merchant_brand: merchant.replace(/[^A-ZÇĞİÖŞÜa-zçğıöşü\s]/g, '').trim(),
      purchase_date,
      purchase_time,
      store_address,
      total,
      items,
      payment_method,
      raw_text: text
    };
  };

  const handleParseText = () => {
    if (!rawText.trim()) {
      toast({
        title: t('common.error'),
        description: t('debug.noTextProvided'),
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing delay
    setTimeout(() => {
      try {
        const result = parseOCRText(rawText);
        setParsedResult(result);
        toast({
          title: t('common.success'),
          description: 'Text parsed successfully'
        });
      } catch (error) {
        toast({
          title: t('common.error'),
          description: 'Failed to parse text',
          variant: 'destructive'
        });
      } finally {
        setIsProcessing(false);
      }
    }, 500);
  };

  const handleExportJSON = () => {
    if (!parsedResult) return;

    const jsonString = JSON.stringify(parsedResult, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `ocr-debug-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    toast({
      title: t('common.success'),
      description: 'JSON exported successfully'
    });
  };

  const handleCopyJSON = () => {
    if (!parsedResult) return;

    const jsonString = JSON.stringify(parsedResult, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      toast({
        title: t('common.success'),
        description: 'JSON copied to clipboard'
      });
    });
  };

  const handleClearText = () => {
    setRawText('');
    setParsedResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {t('debug.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('debug.description')}
          </p>
        </div>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Settings className="h-3 w-3 mr-1" />
          Debug Mode
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('debug.rawText')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={t('debug.pasteText')}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-64 font-mono text-sm"
            />
            
            <div className="flex gap-2">
              <Button 
                onClick={handleParseText}
                disabled={!rawText.trim() || isProcessing}
                className="flex-1"
              >
                {isProcessing ? t('common.loading') : t('debug.parseText')}
              </Button>
              <Button 
                variant="outline"
                onClick={handleClearText}
                disabled={!rawText && !parsedResult}
              >
                {t('debug.clearText')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('debug.parsedResults')}
              </span>
              {parsedResult && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyJSON}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
                  >
                    <Download className="h-4 w-4" />
                    {t('debug.exportJson')}
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parsedResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                     <span className="font-medium">Merchant Brand:</span>
                     <p className="text-muted-foreground">{parsedResult.merchant_brand || 'N/A'}</p>
                   </div>
                   <div>
                     <span className="font-medium">Raw Merchant:</span>
                     <p className="text-muted-foreground text-xs">{parsedResult.merchant_raw || 'N/A'}</p>
                   </div>
                  <div>
                    <span className="font-medium">Date:</span>
                    <p className="text-muted-foreground">{parsedResult.purchase_date || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Time:</span>
                    <p className="text-muted-foreground">{parsedResult.purchase_time || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Total:</span>
                    <p className="text-muted-foreground">₺{parsedResult.total.toFixed(2)}</p>
                  </div>
                </div>

                {parsedResult.store_address && (
                  <div>
                    <span className="font-medium text-sm">Address:</span>
                    <p className="text-sm text-muted-foreground">{parsedResult.store_address}</p>
                  </div>
                )}

                {parsedResult.payment_method && (
                  <div>
                    <span className="font-medium text-sm">Payment:</span>
                    <p className="text-sm text-muted-foreground font-mono">{parsedResult.payment_method}</p>
                  </div>
                )}

                <div>
                  <span className="font-medium text-sm">Items ({parsedResult.items.length}):</span>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {parsedResult.items.map((item, index) => (
                      <div key={index} className="text-xs bg-muted/50 p-2 rounded">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-muted-foreground">
                          {item.qty && `Qty: ${item.qty} • `}
                          {item.unit_price && `Unit: ₺${item.unit_price} • `}
                          {item.line_total && `Total: ₺${item.line_total}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Paste OCR text and click "Parse Text" to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OCRDebugPage;