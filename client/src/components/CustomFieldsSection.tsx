import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type CustomFieldEntityType = "objective" | "key_result" | "big_rock";

export interface CustomFieldDef {
  id: string;
  tenantId: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  fieldType: "short_text" | "number" | "date" | "single_select" | "multi_select";
  description?: string | null;
  optionsJson?: { options: Array<{ value: string; label: string }> } | null;
  required?: boolean | null;
  sortOrder?: number | null;
  archivedAt?: string | null;
}

interface Props {
  entityType: CustomFieldEntityType;
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  initialValues?: Record<string, any>;
}

export function CustomFieldsSection({ entityType, values, onChange, initialValues }: Props) {
  const { data: defs = [], isLoading } = useQuery<CustomFieldDef[]>({
    queryKey: ["/api/custom-fields", entityType],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityType=${entityType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load custom fields");
      return res.json();
    },
  });

  const activeDefs = useMemo(
    () => defs.filter((d) => !d.archivedAt).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [defs],
  );

  // Seed initial values once defs load
  useEffect(() => {
    if (!initialValues || !activeDefs.length) return;
    const seeded: Record<string, any> = { ...values };
    let dirty = false;
    for (const def of activeDefs) {
      if (seeded[def.key] === undefined && initialValues[def.key] !== undefined) {
        seeded[def.key] = initialValues[def.key];
        dirty = true;
      }
    }
    if (dirty) onChange(seeded);
  }, [activeDefs, initialValues]); // eslint-disable-line

  if (isLoading || !activeDefs.length) return null;

  const setVal = (key: string, v: any) => onChange({ ...values, [key]: v });

  return (
    <div className="space-y-4 rounded-md border p-4" data-testid="section-custom-fields">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium">Custom Fields</h4>
        <Badge variant="secondary" data-testid="badge-custom-fields-count">{activeDefs.length}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeDefs.map((def) => {
          const v = values[def.key];
          const testId = `custom-field-${def.entityType}-${def.key}`;
          return (
            <div key={def.id} className="space-y-1.5">
              <Label htmlFor={testId} className="flex items-center gap-1">
                {def.label}
                {def.required ? (
                  <>
                    <span className="text-destructive" aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </>
                ) : null}
              </Label>
              {def.description ? (
                <p className="text-xs text-muted-foreground">{def.description}</p>
              ) : null}
              {def.fieldType === "short_text" && (
                <Input
                  id={testId}
                  data-testid={`input-${testId}`}
                  value={v ?? ""}
                  maxLength={500}
                  onChange={(e) => setVal(def.key, e.target.value)}
                />
              )}
              {def.fieldType === "number" && (
                <Input
                  id={testId}
                  type="number"
                  data-testid={`input-${testId}`}
                  value={v ?? ""}
                  onChange={(e) => setVal(def.key, e.target.value === "" ? null : Number(e.target.value))}
                />
              )}
              {def.fieldType === "date" && (
                <Input
                  id={testId}
                  type="date"
                  data-testid={`input-${testId}`}
                  value={v ?? ""}
                  onChange={(e) => setVal(def.key, e.target.value || null)}
                />
              )}
              {def.fieldType === "single_select" && (
                <Select
                  value={v || "__unset"}
                  onValueChange={(val) => setVal(def.key, val === "__unset" ? null : val)}
                >
                  <SelectTrigger id={testId} data-testid={`select-${testId}`} aria-label={def.label}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset">— None —</SelectItem>
                    {(def.optionsJson?.options ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} data-testid={`option-${testId}-${opt.value}`}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {def.fieldType === "multi_select" && (
                <div className="flex flex-wrap gap-2 rounded-md border p-2" data-testid={`multi-${testId}`}>
                  {(def.optionsJson?.options ?? []).map((opt) => {
                    const arr: string[] = Array.isArray(v) ? v : [];
                    const checked = arr.includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-1 text-sm">
                        <Checkbox
                          checked={checked}
                          data-testid={`checkbox-${testId}-${opt.value}`}
                          onCheckedChange={(c) => {
                            const next = c
                              ? [...arr, opt.value]
                              : arr.filter((x) => x !== opt.value);
                            setVal(def.key, next);
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function extractCustomFieldsFromEntity(
  entity: any,
  entityType: CustomFieldEntityType,
): Record<string, any> {
  if (!entity?.customFields) return {};
  const out: Record<string, any> = {};
  for (const cf of entity.customFields as Array<{ key: string; value: any }>) {
    if (cf.value === null || cf.value === undefined) continue;
    if ("text" in cf.value) out[cf.key] = cf.value.text;
    else if ("number" in cf.value) out[cf.key] = cf.value.number;
    else if ("date" in cf.value) out[cf.key] = cf.value.date;
    else if ("value" in cf.value) out[cf.key] = cf.value.value;
    else if ("values" in cf.value) out[cf.key] = cf.value.values;
  }
  return out;
}
