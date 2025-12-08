import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileSpreadsheet, Folder, Search, RefreshCw, ExternalLink, AlertCircle, CheckCircle, Globe, Cloud } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type FileSourceType = 'onedrive' | 'sharepoint';

interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { driveId: string; driveType?: string; id: string; path: string; siteId?: string };
}

interface SharePointSite {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
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
  excelSiteId?: string;
}

interface ExcelFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  keyResultTitle: string;
  currentConfig?: Partial<ExcelFileLinkConfig>;
  onSuccess?: () => void;
}

// Component for selecting SharePoint sites with manual URL fallback
function SharePointSiteSelector({
  sites,
  sitesLoading,
  selectedSiteId,
  onSiteSelect,
}: {
  sites: SharePointSite[];
  sitesLoading: boolean;
  selectedSiteId: string | null;
  onSiteSelect: (siteId: string) => void;
}) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const { toast } = useToast();

  const handleResolveUrl = async () => {
    if (!siteUrl.trim()) return;
    
    setResolving(true);
    setResolveError('');
    
    try {
      const res = await fetch('/api/m365/sharepoint/resolve-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteUrl: siteUrl.trim() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resolve site');
      }
      
      const site = await res.json();
      onSiteSelect(site.id);
      toast({
        title: 'Site connected',
        description: `Connected to ${site.displayName || site.name}`,
      });
      setShowUrlInput(false);
      setSiteUrl('');
    } catch (e: any) {
      setResolveError(e.message);
    } finally {
      setResolving(false);
    }
  };

  const hasSites = sites.length > 0;

  return (
    <div className="mb-4 space-y-3">
      {hasSites ? (
        <>
          <Label className="text-sm text-muted-foreground block">Select a SharePoint site</Label>
          <Select 
            value={selectedSiteId || ''} 
            onValueChange={onSiteSelect}
          >
            <SelectTrigger data-testid="select-sharepoint-site">
              <SelectValue placeholder={sitesLoading ? 'Loading sites...' : 'Choose a site'} />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button 
            type="button"
            className="text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => setShowUrlInput(!showUrlInput)}
          >
            {showUrlInput ? 'Hide' : "Can't find your site? Enter URL manually"}
          </button>
        </>
      ) : sitesLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading available sites...</span>
        </div>
      ) : (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600" />
            <div>
              <p className="font-medium">No sites found automatically</p>
              <p className="text-muted-foreground">
                Enter your SharePoint site URL below to connect directly.
              </p>
            </div>
          </div>
        </div>
      )}

      {(showUrlInput || !hasSites) && !sitesLoading && (
        <div className="space-y-2">
          <Label className="text-sm">SharePoint Site URL</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://yourcompany.sharepoint.com/sites/yoursite"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              disabled={resolving}
              data-testid="input-sharepoint-url"
            />
            <Button 
              onClick={handleResolveUrl} 
              disabled={resolving || !siteUrl.trim()}
              data-testid="button-connect-sharepoint"
            >
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
            </Button>
          </div>
          {resolveError && (
            <p className="text-sm text-destructive">{resolveError}</p>
          )}
        </div>
      )}
    </div>
  );
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
  const [fileSource, setFileSource] = useState<FileSourceType>('onedrive');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
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

  const { data: sharePointStatus } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/m365/sharepoint/status'],
    enabled: open,
  });

  const { data: sharePointSites, isLoading: sitesLoading } = useQuery<SharePointSite[]>({
    queryKey: ['/api/m365/sharepoint/sites'],
    enabled: open && fileSource === 'sharepoint' && sharePointStatus?.connected,
  });

  // OneDrive file browsing
  const { data: oneDriveFiles, isLoading: oneDriveFilesLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/onedrive/files', currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/m365/onedrive/files?folderId=${currentFolderId}`
        : '/api/m365/onedrive/files';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load files');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'onedrive' && !searchQuery && oneDriveStatus?.connected,
  });

  // OneDrive Excel search
  const { data: oneDriveSearchResults, isLoading: oneDriveSearchLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/excel/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/m365/excel/search?q=${encodeURIComponent(searchQuery)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to search');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'onedrive' && searchQuery.length > 0,
  });

  // SharePoint document library browsing
  const { data: sharePointFiles, isLoading: sharePointFilesLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/sharepoint/sites', selectedSiteId, 'documents', currentFolderId],
    queryFn: async () => {
      let url = `/api/m365/sharepoint/sites/${selectedSiteId}/documents`;
      if (currentFolderId) {
        url += `?folderId=${currentFolderId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load SharePoint documents');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'sharepoint' && !!selectedSiteId && !searchQuery,
  });

  // SharePoint Excel search
  const { data: sharePointSearchResults, isLoading: sharePointSearchLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/sharepoint/sites', selectedSiteId, 'excel-search', searchQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/m365/sharepoint/sites/${selectedSiteId}/excel-search?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to search SharePoint');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'sharepoint' && !!selectedSiteId && searchQuery.length > 0,
  });

  const { data: worksheets, isLoading: worksheetsLoading } = useQuery<ExcelWorksheet[]>({
    queryKey: ['/api/m365/excel/files', selectedFile?.id, 'worksheets', fileSource, selectedSiteId],
    queryFn: async () => {
      let url = `/api/m365/excel/files/${selectedFile!.id}/worksheets?sourceType=${fileSource}`;
      if (fileSource === 'sharepoint' && selectedSiteId) {
        url += `&siteId=${selectedSiteId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
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
      let url = `/api/m365/excel/files/${selectedFile.id}/cell?cell=${encodeURIComponent(cellRef)}&sourceType=${fileSource}`;
      if (fileSource === 'sharepoint' && selectedSiteId) {
        url += `&siteId=${selectedSiteId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      
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
      excelSourceType: fileSource,
      excelFileId: selectedFile.id,
      excelFileName: selectedFile.name,
      excelFilePath: path,
      excelSheetName: selectedSheet,
      excelCellReference: cellReference,
      excelAutoSync: autoSync,
      ...(fileSource === 'sharepoint' && selectedSiteId ? { excelSiteId: selectedSiteId } : {}),
    } as ExcelFileLinkConfig);
  };

  // Compute displayed files based on source
  const getDisplayedFiles = (): OneDriveItem[] | undefined => {
    if (fileSource === 'onedrive') {
      return searchQuery ? oneDriveSearchResults : oneDriveFiles;
    } else {
      return searchQuery ? sharePointSearchResults : sharePointFiles;
    }
  };
  
  const getIsLoading = (): boolean => {
    if (fileSource === 'onedrive') {
      return searchQuery ? oneDriveSearchLoading : oneDriveFilesLoading;
    } else {
      return searchQuery ? sharePointSearchLoading : sharePointFilesLoading;
    }
  };

  const displayedFiles = getDisplayedFiles();
  const isLoading = getIsLoading();

  const resetState = () => {
    setStep('browse');
    setFileSource('onedrive');
    setSelectedSiteId(null);
    setSearchQuery('');
    setCurrentFolderId(null);
    setFolderStack([]);
    setSelectedFile(null);
    setSelectedSheet('');
    setCellReference('A1');
    setAutoSync(false);
    setPreviewValue(null);
  };

  const handleSourceChange = (source: FileSourceType) => {
    setFileSource(source);
    setSearchQuery('');
    setCurrentFolderId(null);
    setFolderStack([]);
    setSelectedSiteId(null);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const bothDisconnected = !oneDriveStatus?.connected && !sharePointStatus?.connected;
  
  if (bothDisconnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect to Microsoft 365</DialogTitle>
            <DialogDescription>Link this Key Result to an Excel file for live data updates</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Unable to connect to OneDrive or SharePoint. Please ensure you're logged in and try again.
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/m365/onedrive/status'] });
                queryClient.invalidateQueries({ queryKey: ['/api/m365/sharepoint/status'] });
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
              ? 'Choose an Excel file from OneDrive or SharePoint to link to this Key Result'
              : `Linking "${selectedFile?.name}" to "${keyResultTitle}"`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'browse' && (
          <>
            <Tabs value={fileSource} onValueChange={(v) => handleSourceChange(v as FileSourceType)} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="onedrive" disabled={!oneDriveStatus?.connected} data-testid="tab-onedrive">
                  <Cloud className="h-4 w-4 mr-2" />
                  OneDrive
                </TabsTrigger>
                <TabsTrigger value="sharepoint" disabled={!sharePointStatus?.connected} data-testid="tab-sharepoint">
                  <Globe className="h-4 w-4 mr-2" />
                  SharePoint
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {fileSource === 'sharepoint' && (
              <SharePointSiteSelector
                sites={sharePointSites || []}
                sitesLoading={sitesLoading}
                selectedSiteId={selectedSiteId}
                onSiteSelect={(siteId) => {
                  setSelectedSiteId(siteId);
                  setCurrentFolderId(null);
                  setFolderStack([]);
                }}
              />
            )}

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search Excel files in ${fileSource === 'onedrive' ? 'OneDrive' : 'SharePoint'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={fileSource === 'sharepoint' && !selectedSiteId}
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
              {fileSource === 'sharepoint' && !selectedSiteId ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Globe className="h-12 w-12 mb-2" />
                  <p>Select a SharePoint site to browse files</p>
                </div>
              ) : isLoading ? (
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
              <Badge variant="outline" className="text-xs">
                {fileSource === 'onedrive' ? (
                  <><Cloud className="h-3 w-3 mr-1" /> OneDrive</>
                ) : (
                  <><Globe className="h-3 w-3 mr-1" /> SharePoint</>
                )}
              </Badge>
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
