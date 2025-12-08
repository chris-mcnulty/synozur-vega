import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, FileSpreadsheet, Folder, Search, RefreshCw, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { driveId: string; id: string; path: string };
}

interface ExcelWorksheet {
  id: string;
  name: string;
  position: number;
}

interface ExcelFileLinkConfig {
  excelSourceType: 'onedrive' | 'sharepoint';
  excelFileId: string;
  excelFileName: string;
  excelFilePath: string;
  excelSheetName: string;
  excelCellReference: string;
  excelAutoSync: boolean;
}

interface ExcelFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  keyResultTitle: string;
  currentConfig?: Partial<ExcelFileLinkConfig>;
  onSuccess?: () => void;
}

export function ExcelFilePicker({
  open,
  onOpenChange,
  keyResultId,
  keyResultTitle,
  currentConfig,
  onSuccess,
}: ExcelFilePickerProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'browse' | 'configure'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<OneDriveItem | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [cellReference, setCellReference] = useState('A1');
  const [autoSync, setAutoSync] = useState(false);
  const [previewValue, setPreviewValue] = useState<{ value: any; text: string; error?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: oneDriveStatus } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/m365/onedrive/status'],
    enabled: open,
  });

  const { data: files, isLoading: filesLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/onedrive/files', currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/m365/onedrive/files?folderId=${currentFolderId}`
        : '/api/m365/onedrive/files';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load files');
      return res.json();
    },
    enabled: open && step === 'browse' && !searchQuery && oneDriveStatus?.connected,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/excel/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/m365/excel/search?q=${encodeURIComponent(searchQuery)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to search');
      return res.json();
    },
    enabled: open && step === 'browse' && searchQuery.length > 0,
  });

  const { data: worksheets, isLoading: worksheetsLoading } = useQuery<ExcelWorksheet[]>({
    queryKey: ['/api/m365/excel/files', selectedFile?.id, 'worksheets'],
    queryFn: async () => {
      const res = await fetch(`/api/m365/excel/files/${selectedFile!.id}/worksheets`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load worksheets');
      return res.json();
    },
    enabled: open && step === 'configure' && !!selectedFile,
  });

  const linkMutation = useMutation({
    mutationFn: async (config: ExcelFileLinkConfig) => {
      const res = await fetch(`/api/m365/key-results/${keyResultId}/link-excel`, {
        method: 'POST',
        body: JSON.stringify(config),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to link Excel');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.syncError ? 'Linked with warning' : 'Excel linked successfully',
        description: data.syncError || `Value synced: ${data.syncedValue}`,
        variant: data.syncError ? 'destructive' : 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/key-results'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to link Excel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (worksheets && worksheets.length > 0 && !selectedSheet) {
      setSelectedSheet(worksheets[0].name);
    }
  }, [worksheets, selectedSheet]);

  const previewCellValue = async () => {
    if (!selectedFile || !cellReference) return;
    
    setPreviewLoading(true);
    try {
      const cellRef = selectedSheet ? `${selectedSheet}!${cellReference}` : cellReference;
      const res = await fetch(
        `/api/m365/excel/files/${selectedFile.id}/cell?cell=${encodeURIComponent(cellRef)}`,
        { credentials: 'include' }
      );
      
      if (!res.ok) {
        const error = await res.json();
        setPreviewValue({ value: null, text: '', error: error.error || 'Failed to read cell' });
      } else {
        const data = await res.json();
        setPreviewValue({
          value: data.value,
          text: data.text,
          error: data.numberValue === undefined ? 'Cell does not contain a numeric value' : undefined,
        });
      }
    } catch (err: any) {
      setPreviewValue({ value: null, text: '', error: err.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileSelect = (file: OneDriveItem) => {
    if (file.folder) {
      setFolderStack([...folderStack, { id: file.id, name: file.name }]);
      setCurrentFolderId(file.id);
    } else if (file.file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      setStep('configure');
      setSelectedSheet('');
      setPreviewValue(null);
    }
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('browse');
      setSelectedFile(null);
      setSelectedSheet('');
      setPreviewValue(null);
    } else if (folderStack.length > 0) {
      const newStack = [...folderStack];
      newStack.pop();
      setFolderStack(newStack);
      setCurrentFolderId(newStack.length > 0 ? newStack[newStack.length - 1].id : null);
    }
  };

  const handleLink = () => {
    if (!selectedFile || !cellReference) return;
    
    const path = selectedFile.parentReference?.path 
      ? selectedFile.parentReference.path.replace('/drive/root:', '') + '/' + selectedFile.name
      : '/' + selectedFile.name;
    
    linkMutation.mutate({
      excelSourceType: 'onedrive',
      excelFileId: selectedFile.id,
      excelFileName: selectedFile.name,
      excelFilePath: path,
      excelSheetName: selectedSheet,
      excelCellReference: cellReference,
      excelAutoSync: autoSync,
    });
  };

  const displayedFiles = searchQuery ? searchResults : files;
  const isLoading = searchQuery ? searchLoading : filesLoading;

  const resetState = () => {
    setStep('browse');
    setSearchQuery('');
    setCurrentFolderId(null);
    setFolderStack([]);
    setSelectedFile(null);
    setSelectedSheet('');
    setCellReference('A1');
    setAutoSync(false);
    setPreviewValue(null);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  if (!oneDriveStatus?.connected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect to OneDrive</DialogTitle>
            <DialogDescription>Link this Key Result to an Excel file for live data updates</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Unable to connect to OneDrive. Please ensure you're logged in and try again.
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                // Invalidate the status query to recheck connection
                queryClient.invalidateQueries({ queryKey: ['/api/m365/onedrive/status'] });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'browse' ? 'Select Excel File' : 'Configure Excel Link'}
          </DialogTitle>
          <DialogDescription>
            {step === 'browse' 
              ? 'Choose an Excel file from your OneDrive to link to this Key Result'
              : `Linking "${selectedFile?.name}" to "${keyResultTitle}"`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'browse' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Excel files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-excel-search"
                />
              </div>
            </div>

            {folderStack.length > 0 && !searchQuery && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Button variant="ghost" size="sm" onClick={() => { setFolderStack([]); setCurrentFolderId(null); }}>
                  Root
                </Button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="flex items-center">
                    <span>/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newStack = folderStack.slice(0, idx + 1);
                        setFolderStack(newStack);
                        setCurrentFolderId(folder.id);
                      }}
                    >
                      {folder.name}
                    </Button>
                  </span>
                ))}
              </div>
            )}

            <ScrollArea className="h-[300px] border rounded-lg p-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !displayedFiles || displayedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mb-2" />
                  <p>{searchQuery ? 'No Excel files found' : 'No files in this folder'}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayedFiles.map((item) => {
                    const isExcel = item.file && (item.name.endsWith('.xlsx') || item.name.endsWith('.xls'));
                    const isFolder = !!item.folder;
                    
                    if (!isExcel && !isFolder) return null;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleFileSelect(item)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        data-testid={`file-item-${item.id}`}
                      >
                        {isFolder ? (
                          <Folder className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          {isFolder && (
                            <p className="text-xs text-muted-foreground">
                              {item.folder?.childCount} items
                            </p>
                          )}
                        </div>
                        {isExcel && (
                          <Badge variant="secondary" className="text-xs">
                            Excel
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {step === 'configure' && selectedFile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedFile.parentReference?.path?.replace('/drive/root:', '') || '/'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="worksheet">Worksheet</Label>
                <Select
                  value={selectedSheet}
                  onValueChange={setSelectedSheet}
                  disabled={worksheetsLoading}
                >
                  <SelectTrigger id="worksheet" data-testid="select-worksheet">
                    <SelectValue placeholder={worksheetsLoading ? 'Loading...' : 'Select worksheet'} />
                  </SelectTrigger>
                  <SelectContent>
                    {worksheets?.map((ws) => (
                      <SelectItem key={ws.id} value={ws.name}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cell">Cell Reference</Label>
                <div className="flex gap-2">
                  <Input
                    id="cell"
                    value={cellReference}
                    onChange={(e) => setCellReference(e.target.value.toUpperCase())}
                    placeholder="e.g., B5"
                    className="font-mono"
                    data-testid="input-cell-reference"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={previewCellValue}
                    disabled={previewLoading || !selectedSheet}
                    data-testid="button-preview-cell"
                  >
                    {previewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {previewValue && (
              <div className={`p-3 rounded-lg border ${previewValue.error ? 'border-destructive bg-destructive/10' : 'border-green-500 bg-green-500/10'}`}>
                <div className="flex items-center gap-2">
                  {previewValue.error ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium">
                    {previewValue.error ? 'Error' : 'Preview'}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  {previewValue.error || `Cell value: ${previewValue.text} (${typeof previewValue.value})`}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto-sync on page load</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically update the Key Result value when viewing
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={autoSync}
                onCheckedChange={setAutoSync}
                data-testid="switch-auto-sync"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {(step === 'configure' || folderStack.length > 0) && (
            <Button variant="outline" onClick={handleBack} data-testid="button-back">
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          {step === 'configure' && (
            <Button
              onClick={handleLink}
              disabled={!selectedFile || !cellReference || linkMutation.isPending}
              data-testid="button-link-excel"
            >
              {linkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Link to Excel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
