import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface TenantMember {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface UserPickerProps {
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UserPicker({ 
  value, 
  onChange, 
  placeholder = "Select user...",
  disabled = false,
  className 
}: UserPickerProps) {
  const [open, setOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery<TenantMember[]>({
    queryKey: ['/api/tenant-members'],
  });

  const selectedMember = members.find(
    m => m.email.toLowerCase() === value?.toLowerCase()
  );

  const handleSelect = (email: string) => {
    onChange(email === value?.toLowerCase() ? "" : email);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full justify-between font-normal", className)}
          data-testid="button-user-picker"
        >
          {selectedMember ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedMember.displayName}</span>
              <span className="text-muted-foreground text-xs truncate">
                ({selectedMember.email})
              </span>
            </span>
          ) : value ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{value}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search by name or email..." 
            data-testid="input-user-search"
          />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.displayName} ${member.email}`}
                  onSelect={() => handleSelect(member.email)}
                  data-testid={`user-option-${member.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.toLowerCase() === member.email.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{member.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
