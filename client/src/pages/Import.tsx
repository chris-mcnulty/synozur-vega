import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileArchive, Clock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';

export default function Import() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  // Import options
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'merge' | 'create'>('skip');
  const [importCheckIns, setImportCheckIns] = useState(true);
  const [importTeams, setImportTeams] = useState(true);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);

  // Fetch import history
  const { data: importHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/import/history'],
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please select a ZIP file',
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify({
        duplicateStrategy,
        importCheckIns,
        importTeams,
        fiscalYearStartMonth,
      }));
      
      // Send the currently selected tenant
      if (currentTenant) {
        formData.append('tenantId', currentTenant.id);
      }

      const response = await fetch('/api/import/viva-goals', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      const result = await response.json();
      setImportResult(result);

      // Refresh import history
      queryClient.invalidateQueries({ queryKey: ['/api/import/history'] });

      // Refresh OKR data
      queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks'] });

      if (result.success) {
        toast({
          title: 'Import successful!',
          description: `Imported ${result.summary.objectivesCreated} objectives, ${result.summary.keyResultsCreated} key results, ${result.summary.bigRocksCreated} big rocks`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Import failed',
          description: result.errors?.[0] || 'Unknown error occurred',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      setImportResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Import Data</h1>
      </div>

      {/* Import from Viva Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Import from Viva Goals
          </CardTitle>
          <CardDescription>
            Upload your Viva Goals export ZIP file to import objectives, key results, and check-ins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Export ZIP File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={importing}
                data-testid="input-import-file"
              />
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              )}
            </div>
          </div>

          {/* Import Options */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duplicate-strategy">Duplicate Strategy</Label>
              <Select
                value={duplicateStrategy}
                onValueChange={(value: any) => setDuplicateStrategy(value)}
                disabled={importing}
              >
                <SelectTrigger id="duplicate-strategy" data-testid="select-duplicate-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip duplicates</SelectItem>
                  <SelectItem value="merge">Merge duplicates</SelectItem>
                  <SelectItem value="create">Create anyway</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscal-year-start">Fiscal Year Start Month</Label>
              <Select
                value={String(fiscalYearStartMonth)}
                onValueChange={(value) => setFiscalYearStartMonth(Number(value))}
                disabled={importing}
              >
                <SelectTrigger id="fiscal-year-start" data-testid="select-fiscal-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-checkins"
                checked={importCheckIns}
                onCheckedChange={(checked) => setImportCheckIns(checked as boolean)}
                disabled={importing}
                data-testid="checkbox-import-checkins"
              />
              <Label htmlFor="import-checkins" className="cursor-pointer">
                Import check-in history
              </Label>
            </div>

          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!selectedFile || importing}
            className="w-full"
            size="lg"
            data-testid="button-start-import"
          >
            {importing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import from Viva Goals
              </>
            )}
          </Button>

          {/* Import Results */}
          {importResult && (
            <Alert variant={importResult.success ? 'default' : 'destructive'} data-testid="alert-import-result">
              {importResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{importResult.success ? 'Import Successful' : 'Import Failed'}</AlertTitle>
              <AlertDescription>
                {importResult.success ? (
                  <div className="space-y-2 mt-2">
                    <p className="font-medium">Summary:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{importResult.summary.objectivesCreated} objectives created</li>
                      <li>{importResult.summary.keyResultsCreated} key results created</li>
                      <li>{importResult.summary.bigRocksCreated} big rocks created</li>
                      {importResult.summary.checkInsCreated > 0 && (
                        <li>{importResult.summary.checkInsCreated} check-ins imported</li>
                      )}
                    </ul>
                    {importResult.warnings.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-warning flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings ({importResult.warnings.length}):
                        </p>
                        <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                          {importResult.warnings.slice(0, 5).map((warning: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground">{warning}</li>
                          ))}
                          {importResult.warnings.length > 5 && (
                            <li className="text-muted-foreground">... and {importResult.warnings.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {importResult.errors?.map((error: string, idx: number) => (
                      <p key={idx}>{error}</p>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Import History
          </CardTitle>
          <CardDescription>Previous imports for this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-muted-foreground">Loading history...</p>
          ) : !importHistory || importHistory.length === 0 ? (
            <p className="text-muted-foreground">No import history yet</p>
          ) : (
            <div className="space-y-3">
              {importHistory.slice(0, 10).map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`import-history-${record.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{record.fileName || 'Viva Goals Import'}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          record.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : record.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.importedAt).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      {record.objectivesCreated} objectives, {record.keyResultsCreated} key results,{' '}
                      {record.bigRocksCreated} big rocks
                    </p>
                  </div>
                  {record.warnings && record.warnings.length > 0 && (
                    <div className="text-sm text-warning flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {record.warnings.length} warnings
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
