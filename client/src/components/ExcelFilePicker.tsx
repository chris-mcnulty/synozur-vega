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

interface UserDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl?: string;
  owner?: { user?: { displayName: string } };
}

interface SharePointDrive {
  id: string;
  name: string;
  description?: string;
  webUrl?: string;
  driveType?: string;
}

interface ExcelWorksheet {
  id: string;
  name: string;
  position: number;
}

interface ExcelFileLinkConfig {
  excelSourceType: 'onedrive' | 'sharepoint';
  excelFileId: string;
  excelDriveId?: string; // Drive ID for SharePoint files
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
      ) : null}

      {showUrlInput && hasSites && (
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
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<OneDriveItem | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [cellReference, setCellReference] = useState('A1');
  const [autoSync, setAutoSync] = useState(false);
  const [previewValue, setPreviewValue] = useState<{ value: any; text: string; error?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Direct file URL input for SharePoint (uses Shares API)
  const [directFileUrl, setDirectFileUrl] = useState('');
  const [resolvingFile, setResolvingFile] = useState(false);
  const [fileResolveError, setFileResolveError] = useState('');
  
  // Direct site URL for browsing specific SharePoint site
  const [siteUrl, setSiteUrl] = useState('');
  const [resolvingSite, setResolvingSite] = useState(false);
  const [siteResolveError, setSiteResolveError] = useState('');
  const [resolvedSite, setResolvedSite] = useState<SharePointSite | null>(null);

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

  // Get all drives user has access to (OneDrive + SharePoint document libraries)
  const { data: userDrives, isLoading: drivesLoading } = useQuery<UserDrive[]>({
    queryKey: ['/api/m365/drives'],
    enabled: open && fileSource === 'sharepoint' && sharePointStatus?.connected,
  });

  // Filter to only SharePoint document libraries (exclude personal OneDrive)
  const sharePointDrives = userDrives?.filter(d => d.driveType === 'documentLibrary') || [];
  
  // Get drives from a specific resolved site
  const { data: siteDrives, isLoading: siteDrivesLoading, refetch: refetchSiteDrives } = useQuery<SharePointDrive[]>({
    queryKey: ['/api/m365/sharepoint/sites', resolvedSite?.id, 'drives'],
    queryFn: async () => {
      const res = await fetch(`/api/m365/sharepoint/sites/${resolvedSite?.id}/drives`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load document libraries');
      return res.json();
    },
    enabled: open && fileSource === 'sharepoint' && !!resolvedSite?.id,
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

  // SharePoint document library browsing using drives API
  const { data: sharePointFiles, isLoading: sharePointFilesLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/drives', selectedDriveId, 'files', currentFolderId],
    queryFn: async () => {
      let url = `/api/m365/drives/${selectedDriveId}/files`;
      if (currentFolderId) {
        url += `?folderId=${currentFolderId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load SharePoint documents');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'sharepoint' && !!selectedDriveId && !searchQuery,
  });

  // SharePoint Excel search using drives API
  const { data: sharePointSearchResults, isLoading: sharePointSearchLoading } = useQuery<OneDriveItem[]>({
    queryKey: ['/api/m365/drives', selectedDriveId, 'search', searchQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/m365/drives/${selectedDriveId}/search?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to search SharePoint');
      return res.json();
    },
    enabled: open && step === 'browse' && fileSource === 'sharepoint' && !!selectedDriveId && searchQuery.length > 0,
  });

  // Get driveId from the selected file or from the selected drive
  const selectedFileDriveId = selectedFile?.parentReference?.driveId || selectedDriveId;

  const { data: worksheets, isLoading: worksheetsLoading } = useQuery<ExcelWorksheet[]>({
    queryKey: ['/api/m365/excel/files', selectedFile?.id, 'worksheets', fileSource, selectedFileDriveId],
    queryFn: async () => {
      let url = `/api/m365/excel/files/${selectedFile!.id}/worksheets?sourceType=${fileSource}`;
      if (fileSource === 'sharepoint' && selectedFileDriveId) {
        url += `&driveId=${selectedFileDriveId}`;
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
      if (fileSource === 'sharepoint' && selectedFileDriveId) {
        url += `&driveId=${selectedFileDriveId}`;
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

  // Validate if URL is a supported Microsoft file URL
  const isValidMicrosoftFileUrl = (url: string): { valid: boolean; hint?: string } => {
    const lowerUrl = url.toLowerCase();
    
    // Valid domains for SharePoint and OneDrive
    const validDomains = [
      'sharepoint.com',
      'onedrive.com', 
      'onedrive.live.com',
      '1drv.ms',
      'officeapps.live.com',
      '-my.sharepoint.com', // Personal OneDrive for Business
    ];
    
    const hasValidDomain = validDomains.some(domain => lowerUrl.includes(domain));
    
    if (!hasValidDomain) {
      // Check for common mistakes
      if (lowerUrl.includes('google.com') || lowerUrl.includes('drive.google')) {
        return { valid: false, hint: 'Google Drive URLs are not supported. Please use a SharePoint or OneDrive file.' };
      }
      if (lowerUrl.includes('dropbox.com')) {
        return { valid: false, hint: 'Dropbox URLs are not supported. Please use a SharePoint or OneDrive file.' };
      }
      return { valid: false, hint: 'Please enter a URL from SharePoint or OneDrive. Open your Excel file in the browser and copy the URL from the address bar.' };
    }
    
    return { valid: true };
  };

  // Handle direct file URL resolution using Shares API
  const handleResolveFileUrl = async () => {
    if (!directFileUrl.trim()) return;
    
    let url = directFileUrl.trim();
    
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Validate URL is a Microsoft file URL
    const validation = isValidMicrosoftFileUrl(url);
    if (!validation.valid) {
      setFileResolveError(validation.hint || 'Invalid URL');
      return;
    }
    
    setResolvingFile(true);
    setFileResolveError('');
    
    try {
      const res = await fetch('/api/m365/sharepoint/resolve-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileUrl: url }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to access file');
      }
      
      const { item, driveId, siteId } = await res.json();
      
      // Validate it's an Excel file
      if (!item.name.endsWith('.xlsx') && !item.name.endsWith('.xls')) {
        throw new Error('This URL points to a file that is not an Excel spreadsheet. Please select an .xlsx or .xls file.');
      }
      
      // Set file info with the parent reference for proper API calls
      const fileWithRef: OneDriveItem = {
        ...item,
        parentReference: {
          ...item.parentReference,
          driveId: driveId,
          siteId: siteId,
        },
      };
      
      setSelectedFile(fileWithRef);
      // Store the driveId for use in worksheet/cell API calls
      if (siteId) {
        setSelectedSiteId(siteId);
      }
      // Update fileSource based on where the file came from
      if (siteId || url.includes('sharepoint.com')) {
        setFileSource('sharepoint');
      } else {
        setFileSource('onedrive');
      }
      setStep('configure');
      setSelectedSheet('');
      setPreviewValue(null);
      setDirectFileUrl('');
      
      toast({
        title: 'File loaded',
        description: `Ready to configure ${item.name}`,
      });
    } catch (error: any) {
      console.error('Failed to resolve file URL:', error);
      // Provide more helpful error messages
      let errorMsg = error.message || 'Could not access file';
      if (errorMsg.includes('access denied') || errorMsg.includes('Access denied')) {
        errorMsg = 'You do not have permission to access this file. Make sure it is shared with you.';
      } else if (errorMsg.includes('not found') || errorMsg.includes('Not found')) {
        errorMsg = 'File not found. Check that the URL is correct and the file still exists.';
      }
      setFileResolveError(errorMsg);
    } finally {
      setResolvingFile(false);
    }
  };

  // Resolve a SharePoint site URL to browse its document libraries
  const handleResolveSiteUrl = async () => {
    if (!siteUrl.trim()) return;
    
    let url = siteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Basic validation for SharePoint URL
    if (!url.includes('sharepoint.com')) {
      setSiteResolveError('Please enter a valid SharePoint site URL (e.g., https://yourcompany.sharepoint.com/sites/Marketing)');
      return;
    }
    
    setResolvingSite(true);
    setSiteResolveError('');
    
    try {
      const res = await fetch('/api/m365/sharepoint/resolve-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteUrl: url }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to access site');
      }
      
      const site: SharePointSite = await res.json();
      setResolvedSite(site);
      setSelectedSiteId(site.id);
      setSiteUrl('');
      
      toast({
        title: 'Site connected',
        description: `Now browsing ${site.displayName || site.name}`,
      });
    } catch (error: any) {
      console.error('Failed to resolve site URL:', error);
      setSiteResolveError(error.message || 'Could not access this SharePoint site. Check the URL and your permissions.');
    } finally {
      setResolvingSite(false);
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
    
    // Get driveId from parentReference (set during URL resolution or browsing)
    const driveId = selectedFile.parentReference?.driveId || selectedDriveId;
    
    linkMutation.mutate({
      excelSourceType: fileSource,
      excelFileId: selectedFile.id,
      excelDriveId: driveId || undefined,
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
            {/* Primary method: Paste URL - works for both OneDrive and SharePoint */}
            <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Paste File URL (Recommended)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Works with any SharePoint or OneDrive Excel file you can access
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://yourcompany.sharepoint.com/sites/.../file.xlsx"
                  value={directFileUrl}
                  onChange={(e) => {
                    setDirectFileUrl(e.target.value);
                    setFileResolveError('');
                  }}
                  disabled={resolvingFile}
                  data-testid="input-direct-file-url"
                  className="flex-1"
                />
                <Button 
                  onClick={handleResolveFileUrl}
                  disabled={resolvingFile || !directFileUrl.trim()}
                  data-testid="button-load-file"
                >
                  {resolvingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
                </Button>
              </div>
              {fileResolveError && (
                <p className="text-sm text-destructive mt-2">{fileResolveError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Open your Excel file in SharePoint or OneDrive, copy the URL from your browser's address bar
              </p>
            </div>

            {/* Divider */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or browse files</span>
              </div>
            </div>

            {/* Secondary method: Browse files */}
            <Tabs value={fileSource} onValueChange={(v) => handleSourceChange(v as FileSourceType)} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="onedrive" disabled={!oneDriveStatus?.connected} data-testid="tab-onedrive">
                  <Cloud className="h-4 w-4 mr-2" />
                  OneDrive
                </TabsTrigger>
                <TabsTrigger 
                  value="sharepoint" 
                  data-testid="tab-sharepoint"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  SharePoint
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {fileSource === 'sharepoint' && (
              <div className="mb-4">
                {/* Show resolved site or site URL input */}
                {resolvedSite ? (
                  <div className="mb-3 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="font-medium">{resolvedSite.displayName || resolvedSite.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setResolvedSite(null);
                          setSelectedSiteId(null);
                          setSelectedDriveId(null);
                          setCurrentFolderId(null);
                          setFolderStack([]);
                        }}
                        data-testid="button-change-site"
                      >
                        Change Site
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <Label className="text-sm font-medium mb-2 block">SharePoint Site URL</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://yourcompany.sharepoint.com/sites/Marketing"
                        value={siteUrl}
                        onChange={(e) => {
                          setSiteUrl(e.target.value);
                          setSiteResolveError('');
                        }}
                        disabled={resolvingSite}
                        data-testid="input-site-url"
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleResolveSiteUrl}
                        disabled={resolvingSite || !siteUrl.trim()}
                        data-testid="button-connect-site"
                      >
                        {resolvingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                      </Button>
                    </div>
                    {siteResolveError && (
                      <p className="text-sm text-destructive mt-2">{siteResolveError}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter the URL of your SharePoint site to browse its document libraries
                    </p>
                  </div>
                )}

                {/* Document library selector - show when site is resolved */}
                {resolvedSite && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Document Library</Label>
                    <Select
                      value={selectedDriveId || ''}
                      onValueChange={(value) => {
                        setSelectedDriveId(value);
                        setCurrentFolderId(null);
                        setFolderStack([]);
                      }}
                    >
                      <SelectTrigger data-testid="select-drive" className="w-full">
                        <SelectValue placeholder={siteDrivesLoading ? "Loading document libraries..." : "Select a document library"} />
                      </SelectTrigger>
                      <SelectContent>
                        {siteDrives?.map((drive) => (
                          <SelectItem key={drive.id} value={drive.id}>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-primary" />
                              <span>{drive.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {!siteDrivesLoading && (!siteDrives || siteDrives.length === 0) && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No document libraries found in this site.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search Excel files in ${fileSource === 'onedrive' ? 'OneDrive' : 'SharePoint'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={fileSource === 'sharepoint' && !selectedDriveId}
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

            <ScrollArea className="h-[250px] border rounded-lg p-2">
              {fileSource === 'sharepoint' && (!sharePointStatus?.connected || !selectedDriveId) ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Globe className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-center">
                    {sharePointStatus?.connected 
                      ? "Select a document library above to browse"
                      : "SharePoint browsing not available"}
                  </p>
                  <p className="text-xs text-center mt-1 max-w-xs">
                    Use the "Paste File URL" option above for direct access to any SharePoint file
                  </p>
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
