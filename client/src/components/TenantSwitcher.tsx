import { useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Tenant = {
  id: string;
  name: string;
  color: string;
};

const mockTenants: Tenant[] = [
  { id: "2", name: "Acme Corporation", color: "hsl(220, 85%, 38%)" },
  { id: "1", name: "The Synozur Alliance LLC", color: "hsl(277, 98%, 53%)" },
  { id: "3", name: "TechStart Inc", color: "hsl(328, 94%, 45%)" },
  { id: "4", name: "Global Ventures", color: "hsl(200, 75%, 45%)" },
];

export function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(mockTenants[0]);

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
              <AvatarFallback
                className="text-xs"
                style={{ backgroundColor: selectedTenant.color }}
              >
                {selectedTenant.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedTenant.name}</span>
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
              {mockTenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.name}
                  onSelect={() => {
                    setSelectedTenant(tenant);
                    setOpen(false);
                  }}
                  data-testid={`tenant-option-${tenant.id}`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback
                        className="text-xs"
                        style={{ backgroundColor: tenant.color }}
                      >
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{tenant.name}</span>
                  </div>
                  {selectedTenant.id === tenant.id && (
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
