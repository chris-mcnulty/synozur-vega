import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Target, Compass, Rocket, Layers, CalendarDays, Activity,
  Users, Building2, FileText, Sparkles, LayoutDashboard, BarChart3,
  LifeBuoy, Info, BookOpen, Map, Ticket, Settings as SettingsIcon,
  UploadCloud, HelpCircle, type LucideIcon,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BreadcrumbSegment {
  label: string;
  href?: string;
  icon: LucideIcon;
  /** Optional quick actions exposed via a small menu on the segment */
  actions?: Array<{ label: string; href: string }>;
}

/**
 * Route segment definition.
 * - `pattern` matches the wouter path (supports `:param` placeholders)
 * - `build` returns the full breadcrumb trail for that route
 *
 * Order matters: more specific routes should be listed before their parents
 * when patterns overlap.
 */
interface RouteDefinition {
  pattern: RegExp;
  build: (match: RegExpMatchArray) => BreadcrumbSegment[] | null;
}

// ─── Section roots ──────────────────────────────────────────────────────────

const HOME: BreadcrumbSegment = { label: "Home", href: "/dashboard", icon: Home };

const SECTION_PLANNING: BreadcrumbSegment = {
  label: "Planning",
  href: "/planning",
  icon: Target,
  actions: [
    { label: "Open Outcomes", href: "/planning" },
    { label: "Ambitions & Strategy", href: "/strategy" },
  ],
};

const SECTION_FOCUS: BreadcrumbSegment = {
  label: "Focus Rhythm",
  href: "/focus-rhythm",
  icon: CalendarDays,
  actions: [{ label: "All meetings", href: "/focus-rhythm" }],
};

const SECTION_ABOUT: BreadcrumbSegment = {
  label: "About",
  href: "/about",
  icon: Info,
  actions: [
    { label: "Roadmap", href: "/roadmap" },
    { label: "Changelog", href: "/changelog" },
    { label: "Backlog", href: "/backlog" },
  ],
};

const SECTION_ADMIN: BreadcrumbSegment = {
  label: "Administration",
  icon: Building2,
  actions: [
    { label: "Tenant Admin", href: "/tenant-admin" },
    { label: "System Admin", href: "/system-admin" },
  ],
};

// ─── Route map ──────────────────────────────────────────────────────────────

const ROUTES: RouteDefinition[] = [
  // Focus Rhythm meeting detail — concrete path before generic
  {
    pattern: /^\/focus-rhythm\/([^/]+)\/?$/,
    build: () => [
      HOME,
      SECTION_FOCUS,
      { label: "Meeting", icon: CalendarDays },
    ],
  },

  // Support subviews
  {
    pattern: /^\/support\/new\/?$/,
    build: () => [
      HOME,
      { label: "Support", href: "/support", icon: LifeBuoy },
      { label: "New ticket", icon: Ticket },
    ],
  },
  {
    pattern: /^\/support\/([^/]+)\/?$/,
    build: (match) => {
      const view = match[1];
      // Known subviews map to readable labels
      const labelMap: Record<string, string> = {
        list: "My tickets",
        detail: "Ticket detail",
      };
      return [
        HOME,
        { label: "Support", href: "/support", icon: LifeBuoy },
        { label: labelMap[view] ?? "Ticket", icon: Ticket },
      ];
    },
  },

  // Top-level routes
  { pattern: /^\/dashboard\/?$/, build: () => [HOME] },
  {
    pattern: /^\/focus\/?$/,
    build: () => [HOME, { label: "My Focus", icon: Rocket }],
  },
  {
    pattern: /^\/executive\/?$/,
    build: () => [HOME, { label: "Executive Dashboard", icon: LayoutDashboard }],
  },
  {
    pattern: /^\/team\/?$/,
    build: () => [HOME, { label: "Team Dashboard", icon: Users }],
  },
  {
    pattern: /^\/foundations\/?$/,
    build: () => [HOME, { label: "Foundations", icon: Compass }],
  },
  {
    pattern: /^\/strategy\/?$/,
    build: () => [HOME, { label: "Strategy", icon: Layers }],
  },
  {
    pattern: /^\/planning\/?$/,
    build: () => [HOME, SECTION_PLANNING],
  },
  {
    pattern: /^\/focus-rhythm\/?$/,
    build: () => [HOME, SECTION_FOCUS],
  },
  {
    pattern: /^\/reporting\/?$/,
    build: () => [HOME, { label: "Reporting", icon: BarChart3 }],
  },
  {
    pattern: /^\/launchpad\/?$/,
    build: () => [HOME, { label: "Launchpad", icon: Sparkles }],
  },
  {
    pattern: /^\/import\/?$/,
    build: () => [HOME, { label: "Import", icon: UploadCloud }],
  },
  {
    pattern: /^\/settings\/?$/,
    build: () => [HOME, { label: "Settings", icon: SettingsIcon }],
  },
  {
    pattern: /^\/tenant-admin\/?$/,
    build: () => [HOME, SECTION_ADMIN, { label: "Tenant Admin", icon: Building2 }],
  },
  {
    pattern: /^\/system-admin\/?$/,
    build: () => [HOME, SECTION_ADMIN, { label: "System Admin", icon: SettingsIcon }],
  },
  {
    pattern: /^\/ai-grounding\/?$/,
    build: () => [HOME, SECTION_ADMIN, { label: "AI Grounding", icon: BookOpen }],
  },
  {
    pattern: /^\/support\/?$/,
    build: () => [HOME, { label: "Support", icon: LifeBuoy }],
  },
  {
    pattern: /^\/help\/?$/,
    build: () => [HOME, { label: "User Guide", icon: HelpCircle }],
  },
  {
    pattern: /^\/about\/?$/,
    build: () => [HOME, SECTION_ABOUT],
  },
  {
    pattern: /^\/changelog\/?$/,
    build: () => [HOME, SECTION_ABOUT, { label: "Changelog", icon: FileText }],
  },
  {
    pattern: /^\/roadmap\/?$/,
    build: () => [HOME, SECTION_ABOUT, { label: "Roadmap", icon: Map }],
  },
  {
    pattern: /^\/backlog\/?$/,
    build: () => [HOME, SECTION_ABOUT, { label: "Backlog", icon: Activity }],
  },
];

// ─── Resolution ────────────────────────────────────────────────────────────

function resolveSegments(pathname: string): BreadcrumbSegment[] | null {
  for (const route of ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) {
      return route.build(match);
    }
  }
  return null;
}

// ─── Truncation helper ─────────────────────────────────────────────────────

const MAX_VISIBLE_SEGMENTS = 4;

function truncateSegments(segments: BreadcrumbSegment[]): {
  visible: BreadcrumbSegment[];
  hidden: BreadcrumbSegment[];
} {
  if (segments.length <= MAX_VISIBLE_SEGMENTS) {
    return { visible: segments, hidden: [] };
  }
  // Keep first (Home), last 2 segments, collapse the rest into an ellipsis
  const first = segments[0];
  const lastTwo = segments.slice(-2);
  const hidden = segments.slice(1, segments.length - 2);
  return { visible: [first, ...lastTwo], hidden };
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ContextualBreadcrumbs() {
  const [location] = useLocation();

  const segments = useMemo(() => resolveSegments(location), [location]);

  if (!segments || segments.length === 0) {
    return null;
  }

  const { visible, hidden } = truncateSegments(segments);

  return (
    <nav
      aria-label="Contextual breadcrumbs"
      className="border-b bg-background/60 px-3 md:px-6 py-1.5"
      data-testid="contextual-breadcrumbs"
    >
      <Breadcrumb>
        <BreadcrumbList>
          {visible.map((segment, idx) => {
            const Icon = segment.icon;
            const isLast = idx === visible.length - 1;
            const showEllipsisAfterFirst = idx === 0 && hidden.length > 0;

            return (
              <div key={`${segment.label}-${idx}`} className="contents">
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span>{segment.label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <SegmentLink segment={segment} />
                  )}
                </BreadcrumbItem>

                {!isLast && <BreadcrumbSeparator />}

                {showEllipsisAfterFirst && (
                  <>
                    <BreadcrumbItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex items-center rounded hover:text-foreground"
                          data-testid="breadcrumb-ellipsis-trigger"
                          aria-label={`Show ${hidden.length} hidden breadcrumb segments`}
                        >
                          <BreadcrumbEllipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {hidden.map((h, hIdx) => {
                            const HIcon = h.icon;
                            const inner = (
                              <span className="flex items-center gap-2">
                                <HIcon className="h-4 w-4" />
                                {h.label}
                              </span>
                            );
                            return h.href ? (
                              <DropdownMenuItem key={`${h.label}-${hIdx}`} asChild>
                                <Link href={h.href}>{inner}</Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem key={`${h.label}-${hIdx}`} disabled>
                                {inner}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </nav>
  );
}

// ─── Segment link with optional quick-action menu ──────────────────────────

function SegmentLink({ segment }: { segment: BreadcrumbSegment }) {
  const Icon = segment.icon;
  const content = (
    <span className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{segment.label}</span>
    </span>
  );

  const linked = segment.href ? (
    <BreadcrumbLink asChild>
      <Link href={segment.href}>{content}</Link>
    </BreadcrumbLink>
  ) : (
    <span className="text-muted-foreground">{content}</span>
  );

  // No quick actions → just render the link
  if (!segment.actions || segment.actions.length === 0) {
    return linked;
  }

  // With quick actions → wrap in a dropdown trigger on the segment label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1 rounded transition-colors hover:text-foreground"
        data-testid={`breadcrumb-segment-${segment.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {content}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {segment.href && (
          <DropdownMenuItem asChild>
            <Link href={segment.href}>Open {segment.label}</Link>
          </DropdownMenuItem>
        )}
        {segment.actions.map((action, idx) => (
          <DropdownMenuItem key={`${action.label}-${idx}`} asChild>
            <Link href={action.href}>{action.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
