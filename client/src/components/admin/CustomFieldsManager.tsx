import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RotateCcw, ArchiveRestore, Archive } from "lucide-react";
import type { CustomFieldDef, CustomFieldEntityType } from "@/components/CustomFieldsSection";

const ENTITY_TYPES: { value: CustomFieldEntityType; label: string }[] = [
  { value: "objective", label: "Objectives" },
  { value: "key_result", label: "Key Results" },
  { value: "big_rock", label: "Big Rocks" },
];

const FIELD_TYPES = [
  { value: "short_text", label: "Short Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
];

export function CustomFieldsManager() {
  const [active, setActive] = useState<CustomFieldEntityType>("objective");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Custom Fields</h3>
        <p className="text-sm text-muted-foreground">
          Define up to 10 active fields per entity type. Fields appear in entity dialogs and are
          included in tables, exports, and reports.
        </p>
      </div>
      <Tabs value={active} onValueChange={(v) => setActive(v as CustomFieldEntityType)}>
        <TabsList data-testid="tabs-custom-fields-entity">
          {ENTITY_TYPES.map((e) => (
            <TabsTrigger key={e.value} value={e.value} data-testid={`tab-cf-${e.value}`}>
              {e.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ENTITY_TYPES.map((e) => (
          <TabsContent key={e.value} value={e.value} className="mt-4">
            <EntityFieldsList entityType={e.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EntityFieldsList({ entityType }: { entityType: CustomFieldEntityType }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);

  const { data: defs = [], isLoading } = useQuery<CustomFieldDef[]>({
    queryKey: ["/api/custom-fields", entityType, "all"],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityType=${entityType}&includeArchived=true`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const activeCount = defs.filter((d) => !d.archivedAt).length;

  const archiveMut = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/custom-fields/${id}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Field archived" });
    },
  });
  const restoreMut = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/custom-fields/${id}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Field restored" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{activeCount}</span>
          <span className="text-muted-foreground"> / 10 active fields</span>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          disabled={activeCount >= 10}
          data-testid="button-add-custom-field"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Field
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : defs.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
          No custom fields yet. Click "Add Field" to create one.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {defs.map((d) => (
            <Card key={d.id} className={d.archivedAt ? "opacity-60" : ""}>
              <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-cf-label-${d.key}`}>{d.label}</span>
                    <Badge variant="outline" className="text-xs">{d.fieldType}</Badge>
                    <code className="text-xs text-muted-foreground">{d.key}</code>
                    {d.required ? <Badge variant="secondary" className="text-xs">Required</Badge> : null}
                    {d.archivedAt ? <Badge variant="destructive" className="text-xs">Archived</Badge> : null}
                  </div>
                  {d.description ? (
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {d.archivedAt ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMut.mutate(d.id)}
                      disabled={activeCount >= 10}
                      data-testid={`button-restore-cf-${d.key}`}
                    >
                      <ArchiveRestore className="w-4 h-4 mr-1" /> Restore
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditing(d); setDialogOpen(true); }}
                        data-testid={`button-edit-cf-${d.key}`}
                      >Edit</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => archiveMut.mutate(d.id)}
                        data-testid={`button-archive-cf-${d.key}`}
                      >
                        <Archive className="w-4 h-4 mr-1" /> Archive
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        editing={editing}
      />
    </div>
  );
}

function FieldDialog({ open, onOpenChange, entityType, editing }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: CustomFieldEntityType;
  editing: CustomFieldDef | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(() => ({
    label: "",
    key: "",
    fieldType: "short_text",
    description: "",
    required: false,
    options: [{ value: "", label: "" }],
  }));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        label: editing.label,
        key: editing.key,
        fieldType: editing.fieldType,
        description: editing.description || "",
        required: !!editing.required,
        options: editing.optionsJson?.options?.length
          ? editing.optionsJson.options.map((o) => ({ ...o }))
          : [{ value: "", label: "" }],
      });
    } else {
      setForm({
        label: "",
        key: "",
        fieldType: "short_text",
        description: "",
        required: false,
        options: [{ value: "", label: "" }],
      });
    }
  }, [open, editing?.id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        entityType,
        label: form.label,
        fieldType: form.fieldType,
        description: form.description || null,
        required: !!form.required,
      };
      if (!editing) body.key = form.key;
      if (form.fieldType === "single_select" || form.fieldType === "multi_select") {
        body.optionsJson = {
          options: (form.options || [])
            .filter((o: any) => o.value && o.label)
            .map((o: any) => ({ value: o.value, label: o.label })),
        };
      } else {
        body.optionsJson = null;
      }
      if (editing) {
        return apiRequest("PATCH", `/api/custom-fields/${editing.id}`, body);
      }
      return apiRequest("POST", `/api/custom-fields`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: editing ? "Field updated" : "Field created" });
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isSelect = form.fieldType === "single_select" || form.fieldType === "multi_select";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Custom Field" : "New Custom Field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Label</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              data-testid="input-cf-label"
            />
          </div>
          <div>
            <Label>Key {editing ? "(locked)" : ""}</Label>
            <Input
              value={form.key}
              disabled={!!editing}
              placeholder="e.g. business_unit"
              onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              data-testid="input-cf-key"
            />
            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, digits, underscores. Cannot change after creation.</p>
          </div>
          <div>
            <Label>Type {editing ? "(locked)" : ""}</Label>
            <Select
              value={form.fieldType}
              onValueChange={(v) => setForm({ ...form, fieldType: v })}
              disabled={!!editing}
            >
              <SelectTrigger data-testid="select-cf-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              data-testid="input-cf-description"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!form.required}
              onCheckedChange={(v) => setForm({ ...form, required: v })}
              data-testid="switch-cf-required"
            />
            <Label>Required</Label>
          </div>
          {isSelect && (
            <div className="space-y-2">
              <Label>Options</Label>
              {(form.options || []).map((opt: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="value"
                    value={opt.value}
                    onChange={(e) => {
                      const opts = [...form.options];
                      opts[i] = { ...opts[i], value: e.target.value };
                      setForm({ ...form, options: opts });
                    }}
                    data-testid={`input-cf-option-value-${i}`}
                  />
                  <Input
                    placeholder="label"
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...form.options];
                      opts[i] = { ...opts[i], label: e.target.value };
                      setForm({ ...form, options: opts });
                    }}
                    data-testid={`input-cf-option-label-${i}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setForm({ ...form, options: form.options.filter((_: any, j: number) => j !== i) })}
                    data-testid={`button-cf-option-remove-${i}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...form, options: [...(form.options || []), { value: "", label: "" }] })}
                data-testid="button-cf-add-option"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Option
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.label || (!editing && !form.key)}
            data-testid="button-cf-save"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

