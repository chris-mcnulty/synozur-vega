import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Brain, 
  Plus, 
  Pencil, 
  Trash2, 
  FileText, 
  BookOpen, 
  Lightbulb, 
  Tag, 
  FileCode,
  Upload,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Building2 } from "lucide-react";

type GroundingDocument = {
  id: string;
  tenantId: string | null;
  title: string;
  description: string | null;
  category: string;
  content: string;
  priority: number | null;
  isActive: boolean | null;
  isTenantBackground: boolean | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type Tenant = {
  id: string;
  name: string;
};

// INSTRUCTIONAL categories - included in AI system prompt as rules/guidance
const INSTRUCTIONAL_CATEGORIES = ["methodology", "best_practices", "terminology", "examples"];
// CONTEXTUAL categories - included in AI user prompt as organizational context
const CONTEXTUAL_CATEGORIES = ["background_context", "company_os"];

const CATEGORIES = [
  { value: "methodology", label: "Methodology & Framework", icon: Brain, description: "OKR methodology and best practices (instructional)", type: "instructional" },
  { value: "best_practices", label: "Best Practices", icon: Lightbulb, description: "Tips and guidelines for effective execution (instructional)", type: "instructional" },
  { value: "terminology", label: "Key Terminology", icon: Tag, description: "Definitions and glossary (instructional)", type: "instructional" },
  { value: "examples", label: "Examples & Templates", icon: FileCode, description: "Sample content and templates (instructional)", type: "instructional" },
  { value: "background_context", label: "Background Context", icon: Building2, description: "Company-specific background, industry, history (contextual)", type: "contextual" },
  { value: "company_os", label: "Company OS Overview", icon: BookOpen, description: "Existing CoS elements for reference (contextual)", type: "contextual" },
];

export { INSTRUCTIONAL_CATEGORIES, CONTEXTUAL_CATEGORIES };

function getCategoryInfo(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
}

export default function AIGroundingAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenants } = useTenant();
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<GroundingDocument | null>(null);
  const [viewingDocument, setViewingDocument] = useState<GroundingDocument | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "company_os",
    content: "",
    priority: 0,
    isActive: true,
    isTenantBackground: false,
    tenantId: null as string | null,
  });

  const { data: documents = [], isLoading } = useQuery<GroundingDocument[]>({
    queryKey: ["/api/ai/grounding-documents"],
  });

  // Helper to get tenant name by ID
  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return null;
    return tenants.find(t => t.id === tenantId)?.name || "Unknown Tenant";
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/ai/grounding-documents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/grounding-documents"] });
      toast({ title: "Success", description: "Grounding document created" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create document", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/ai/grounding-documents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/grounding-documents"] });
      toast({ title: "Success", description: "Grounding document updated" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update document", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ai/grounding-documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/grounding-documents"] });
      toast({ title: "Success", description: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/ai/grounding-documents/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/grounding-documents"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle status", variant: "destructive" });
    },
  });

  function openCreateDialog() {
    setEditingDocument(null);
    setFormData({
      title: "",
      description: "",
      category: "company_os",
      content: "",
      priority: 0,
      isActive: true,
      isTenantBackground: false,
      tenantId: null,
    });
    setDocumentDialogOpen(true);
  }

  function openEditDialog(doc: GroundingDocument) {
    setEditingDocument(doc);
    setFormData({
      title: doc.title,
      description: doc.description || "",
      category: doc.category,
      content: doc.content,
      priority: doc.priority || 0,
      isActive: doc.isActive ?? true,
      isTenantBackground: doc.isTenantBackground ?? false,
      tenantId: doc.tenantId || null,
    });
    setDocumentDialogOpen(true);
  }

  function openViewDialog(doc: GroundingDocument) {
    setViewingDocument(doc);
    setViewDialogOpen(true);
  }

  function closeDialog() {
    setDocumentDialogOpen(false);
    setEditingDocument(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingDocument) {
      updateMutation.mutate({ id: editingDocument.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      let content = "";
      
      if (fileExtension === 'pdf') {
        // Parse PDF file
        const arrayBuffer = await file.arrayBuffer();
        const response = await fetch('/api/ai/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuffer,
        });
        if (!response.ok) throw new Error('Failed to parse PDF');
        const result = await response.json();
        content = result.text;
      } else if (fileExtension === 'docx') {
        // Parse DOCX file
        const arrayBuffer = await file.arrayBuffer();
        const response = await fetch('/api/ai/parse-docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuffer,
        });
        if (!response.ok) throw new Error('Failed to parse DOCX');
        const result = await response.json();
        content = result.text;
      } else {
        // Handle text files (.txt, .md, .json)
        content = await file.text();
      }
      
      setFormData(prev => ({ ...prev, content }));
      
      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        setFormData(prev => ({ ...prev, title: fileName }));
      }
      
      toast({ title: "File loaded", description: `Loaded content from ${file.name}` });
    } catch (error) {
      console.error('File upload error:', error);
      toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
    }
  }

  // Check if user is admin
  const isAdmin = user && ["admin", "global_admin", "vega_admin", "vega_consultant"].includes(user.role);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Grounding Documents</h1>
            <p className="text-muted-foreground">Access restricted</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Grounding Documents</h1>
            <p className="text-muted-foreground">Master context documents to guide AI responses</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-document">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Grounding Documents
          </CardTitle>
          <CardDescription>
            These documents are injected into AI conversations to provide context about the Company OS methodology.
            Higher priority documents are included first. Only active documents are used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No grounding documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Add documents to provide context for AI responses
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Document
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const categoryInfo = getCategoryInfo(doc.category);
                  const CategoryIcon = categoryInfo.icon;
                  return (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell>
                        <div className="font-medium">{doc.title}</div>
                        {doc.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {doc.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {doc.tenantId ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Building2 className="h-3 w-3" />
                              {getTenantName(doc.tenantId)}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <Brain className="h-3 w-3" />
                              Global
                            </Badge>
                          )}
                          {doc.isTenantBackground && (
                            <Badge variant="default" className="w-fit text-xs">
                              Background Context
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <CategoryIcon className="h-3 w-3" />
                          {categoryInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.priority || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={doc.isActive ?? true}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: doc.id, isActive: checked })
                            }
                            data-testid={`switch-active-${doc.id}`}
                          />
                          {doc.isActive ? (
                            <Eye className="h-4 w-4 text-green-500" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {doc.content.length.toLocaleString()} chars
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDialog(doc)}
                            data-testid={`button-view-${doc.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(doc)}
                            data-testid={`button-edit-${doc.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Delete this grounding document?")) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            data-testid={`button-delete-${doc.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Reference</CardTitle>
          <CardDescription>Understanding grounding document categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.value} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-sm text-muted-foreground">{cat.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? "Edit Grounding Document" : "Add Grounding Document"}
            </DialogTitle>
            <DialogDescription>
              {editingDocument
                ? "Update the document content and settings"
                : "Create a new document to guide AI responses"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., OKR Best Practices"
                  required
                  data-testid="input-title"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this document's purpose"
                  data-testid="input-description"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant">Scope</Label>
                <Select
                  value={formData.tenantId || "global"}
                  onValueChange={(value) => setFormData({ ...formData, tenantId: value === "global" ? null : value })}
                >
                  <SelectTrigger id="tenant" data-testid="select-tenant">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <span className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-muted-foreground" />
                        Global (all tenants)
                      </span>
                    </SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {tenant.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Global documents apply to all tenants. Tenant-specific documents only apply when that tenant is active.
                </p>
              </div>

              {formData.tenantId && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="tenant-background">Tenant Background Context</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, this document is automatically included in all AI conversations for this tenant
                    </p>
                  </div>
                  <Switch
                    id="tenant-background"
                    checked={formData.isTenantBackground}
                    onCheckedChange={(checked) => setFormData({ ...formData, isTenantBackground: checked })}
                    data-testid="switch-tenant-background"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority (higher = included first)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-priority"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Content</Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".txt,.md,.json,.pdf,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File (.txt, .md, .json, .pdf, .docx)
                      </span>
                    </Button>
                  </label>
                </div>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the grounding document content here. This will be provided to the AI as context for generating responses..."
                  rows={12}
                  required
                  className="font-mono text-sm"
                  data-testid="textarea-content"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.content.length.toLocaleString()} characters
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-is-active"
                />
                <Label htmlFor="isActive">Active (include in AI context)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingDocument
                  ? "Update Document"
                  : "Create Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.title}</DialogTitle>
            <DialogDescription>
              {viewingDocument?.description || getCategoryInfo(viewingDocument?.category || "").label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {getCategoryInfo(viewingDocument?.category || "").label}
              </Badge>
              <Badge variant="outline">Priority: {viewingDocument?.priority || 0}</Badge>
              {viewingDocument?.isActive ? (
                <Badge className="bg-green-500/10 text-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <div className="bg-muted rounded-lg p-4 max-h-[50vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {viewingDocument?.content}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {viewingDocument && (
              <Button onClick={() => {
                setViewDialogOpen(false);
                openEditDialog(viewingDocument);
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
