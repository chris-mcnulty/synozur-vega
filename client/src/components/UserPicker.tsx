import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, User, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTenant } from "@/contexts/TenantContext";

interface UserResult {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserPickerProps {
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Persist recent selections per-tenant in sessionStorage
const RECENT_KEY = "userPicker_recent";
const MAX_RECENT = 5;

function getRecentSelections(tenantId: string): string[] {
  try {
    const stored = sessionStorage.getItem(`${RECENT_KEY}_${tenantId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSelection(tenantId: string, email: string) {
  const recent = getRecentSelections(tenantId).filter(e => e !== email);
  recent.unshift(email);
  sessionStorage.setItem(
    `${RECENT_KEY}_${tenantId}`,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

export function UserPicker({
  value,
  onChange,
  placeholder = "Select user...",
  disabled = false,
  className
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // Fetch users via search endpoint with debounced query
  const { data: users = [], isLoading } = useQuery<UserResult[]>({
    queryKey: ['/api/users/search', tenantId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      // tenantId is resolved server-side from the authenticated session — never from client params
      const res = await fetch(`/api/users/search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to search users');
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const recentEmails = tenantId ? getRecentSelections(tenantId) : [];
  const recentUsers = users.filter(u => recentEmails.includes(u.email));

  const selectedUser = users.find(
    u => u.email.toLowerCase() === value?.toLowerCase()
  );

  const handleSelect = useCallback((email: string) => {
    const newValue = email === value?.toLowerCase() ? "" : email;
    onChange(newValue);
    if (newValue && tenantId) {
      addRecentSelection(tenantId, newValue);
    }
    setOpen(false);
    setShowManualEntry(false);
    setManualEmail("");
  }, [value, onChange, tenantId]);

  const handleManualSubmit = useCallback(() => {
    const email = manualEmail.trim();
    if (email && email.includes("@")) {
      onChange(email);
      if (tenantId) addRecentSelection(tenantId, email);
      setOpen(false);
      setShowManualEntry(false);
      setManualEmail("");
    }
  }, [manualEmail, onChange, tenantId]);

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setShowManualEntry(false);
      setManualEmail("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !tenantId}
          className={cn("w-full justify-between font-normal", className)}
          data-testid="button-user-picker"
        >
          {selectedUser ? (
            <span className="flex items-center gap-2 truncate">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                {getInitials(selectedUser.name)}
              </span>
              <span className="truncate">{selectedUser.name}</span>
              <span className="text-muted-foreground text-xs truncate">
                ({selectedUser.email})
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
      <PopoverContent className="w-[320px] p-0 z-[100]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or email..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid="input-user-search"
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : (
              <>
                {/* Recent selections group */}
                {!searchQuery && recentUsers.length > 0 && (
                  <>
                    <CommandGroup heading="Recent">
                      {recentUsers.map((user) => (
                        <CommandItem
                          key={`recent-${user.id}`}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => handleSelect(user.email)}
                          data-testid={`user-recent-${user.id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value?.toLowerCase() === user.email.toLowerCase()
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary mr-2">
                            {getInitials(user.name)}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{user.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                {/* All users group */}
                <CommandGroup heading={searchQuery ? "Results" : "All Users"}>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => handleSelect(user.email)}
                      data-testid={`user-option-${user.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.toLowerCase() === user.email.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary mr-2">
                        {getInitials(user.name)}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{user.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {users.length === 0 && !isLoading && (
                  <CommandEmpty>
                    <div className="text-center py-2">
                      <p>No users found.</p>
                      {!showManualEntry && (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1"
                          onClick={() => setShowManualEntry(true)}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Enter email manually
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                )}

                {/* Manual email entry fallback */}
                {showManualEntry && (
                  <>
                    <CommandSeparator />
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        Enter email for a user not yet in this organization:
                      </p>
                      <div className="flex gap-1">
                        <input
                          type="email"
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          placeholder="user@example.com"
                          value={manualEmail}
                          onChange={e => setManualEmail(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleManualSubmit();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2"
                          onClick={handleManualSubmit}
                          disabled={!manualEmail.includes("@")}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
