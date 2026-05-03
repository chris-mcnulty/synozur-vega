import { useState } from "react";
import { Bookmark, BookmarkCheck, Plus, Save, Trash2, Star, StarOff, X, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { SavedView } from "@shared/schema";
import { useSavedViews, type SavedViewPage } from "@/hooks/useSavedViews";

type SavedViewBarProps = {
  page: SavedViewPage;
  controller: ReturnType<typeof useSavedViews>;
  currentUserId?: string;
  isAdmin?: boolean;
};

export function SavedViewBar({ page, controller, currentUserId, isAdmin }: SavedViewBarProps) {
  const { views, activeView, activeViewId, applyView, clearView, isDirty, createView, updateView, deleteView } = controller;
  const { toast } = useToast();

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [isDefault, setIsDefault] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  const canEditView = (v: SavedView) =>
    v.ownerUserId === currentUserId || (v.visibility === "shared" ? !!isAdmin : v.ownerUserId === currentUserId);

  const openSaveDialog = (asNew: boolean) => {
    setSaveAsNew(asNew);
    if (!asNew && activeView) {
      setName(activeView.name);
      setVisibility(activeView.visibility as "private" | "shared");
      setIsDefault(activeView.isDefault);
    } else {
      setName("");
      setVisibility("private");
      setIsDefault(false);
    }
    setSaveOpen(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Name required", description: "Give this view a name.", variant: "destructive" });
      return;
    }
    try {
      if (!saveAsNew && activeView && canEditView(activeView)) {
        await updateView({
          id: activeView.id,
          data: {
            name: trimmed,
            visibility,
            isDefault,
            filterJson: controller.currentState,
          },
        });
        toast({ title: "View updated", description: `Saved changes to "${trimmed}".` });
      } else {
        await createView({ name: trimmed, visibility, isDefault });
        toast({ title: "View saved", description: `Created "${trimmed}".` });
      }
      setSaveOpen(false);
    } catch (err: any) {
      toast({ title: "Failed to save view", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  const handleSetDefault = async (v: SavedView) => {
    try {
      await updateView({ id: v.id, data: { isDefault: !v.isDefault } });
      toast({
        title: v.isDefault ? "Default removed" : "Default set",
        description: v.isDefault ? `"${v.name}" is no longer the default.` : `"${v.name}" will load by default.`,
      });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  const handleDelete = async (v: SavedView) => {
    if (!window.confirm(`Delete saved view "${v.name}"? It can be recovered within 30 days.`)) return;
    try {
      await deleteView(v.id);
      toast({ title: "View deleted", description: `"${v.name}" was moved to trash.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  const ownedViews = views.filter((v) => v.ownerUserId === currentUserId);
  const sharedViews = views.filter((v) => v.ownerUserId !== currentUserId && v.visibility === "shared");

  const renderChip = (v: SavedView) => {
    const isActive = v.id === activeViewId;
    const editable = canEditView(v);
    return (
      <div
        key={v.id}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover-elevate ${isActive ? "bg-accent border-accent-border" : ""}`}
        data-testid={`chip-saved-view-${v.id}`}
      >
        <button
          type="button"
          onClick={() => applyView(v.id)}
          className="flex items-center gap-1.5 text-left"
          data-testid={`button-apply-view-${v.id}`}
        >
          {isActive ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          <span className="truncate max-w-[160px]">{v.name}</span>
          {v.visibility === "shared" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Users className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Shared with tenant</TooltipContent>
            </Tooltip>
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
          {v.isDefault && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
              Default
            </Badge>
          )}
        </button>
        {editable && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => handleSetDefault(v)}
                  data-testid={`button-toggle-default-${v.id}`}
                >
                  {v.isDefault ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{v.isDefault ? "Remove default" : "Make default"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => handleDelete(v)}
                  data-testid={`button-delete-view-${v.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete view</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-card" data-testid={`saved-view-bar-${page}`}>
      <span className="text-xs font-medium text-muted-foreground mr-1">Views:</span>
      {ownedViews.length === 0 && sharedViews.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No saved views yet</span>
      )}
      {ownedViews.map(renderChip)}
      {sharedViews.length > 0 && ownedViews.length > 0 && <span className="text-muted-foreground">|</span>}
      {sharedViews.map(renderChip)}

      <div className="ml-auto flex items-center gap-2">
        {activeView && isDirty && (
          <Badge variant="outline" className="text-xs" data-testid="badge-view-dirty">
            Unsaved changes
          </Badge>
        )}
        {activeView && (
          <Button type="button" size="sm" variant="ghost" onClick={clearView} data-testid="button-clear-view">
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
        {activeView && canEditView(activeView) && isDirty && (
          <Button type="button" size="sm" variant="outline" onClick={() => openSaveDialog(false)} data-testid="button-update-view">
            <Save className="h-3.5 w-3.5 mr-1" /> Update view
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => openSaveDialog(true)} data-testid="button-save-view">
          <Plus className="h-3.5 w-3.5 mr-1" /> Save as view
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{!saveAsNew && activeView ? "Update saved view" : "Save current filters as a view"}</DialogTitle>
            <DialogDescription>
              Saved views remember your filters, sort, grouping, and search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 stalled outcomes"
                maxLength={80}
                data-testid="input-view-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <RadioGroup
                value={visibility}
                onValueChange={(v) => setVisibility(v === "shared" ? "shared" : "private")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="private" id="vis-private" data-testid="radio-visibility-private" />
                  <Label htmlFor="vis-private" className="font-normal">Private — only you</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="shared" id="vis-shared" data-testid="radio-visibility-shared" />
                  <Label htmlFor="vis-shared" className="font-normal">Shared with everyone in this tenant</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="view-default"
                checked={isDefault}
                onCheckedChange={(c) => setIsDefault(!!c)}
                data-testid="checkbox-view-default"
              />
              <Label htmlFor="view-default" className="font-normal">Set as my default view for this page</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)} data-testid="button-cancel-save-view">
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} data-testid="button-confirm-save-view">
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
