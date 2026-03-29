import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Target,
  TrendingUp,
  BarChart2,
  Calendar,
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Rocket,
  Settings,
  HelpCircle,
  Activity,
  Flag,
} from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import type { Objective, KeyResult, Strategy } from "@shared/schema";

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  meetingType: string;
}

interface BigRock {
  id: string;
  title: string;
  status: string;
}

const NAV_ITEMS = [
  { title: "Company OS", url: "/dashboard", icon: LayoutDashboard, group: "Navigate" },
  { title: "My Focus", url: "/focus", icon: Activity, group: "Navigate" },
  { title: "Executive Dashboard", url: "/executive", icon: BarChart2, group: "Navigate" },
  { title: "Team Mode", url: "/team", icon: Users, group: "Navigate" },
  { title: "Foundations", url: "/foundations", icon: Building2, group: "Navigate" },
  { title: "Strategy", url: "/strategy", icon: Target, group: "Navigate" },
  { title: "Outcomes", url: "/planning", icon: TrendingUp, group: "Navigate" },
  { title: "Focus Rhythm", url: "/focus-rhythm", icon: Calendar, group: "Navigate" },
  { title: "Reporting", url: "/reporting", icon: FileText, group: "Navigate" },
  { title: "Launchpad", url: "/launchpad", icon: Rocket, group: "Navigate" },
  { title: "My Settings", url: "/settings", icon: Settings, group: "Navigate" },
  { title: "User Guide", url: "/help", icon: HelpCircle, group: "Navigate" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { currentTenant } = useTenant();
  const { quarter, year } = useTimePeriod();
  const tenantId = currentTenant?.id;

  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", tenantId, quarter, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/okr/objectives?tenantId=${tenantId}&quarter=${quarter}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId && open,
    staleTime: 2 * 60 * 1000,
  });

  const { data: strategies = [] } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/strategies?tenantId=${tenantId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId && open,
    staleTime: 2 * 60 * 1000,
  });

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/focus-rhythm/meetings", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/focus-rhythm/meetings?tenantId=${tenantId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId && open,
    staleTime: 2 * 60 * 1000,
  });

  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", tenantId, quarter, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/okr/big-rocks?tenantId=${tenantId}&quarter=${quarter}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId && open,
    staleTime: 2 * 60 * 1000,
  });

  const navigate = useCallback(
    (url: string) => {
      setLocation(url);
      onOpenChange(false);
    },
    [setLocation, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, objectives, strategies, meetings..." />
      <CommandList className="max-h-[480px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.url}
              value={`nav-${item.title}`}
              onSelect={() => navigate(item.url)}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Objectives */}
        {objectives.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Objectives">
              {objectives.slice(0, 8).map((obj) => (
                <CommandItem
                  key={obj.id}
                  value={`obj-${obj.title}-${obj.id}`}
                  onSelect={() => navigate(`/planning`)}
                >
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{obj.title}</span>
                  {obj.status && (
                    <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">
                      {obj.status.replace("_", " ")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Strategies */}
        {strategies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Strategies">
              {strategies.slice(0, 5).map((s) => (
                <CommandItem
                  key={s.id}
                  value={`strategy-${s.title}-${s.id}`}
                  onSelect={() => navigate(`/strategy`)}
                >
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{s.title}</span>
                  {s.priority && (
                    <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">
                      {s.priority}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Big Rocks */}
        {bigRocks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Big Rocks">
              {bigRocks.slice(0, 5).map((br) => (
                <CommandItem
                  key={br.id}
                  value={`bigrock-${br.title}-${br.id}`}
                  onSelect={() => navigate(`/planning`)}
                >
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{br.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Meetings */}
        {meetings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Meetings">
              {meetings.slice(0, 5).map((m) => (
                <CommandItem
                  key={m.id}
                  value={`meeting-${m.title}-${m.id}`}
                  onSelect={() => navigate(`/focus-rhythm/${m.id}`)}
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{m.title}</span>
                  {m.meetingDate && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {new Date(m.meetingDate).toLocaleDateString()}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
