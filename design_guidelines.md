# Vega Design Guidelines

## Design Approach: Reference-Based (Orion.synozur.com)

**Primary Reference**: Orion.synozur.com aesthetic and UX patterns
**Justification**: User explicitly requested to mirror Orion's design language, creating brand continuity between platforms.

---

## Core Design Elements

### Typography
**Font Family**: Avenir Next LT Pro (via Adobe Fonts or similar CDN)
- **Headlines (H1)**: 48px/3rem, Bold (700), tight line-height (1.1)
- **Subheadings (H2)**: 36px/2.25rem, Demi-bold (600), line-height 1.2
- **Section Headers (H3)**: 24px/1.5rem, Medium (500)
- **Body Text**: 16px/1rem, Regular (400), line-height 1.6
- **Small Text/Labels**: 14px/0.875rem, Regular (400)
- **Button Text**: 16px/1rem, Medium (500), slight letter-spacing

### Layout System
**Spacing Scale**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24 (p-2, m-4, gap-6, etc.)
- **Section Padding**: py-20 (desktop), py-12 (mobile)
- **Container Max-Width**: max-w-7xl with px-6 for edge spacing
- **Card/Component Padding**: p-6 to p-8
- **Grid Gaps**: gap-6 for cards, gap-4 for form elements
- **Whitespace Philosophy**: Generous breathing room between sections, minimal clutter within components

### Component Library

**Navigation**
- Clean horizontal nav with logo left, links center/right
- Minimal borders, subtle hover states
- Tenant switcher dropdown in top-right corner
- Mobile: Hamburger menu with full-screen overlay

**Cards & Containers**
- Subtle rounded corners (rounded-lg to rounded-xl)
- Light borders or subtle shadows (not both)
- White/light backgrounds with ample internal padding
- Hover: gentle lift effect (translate-y-[-2px])

**Forms**
- Single-column layouts for wizards
- Generous input padding (px-4 py-3)
- Clear labels above inputs
- Inline validation states
- Multi-step progress indicators for wizards

**Data Displays**
- Clean tables with alternating row backgrounds
- Chart.js visualizations with brand colors
- Progress bars with smooth animations
- Dashboard cards in 2-4 column grids

**Buttons**
- Primary: Solid fill with brand colors, rounded-lg, px-6 py-3
- Secondary: Outlined version with transparent background
- Ghost: Text-only for tertiary actions
- Blurred backgrounds when overlaying images

**AI Panels**
- Sidebar or modal format, 400px wide
- Chat-style interface with message bubbles
- Typing indicators and smooth message animations
- Collapsible/dismissible

### Animations
**Subtle Only**:
- Page transitions: 200ms fade
- Card hovers: 150ms ease transform
- Button hovers: built-in states
- Loading states: gentle pulse or spinner
- NO scroll-triggered animations, parallax, or excessive motion

---

## Module-Specific Layouts

### Landing Page
- **Hero**: Full-width, 85vh height with large hero image showing modern workspace/dashboard
- Large headline with tagline, dual CTAs (Start Now primary, Learn More secondary)
- **Features Section**: 3-column grid showcasing five modules with icons
- **Benefits Section**: Alternating 2-column layouts (text left/image right, then reverse)
- **M365 Integration Callout**: Single row showcasing Excel, Outlook, Planner logos
- **Footer**: Multi-column with quick links, social, newsletter signup

### Dashboard/Module Pages
- **Left Sidebar**: Fixed navigation (200px), module icons with labels
- **Top Bar**: Breadcrumb, tenant switcher, AI chat toggle, user profile
- **Main Content**: max-w-6xl centered, module-specific layouts
- **Right Panel** (conditional): AI suggestions, contextual help (300px)

### Foundations Module
- Wizard-style form, single-step visible at a time
- Progress tracker at top (4 steps: Mission, Vision, Values, Review)
- Large text areas with AI suggestion chips below
- "Generate with AI" buttons adjacent to each field

### Strategy Module
- Kanban-style board with draggable cards
- 3-4 columns for priority levels
- Modal for creating/editing strategic priorities
- AI draft generator button in header

### Planning Module
- Dashboard grid: OKRs (left), KPIs (top-right), Quarterly Rocks (bottom-right)
- Chart.js bar charts and progress rings
- Planner integration indicator showing sync status
- Quick-add buttons for new objectives

### Focus Rhythm Module
- Calendar-style weekly view (7 columns)
- Meeting cards with time, attendees, Teams link icon
- Monthly view option (calendar grid)
- AI summary panel on right showing meeting insights
- Outlook sync status badge

### Tenant Admin
- Connection status cards for M365 services (3-column grid)
- Toggle switches for app permissions
- User management table
- Activity log section

---

## Images

### Landing Page Hero
**Image**: Modern, bright workspace with multiple screens showing dashboard interfaces, diverse team collaborating, professional but approachable atmosphere. Place as full-width background with gradient overlay (dark purple to transparent) to ensure text readability.

### Benefits/Features Sections
**Images**: 
- Screenshot mockups of actual Vega modules on laptop/tablet devices
- Team collaboration photos showing strategy sessions
- Data visualization examples from Planning module
- Meeting interface showing Focus Rhythm calendar

### Module Screenshots
Use authentic UI screenshots throughout marketing sections showing the actual interface design to build credibility and demonstrate functionality.

---

## Multitenancy Visual Language
- Tenant name displayed prominently in top navigation
- Distinct tenant badge/avatar in dropdown switcher
- Subtle tenant-color theming option (user-selectable accent alongside brand colors)
- Clear visual separation between tenant admin functions and standard user features

---

## M365 Integration Indicators
- Service logos (Excel, Outlook, Planner) in connection cards
- Green check badges for connected services
- Sync status with animated icons during active sync
- "Connect" CTAs for unlinked services