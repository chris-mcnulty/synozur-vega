import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import type { CompanyValue } from "@shared/schema";

interface ValueTagSelectorProps {
  availableValues: CompanyValue[];
  selectedValues: string[];
  onValuesChange: (values: string[]) => void;
  disabled?: boolean;
}

export function ValueTagSelector({ 
  availableValues, 
  selectedValues, 
  onValuesChange,
  disabled = false 
}: ValueTagSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleValue = (valueTitle: string) => {
    const newValues = selectedValues.includes(valueTitle)
      ? selectedValues.filter(v => v !== valueTitle)
      : [...selectedValues, valueTitle];
    onValuesChange(newValues);
  };

  const removeValue = (valueTitle: string) => {
    onValuesChange(selectedValues.filter(v => v !== valueTitle));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedValues.map((valueTitle) => (
          <Badge
            key={valueTitle}
            variant="secondary"
            className="gap-1"
            data-testid={`badge-value-${valueTitle}`}
          >
            {valueTitle}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeValue(valueTitle)}
                className="ml-1 hover:text-destructive"
                data-testid={`button-remove-value-${valueTitle}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-add-values"
            >
              {selectedValues.length === 0 ? "Add Values" : "Add More Values"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 z-[60]" align="start">
            <Command>
              <CommandList>
                <CommandGroup heading="Company Values">
                  {availableValues.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No values defined yet.
                      <br />
                      Add values in the Foundations module.
                    </div>
                  ) : (
                    availableValues.map((value) => (
                      <CommandItem
                        key={value.title}
                        onSelect={() => toggleValue(value.title)}
                        className="cursor-pointer"
                        data-testid={`option-value-${value.title}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{value.title}</div>
                            {value.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {value.description}
                              </div>
                            )}
                          </div>
                          {selectedValues.includes(value.title) && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
