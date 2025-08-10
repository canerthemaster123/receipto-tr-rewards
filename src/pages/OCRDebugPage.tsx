import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Textarea } from '../components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Copy, Download, FileText, Settings } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { formatTRY } from '../utils/currency';

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
  receipt_unique_no: string | null;
  fis_no: string | null;
  raw_text: string;
}

const OCRDebugPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedOCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sample Turkish receipt for testing
  const MIGROS_SAMPLE = `MİGROS TİCARET A.Ş.
GÜNEY MEGA STORE
Barbaros Mah. Begonya Sk. No:3/A
34349 İSTANBUL
VERGİ NO: 6200278131
TARİH: 08.01.2025
SAAT: 14:23:45
FİŞ NO: 0078

#60020857386623299
SERFRESH SADE ŞALGAM
*12,75

ZEYTIN DOLMASI
2,500 KG x 89,90
*224,75

KAMPANYA İNDİRİMİ
*-5,50

TUTAR İNDİRİM
*-3,25

ARA TOPLAM              228,75
TOPLAM                  *228,75

#494314******4645 ORTAK POS
ONAY KODU: 123456
TERMINAL: 12345678

4039592837461029583947261
`;

  // Since we can't directly import OCR functions in frontend, 
  // we'll create a simplified version for testing
  const parseOCRText = (text: string): ParsedOCRResult => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Extract merchant brand using simplified normalization
    let merchant = lines.find(line => 
      /^(MİGROS|MIGROS|BİM|A101|ŞOK|CARREFOUR|REAL|MACRO)/i.test(line)
    ) || lines[0] || '';
    
    // Normalize to brand
    let brand = merchant;
    if (/migros/i.test(merchant)) brand = 'Migros';
    else if (/bim/i.test(merchant)) brand = 'BİM';
    else if (/a101/i.test(merchant)) brand = 'A101';
    else if (/şok|sok/i.test(merchant)) brand = 'ŞOK';
    else if (/carrefour/i.test(merchant)) brand = 'CarrefourSA';

    // Extract date
    const datePattern = /TARİH\s*:\s*(\d{2}\.\d{2}\.\d{4})|(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})/i;
    const dateMatch = text.match(datePattern);
    const purchase_date = dateMatch ? (dateMatch[1] || dateMatch[2]) : '';

    // Extract time
    const timePattern = /SAAT\s*:\s*(\d{2}:\d{2}:\d{2})|(\d{1,2}:\d{2}:\d{2})/i;
    const timeMatch = text.match(timePattern);
    const purchase_time = timeMatch ? (timeMatch[1] || timeMatch[2]) : null;

    // Extract total (avoiding discount lines)
    const totalPattern = /TOPLAM[\s:]*₺?\*?(\d+[,\.]\d{2})/i;
    const totalMatch = text.match(totalPattern);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // Extract address (lines with street indicators)
    const store_address = lines.find(line =>
      /\b(Mah\.|Mahallesi|Sk\.|Sokak|No\b|Cad\.|Caddesi)\b/i.test(line)
    ) || null;

    // Extract payment method
    const paymentPattern = /#?(\d{6}\*{4,6}\d{4}|\d{4}\s*\*{4}\s*\d{4})/;
    const paymentMatch = text.match(paymentPattern);
    const payment_method = paymentMatch ? paymentMatch[1] : null;

    // Extract FİŞ NO
    const fisPattern = /FİŞ\s*NO\s*:\s*(\d+)/i;
    const fisMatch = text.match(fisPattern);
    const fis_no = fisMatch ? fisMatch[1] : null;

    // Extract barcode (18-24 digit sequence)
    const barcodePattern = /\b(\d{18,24})\b/;
    const barcodeLines = lines.slice(-5); // Check last 5 lines
    let receipt_unique_no = null;
    for (const line of barcodeLines) {
      const match = line.match(barcodePattern);
      if (match) {
        receipt_unique_no = match[1];
        break;
      }
    }

    // Parse items (filter out discounts, handle product codes)
    const items = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Skip header/footer lines and discounts
      if (/^(MİGROS|MIGROS|BİM|A101|VERGİ|MERSIS|TEL|TOPLAM|SAAT|TARİH|ONAY|TERMINAL)/i.test(line)) {
        i++;
        continue;
      }
      
      // Skip discount lines
      if (/\b(İNDİRİM|INDIRIM|KAMPANYA|PROMOSYON)\b/i.test(line)) {
        i++;
        continue;
      }
      
      // Check for product code (#<digits>)
      const productCodeMatch = line.match(/^#(\d{6,})/);
      if (productCodeMatch) {
        const product_code = productCodeMatch[1];
        // Look for item name on next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && /[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}/.test(nextLine) && 
              !/\b(İNDİRİM|INDIRIM|KAMPANYA)\b/i.test(nextLine)) {
            
            const priceMatch = nextLine.match(/\*?(\d+[,\.]\d{2})$/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : undefined;
            const name = nextLine.replace(/\*?\d+[,\.]\d{2}$/, '').trim();
            
            if (name.length >= 2) {
              items.push({
                name,
                line_total: price,
                raw_line: line,
                product_code
              });
            }
            i += 2; // Skip both lines
            continue;
          }
        }
      }
      
      // Regular item line
      if (/[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}/.test(line) && !/^\d+[,\.]\d{2}$/.test(line)) {
        const priceMatch = line.match(/\*?(\d+[,\.]\d{2})$/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : undefined;
        
        const qtyMatch = line.match(/(\d+(?:[,\.]\d+)?)\s*KG\s*x\s*(\d+(?:[,\.]\d+)?)/);
        let qty: number | undefined;
        let unit_price: number | undefined;
        
        if (qtyMatch) {
          qty = parseFloat(qtyMatch[1].replace(',', '.'));
          unit_price = parseFloat(qtyMatch[2].replace(',', '.'));
        }

        const name = line.replace(/\*?\d+[,\.]\d{2}$/, '').replace(/\d+(?:[,\.]\d+)?\s*KG\s*x\s*\d+(?:[,\.]\d+)?/, '').trim();
        
        if (name.length >= 2) {
          items.push({
            name,
            qty,
            unit_price,
            line_total: price,
            raw_line: line
          });
        }
      }
      i++;
    }

    return {
      merchant_raw: merchant.replace(/[^A-ZÇĞİÖŞÜa-zçğıöşü\s]/g, '').trim(),
      merchant_brand: brand,
      purchase_date,
      purchase_time,
      store_address,
      total,
      items,
      payment_method,
      receipt_unique_no,
      fis_no,
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

  const handleLoadSample = () => {
    setRawText(MIGROS_SAMPLE);
    toast({
      title: 'Sample Loaded',
      description: 'Migros sample receipt loaded for testing'
    });
  };

  const runUnitTests = () => {
    const tests = [
      {
        name: 'Discount lines are filtered out',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          const hasDiscountItems = result.items.some(item => 
            /\b(İNDİRİM|INDIRIM|KAMPANYA|PROMOSYON)\b/i.test(item.name)
          );
          return !hasDiscountItems;
        }
      },
      {
        name: 'Product code + name extraction',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          const productCodeItem = result.items.find(item => item.product_code);
          return productCodeItem && productCodeItem.name === 'SERFRESH SADE ŞALGAM' && 
                 productCodeItem.product_code === '60020857386623299';
        }
      },
      {
        name: 'Merchant brand normalization',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          return result.merchant_brand === 'Migros';
        }
      },
      {
        name: 'Barcode extraction',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          return result.receipt_unique_no === '4039592837461029583947261';
        }
      },
      {
        name: 'FİŞ NO extraction',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          return result.fis_no === '0078';
        }
      },
      {
        name: 'Total amount correct',
        test: () => {
          const result = parseOCRText(MIGROS_SAMPLE);
          return Math.abs(result.total - 228.75) < 0.01;
        }
      }
    ];

    const results = tests.map(({ name, test }) => {
      try {
        const passed = test();
        return { name, passed, error: null };
      } catch (error) {
        return { name, passed: false, error: error.message };
      }
    });

    const allPassed = results.every(r => r.passed);
    
    toast({
      title: `Unit Tests ${allPassed ? 'Passed' : 'Failed'}`,
      description: `${results.filter(r => r.passed).length}/${results.length} tests passed`,
      variant: allPassed ? 'default' : 'destructive'
    });

    console.log('OCR Unit Test Results:', results);
    return results;
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
                onClick={handleLoadSample}
              >
                Load Sample
              </Button>
              <Button 
                variant="outline"
                onClick={handleClearText}
                disabled={!rawText && !parsedResult}
              >
                {t('debug.clearText')}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={runUnitTests}
                className="flex-1"
              >
                Run Unit Tests
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
                     <p className="text-muted-foreground">{formatTRY(parsedResult.total)}</p>
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

                {parsedResult.receipt_unique_no && (
                  <div>
                    <span className="font-medium text-sm">Receipt No:</span>
                    <p className="text-sm text-muted-foreground font-mono">{parsedResult.receipt_unique_no}</p>
                  </div>
                )}

                {parsedResult.fis_no && (
                  <div>
                    <span className="font-medium text-sm">FİŞ NO:</span>
                    <p className="text-sm text-muted-foreground">{parsedResult.fis_no}</p>
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
                           {item.unit_price && `Unit: ${formatTRY(item.unit_price)} • `}
                           {item.line_total && `Total: ${formatTRY(item.line_total)}`}
                           {item.product_code && `Code: #${item.product_code}`}
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