import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTenant } from "@/contexts/TenantContext";

export function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const { currentTenant, setCurrentTenant, tenants } = useTenant();

  if (!currentTenant) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          data-testid="button-tenant-switcher"
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {currentTenant.logoUrl && <AvatarImage src={currentTenant.logoUrl} alt={currentTenant.name} />}
              <AvatarFallback
                className="text-xs"
                style={{ backgroundColor: currentTenant.color || "#3B82F6" }}
              >
                {currentTenant.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{currentTenant.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search tenant..." />
          <CommandList>
            <CommandEmpty>No tenant found.</CommandEmpty>
            <CommandGroup>
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.name}
                  onSelect={() => {
                    setCurrentTenant(tenant);
                    setOpen(false);
                  }}
                  data-testid={`tenant-option-${tenant.id}`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-5 w-5">
                      {tenant.logoUrl && <AvatarImage src={tenant.logoUrl} alt={tenant.name} />}
                      <AvatarFallback
                        className="text-xs"
                        style={{ backgroundColor: tenant.color || "#3B82F6" }}
                      >
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{tenant.name}</span>
                  </div>
                  {currentTenant.id === tenant.id && (
                    <Check className="ml-2 h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
