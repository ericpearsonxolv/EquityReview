# Design Guidelines: EquityReview Prototype

## Design Approach

**Selected Approach:** Design System - Fluent Design (Microsoft)
**Rationale:** Enterprise HR tool targeting Azure deployment with focus on clarity, efficiency, and professional trust. Fluent Design provides familiar patterns for productivity applications with excellent accessibility and data-heavy interfaces.

## Core Design Elements

### A. Typography

**Font Family:** 
- Primary: 'Segoe UI', system-ui, -apple-system, sans-serif
- Monospace: 'Consolas', 'Monaco', monospace (for job IDs, file names)

**Hierarchy:**
- Page Title: text-2xl, font-semibold
- Section Headers: text-lg, font-semibold
- Body: text-base, font-normal
- Labels: text-sm, font-medium
- Helper Text: text-sm, font-normal
- Status Messages: text-sm, font-medium

### B. Layout System

**Spacing Units:** Tailwind units of 3, 4, 6, 8, 12
- Component padding: p-6
- Section spacing: space-y-8
- Form field gaps: space-y-4
- Inline elements: gap-3

**Container:**
- Max width: max-w-3xl mx-auto
- Page padding: px-6 py-12

### C. Component Library

**Primary Interface (Single Page Application)**

1. **Application Header**
   - Logo/title area with subtle bottom border
   - Height: h-16
   - Padding: px-6
   - Contains: "EquityReview Analysis Portal" title + future auth placeholder (right-aligned empty div)

2. **Main Content Container**
   - Card-based layout with subtle elevation
   - Rounded corners: rounded-lg
   - Padding: p-8
   - Border: 1px solid with subtle shadow

3. **Form Section**
   - Vertical stack layout (space-y-6)
   - ReviewBatch Input:
     - Label above input
     - Full-width text input
     - Height: h-10
     - Padding: px-4
     - Rounded: rounded-md
     - Border: 1px solid
   - File Upload:
     - Label with clear instructions ("Upload Performance Review Excel (.xlsx)")
     - Custom file input button styled as secondary button
     - File name display below when selected (text-sm, truncate)
     - Accept attribute: .xlsx only

4. **Action Button (Submit)**
   - Full-width on mobile, auto-width on desktop (min-w-32)
   - Height: h-11
   - Padding: px-6
   - Rounded: rounded-md
   - Font: text-base, font-semibold
   - Disabled state when no file selected

5. **Status Display Section**
   - Appears after submission
   - Card with subtle background differentiation
   - Padding: p-6, rounded-lg
   - Contains:
     - Job ID (monospace font, text-sm)
     - Status badge (inline-flex, px-3, py-1, rounded-full, text-sm, font-medium)
     - Progress bar (when running):
       - Container: h-2, rounded-full, full-width
       - Fill: h-2, rounded-full, transition-all duration-300
     - Status message (text-sm, mt-3)

6. **Download Section**
   - Appears when status = "done"
   - Padding: p-6, rounded-lg
   - Download button:
     - Height: h-11
     - Padding: px-6
     - Rounded: rounded-md
     - Icon + text layout (gap-2)
     - Font: text-base, font-semibold

7. **Error Display**
   - Border-l-4 accent
   - Padding: p-4
   - Rounded: rounded-md
   - Icon + message layout

**State Patterns:**
- Loading states: Subtle pulse animation on progress indicators
- Disabled inputs: Reduced opacity (opacity-50), cursor-not-allowed
- Focus states: Visible outline with 2px offset
- Success states: Checkmark icon + confirmation message
- Error states: Alert icon + error message with border accent

**Form Validation Feedback:**
- Inline validation messages below inputs (text-sm)
- Error messages in semantic styling
- Required field indicators (* after label)

### D. Layout Grid

Desktop (lg:):
- Single-column centered layout
- Max-width constraint for optimal reading/interaction

Mobile (base):
- Full-width with horizontal padding
- Stacked elements with consistent spacing

### E. Icons

**Library:** Heroicons (via CDN)
**Usage:**
- File upload: document-arrow-up
- Download: arrow-down-tray
- Success: check-circle
- Error: exclamation-circle
- Loading: arrow-path (with spin animation)
- Info: information-circle

### F. Accessibility

- All form inputs have associated labels (htmlFor)
- File upload includes keyboard navigation support
- Status updates announced to screen readers (aria-live="polite")
- Sufficient contrast ratios throughout
- Focus indicators on all interactive elements (ring-2, ring-offset-2)
- Semantic HTML (main, section, form tags)

## Images

**No hero image required.** This is a utility application focused on functionality, not marketing.

## Animations

**Minimal, functional only:**
- Progress bar fill: transition-all duration-300
- Loading spinner: animate-spin
- Status transitions: Fade-in for new status messages (transition-opacity duration-200)

## Distinctive Characteristics

- Clean, uncluttered interface prioritizing task completion
- Enterprise-appropriate professionalism
- Clear visual hierarchy guiding users through upload → analyze → download workflow
- Trust-building through clarity and predictability
- Responsive but not mobile-first (desktop productivity tool)