import { Link } from "wouter";
import { Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

interface DeletedItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTypeLabel?: string;
  onDismiss?: () => void;
}

export function DeletedItemDialog({
  open,
  onOpenChange,
  itemTypeLabel = "item",
  onDismiss,
}: DeletedItemDialogProps) {
  const permissions = usePermissions();
  // Match the access rules used by the /trash page itself: tenant admins/owners
  // (MANAGE_TENANT_SETTINGS) and platform admins.
  const showTrashLink = permissions.canManageTenantSettings || permissions.isPlatformAdmin;

  const handleClose = () => {
    onOpenChange(false);
    onDismiss?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-deleted-item">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <span data-testid="text-deleted-item-title">Item not found or has been deleted</span>
          </DialogTitle>
          <DialogDescription data-testid="text-deleted-item-description">
            The {itemTypeLabel} you're looking for is no longer available. It may
            have been deleted{showTrashLink ? " and might still be in Trash" : ""}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 flex-wrap">
          {showTrashLink && (
            <Link href="/trash">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-deleted-item-view-trash"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                View Trash
              </Button>
            </Link>
          )}
          <Button onClick={handleClose} data-testid="button-deleted-item-dismiss">
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
