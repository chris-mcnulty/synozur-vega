# Vega User Guide

**Welcome to Vega - The Synozur Alliance Company Operating System**

Version 1.9 | Last Updated: February 8, 2026

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Introduction](#introduction)
3. [Getting Started](#getting-started)
4. [What's New & Changelog](#whats-new--changelog)
5. [Dashboard Overview](#dashboard-overview)
6. [Foundations Module](#foundations-module)
7. [Strategy Module](#strategy-module)
8. [Planning (OKRs)](#planning-okrs)
9. [Focus Rhythm](#focus-rhythm)
10. [AI Assistant & Intelligence](#ai-assistant)
11. [Help & Support](#help--support)
12. [Microsoft 365 Integration](#microsoft-365-integration)
13. [Import & Export](#import--export)
14. [Reporting](#reporting)
15. [Launchpad (AI Kickstart Wizard)](#launchpad-ai-kickstart-wizard)
16. [Settings & Administration](#settings--administration)
17. [Best Practices](#best-practices)
18. [Troubleshooting](#troubleshooting)

---

## Feature Overview

Vega is a comprehensive Company Operating System with the following capabilities organized by category:

### Strategy & Planning
- **Mission, Vision & Values** - Define and communicate your organization's core identity
- **Ambitions** - 3-5 year strategic targets that bridge vision and annual goals (New in v1.7)
- **Annual Goals** - Set high-level yearly targets with optional ambition linking (moved to Outcomes in v1.8)
- **Strategic Initiatives** - Create and manage strategic priorities with owner assignment and timeline
- **OKRs (Objectives & Key Results)** - Full OKR framework with 4 hierarchy levels (Organization, Team, Division, Individual)
- **Big Rocks** - Major quarterly initiatives linked to objectives and strategies
- **Big Rock Tasks** - Break down Big Rocks into actionable tasks with status tracking (New in v1.5)
- **OKR Cloning** - Clone objectives across teams or roll over to new periods
- **Mixed Child Rollup** - Flexible progress calculation from Key Results and child objectives

### Execution & Tracking
- **Key Result Check-ins** - Regular progress updates with notes and status indicators
- **Pace & Velocity Tracking** - AI-powered analysis of progress trends and projections
- **Behind Pace Alerts** - Automatic detection of at-risk objectives and key results
- **Task Status Workflow** - Three-state task tracking (Open, In Progress, Completed)
- **Due Date Management** - Set and track deadlines for Big Rocks and tasks
- **Progress Visualization** - Progress bars, status indicators, and trend analysis

### Meetings & Rhythm
- **Focus Rhythm** - Meeting management with four cadences (Weekly, Monthly, Quarterly, Annual)
- **Meeting Templates** - Pre-built agendas for each meeting type
- **OKR-Linked Meetings** - Connect objectives and key results to meeting agendas
- **Meeting Notes** - Capture decisions, action items, and follow-ups

### AI & Intelligence
- **AI Chat Assistant** - Context-aware AI for strategy and OKR guidance with function calling
- **OKR Intelligence** - Predictive analytics for pace and velocity with Pace Badges
- **AI Check-in Rewriter** - Improve check-in notes with four rewrite modes
- **AI OKR Suggestions** - Generate objective and key result ideas based on your strategies
- **AI Big Rock Suggestions** - Get initiative recommendations aligned to objectives
- **AI Annual Goal Suggestions** - Generate goal ideas grounded in your mission, vision, and strategies
- **AI Strategy Drafter** - Draft strategic initiatives from a description using organizational context
- **AI Meeting Recap Parser** - Extract action items, decisions, and blockers from meeting notes
- **OKR Quality Scoring** - AI-powered quality assessment with improvement suggestions
- **AI Progress Summary** - Generate executive summaries of OKR progress for reports
- **Launchpad Wizard** - AI-powered setup for new organizations using uploaded documents
- **Dynamic AI Providers** - Support for multiple AI models (GPT-5, GPT-4o, Claude, Replit AI)
- **AI Grounding Documents** - Customize AI behavior with company context

### Integrations
- **Microsoft SSO** - Single Sign-On with Azure AD / Entra ID
- **Microsoft Planner** - Bidirectional task sync (coming soon for Big Rock Tasks)
- **Outlook Calendar** - Meeting and event integration
- **Excel Data Binding** - Connect Key Results to Excel data sources
- **OneDrive & SharePoint** - Document storage and access
- **MCP Server** - AI assistant integration for Claude Desktop, Cursor, and other tools
- **M365 Copilot Agent** - OpenAPI-based Copilot integration
- **HubSpot CRM** - Automated deal creation for new signups

### Reporting & Export
- **PDF Export** - Professional reports with customizable branding
- **PowerPoint Export** - Presentation-ready slides for strategy reviews
- **OKR Quality Scores** - Automated scoring for objective quality
- **Dashboard Views** - Executive, Team, and Company OS dashboards

### Help & Support (New in v1.9)
- **Help Chatbot** - AI-powered help assistant grounded on the User Guide, accessible from the header
- **Support Tickets** - Submit and track bug reports, feature requests, questions, and feedback
- **Admin Support Dashboard** - Cross-tenant ticket management for platform admins

### Platform Updates
- **What's New Modal** - AI-powered summary of recent platform updates shown on login (New in v1.8)
- **Changelog Page** - Full history of platform updates with search and table of contents (New in v1.8)

### Administration
- **Multi-Tenancy** - Isolated organizations with data security
- **Role-Based Access Control** - Six roles with fine-grained permissions
- **User Management** - Invite, manage, and assign team members
- **Custom Vocabulary** - Customize terminology (e.g., "Initiatives" vs "Big Rocks")
- **Allowed Email Domains** - Control signup access by email domain
- **Service Plans** - Manage subscription tiers and features

---

## Introduction

### What is Vega?

Vega is a comprehensive Company Operating System designed to help organizations align their culture, strategy, and execution. Built by The Synozur Alliance LLC, Vega brings together strategy development, operational execution, and team alignment into one integrated platform.

### Key Features

- **Foundations**: Define your organization's identity through mission, vision, values, and ambitions
- **Strategy**: Develop and track strategic initiatives that drive your business forward
- **Planning (OKRs)**: Set and track Objectives and Key Results at organization, team, division, and individual levels
- **Focus Rhythm**: Integrate strategy reviews with regular meeting cadences (weekly, monthly, quarterly, annual)
- **AI Assistant**: Get intelligent insights and assistance with AI-powered analysis
- **Microsoft 365 Integration**: Connect seamlessly with your Microsoft 365 tools (Planner, SharePoint, OneDrive, Outlook)
- **Culture-Driven**: Tag objectives and strategies with company values to ensure values-driven decision making

### Who Should Use This Guide?

This guide is designed for end users of the Vega platform, including:
- Team members tracking their objectives and key results
- Managers overseeing team performance
- Strategic leaders setting organizational direction
- Administrators managing tenant settings

---

## Getting Started

### Creating an Account

#### Method 1: Email and Password

1. Navigate to the Vega login page
2. Click **"Sign Up"** or **"Create Account"**
3. Enter your:
   - Email address (use your company email)
   - Password (minimum 8 characters)
   - Full name
4. Click **"Sign Up"**
5. Check your email for a verification link
6. Click the verification link to activate your account
7. Log in with your credentials

**Note**: Your email domain determines which organization (tenant) you'll be assigned to. If your domain doesn't exist in the system, contact your administrator.

#### Method 2: Microsoft Single Sign-On (SSO)

If your organization has enabled Microsoft SSO:

1. Navigate to the Vega login page
2. Click **"Sign in with Microsoft"**
3. You'll be redirected to Microsoft's login page
4. Enter your Microsoft 365 credentials
5. Grant permissions when prompted
6. You'll be automatically redirected back to Vega

**Benefits of SSO:**
- No separate password to remember
- More secure authentication
- Automatic account provisioning
- Seamless integration with Microsoft 365

### First Login

After logging in for the first time:

1. **Complete Your Profile**: Navigate to Settings to update your profile information
2. **Explore the Dashboard**: Familiarize yourself with the main interface
3. **Review Foundations**: Understand your organization's mission, vision, and values
4. **Check Your Objectives**: See what objectives and key results are assigned to you

![Vega login interface showing email and password input fields with a Sign in with Microsoft SSO button](/guide-images/01-login-page.png)
*Screenshot showing the Vega login page with both email/password and Microsoft SSO options*

### Understanding the Interface

#### Main Navigation

The left sidebar provides access to all major modules:

- **Dashboard**: Your home base showing key metrics and priorities
- **Foundations**: Organization identity (mission, vision, values, ambitions)
- **Strategy**: Strategic initiatives and plans
- **Planning**: OKR management (Objectives, Key Results, Big Rocks)
- **Focus Rhythm**: Meeting management and cadence
- **Import**: Import OKR data from other systems
- **Launchpad**: AI Kickstart Wizard for new organizations
- **Support**: View and manage your support tickets (New in v1.9)
- **Settings**: Personal and M365 connection settings
- **Admin** (if authorized): Tenant administration

#### Top Bar

- **Tenant Switcher**: If you have access to multiple organizations, switch between them here
- **AI Chat**: Click the sparkle icon to open the AI Assistant
- **Help**: Click the Help button to open the AI-powered Help Chatbot (New in v1.9)
- **Theme Toggle**: Switch between light and dark mode
- **Profile Menu**: Access settings and logout

![Vega main interface showing navigation and controls](/guide-images/02-main-navigation.png)
*Screenshot highlighting the left sidebar navigation and top bar elements including AI chat icon, theme toggle, and profile menu*

---

## What's New & Changelog

Vega keeps you informed about platform updates through two features added in v1.8.

### What's New Modal

When you log in after a new release, a "What's New" modal appears with an AI-generated summary of recent changes. This gives you a quick overview of new features and improvements without needing to read the full changelog.

**How It Works:**
- Appears automatically after login when there are new updates since your last visit
- Shows a friendly, plain-language summary of recent changes
- Click **"Got it"** to dismiss until the next release
- First-time users will not see this modal (you will see the Launchpad welcome instead)

**Tenant Admin Control:**
Tenant admins can turn this feature on or off for their organization:
1. Navigate to **Tenant Admin** (Admin section)
2. Go to the **General** tab
3. Find **Notifications** section
4. Toggle **"Show What's New on Login"** on or off

### Changelog Page

Browse the complete history of all Vega updates from a dedicated page.

**Accessing the Changelog:**
Click **"Changelog"** in the left sidebar under the support section.

**Features:**
- Full markdown-rendered history of all platform updates
- **Search**: Filter entries by keyword to find specific features or fixes
- **Table of Contents**: Jump to any version or date with one click
- **Scroll to Top**: Quick return to the top of the page after scrolling

---

## Dashboard Overview

The Dashboard is your central hub for tracking organizational performance and priorities.

### Time Period Selection

**Fiscal Year Selector**: Choose which fiscal year to view
- FY 2025, FY 2024, etc.

**Quarter Selector**: Select a specific quarter
- Q1, Q2, Q3, Q4 for the selected fiscal year
- Dashboard data updates based on your selection

### Dashboard Sections

#### 1. Company Identity (Collapsible)

Displays your organization's:
- **Mission**: Your organization's purpose
- **Vision**: Your aspirational future state
- **Values**: Core principles that guide decisions
- **Culture Statement**: How you work together

Click the section header to expand/collapse.

#### 2. Strategic Priorities

View active strategies for the selected time period:
- **Strategy Title**: Name of the strategic initiative
- **Description**: Details of the strategy
- **Priority**: High, Medium, or Low
- **Value Tags**: Which company values this strategy supports
- **Progress**: Visual progress indicator
- **Linked Objectives**: How many objectives support this strategy

Click **"View All Strategies"** to go to the Strategy module.

#### 3. Active Objectives

See all active objectives for the selected quarter, organized by level:
- **Organization**: Company-wide objectives
- **Team**: Team-specific objectives
- **Division**: Division-level objectives
- **Individual**: Personal objectives

**For Each Objective:**
- Title and description
- Owner information
- Progress percentage (rolled up from Key Results)
- Status indicator (On Track, At Risk, Behind, Closed)
- Value tags
- Linked strategies
- Number of Key Results and Big Rocks

**Filtering Options:**
- Filter by team using the team dropdown
- Preferences are saved automatically

Click any objective to view details and manage Key Results.

![Complete Vega Dashboard with all sections and widgets](/guide-images/03-dashboard-overview.png)
*Screenshot showing the complete Dashboard with fiscal year/quarter selectors, Company Identity section, Strategic Priorities, Active Objectives by level, and Upcoming Meetings*

#### 4. Upcoming Meetings

View your upcoming Focus Rhythm meetings:
- Meeting title and type (Weekly, Monthly, Quarterly, Annual)
- Date and time
- Number of linked OKRs
- Click to view meeting details and agendas

---

## Foundations Module

The Foundations module defines your organization's core identity.

### Accessing Foundations

Click **"Foundations"** in the left sidebar.

### Components

#### Mission Statement

Your organization's fundamental purpose - why you exist.

**Example**: "To empower organizations to achieve strategic alignment through innovative technology and consulting services."

#### Vision Statement

Your aspirational future state - where you're headed.

**Example**: "To become the leading Company Operating System trusted by 10,000 organizations worldwide by 2030."

#### Company Values

Core principles that guide decision-making and culture.

**Structure:**
- **Value Title**: Name of the value (e.g., "Innovation", "Integrity", "Customer Focus")
- **Description**: What this value means in practice

**Using Values:**
Values can be tagged on:
- Objectives
- Strategies
- Ambitions

This creates transparency about which values drive your work.

#### Ambitions (Long-Term Strategic Targets)

Ambitions are 3-5 year strategic targets that bridge the gap between your vision and annual goals. They represent major transformational outcomes your organization aspires to achieve.

**Structure:**
- **Title**: Clear, outcome-focused statement (e.g., "Become market leader in enterprise segment")
- **Description**: Detailed context about what success looks like
- **Target Year**: When you aim to achieve this (typically 3-5 years out)
- **Linked Values**: Which organizational values this ambition supports

**Managing Ambitions:**
- **Add**: Create new ambitions with the "Add Ambition" button
- **Edit**: Update title, description, target year, or linked values
- **Close**: Mark as closed when achieved or no longer relevant (includes optional closing note)
- **Reopen**: Closed ambitions can be reopened if needed

**Soft Limit:** The platform recommends keeping 3-5 active ambitions to maintain strategic focus. A warning appears if you have more than 5 active ambitions.

**How Ambitions Connect:**
- Annual Goals can optionally link to a parent Ambition
- This creates strategic alignment from long-term vision → ambitions → annual goals → OKRs

**Examples:**
- "Expand to 10 international markets by 2028"
- "Achieve $100M ARR milestone"
- "Build industry-leading AI-powered platform"

#### Annual Goals

High-level goals for the current fiscal year. As of v1.8, Annual Goals are managed in the **Outcomes** module (previously in Foundations) for tighter alignment with OKR planning workflows. All functionality is preserved including AI suggestions, ambition linking, cloning, and year selectors.

**Structure:**
- **Title**: Clear, measurable goal statement
- **Year**: The fiscal year this goal applies to
- **Description**: Additional context (optional)
- **Linked Ambition**: Optional link to a parent long-term Ambition

**Examples:**
- "Achieve $10M in annual recurring revenue"
- "Launch in 3 new international markets"
- "Reach 95% customer satisfaction score"

**How Annual Goals Connect:**
- Annual goals can optionally link to a parent Ambition (3-5 year target)
- Strategies link to annual goals
- Objectives can link to annual goals
- Provides line-of-sight from execution to yearly targets

#### Tagline

A concise, memorable phrase that captures your brand essence.

#### Company Summary

A brief description of your organization, products, and services.

#### Messaging Statement

Your positioning statement for external communication.

#### Culture Statement

How your organization works together and what makes your culture unique.

#### Brand Voice

Guidelines for communication tone and style.

![Foundations module displaying core organizational identity](/guide-images/04-foundations-module.png)
*Screenshot displaying the Foundations page with Mission, Vision, Values (with tags), Ambitions, and other identity components*

### Editing Foundations (Admin Only)

If you have admin permissions:

1. Click **"Edit"** in the Foundations page
2. Update any field
3. Click **"Save"** to apply changes

Changes are tenant-wide and visible to all users.

---

## Strategy Module

The Strategy module helps you define and track strategic initiatives that drive your business forward.

### Viewing Strategies

Click **"Strategy"** in the left sidebar.

**View Options:**
- **Time Period**: Filter by quarter and year
- **Priority**: See strategies marked as High, Medium, or Low priority
- **Team**: Filter by specific team (if applicable)

### Strategy Components

Each strategy includes:

**Basic Information:**
- **Title**: Name of the strategic initiative
- **Description**: Detailed explanation of the strategy
- **Priority**: Importance level (High, Medium, Low)
- **Status**: Current status (Active, On Hold, Completed, Cancelled)
- **Owner**: Person responsible for the strategy

**Time Scope:**
- **Quarter**: Which quarter(s) this strategy applies to
- **Year**: Fiscal year

**Relationships:**
- **Linked Goals**: Which annual goals this strategy supports
- **Value Tags**: Which company values this strategy embodies
- **Objectives**: How many objectives are executing this strategy
- **Big Rocks**: Key initiatives supporting this strategy

### Creating a Strategy (If Authorized)

1. Click **"Add Strategy"**
2. Fill in the form:
   - Title (required)
   - Description
   - Priority
   - Status
   - Time period (quarter and year)
   - Owner
3. **Link to Annual Goals**: Select which goals this strategy advances
4. **Tag with Values**: Select which values this strategy represents
5. Click **"Save"**

### Editing a Strategy

1. Click on a strategy to view details
2. Click **"Edit"**
3. Update fields as needed
4. Click **"Save"**

### Viewing Strategy Performance

Each strategy shows:
- **Linked Objectives Count**: How many objectives support it
- **Overall Progress**: Rolled up from linked objectives
- **At-Risk Indicators**: If linked objectives are behind schedule

![Strategy module showing list of strategic initiatives](/guide-images/05-strategy-module.png)
*Screenshot showing the Strategy page with list of strategies including priority indicators, linked goals, value tags, and progress tracking*

---

## Planning (OKRs)

The Planning module is where you create and manage Objectives, Key Results, and Big Rocks (initiatives).

### What are OKRs?

**OKR** stands for **Objectives and Key Results**:

- **Objective**: A qualitative goal you want to achieve
  - Example: "Become the market leader in our segment"
  
- **Key Results**: Quantitative metrics that measure progress toward the objective
  - Example: "Increase market share from 15% to 25%"

- **Big Rocks**: Major initiatives or projects that help achieve objectives
  - Example: "Launch new product line in Q3"

### Accessing Planning

Click **"Planning"** in the left sidebar.

### OKR Hierarchy Levels

Vega supports four levels of objectives:

1. **Organization**: Company-wide objectives visible to everyone
2. **Team**: Team-specific objectives
3. **Division**: Division or department objectives  
4. **Individual**: Personal objectives for individual contributors

**Hierarchy Support:**
- Objectives can have child objectives (nested structure)
- Provides alignment from organization level down to individuals

### Viewing OKRs

**Filter Options:**
- **Quarter & Year**: Select time period
- **Level**: Filter by Organization, Team, Division, or Individual
- **Team**: Filter by specific team
- **Owner**: Filter by objective owner
- **Status**: Filter by status (Active, At Risk, Behind, Closed)

**Display Options:**
- **Hierarchy View**: See parent-child relationships
- **List View**: Flat list of all objectives

### Creating an Objective

1. Click **"Add Objective"**
2. Fill in the form:
   - **Title**: Clear, aspirational goal statement
   - **Description**: Context and reasoning
   - **Level**: Organization, Team, Division, or Individual
   - **Owner**: Person responsible
   - **Time Period**: Quarter and year
   - **Parent Objective** (optional): For nested objectives
   - **Team** (optional): Associate with a team
   - **Status**: Not Started, In Progress, On Track, At Risk, Behind, Closed
   
3. **Link Relationships**:
   - **Strategies**: Which strategies does this objective execute?
   - **Annual Goals**: Which annual goals does this support?
   - **Values**: Which company values does this embody?

4. Click **"Save"**

![Create Objective form showing all input fields and options](/guide-images/06-create-objective.png)
*Screenshot of the Add/Edit Objective form showing all fields including title, description, level selector, owner assignment, time period, parent objective selection, and value/strategy tagging options*

### Adding Key Results to an Objective

Key Results are the measurable outcomes that indicate objective achievement.

**To Add a Key Result:**

1. Open an objective (click on it)
2. Navigate to the **"Key Results"** tab
3. Click **"Add Key Result"**
4. Fill in the form:
   - **Title**: What you're measuring
   - **Start Value**: Starting point
   - **Target Value**: Goal to reach
   - **Current Value**: Current progress
   - **Unit**: What you're measuring (e.g., %, $, users, deals)
   - **Metric Type**: 
     - **Increase**: Progress means going up (e.g., revenue)
     - **Decrease**: Progress means going down (e.g., costs)
     - **Target**: Binary completion (done/not done)
   - **Owner**: Person responsible
   - **Weight** (optional): How much this KR contributes to objective progress (default: equal weighting)

5. Click **"Save"**

**Progress Calculation:**
- Progress is automatically calculated based on (current - start) / (target - start)
- Objective progress rolls up from all Key Results
- If weights are specified, weighted average is used

### Checking In on Key Results

Regular check-ins update progress and add context.

**To Check In:**

1. Open an objective
2. Find the Key Result you want to update
3. Click **"Check In"** or the check-in icon
4. Enter:
   - **Current Value**: Updated measurement
   - **Status**: On Track, At Risk, Behind
   - **Note**: Commentary on progress, blockers, or achievements
5. Click **"Save Check-In"**

**Check-In History:**
- View all historical check-ins
- Edit past check-ins if needed
- See progress trends over time

**Smart Check-In Prompts (Added Dec 16, 2025):**
- If you check in on a Key Result that has exceeded its target (100%+), Vega will prompt you to close it by marking it as **Closed** to indicate completion, helping maintain clean data and focusing attention on active Key Results
![Expanded objective detail view with Key Results list](/guide-images/07-objective-detail-key-results.png)
*Screenshot showing an expanded objective view with multiple Key Results, their progress bars, current vs target values, check-in buttons, and overall objective progress rollup*

### Big Rocks (Major Initiatives)

Big Rocks are significant projects or initiatives that drive Key Results forward.

**To Add a Big Rock:**

1. Open an objective
2. Navigate to the **"Big Rocks"** tab
3. Click **"Add Big Rock"**
4. Fill in:
   - **Title**: Name of the initiative
   - **Description**: What needs to be done
   - **Owner**: Person responsible
   - **Status**: Not Started, In Progress, On Track, At Risk, Behind, Completed, Cancelled
   - **Due Date**: When it should be completed
   - **Completion Percentage**: 0-100%

5. **Link to Key Results**: Associate with one or more Key Results
6. **Link to Strategies** (optional): Show strategic alignment
7. Click **"Save"**

**Managing Big Rocks:**
- Update status and completion percentage regularly
- Add notes for progress updates
- Mark as Completed when done

### Big Rock Tasks (New in v1.5)

Big Rock Tasks allow you to break down Big Rocks into smaller, actionable tasks with assignees and due dates.

**To Add Tasks to a Big Rock:**

1. Navigate to the Planning module
2. Click on the **Big Rocks** tab
3. Click the **edit icon** (pencil) on a Big Rock card
4. Scroll down to the **Tasks** section
5. Click **"Add"** to create a new task
6. Fill in the task details:
   - **Title**: Name of the task (required)
   - **Description**: Additional details (optional)
   - **Assignee**: Team member responsible for the task
   - **Due Date**: When the task should be completed
7. Click **"Create"**

**Task Status Workflow:**

Tasks follow a simple three-state workflow:
- **Open** (gray circle icon): Task not yet started
- **In Progress** (blue clock icon): Work is underway
- **Completed** (green checkmark): Task finished

Click the status icon to cycle through statuses: Open → In Progress → Completed → Open

**Task Permissions:**
- **Big Rock Owners** can add, edit, and delete any task
- **Task Assignees** can update their own tasks (including status)
- Non-owners and non-assignees see read-only status

**Task Count Badges:**

Big Rock cards display a task count badge showing completed/total tasks (e.g., "2/5 tasks"). This gives you a quick overview of execution progress without opening the Big Rock.

**Best Practices for Tasks:**
- Keep tasks specific and actionable
- Assign clear owners for accountability
- Set realistic due dates
- Update task status regularly during check-ins
- Use task completion to drive Big Rock progress

### Objective Progress and Status

**Progress Percentage:**
- Automatically calculated from Key Results
- Displays as a progress bar
- Can exceed 100% if targets are exceeded

**Status Indicators:**
- **Not Started**: No progress yet
- **In Progress**: Work has begun
- **On Track**: Progressing as expected (Green)
- **At Risk**: May not meet target (Yellow)
- **Behind**: Significantly behind schedule (Red)
- **Closed**: Objective completed

**At-Risk Detection:**
- The AI Assistant can identify at-risk items
- Dashboard highlights objectives that need attention

### Key Result Weighting

By default, all Key Results contribute equally to objective progress. You can customize this with weights.

**To Set Weights:**

1. Open an objective
2. View Key Results
3. Click on weight field for each KR (if exposed in UI)
4. Enter a percentage (0-100)
5. Weights should sum to 100%

**Example:**
- KR1: 60% weight at 100% complete = 60 points
- KR2: 40% weight at 50% complete = 20 points
- **Objective Progress: 80%**

### OKR Cloning (Added Dec 20, 2025)

Clone objectives to simplify recurring OKR creation and cross-team alignment—either duplicating OKRs across teams or rolling over unfinished objectives to new time periods.

**Use Cases:**

1. **Cross-functional collaboration**: Copy OKRs between teams when multiple teams need aligned objectives with slight modifications
2. **Quarterly rollover**: Clone unfinished Q2 objectives to Q3, resetting progress for the new period while preserving Q2 history
3. **Template creation**: Establish standard objectives that can be cloned across multiple teams with consistent structure

**To Clone an Objective:**

1. Navigate to the Planning module
2. Hover over the objective you want to clone
3. Click the **"Clone"** option from the action menu
4. Configure clone options:
   - **Time Period**: Select target quarter/year (defaults to current period)
   - **Owner (applies to entire cloned hierarchy)**: Keep original owner for all cloned items OR assign a single new owner for all cloned items
   - **Scope**:
     - Clone only the objective (no children)
     - Clone objective and immediate children (Key Results only)
     - Clone objective and all children (full hierarchy including nested objectives)
5. Click **"Clone"**

**Important Notes:**
- Progress is reset to 0% for the cloned objective and its Key Results
- Historical check-ins are NOT copied (maintains clean history for the new time period)
- Relationships (linked strategies, annual goals, values) are preserved
- Big Rocks can be cloned along with the objective hierarchy

![Key Result check-in dialog with value input and status options](/guide-images/08-key-result-checkin.png)
*Screenshot of the Key Result check-in dialog showing current value input, status selection (On Track/At Risk/Behind), and notes field for progress commentary*

---

## Focus Rhythm

Focus Rhythm connects your strategy reviews to regular meeting cadences, ensuring continuous alignment and execution.

### Meeting Types

Vega supports four meeting cadences:

1. **Weekly**: Tactical execution meetings
2. **Monthly**: Review progress and adjust tactics
3. **Quarterly**: Strategic reviews and planning
4. **Annual**: Yearly planning and goal setting

### Accessing Focus Rhythm

Click **"Focus Rhythm"** in the left sidebar.

### Viewing Meetings

**Default View**: Calendar-style list of meetings

**Filter Options:**
- **Meeting Type**: Weekly, Monthly, Quarterly, Annual
- **Time Period**: Filter by date range
- **Search**: Find meetings by title or description

### Creating a Meeting

1. Click **"Add Meeting"**
2. Fill in:
   - **Title**: Meeting name
   - **Type**: Weekly, Monthly, Quarterly, or Annual
   - **Date**: When the meeting occurs
   - **Time** (optional): Meeting start time
   - **Description**: Purpose and context

3. **Select Template** (optional):
   - Pre-defined agenda templates for each meeting type
   - Templates include suggested agenda items
   - Can customize after selection

4. **Agenda Items**:
   - Add discussion topics
   - Reorder as needed
   - Mark importance

5. Click **"Save"**

### Meeting Templates

Pre-defined templates help structure effective meetings:

**Weekly Meeting Template:**
- Review previous week's commitments
- Current week priorities
- Blockers and challenges
- Key decisions needed

**Monthly Meeting Template:**
- Progress on Key Results
- Big Rock status updates
- Strategic adjustments
- Next month priorities

**Quarterly Meeting Template:**
- OKR review and results
- Strategic initiatives assessment
- Next quarter planning
- Resource allocation

**Annual Meeting Template:**
- Year in review
- Annual goal achievement
- Next year strategy
- Major initiatives planning

### Linking OKRs to Meetings

Connect objectives, key results, and big rocks to meeting agendas:

1. Open a meeting (click to view details)
2. Click **"Link OKRs"**
3. Search and select:
   - Objectives
   - Key Results
   - Big Rocks
4. Click **"Add"**

**Benefits:**
- Ensure meetings discuss relevant strategic items
- Provide context for participants
- Track which objectives are regularly reviewed
- Generate focused agendas automatically

### Meeting Notes

Capture decisions and action items:

1. Open a meeting
2. Navigate to **"Notes"** section
3. Enter meeting notes
4. Document:
   - Key decisions made
   - Action items and owners
   - Blockers identified
   - Important discussions

**AI Integration:**
- If you use Microsoft Copilot in Outlook meetings, you can paste meeting summaries directly into Vega

### Viewing Meeting Details

Click any meeting to see:
- Meeting information (date, type, description)
- Agenda items
- Linked OKRs with current status
- Meeting notes
- Action items

![Focus Rhythm meeting detail page with agenda and linked OKRs](/guide-images/09-focus-rhythm-meeting.png)
*Screenshot of a meeting detail page showing meeting type, date/time, agenda items, linked OKRs with their current progress, and notes section*

---

## AI Assistant

Vega includes a comprehensive suite of AI-powered tools that help you at every stage of strategic planning and execution. From drafting strategies and goals to tracking progress and improving your check-in notes, AI is woven throughout the platform.

### Accessing the AI Chat

Click the **sparkle icon** in the top right corner to open the AI chat panel. This is your general-purpose assistant for querying data, getting insights, and asking questions.

### AI Chat Assistant

The AI Chat has access to your organization's data and can help with:

**Query OKRs:**
- "What are our Q4 objectives?"
- "Show me all Key Results for the sales team"
- "List objectives owned by John Smith"

**Analyze Performance:**
- "What items are at risk?"
- "Show me objectives behind schedule"
- "Which Key Results have exceeded their targets?"

**Strategic Analysis:**
- "Find strategies without supporting objectives"
- "Which annual goals lack objectives?"
- "Identify execution gaps"

**Meeting Insights:**
- "Show upcoming quarterly meetings"
- "List all meetings linked to this objective"

**Context and Guidance:**
- "What is our company mission?"
- "What are our core values?"
- "Explain the OKR methodology"

**Using the Chat:**

1. Open the AI chat panel (sparkle icon in the top bar)
2. Type your question in natural language
3. Press Enter or click Send
4. The AI will process your request and respond

The AI maintains conversation context, so you can ask follow-up questions like "Now show only the ones that are behind" without repeating your earlier query.

Behind the scenes, the AI uses specialized functions including: querying objectives, key results, big rocks, meetings, identifying at-risk items, analyzing strategic gaps and objective gaps, and accessing your mission, vision, and values.

![AI Assistant chat panel with example conversation](/guide-images/10-ai-assistant-chat.png)
*Screenshot showing the AI chat panel interface with example queries and responses*

---

### AI Check-in Note Rewriter

When recording check-in updates on Key Results or Big Rocks, the AI can help you write better, more professional notes.

**Where to Find It:**
- Open any Key Result or Big Rock detail view
- Enter your check-in note text
- Click the AI rewrite button to improve your note

**Four Rewrite Modes:**

| Mode | What It Does |
|------|-------------|
| **Full Rewrite** | Professional, detailed rewrite that includes context about progress toward the goal. Data-driven and specific. |
| **Improve Clarity** | Fixes grammar, structure, and clarity while keeping the original meaning intact. |
| **Make Concise** | Shortens the note while preserving key points. Makes it punchy and easy to scan. |
| **Add Context** | Expands the note by adding relevant context about progress, timeline, and next steps based on actual data. |

The AI has access to the Key Result's target value, current progress, pace status, and parent objective context, so it can write notes that reference real data.

**Example:**

Your original note: "things are going ok, talked to the team"

AI Full Rewrite: "Progress is on track at 65% against our Q1 target of 500 new signups. Team alignment session completed this week to address the remaining 35% gap. Next steps include launching the referral campaign to accelerate acquisition pace."

---

### AI OKR Suggestions

When creating objectives, the AI can suggest OKR ideas based on your existing strategies and organizational context.

**Where to Find It:**
- In the Planning module, look for the AI suggestion option when creating new objectives
- The AI considers your current strategies, existing objectives for the period, and your organization's focus areas

**What It Provides:**
- Suggested objective titles with descriptions
- Recommended key results for each objective
- Alignment to existing strategies
- Target values and measurement approaches

---

### AI Big Rock Suggestions

When planning major initiatives for an objective, the AI can recommend Big Rock ideas.

**Where to Find It:**
- Within an objective's detail view, use the AI suggestion feature for Big Rocks
- You can also ask for Big Rock ideas through the AI Chat panel

**What It Provides:**
- Initiative ideas that support the objective
- Consideration of existing key results to suggest complementary initiatives
- Practical, actionable recommendations

---

### AI Annual Goal Suggestions

The AI can generate annual goal ideas that align with your organization's mission, vision, values, strategies, and existing objectives.

**Where to Find It:**
- In the Outcomes module when managing Annual Goals, open the AI Goal Suggestions dialog
- Goals are generated automatically when you open the dialog

**What It Provides:**
- Goal titles grounded in your organizational identity and strategic direction
- Suggestions that complement (rather than duplicate) your existing goals
- One-click "Add" to create a goal directly from a suggestion

---

### AI Strategy Drafter

Describe a strategic direction in your own words, and the AI will draft a complete strategy for you.

**Where to Find It:**
- In the Strategy module, use the "AI Draft" feature
- Provide at least a brief description of the strategy you want to create (minimum 10 characters)

**What It Provides:**
- A professionally structured strategy draft
- Content grounded in your organization's foundations (mission, vision, values)
- Awareness of your existing strategies to avoid duplication
- Streamed output so you can see the draft as it's being written

---

### AI Meeting Recap Parser

After a meeting, paste your raw meeting notes and the AI will extract structured information automatically.

**Where to Find It:**
- In Focus Rhythm meeting detail views, use the AI recap feature
- Provide your meeting notes (minimum 10 characters)

**What It Extracts:**
- **Action Items**: Tasks that need to be done, with suggested owners
- **Decisions**: Key decisions made during the meeting
- **Blockers**: Issues or obstacles raised that need resolution
- Context from linked OKRs is used to make the parsing more relevant

---

### OKR Quality Scoring

Get an AI-powered quality assessment of your objectives and key results before finalizing them.

**Where to Find It:**
- In the objective edit or creation view, click the **"Check Quality"** button
- The AI analyzes your objective title, description, key results, and alignment

**What It Provides:**
- An overall quality score
- Specific feedback on areas like clarity, measurability, ambition level, and alignment
- Actionable suggestions for improvement
- You can apply suggestions directly to update your OKR

**Tips for Better Scores:**
- Include a clear, specific objective title
- Add a description that explains what success looks like
- Define key results with measurable targets and units
- Align your objective to parent strategies or goals

---

### AI Progress Summary

When generating reports, the AI creates executive-level summaries of OKR progress for a given time period.

**Where to Find It:**
- In the Reporting module, AI-generated period summaries appear in both PDF and PowerPoint exports
- The summary is automatically generated based on your objectives, key results, and check-in data

**What It Provides:**
- An executive headline summarizing period performance
- Key themes (up to 4) extracted from check-in notes and progress data
- Strategic guidance and recommendations for the next period
- Included as a branded slide in PowerPoint exports

---

### Pace & Velocity Tracking (OKR Intelligence)

Vega automatically calculates pace and velocity metrics for every objective and key result, giving you real-time intelligence on whether you're on track.

**How It Works:**

The system compares your actual progress against where you should be at this point in the quarter (or year for annual goals). For example, if you're 50% through Q2 and an objective is at 30% progress, you're behind pace.

**Pace Badges:**

Every objective and key result displays a color-coded pace badge:

| Badge | Meaning |
|-------|---------|
| **Ahead** | Progress is more than 10 percentage points above expected pace |
| **On Track** | Progress is within 10 percentage points of expected pace |
| **Behind** | Progress is more than 10 points below expected, but less than 25 |
| **At Risk** | Progress is more than 25 percentage points below expected pace |
| **No Data** | Not enough check-in data to calculate pace |
| **Completed** | The item has reached or exceeded its target |

**Where You See Pace:**
- **Executive Dashboard**: Summary counts of how many objectives are ahead, on track, behind, or at risk
- **OKR Detail View**: Individual pace badge with tooltip showing expected vs. actual progress
- **Hierarchical OKR Table**: Pace badges on each row for quick scanning
- **Meeting Detail Pages**: Pace context for linked OKRs

**Velocity Projections:**

The system also calculates velocity (the rate of progress over time) and projects where you'll end up by the end of the period. This projection appears in tooltips when you hover over pace badges.

**Risk Signals:**

In addition to pace, the system detects risk signals:
- **Stalled**: No check-in activity for an extended period
- **Attention Needed**: Progress is falling behind and may need intervention

---

### AI Provider Configuration (Platform Admins Only)

Platform administrators can switch the AI provider and model that powers all AI features in Vega.

**Where to Find It:**
- Navigate to **System Admin** (visible only to platform admins)
- Click the **"AI Config"** tab

**Supported Providers:**

| Provider | Models | Notes |
|----------|--------|-------|
| **Replit AI** | Default model | No additional configuration needed |
| **OpenAI** | GPT-5, GPT-4o | Requires OPENAI_API_KEY |
| **Azure OpenAI** | GPT-5, GPT-4o | Requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY |
| **Anthropic** | Claude 3.5 Opus, Claude 3.5 Sonnet, Claude 3.5 Haiku | Requires ANTHROPIC_API_KEY |

**What Changes Affect:**
- AI Chat conversations
- OKR suggestions and quality scoring
- Check-in note rewriting
- Strategy drafting
- Goal suggestions
- Meeting recap parsing
- Document analysis in Launchpad
- Report AI summaries

Changes take effect immediately after saving. Different models have different pricing, quality, and speed characteristics. GPT-5 offers the highest quality but at higher cost. GPT-4o provides a good balance.

---

### AI Best Practices

**Be Specific in Chat:**
- Instead of "Show me objectives", try "Show me Q4 marketing objectives"
- Include time periods, teams, or owners for better results

**Use Rewrite Modes Strategically:**
- Use "Full Rewrite" for drafts that need major improvement
- Use "Improve Clarity" when the content is good but the writing needs polish
- Use "Make Concise" for lengthy notes that need tightening
- Use "Add Context" when your note is too brief

**Check OKR Quality Early:**
- Score your objectives while drafting them, not after they're finalized
- Apply the AI's suggestions iteratively for better results

**Leverage AI for Preparation:**
- Use AI Goal Suggestions before annual planning sessions
- Use Strategy Drafter to create starting points for team discussions
- Use Meeting Recap Parser immediately after meetings while notes are fresh

---

## Help & Support

Vega provides a built-in help system with an AI-powered chatbot and a support ticket system so you can get answers quickly and escalate issues when needed.

### Help Chatbot

The Help Chatbot is an AI-powered assistant that answers questions about using Vega based on the official User Guide. It's available from anywhere in the platform.

**Accessing the Help Chatbot:**
Click the **Help** button in the top header toolbar. A sliding panel opens from the right side of the screen.

**How to Use It:**
1. Type your question in the text field at the bottom of the panel
2. Press **Enter** or click **Send**
3. The AI will stream a response based on the Vega User Guide
4. Continue the conversation with follow-up questions

**Example Questions:**
- "How do I create an OKR?"
- "What is a Big Rock?"
- "How do check-ins work?"
- "How do I connect Microsoft 365?"
- "What are the different user roles?"

**Escalation to Support:**
If the chatbot can't fully resolve your question, click the **"Open Support Ticket"** button at the bottom of the panel. This opens the support ticket form with your conversation summary pre-filled in the description, so you don't have to repeat yourself.

**Tips:**
- Be specific in your questions for better answers
- The chatbot knows about all Vega features documented in this guide
- Conversation history is maintained during your session
- Close and reopen the panel without losing your conversation

---

### Support Tickets

The Support Ticket system lets you submit bug reports, feature requests, questions, and general feedback to the Vega team.

**Accessing Support:**
Click **"Support"** in the left sidebar under the support section.

#### Creating a Ticket

1. Click **"New Ticket"** on the Support page (or use the escalation button in the Help Chatbot)
2. Fill in the form:
   - **Subject**: A short description of your issue or request
   - **Category**: Choose one of:
     - **Bug**: Something isn't working correctly
     - **Feature Request**: A new capability you'd like to see
     - **Question**: A question that the chatbot couldn't answer
     - **Feedback**: General feedback about the platform
   - **Priority**: How urgent this is (Low, Medium, or High)
   - **Description**: Detailed explanation of your issue, request, or feedback
3. Click **"Submit Ticket"**

**What Happens After Submission:**
- You receive an email confirmation with your ticket number and details
- Platform admins are automatically notified via email
- Your ticket appears in your ticket list with status tracking

#### Viewing Your Tickets

The Support page shows all your submitted tickets with:
- **Ticket Number**: Unique identifier for tracking
- **Subject**: Your ticket title
- **Status**: Current state (Open, In Progress, Resolved, Closed)
- **Priority**: Urgency level
- **Category**: Type of request
- **Date**: When you submitted the ticket

Click any ticket to view its full details and reply thread.

#### Ticket Replies

Once a ticket is open, you can communicate back and forth with the support team:
1. Open a ticket from your ticket list
2. Scroll to the **Replies** section
3. Type your message in the text area
4. Click the **Send** button

Replies from the Vega team will appear in the same thread. You'll see the author name and timestamp for each reply.

#### Ticket Statuses

| Status | Meaning |
|--------|---------|
| **Open** | Your ticket has been submitted and is awaiting review |
| **In Progress** | The support team is actively working on your issue |
| **Resolved** | A solution has been provided or the issue has been fixed |
| **Closed** | The ticket is complete and no further action is needed |

---

### Admin Support Dashboard (Platform Admins Only)

Platform administrators can manage support tickets across all tenants from the System Admin page.

**Accessing the Admin Dashboard:**
Navigate to **System Admin** → **Support** tab.

**Features:**
- **Global Ticket View**: See all tickets across all organizations
- **Filters**: Filter by status, priority, category, or specific tenant
- **Status Management**: Update ticket status (Open, In Progress, Resolved, Closed)
- **Priority Updates**: Change ticket priority as needed
- **Internal Notes**: Add notes visible only to other admins (not visible to the ticket creator)
- **Reply Threads**: Respond directly to users within ticket detail views

---

## MCP Server (AI Assistant Integration)

Vega includes a Model Context Protocol (MCP) server that allows external AI assistants like Claude Desktop, Cursor, and other MCP-compatible tools to access your organization's data securely.

### What is MCP?

MCP (Model Context Protocol) is an open standard that enables AI assistants to connect to external data sources. With Vega's MCP server, you can use AI tools outside of Vega to query your OKRs, strategies, and other Company OS data.

### Setting Up MCP Access

#### Step 1: Create an API Key

1. Go to **Tenant Admin** (gear icon in sidebar)
2. Navigate to the **Integrations** tab
3. Find the **MCP API Keys** section
4. Click **"Create API Key"**
5. Enter a descriptive name (e.g., "Claude Desktop", "Cursor AI")
6. Select permissions:
   - **Read permissions**: Access to view OKRs, strategies, meetings, etc.
   - **Write permissions**: Ability to update progress and add notes (use with caution)
7. Set an expiration period (recommended: 90 days for security)
8. Click **"Create Key"**
9. **Copy the API key immediately** - it won't be shown again

#### Step 2: Configure Your AI Assistant

**For Claude Desktop:**

Add to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vega": {
      "url": "https://your-vega-instance.replit.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**For Cursor:**

1. Open Cursor Settings
2. Navigate to MCP Servers
3. Add a new server with:
   - Name: Vega
   - URL: `https://your-vega-instance.replit.app/mcp`
   - Authentication: Bearer token with your API key

**For Other MCP Clients:**

Use the token exchange flow:
1. POST to `/mcp/token` with your API key in the Authorization header
2. Receive a short-lived JWT token (1 hour)
3. Use that JWT for subsequent MCP requests

### Available MCP Tools

Once connected, your AI assistant can use these tools:

**Read Operations:**
- `get_okrs` - Retrieve OKRs, optionally filtered by quarter/year
- `get_big_rocks` - Get Big Rocks (initiatives)
- `get_strategies` - List all strategies
- `get_mission` - Get organization mission statement
- `get_vision` - Get organization vision
- `get_values` - Get core values
- `get_annual_goals` - Get annual goals
- `get_teams` - List all teams
- `get_meetings` - Get Focus Rhythm meetings

**Write Operations (requires write permissions):**
- `update_kr_progress` - Update Key Result progress
- `add_check_in_note` - Add a check-in note to an objective
- `update_big_rock_status` - Update Big Rock status

### Example AI Conversations

With Claude Desktop connected to Vega:

```
You: What are our Q1 2026 objectives?

Claude: Let me check your Vega data...
[Uses get_okrs tool]
I found 8 objectives for Q1 2026:
1. Expand market presence in APAC region (65% complete)
2. Launch mobile app MVP (40% complete)
...

You: Update the "Launch mobile app" KR for "Complete beta testing" to 75%

Claude: I'll update that Key Result for you.
[Uses update_kr_progress tool]
Done! I've updated "Complete beta testing" to 75% progress.
```

### Managing API Keys

#### View Active Keys

In Tenant Admin → Integrations → MCP API Keys, you can see:
- Key name and prefix
- Assigned permissions
- IP restrictions (if configured)
- Status (Active, Rotating, or Expired)
- Creation date

#### IP Restrictions

For enhanced security, you can restrict API keys to specific IP addresses:

1. Click the **Settings icon** next to a key
2. Enter allowed IP addresses (one per line)
3. Supports individual IPv4 addresses (e.g., `192.168.1.100`) or CIDR ranges (e.g., `10.0.0.0/24`)
4. Leave empty to allow access from any IP
5. Click **Save Changes**

**Note:** IP allowlisting currently supports IPv4 addresses only.

#### Key Rotation

Rotate keys periodically for security:

1. Click the **Refresh icon** next to a key
2. Select a grace period (how long the old key remains valid)
3. Click **Rotate Key**
4. Copy the new key immediately
5. Update your AI assistant configuration
6. The old key will continue working during the grace period

#### Revoking Keys

To revoke a compromised or unused key:
1. Click the **Trash icon** next to the key
2. Confirm revocation
3. The key stops working immediately

### Security Best Practices

1. **Use minimal permissions**: Only grant write access if truly needed
2. **Set expiration dates**: Don't create keys that never expire
3. **Use IP restrictions**: Limit access to known networks when possible
4. **Rotate regularly**: Change keys every 90 days
5. **Monitor usage**: Check key usage in the admin panel
6. **Revoke unused keys**: Remove keys for tools you no longer use

### Rate Limits

The MCP server enforces rate limits to ensure fair usage:
- **60 requests per minute** per tenant
- **10 token exchanges per minute** per IP address

If you exceed limits, requests will return HTTP 429 with retry information.

---

## Microsoft 365 Integration

Vega integrates with Microsoft 365 to sync data and enhance your workflow.

### Available Integrations

1. **Microsoft SSO**: Log in with your Microsoft 365 account
2. **Planner**: Sync tasks and initiatives
3. **SharePoint**: Access documents and files
4. **OneDrive**: Link files to objectives

### Connecting Microsoft 365

#### First-Time Setup

1. Navigate to **Settings**
2. Click **"Connect Microsoft 365"** or **"Connect to Outlook"**
3. You'll be redirected to Microsoft's authorization page
4. Sign in with your Microsoft 365 credentials
5. Review requested permissions:
   - Read calendar events
   - Read tasks
   - Read files
   - (Full list displayed during consent)
6. Click **"Accept"** to grant permissions
7. You'll be redirected back to Vega

**Connection Status:**
- Settings page shows which services are connected
- Green checkmark indicates active connection
- Reconnect if needed

### Microsoft Planner Integration

Sync tasks from Microsoft Planner with Vega Big Rocks.

**Prerequisites:**
- Microsoft 365 connection established
- Planner tasks exist in your M365 tenant

**To Sync Planner Tasks:**

1. Connect Microsoft 365 (see above)
2. Navigate to Planning module
3. In Big Rock creation/editing, you can link to Planner tasks
4. Status and completion sync automatically

**Benefits:**
- View Planner tasks within Vega
- Track strategic alignment of daily tasks
- No duplicate data entry

**Limitations:**
- Read-only access (tasks are updated in Planner, reflected in Vega)
- Requires Outlook connection first

### SharePoint & OneDrive Integration

Access and link files from SharePoint and OneDrive.

**To Access Files:**

1. Connect Microsoft 365
2. Navigate to where you want to attach a file
3. Click **"Attach from SharePoint/OneDrive"**
4. Browse your available:
   - OneDrive files
   - SharePoint sites you follow
   - Recent documents
5. Select the file(s)
6. Click **"Attach"**

**Use Cases:**
- Link strategy documents to strategies
- Attach KPI reports to Key Results
- Reference planning documents in objectives

### Managing M365 Connections

**In Settings:**

- **View Connection Status**: See which services are connected
- **Disconnect**: Revoke permissions (data remains in Vega)
- **Reconnect**: Re-authorize if connection expires

**Troubleshooting:**
- If connection fails, check your M365 permissions
- Ensure admin has granted tenant-wide consent (for some features)
- Contact your IT administrator for permission issues

![Settings page showing Microsoft 365 connection status](/guide-images/11-m365-integration.png)
*Screenshot of the Settings page showing Microsoft 365 connection status, available integrations (Planner, SharePoint, OneDrive), and connect/disconnect buttons*

---

## Import & Export

Vega provides tools to import OKR data from other systems and export your Company OS data.

### Accessing Import/Export

- **Import**: Click **"Import"** in the left sidebar
- **Export**: Available in Tenant Admin settings (if authorized)

### Importing Data

#### Supported Import Formats

1. **Viva Goals Export**: Import from Microsoft Viva Goals
2. **Vega (.cos) Files**: Import previously exported Vega data

#### Import from Viva Goals

If you're migrating from Microsoft Viva Goals:

1. **Export from Viva Goals**:
   - Log in to Viva Goals
   - Navigate to Admin settings
   - Export your OKR data (usually as JSON or ZIP)

2. **Import to Vega**:
   - Click **"Import"** in Vega sidebar
   - Select **"Viva Goals Import"**
   - Upload the exported file
   - Click **"Upload and Process"**

3. **Review Import Results**:
   - See summary of imported items
   - Review any errors or warnings
   - Verify data accuracy

**What Gets Imported:**
- Objectives and Key Results
- Progress history
- Check-ins and notes
- Team structure
- Time periods

#### Import from Vega (.cos files)

Import data previously exported from another Vega tenant:

1. Click **"Import"** in sidebar
2. Select **"Import from File"**
3. Upload the .cos file
4. Choose import options:
   - **Time Period**: Which quarter/year to import to
   - **Duplicate Strategy**: 
     - **Skip**: Don't import duplicates
     - **Replace**: Overwrite existing items
     - **Create Duplicate**: Import as new items
   
5. Click **"Start Import"**
6. Review import summary

**What Gets Imported:**
- Foundation (mission, vision, values, goals)
- Strategies
- Objectives, Key Results, Big Rocks
- Check-in history
- Teams
- AI grounding documents

![Import page with file upload and configuration options](/guide-images/12-import-interface.png)
*Screenshot of the Import page showing file upload area, format selection (Viva Goals vs Vega .cos), import options (time period, duplicate strategy), and import results summary*

### Exporting Data

Export your entire Company OS for backup, migration, or analysis.

**To Export** (Admin access required):

1. Navigate to **Tenant Admin** (Admin section)
2. Click **"Export & Import"** or **"Export Company OS"**
3. Select export options:
   - **Time Period**: Specific quarter/year or all data
   - **Include History**: Whether to include check-in history
4. Click **"Export"**
5. Download the .cos file

**Export File Format:**
- **.cos** (Company OS) format
- JSON structure
- Human-readable
- Can be re-imported to any Vega tenant

**Use Cases:**
- **Backups**: Regular exports for data safety
- **Migration**: Move data between environments
- **Templates**: Export a well-structured Company OS to reuse
- **Analysis**: Extract data for custom reporting

---

## Reporting

**Added January 11, 2026**

The Reporting module allows you to capture snapshots of your Company OS state, generate professional reports, and export them as PDF or PowerPoint presentations.

### Accessing Reporting

Click **"Reporting"** in the left sidebar under the "Review & Learn" section.

### Report Types

Vega supports four report types, each with appropriate date range selection:

| Report Type | Description | Date Selection |
|-------------|-------------|----------------|
| **Weekly Status** | Quick progress update for the week | Pick from last 12 weeks |
| **Monthly Report** | Detailed monthly progress summary | Select month and year |
| **Quarterly Business Review** | Comprehensive QBR with trends | Select quarter and year |
| **Annual Review** | Full year strategic review | Select year |

### Generating a Report

1. Click **"Generate Report"** button
2. Select the **Report Type** (Weekly, Monthly, Quarterly, Annual)
3. Select the **Time Period** using the appropriate date picker:
   - Weekly: Choose a week from the dropdown
   - Monthly: Select month and year
   - Quarterly: Select quarter and year
   - Annual: Select year
4. Enter a **Report Title** (auto-generated based on period)
5. Optionally select a **Snapshot** to compare against
6. Click **"Generate Report"**

### Report Contents

Generated reports include:

- **Executive Summary**: Overall progress and key metrics
- **Objectives by Status**: Breakdown of on-track, at-risk, and behind items
- **Key Results Progress**: Detailed progress on measurable outcomes
- **Big Rocks Status**: Major initiative progress
- **Team Performance**: Per-team progress comparison
- **Check-in Highlights**: Recent updates and commentary
- **AI Period Summary**: AI-generated insights including:
  - Executive headline
  - Key themes (max 4)
  - Strategic guidance

### Exporting Reports

**PDF Export:**
1. View any generated report
2. Click the **PDF** button
3. Your report downloads with professional formatting

**PowerPoint Export:**
1. View any generated report
2. Click the **PowerPoint** button
3. Choose which slides to include:
   - Executive Scorecard (KPIs, status charts)
   - Team Performance (comparison charts)
   - Objectives Overview (detailed table)
   - Key Results Progress (bar charts)
   - At-Risk Items (items below 40%)
   - Big Rocks Kanban (status columns)
   - Period Comparison (if snapshot selected)
   - Check-in Highlights (recent notes)
   - AI Period Summary (AI insights)
4. Click **"Download PPTX"**

### Snapshots

Snapshots capture a point-in-time view of your Company OS for comparison:

**Creating a Snapshot:**
1. Click **"Create Snapshot"**
2. Enter a title and description
3. Select the review type (Weekly, Monthly, Quarterly, Annual)
4. Click **"Create Snapshot"**

**Using Snapshots:**
- Compare current state against historical snapshots
- Track progress over time
- Include period comparison in PowerPoint exports

### Best Practices

- **Weekly**: Create snapshots before team meetings for status updates
- **Monthly**: Generate monthly reports for leadership reviews
- **Quarterly**: Use QBR reports for board presentations
- **Annual**: Create comprehensive annual reviews with AI insights

---

## Launchpad (AI Kickstart Wizard)

**Added December 20, 2025**

The Launchpad is an AI-powered kickstart wizard that helps new organizations quickly establish their Company Operating System by analyzing existing strategic documents.

### What is Launchpad?

Launchpad allows you to upload organizational documents (strategic plans, annual reports, business plans) and uses AI to automatically generate a complete Company OS proposal including mission, vision, values, goals, strategies, objectives, and big rocks.

### Accessing Launchpad

Click **"Launchpad"** in the left sidebar.

### Using the Launchpad Wizard

#### Step 1: Upload Your Document

1. Click **"Start New Session"** or **"Upload Document"**
2. Select a file to upload:
   - **PDF**: Strategic plans, annual reports
   - **Word (.docx only)**: Business plans, planning documents
   - **Plain Text (.txt)**: Any text-based strategic content
3. Enter optional context:
   - Target year for the Company OS
   - Specific focus areas or priorities
   - Any additional instructions for the AI
4. Click **"Upload and Analyze"**

**What the AI Extracts:**
- Organization mission and vision
- Core values and culture
- Annual goals and targets
- Strategic initiatives
- Objectives and key results
- Major initiatives (Big Rocks)

#### Step 2: Review AI-Generated Proposal

The AI will analyze your document and generate structured proposals for each component:

1. **Foundation Elements**:
   - Mission statement
   - Vision statement
   - Company values (with descriptions)
   - Annual goals

2. **Strategic Components**:
   - Strategic initiatives with priorities
   - Linked to annual goals
   - Tagged with values

3. **Operational Elements**:
   - Objectives at various levels
   - Key Results with targets
   - Big Rocks (major initiatives)

#### Step 3: Review & Edit

Navigate through each section to review and refine the AI's suggestions:

1. **Foundation Review**:
   - Edit mission and vision statements
   - Modify value descriptions
   - Adjust annual goals
   - Add or remove values

2. **Strategy Review**:
   - Edit strategy titles and descriptions
   - Adjust priorities (High, Medium, Low)
   - Link to different annual goals
   - Add or remove strategies

3. **OKR Review**:
   - Edit objective titles and descriptions
   - Modify Key Result metrics and targets
   - Adjust ownership and time periods
   - Add, remove, or reorganize the OKR hierarchy

4. **Big Rocks Review**:
   - Edit initiative descriptions
   - Adjust due dates
   - Link to different Key Results
   - Modify priorities

#### Step 4: Approve and Deploy

Once you're satisfied with the proposal:

1. Review the summary of what will be created
2. Click **"Approve and Deploy"**
3. The system creates all entities in your tenant:
   - Foundation elements are set
   - Strategies are created
   - Objectives, Key Results, and Big Rocks are created
   - All relationships (links between strategies, goals, values) are established

**Draft Sessions:**
- Your work is automatically saved as a draft
- You can exit and return later to complete the wizard
- Drafts are saved until you either approve or delete them

### Consultant Mode

For Vega consultants working with clients:

1. Upload the client's strategic document
2. Use Launchpad to generate the initial Company OS proposal
3. Review and refine the suggestions based on your expertise
4. Share the draft with the client for their review and approval
5. The client can make final adjustments before deployment

### Best Practices for Launchpad

**Document Quality:**
- Use comprehensive strategic documents with clear goals and initiatives
- Include context about your organization, industry, and market
- More detailed documents yield better AI-generated proposals

**Review Thoroughly:**
- Don't blindly accept all AI suggestions
- The AI provides a starting point - your expertise refines it
- Ensure values and mission reflect your true culture

**Iterative Refinement:**
- Use the AI-generated structure as a foundation
- Add specific metrics and targets that the AI couldn't extract
- Reorganize the hierarchy to match your organizational structure

**When to Use Launchpad:**
- New organizations setting up their Company OS for the first time
- Organizations migrating from another system without structured data
- Annual planning sessions when starting fresh with a new strategic plan
- Creating templates for multiple similar organizations

---

## Settings & Administration

### Personal Settings

Access personal settings by clicking your profile menu → **Settings**.

#### Profile Information

Update your:
- Name
- Email (must be verified)
- Password (change password)

#### Microsoft 365 Connections

View and manage:
- Connection status for M365 services
- Last sync times
- Connect/disconnect buttons
- Reconnect if authorization expires

#### Theme Preferences

- **Light Mode**: Default light theme
- **Dark Mode**: Dark theme for low-light environments
- **System**: Follow operating system theme preference

### Tenant Administration

If you have admin permissions, access advanced settings for your organization.

#### Accessing Tenant Admin

Click **"Admin"** in the left sidebar (only visible to admins).

#### Tenant Admin Tabs (Updated Jan 3, 2026)

The Tenant Administration page is organized into three tabs for easier navigation:

1. **Organization Tab**: Manage tenant settings, branding, SSO, domains, vocabulary, and M365 connectors
2. **Users & Teams Tab**: Create and manage users and teams
3. **Integrations Tab**: Configure M365 connectors, admin consent, and consultant access

### Organization Tab Functions

#### Tenant Settings

Each organization card provides quick access to:
- **Edit/Delete**: Modify organization name, color, and logo
- **Membership**: Manage allowed email domains or invite-only mode
- **Default Time Period**: Set current quarter or specific time period
- **Fiscal Year**: Configure when your fiscal year starts
- **SSO**: Configure Microsoft Entra ID single sign-on
- **M365 Connectors**: Enable/disable OneDrive, SharePoint, Outlook, Excel, Planner
- **Vocabulary**: Customize terminology (Goals, Objectives, Key Results, etc.)
- **Branding**: Configure logos, colors, and report branding

### Users & Teams Tab Functions

#### 1. Manage Users

View and manage users in your organization:

**User List:**
- See all users in your tenant
- View roles and permissions
- Check email verification status

**Add New User:**
1. Click **"Add User"**
2. Enter email, name, role
3. Set initial password
4. Click **"Create"**
5. User receives welcome email

**Bulk Import:**
- Upload CSV file to create multiple users at once
- Required columns: email, password
- Optional columns: name, role

**Edit User:**
1. Click user row
2. Update role, status, or other fields
3. Click **"Save"**

**User Roles:**
- **User (tenant_user)**: Standard user, can view and edit own OKRs
- **Tenant Admin**: Can manage tenant settings and users
- **Admin**: Full access to tenant management
- **Vega Consultant**: Multi-tenant access (managed by platform admins)
- **Vega Admin**: Platform-level access (managed by platform admins)

#### 2. Manage Teams

Create and organize teams with full CRUD (Create, Read, Update, Delete) capabilities:

**Accessing Team Management:**
1. Navigate to **Tenant Admin** section (Admin sidebar item)
2. Click on the **"Users & Teams"** tab

**View Teams:**
- See all teams in your organization
- View team member count
- See team description and details

**Add New Team:**
1. Click **"Add Team"** or **"Create Team"**
2. Enter:
   - **Team name**: Descriptive name for the team
   - **Description**: Purpose and focus of the team
   - **Team members**: Select users to add to the team
3. Click **"Save"** or **"Create"**

**Edit Team:**
1. Click on a team from the list
2. Click **"Edit"** or click the edit icon
3. Update any field:
   - Modify team name or description
   - Add or remove team members
   - Adjust team settings
4. Click **"Save Changes"**

**Delete Team:**
1. Select a team from the list
2. Click **"Delete"** or the delete icon
3. Confirm deletion
4. **Note:**
   - Deleting a team does **not** delete associated OKRs. Objectives and key results remain in Vega but no longer have that team assigned.
   - Team-owned objectives become "unassigned" from a team: they continue to be visible to their objective owners and contributors and in any global views/filters that do not require a team.
   - **Best practice before deletion:** Review all active OKRs for the team and, where appropriate, reassign them to another team so you do not leave important OKRs without a team context.
   - **After deletion:** Use OKR filters (for example, filter by **No Team** or equivalent) to identify and clean up any remaining orphaned OKRs.
   - Vega may not automatically notify users when a team is deleted. Communicate team deletions and any OKR reassignments through your normal channels (e.g., email, meetings, announcements).

**Manage Team Members:**
- Add members: Select from list of users in your tenant
- Remove members: Click the remove icon next to member name
- View member roles: See what role each team member has
- Bulk operations: Add or remove multiple members at once

**Team Benefits:**
- Organize objectives by team
- Filter dashboards by team
- Track team-specific metrics
- Improve collaboration and visibility
- Support team-level OKR hierarchy

#### 3. Tenant Settings

Configure organization-wide settings:

**General Settings:**
- **Organization Name**: Display name
- **Logo**: Upload company logo
- **Primary Color**: Brand color for UI elements

**SSO Settings:**
- **Enforce SSO**: Require Microsoft SSO for all users
- **Allow Local Auth**: Permit email/password login alongside SSO
- **Azure Tenant ID**: Your Microsoft tenant identifier

**Allowed Email Domains:**
- Specify which email domains can join your tenant
- Users with these domains are automatically assigned
- Example: `@company.com`, `@subsidiary.com`

**Time Period Defaults:**
- **Mode**: Current (always show current quarter) or Specific
- **Default Quarter**: If specific, which quarter to show
- **Default Year**: If specific, which year to show

**Customizable Branding (Added Dec 20, 2025):**
- **Organization Logo**: Upload your company logo
  - Supported formats: PNG, JPG, SVG
  - Recommended size: 200x50 pixels for optimal display
  - Light mode logo: Displayed on light backgrounds
  - Dark mode logo: Optional separate logo for dark mode
- **Primary Brand Color**: Set your brand color for UI elements
  - Used for buttons, links, and accent elements
  - Hex color code or color picker
- **Company Name**: Display name shown in the interface
- **Branding Preview**: See how your branding looks before saving
- **Apply to Reports**: Your branding is automatically applied to exported PDF and PPTX reports

**Setting Up Branding:**
1. Navigate to **Tenant Settings** in Admin
2. Scroll to **"Branding"** section
3. Upload your logo(s):
   - Click **"Upload Light Mode Logo"**
   - Optionally upload **"Upload Dark Mode Logo"** for dark theme
4. Set your **Primary Brand Color** using the color picker
5. Preview your branding in the preview panel
6. Click **"Save Settings"**

**Branding Applications:**
- Top navigation bar displays your logo
- Primary color used throughout the interface
- Exported reports include your logo and branding
- Email notifications can include branding (if configured)

#### 4. AI Grounding Documents

Manage documents that provide context to the AI Assistant:

1. Navigate to **"AI Grounding Admin"**
2. See existing grounding documents
3. Click **"Add Document"**
4. Enter:
   - **Title**: Document name
   - **Type**: Methodology, Terminology, Best Practices, etc.
   - **Content**: Text that provides context to AI
5. Click **"Save"**

**Purpose:**
- Train the AI on your organization's specific language
- Provide methodology guidelines
- Define custom terminology
- Share best practices

**Examples:**
- Company-specific acronyms and definitions
- Strategy development methodology
- Values descriptions and examples
- Industry-specific context

#### 5. Import/Export Management

Admin-level import and export functions:

- **Export Tenant Data**: Create .cos backup files
- **View Import History**: See past imports
- **Manage Templates**: Export for reuse

### Integrations Tab Functions

#### Consultant Access Management

Grant and revoke consultant access to your organization:

- View which consultants have access to each tenant
- Grant access with optional expiration dates
- Revoke access when engagements end

#### Microsoft 365 Integration

Configure M365 admin consent and connectors:

- **Admin Consent**: Grant Azure AD consent for M365 API access
- **Available Connectors**: View connector descriptions and capabilities

---

### System Administration (Platform Admins Only)

System Administration is accessible only to Vega Admins and Global Admins. This section manages platform-wide settings that affect all tenants.

#### Accessing System Admin

Click **"System"** in the left sidebar (only visible to platform admins).

#### System Admin Tabs (Updated Feb 8, 2026)

1. **Vocabulary**: Set system-wide default terminology
2. **AI Usage**: Monitor platform-wide AI token consumption and costs
3. **AI Config**: Configure AI provider and model settings
4. **Plans**: Create and manage service plans for tenant licensing
5. **Security**: Manage blocked email domains
6. **Tenants**: View tenant activity, assign service plans
7. **Traffic**: Website traffic analytics
8. **Announcements**: System-wide announcement banners
9. **Scheduled Jobs**: Monitor and control background system jobs
10. **Support**: Manage support tickets across all tenants (New in v1.9)

#### AI Usage Reporting (Platform-wide)

Track and monitor AI usage across **all tenants** to understand platform operating costs.

**Summary Dashboard:**
- **Total AI Calls**: Number of AI requests made platform-wide
- **Total Tokens Used**: Input and output tokens consumed
- **Cost Estimates**: Approximate costs based on usage
- **Usage by Provider**: Track usage by AI provider (Azure OpenAI, Anthropic, etc.)
- **Usage by Model**: Compare model performance and usage patterns

**Why Platform-level:**
AI usage is a platform operating cost, not charged to individual tenants. Platform admins use this to monitor overall costs and capacity.

#### Service Plans Management

Create and manage subscription plans for tenants:

- **Internal Name**: Technical identifier
- **Display Name**: User-facing plan name
- **Duration**: How long the plan lasts (e.g., 60 days for trial)
- **Max Read/Write Users**: User limits
- **Max Read-Only Users**: Read-only user limits
- **Default Plan**: Set which plan applies to new self-service signups

#### Blocked Domains (Security)

Prevent specific email domains from self-service signup:

- Block disposable email domains
- Block competitor domains
- Add reasons for audit purposes

#### Tenant Plan Assignment

View and manage service plans for each organization:

- See current plan status (Active, Expired, Days Left)
- Assign or change plans
- Set expiration dates

#### Scheduled Jobs Dashboard (Added Jan 31, 2026)

Monitor and manage all background jobs running on the platform. This dashboard provides visibility into system tasks that run automatically.

**Accessing Scheduled Jobs:**
Navigate to System Admin → Scheduled Jobs tab.

**Jobs List Tab:**
View all registered background jobs with:
- **Job Name**: Display name and technical identifier
- **Status**: Active (running on schedule) or Paused
- **Schedule**: How often the job runs (e.g., "Every day", "Every hour")
- **Category**: Job type (notification, sync, maintenance, system)
- **Last Run**: When the job last executed
- **Next Run**: When the job will run next

**Run History Tab:**
View execution history for all jobs:
- **Status Indicators**: Success (green), Failed (red), Running (blue)
- **Execution Time**: When the job started and completed
- **Summary**: Brief description of what happened
- **Trigger**: How the job was started (scheduled, manual, startup)

**Job Controls (Vega Admin Only):**
Platform admins with vega_admin role can control jobs:
- **Run Now**: Manually trigger a job immediately
- **Pause**: Stop a job from running on its schedule
- **Resume**: Restart a paused job
- **Edit Schedule**: Change how often a job runs using schedule presets (every minute to daily intervals)
- **Kill Stuck Run**: Force-stop a job run that appears stuck in "Running" state. Requires confirmation. Records who killed it and when for audit purposes.

**Currently Registered Jobs:**
- **Expiration Reminders**: Runs daily to check for expiring items and send notification emails
- **Reminder Cache Reset**: Runs daily for cache maintenance

**Job Failure Notifications:**
When any background job fails, all platform admins (vega_admin users) receive an email alert with:
- Job name and description
- Error message and technical details
- Timestamp of failure

**Permission Note:**
Tenant admins can view the Scheduled Jobs dashboard but cannot control jobs (Run/Pause/Resume buttons are hidden). Only vega_admin users have job control permissions.

#### 7. Enhanced Reporting with PDF/PPTX Export (Added Dec 20, 2025)

Generate professional reports with your branding for board meetings, stakeholder updates, and reviews.

**Accessing Enhanced Reporting:**
1. Navigate to any reporting view (Dashboard, OKRs, Strategies)
2. Click **"Export"** or **"Generate Report"** button
3. Select report format: **PDF** or **PowerPoint (PPTX)**

**Report Types:**

**OKR Progress Report:**
- Summary of objectives and key results for selected time period
- Progress charts and visualizations
- At-risk items highlighted
- Includes your company branding

**Strategic Review Report:**
- Strategic initiatives overview
- Linked objectives and progress
- Value alignment analysis
- Executive summary

**Dashboard Summary Report:**
- Company identity (mission, vision, values)
- Strategic priorities snapshot
- Active objectives by level
- Upcoming meetings

**Report Customization:**
- **Time Period**: Select quarter and year
- **Scope**: Organization-wide, team, or individual
- **Include**: Choose which sections to include
- **Branding**: Automatically includes your logo and colors

**PDF Export Features:**
- Professional formatting with your branding
- Progress charts and visualizations
- Detailed metrics and status
- Exportable for sharing with stakeholders

**PowerPoint (PPTX) Export Features:**
- Slide deck with your branding
- One slide per major objective or strategy
- Progress visualizations
- Editable format for further customization
- Ready for board presentations

**Use Cases:**
- **Board Meetings**: Generate executive summaries for leadership
- **Stakeholder Updates**: Share progress with external stakeholders
- **Quarterly Reviews**: Document performance for historical records
- **Client Deliverables**: Consultants can generate branded reports for clients

### Role-Based Access Control (RBAC)

Vega uses role-based permissions to control access:

**Permission Levels:**

| Role | Permissions |
|------|-------------|
| **Tenant User** | View foundations, view/edit own OKRs, check in on assigned KRs, view team data |
| **Tenant Admin** | All user permissions + manage users, manage teams, edit foundations, export data |
| **Admin** | Full tenant administration |
| **Vega Consultant** | Access multiple tenants, view all data, edit where assigned |
| **Vega Admin** | Platform-level access |

**Security Features:**
- All routes require authentication
- Tenant isolation (users only see their organization's data)
- Row-level security on sensitive operations
- Audit logging (for admin actions)

---

## Best Practices

### Setting Effective OKRs

**Objectives:**
- Make them aspirational and inspiring
- Use action-oriented language
- Keep them qualitative (not just numbers)
- Limit to 3-5 objectives per level per quarter
- Ensure alignment from organization → team → individual

**Key Results:**
- Must be measurable and quantifiable
- Should be ambitious but achievable
- Define clear start, target, and current values
- Limit to 3-5 key results per objective
- Use specific metrics (%, $, count, etc.)

**Big Rocks:**
- Define major initiatives, not tasks
- Link clearly to Key Results
- Set realistic due dates
- Assign clear ownership
- Update status regularly

### Regular Check-Ins

**Recommended Cadence:**
- **Key Results**: Weekly or bi-weekly
- **Objectives**: Monthly review
- **Strategies**: Quarterly review

**Check-In Best Practices:**
- Always add notes explaining progress
- Be honest about status (don't hide risks)
- Flag blockers early
- Celebrate wins when targets are exceeded

### Values-Driven Decisions

- Tag objectives with relevant company values
- Reference values in strategy descriptions
- Use Values Alignment dashboard widget to track balance
- Ensure all values are represented in your work portfolio

### Meeting Effectiveness

**Focus Rhythm Tips:**
- Link relevant OKRs to every meeting
- Review progress during meetings (don't wait)
- Document decisions and action items
- Use AI to generate meeting prep summaries
- Follow a consistent template for each cadence

### Using AI Effectively

**Maximize AI Value:**
- Ask questions before meetings to prep
- Use AI to identify gaps in your strategy
- Let AI flag at-risk items proactively
- Query for insights, not just data retrieval
- Teach the AI your organization's language (grounding docs)

### Data Hygiene

**Keep Data Current:**
- Archive or close completed objectives
- Update Key Results regularly
- Mark Big Rocks complete when done
- Remove outdated strategies
- Verify team memberships each quarter

**Avoid Clutter:**
- Don't create too many nested objective levels
- Limit draft/inactive items
- Delete test data
- Use consistent naming conventions

---

## Troubleshooting

### Common Issues

#### Login Problems

**Issue**: "Invalid credentials" error
- **Solution**: Verify email and password are correct
- Check if caps lock is on
- Try password reset if forgotten
- Ensure email is verified (check inbox for verification link)

**Issue**: Microsoft SSO not working
- **Solution**: 
  - Verify your organization has enabled SSO
  - Check with IT admin for tenant-wide consent
  - Clear browser cookies and try again
  - Try a different browser

**Issue**: Session expires quickly
- **Solution**: 
  - Check browser privacy settings (allow cookies)
  - Don't use incognito/private mode
  - Re-login to refresh session

#### Data Not Appearing

**Issue**: Objectives or strategies not visible
- **Solution**:
  - Check time period filter (quarter/year selector)
  - Verify team filter settings
  - Ensure you have permissions to view that data
  - Try refreshing the page

**Issue**: Microsoft Planner tasks not syncing
- **Solution**:
  - Verify Microsoft 365 connection in Settings
  - Ensure Outlook is connected first (prerequisite)
  - Check that you have Planner tasks in M365
  - Reconnect if needed

#### Import/Export Issues

**Issue**: Import fails with errors
- **Solution**:
  - Verify file format is correct (.cos or Viva Goals format)
  - Check file isn't corrupted (re-download)
  - Review error messages for specific issues
  - Ensure you have admin permissions

**Issue**: Export doesn't include expected data
- **Solution**:
  - Verify time period selection includes your data
  - Check that data exists in selected quarter/year
  - Ensure you have permissions to export

#### Performance Issues

**Issue**: App is slow or unresponsive
- **Solution**:
  - Clear browser cache and cookies
  - Try a different browser (Chrome, Edge, Firefox)
  - Check internet connection speed
  - Reduce number of open tabs
  - Contact support if persistent

#### AI Assistant Issues

**Issue**: AI gives incorrect or irrelevant answers
- **Solution**:
  - Rephrase your question more specifically
  - Include time periods and team names
  - Check that relevant data exists
  - Admin: Add grounding documents for better context

**Issue**: AI says "no data found"
- **Solution**:
  - Verify data exists for the time period
  - Check permissions (AI uses your access level)
  - Try a broader query first

### Getting Help

**Resources:**
- **Help Chatbot**: Click the Help button in the header for instant AI-powered answers (New in v1.9)
- **Support Tickets**: Submit a support ticket from the Support page in the sidebar (New in v1.9)
- **User Guide**: This document
- **Admin Support**: Contact your tenant administrator
- **Platform Support**: Contact The Synozur Alliance

**Reporting Bugs:**
1. Try the **Help Chatbot** first for quick answers
2. If unresolved, click **"Open Support Ticket"** in the chatbot or go to the Support page
3. Select **"Bug"** as the category
4. Include the exact steps to reproduce
5. Capture any error messages
6. The ticket system automatically notifies the Vega team

---

## Appendix: Glossary

**Big Rock**: A major initiative or project that contributes to achieving Key Results. Named after the "big rocks" time management metaphor - prioritizing important over urgent.

**Branding**: Customizable visual identity for your organization within Vega, including logos, colors, and styling that appears in the interface and exported reports.

**Check-In**: A progress update on a Key Result, including updated metrics and status notes.

**Cloning**: The process of duplicating an objective, along with its Key Results and/or Big Rocks, to a new time period or for use by a different team while resetting progress and maintaining structure.

**Company OS**: Company Operating System - the integrated platform for strategic alignment and execution (Vega).

**Focus Rhythm**: Regular meeting cadences (weekly, monthly, quarterly, annual) that connect strategy to execution.

**Foundation**: The core identity elements of an organization: mission, vision, values, and ambitions. Annual goals are managed in the Outcomes module.

**Help Chatbot**: An AI-powered assistant that answers questions about using Vega based on the official User Guide. Accessible from the Help button in the header toolbar.

**Key Result (KR)**: A quantitative metric that measures progress toward an objective. Typically 3-5 per objective.

**Launchpad**: An AI-powered kickstart wizard that analyzes strategic documents to automatically generate a complete Company OS proposal, including mission, vision, values, strategies, objectives, and big rocks.

**Objective**: A qualitative, aspirational goal. The "O" in OKR.

**OKR**: Objectives and Key Results - a goal-setting framework for defining and tracking objectives and their outcomes.

**Rollup**: The aggregation of Key Result progress to calculate overall Objective progress.

**Strategy**: A high-level plan or initiative designed to achieve annual goals.

**Support Ticket**: A formal request for help, bug report, feature request, or feedback submitted through the Support page. Tracked with status, priority, and reply threads.

**Tenant**: An organization or company instance within Vega. Multi-tenant architecture allows multiple organizations on one platform.

**Value Tag**: Associating a company value with an objective or strategy to show values-driven work.

**Weight**: The relative importance of a Key Result in contributing to its parent Objective's progress (used in weighted rollup calculations).

---

## Document Version History

- **v1.0** (December 13, 2025): Initial comprehensive user guide
- **v1.1** (December 17, 2025): Removed roadmap and future work content; focused on currently implemented features only
- **v1.2** (December 23, 2025): Added documentation for features completed since v1.1:
  - Check-in Close Prompt feature (completed Dec 16, 2025)
  - AI Usage Reporting for Tenant Admins (completed Dec 20, 2025)
  - Enhanced Reporting with PDF/PPTX export (completed Dec 20, 2025)
  - Customizable Branding (completed Dec 20, 2025)
  - Team Management CRUD UI (completed Dec 20, 2025)
  - OKR Cloning feature (completed Dec 20, 2025)
  - Launchpad / AI Kickstart Wizard (completed Dec 20, 2025)
  - Updated navigation to include Launchpad
  - Added glossary terms: Branding, Cloning, Launchpad
- **v1.3** (January 3, 2026): Improved admin screen UX:
  - Reorganized Tenant Admin into three tabs: Organization, Users & Teams, Integrations
  - Moved platform-level features to System Admin: Service Plans, Blocked Domains, Tenant Plan Assignment, AI Usage
  - Added responsive mobile design for admin screens
  - System Admin now has tabs: Vocabulary, AI Usage, Plans, Security, Tenants, Traffic, Announcements
  - Updated navigation and documentation for admin screens
- **v1.4** (February 7, 2026): Version 1.8 updates:
  - Added What's New & Changelog section with modal and full changelog page documentation
  - Updated Annual Goals to reflect move from Foundations to Outcomes module
  - Added Job Scheduler kill stuck runs and schedule editing documentation
  - Updated job schedules to reflect actual intervals (daily)
  - Added Platform Updates category to Feature Overview
  - Updated Table of Contents
- **v1.5** (February 8, 2026): Version 1.9 updates:
  - Added Help & Support section with Help Chatbot and Support Tickets documentation
  - Added Help button to Top Bar description
  - Added Support link to Main Navigation description
  - Updated System Admin tabs to include Support tab
  - Updated Getting Help section with chatbot-first approach
  - Added Help & Support category to Feature Overview
  - Added glossary terms: Help Chatbot, Support Ticket

---

**Need More Help?**

Contact your organization's Vega administrator or The Synozur Alliance support team.

**The Synozur Alliance LLC**  
Empowering organizations through strategic alignment.
