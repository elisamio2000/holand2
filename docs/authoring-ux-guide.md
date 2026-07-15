# Assessment Authoring UX Guide — Phase C

## Overview

This guide walks authors through the professional assessment authoring interface. The authoring panel is designed for administrators and content experts to create, edit, and publish assessments with age-branching support.

---

## Getting Started

### Accessing the Authoring Panel

1. Log in as **admin** or **analyst** role
2. Navigate to **Assessment Management** → **Authoring**
3. Select an existing assessment or click **Create New Assessment**

---

## The 4-Tab Interface

The authoring panel consists of 4 main sections (tabs):

```
┌───────────────────────────────────────────────────────────────┐
│ Assessment: [Title Input]                              [← Back] │
├───────────────────────────────────────────────────────────────┤
│ 📋 Overview │ ❓ Questions │ 📊 Scoring │ 🎯 Age-Branching   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ [TAB CONTENT HERE]                                           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Tab Navigation

- Click any tab to switch sections
- Unsaved changes are auto-saved (500ms debounce)
- A warning appears if you leave with unsaved edits

---

## Tab 1: Overview

**What it does:** Manage core assessment metadata and enable age-branching.

### Fields

#### Title (required)
- Name of the assessment (e.g., "Holland Self-Directed Search v2")
- Auto-saves when you blur the input
- Max 200 characters

#### Description
- Optional long-form explanation of the assessment
- Used in assessments list and about pages
- Supports Markdown (future enhancement)

#### Age-Branched Toggle
- Enables separate question/scoring branches for 4 age groups:
  - **Child** (6-12 years)
  - **Teen** (13-17 years)
  - **Adult** (18-50 years)
  - **Senior** (50+ years)
- When enabled, each branch can have different questions and scoring rules
- When disabled, all users see the same content

#### Publish Status
- Shows current state of each branch (if age-branching enabled):
  - **Draft** (gray): In progress, not ready for users
  - **Reviewed** (blue): Submitted for approval
  - **Approved** (green): Approved, not yet live
  - **Published** (bold green): Live and in use by users

---

## Tab 2: Questions

**What it does:** Build and customize the question bank.

### Quick Actions

- **Add Question**: Creates a new question at the end of the list
- **Edit**: Inline editor for prompt, options, and age variants
- **Delete**: Removes the question permanently
- **Drag-Drop**: Reorder questions by dragging the question row

### Question Editor

When you click **Edit** or add a new question, the editor opens:

#### Question Fields
- **Type**: Likert (1-5 scale) or Forced-Choice (pick A or B)
- **Dimension**: RIASEC code (R/I/A/S/E/C for Holland) or MBTI pair (EI/SN/TF/JP)
- **Prompt**: The text users see (e.g., "I like working with my hands")
- **Reverse-Scored**: Check if high scores mean low on this dimension

#### Options
For Likert questions, define 5 response options:
```
1. Strongly Disagree  [weight: 1.0]
2. Disagree           [weight: 0.75]
3. Neutral            [weight: 0.5]
4. Agree              [weight: 0.75]
5. Strongly Agree     [weight: 1.0]
```

Each option maps to a pole (dimension letter) and a weight (0.0-1.0).

#### Age Variants
Define age-specific wording for the same question:

```
Question (parent): "I like working with my hands"

Age Variants:
  child:   "I like to make things"
  teen:    "I enjoy building and creating things"
  adult:   "I prefer hands-on work"
  senior:  "I have enjoyed practical activities"
```

When a user takes the assessment, they see the variant matching their age group.

### Reordering Questions

1. Click and hold a question row
2. Drag it to the new position
3. Release to drop
4. The new order is auto-saved (1s debounce)

---

## Tab 3: Scoring

**What it does:** Define how raw question responses are converted to scores/categories.

### Scoring Models

Each assessment can have multiple scoring models (e.g., "Holland Code", "Risk Level", "Engagement Score").

#### Model Card
Shows:
- **Name**: Human-readable name (e.g., "Holland Hexagon Score")
- **Version**: Auto-incremented when you edit
- **Algorithm**: How scores are calculated (weighted_sum, percentile, etc.)
- **Weight**: Importance if combined with other models
- **Output Type**: score (numeric), category (text code), or narrative (description)

#### Adding a Model

1. Click **+ Add Model**
2. Enter model name and configuration
3. Define thresholds, rules, or dimension weights in JSON config
4. Save

#### Editing a Model

1. Click **Edit** on a model card
2. Update name, algorithm, or config JSON
3. Version is automatically incremented
4. Save

#### Example Config

```json
{
  "algorithm": "weighted_sum",
  "thresholds": [10, 20, 30, 40],
  "dimension_weights": {
    "R": 1.0,
    "I": 1.0,
    "A": 1.0,
    "S": 1.0,
    "E": 1.0,
    "C": 1.0
  }
}
```

**Note**: Phase D will extend scoring models with rule-based engines; Phase C keeps configs flexible (JSONB).

---

## Tab 4: Age-Branching

**What it does:** Manage separate assessment versions for different age groups.

### Branch Cards

Four cards displayed: Child, Teen, Adult, Senior

#### For Each Branch

**Status**: Current workflow state (draft/reviewed/approved/published)

**Actions**:
- **Initialize**: Copies all questions and scoring models from the parent (if not yet created)
- **State Selector**: Dropdown to move through workflow (draft → reviewed → approved → published)
- **Created Date**: When this branch was initialized
- **Copy Info**: Which parent branch it was copied from (if applicable)

### Copy-on-First-Edit Flow

1. Author creates assessment with questions and scoring models
2. Author navigates to **Age-Branching** tab
3. For **Child** branch: clicks **Initialize**
   - All parent questions are copied to a new draft version for child
   - All scoring models are linked to child branch
4. Author can now edit questions/models specifically for child (other branches unaffected)
5. Author repeats for Teen, Adult, Senior
6. Each branch transitions independently through workflow

### Branch State Machine

```
draft ──→ reviewed ──→ approved ──→ published
  ↑                                      │
  └──────────────────────────────────────┘
          (can revert to draft)
```

**Draft**: In progress, questions/scoring can be edited

**Reviewed**: Submitted for approval; locked from edits

**Approved**: Approved by coordinator; ready for production

**Published**: Live; users see this branch based on their age

### Isolation Guarantee

- Editing questions on **Child** branch does NOT affect Teen/Adult/Senior
- Publishing one branch does NOT affect other branches
- Users only see content for their age group

---

## Workflow: Create → Edit → Publish

### Step 1: Create Assessment
1. Click **Create New Assessment**
2. Fill in Overview: Title, Description
3. Enable Age-Branched if needed
4. Save

### Step 2: Add Questions
1. Navigate to **Questions** tab
2. Click **+ Add Question**
3. Fill in prompt, options, select dimension (R/I/A/S/E/C)
4. Add age variants (optional but recommended)
5. Repeat until all questions added
6. Reorder as needed using drag-drop

### Step 3: Configure Scoring
1. Navigate to **Scoring** tab
2. Click **+ Add Model**
3. Name it (e.g., "Holland Hexagon Score")
4. Set algorithm and thresholds in config JSON
5. Save (version auto-increments)
6. Repeat for additional scoring models if needed

### Step 4: Branch & Publish (if age-branching enabled)
1. Navigate to **Age-Branching** tab
2. For each age group (Child, Teen, Adult, Senior):
   - Click **Initialize** to create branch
   - Optionally edit age-variant wording or branch-specific questions
   - Click **State** dropdown and select → **Reviewed**
3. Once approved by coordinator:
   - State → **Approved**
   - State → **Published**
4. Users now see assessment in their age group

### Step 5: Monitor & Iterate
- Assessment metadata (title, description) can be updated anytime
- Published questions/scoring cannot be edited (only draft versions can be edited)
- To change published content, create a new assessment version

---

## Auto-Save & Toast Notifications

### How Auto-Save Works

- All field changes are debounced (500ms-1s depending on field)
- A **"Saving..."** indicator appears briefly
- When save completes: **"✓ Saved"** toast notification
- If error: **"✗ Failed to save: [error message]"** appears

### What Gets Auto-Saved

- ✅ Title, Description (Overview tab)
- ✅ Question prompt, options, order (Questions tab)
- ✅ Scoring model config (Scoring tab)
- ✅ Branch state transitions (Age-Branching tab)

### Manual Actions (Not Auto-Saved)

- Delete question → Requires confirmation
- Delete scoring model → Requires confirmation
- Publish branch → Requires confirmation

---

## Tips & Best Practices

### Question Design
- **Keep prompts concise** (< 20 words) for better readability
- **Use consistent language** across age variants
- **Test edge cases** (reverse-scored questions, extreme options)

### Age Variants
- Adjust **wording** and **complexity** for age group, not meaning
- Example:
  ```
  Adult: "I enjoy working independently"
  Teen:  "I like doing things by myself"
  Child: "I like to do things alone"
  ```

### Scoring Models
- **Version incrementally** — don't make large config changes
- Use **meaningful dimension weights** (0.0-1.0 range)
- Document thresholds in notes for future maintenance

### Publishing
- Always transition through **Reviewed** → **Approved** before **Published**
- Get stakeholder buy-in at **Reviewed** stage
- Keep changelog/audit trail updated

---

## Troubleshooting

### Question Won't Save

**Issue**: Click save but question stays in edit mode.

**Solution**:
1. Check browser console for errors (F12 → Console)
2. Verify assessment version is still in DRAFT status (not published)
3. Try refreshing page and re-entering question

### Branch Won't Initialize

**Issue**: "Initialize" button disabled or shows error.

**Solution**:
1. Verify parent assessment has at least one question
2. Check browser console for network errors
3. Ensure you have admin role

### State Transition Blocked

**Issue**: Cannot change branch state from draft to reviewed.

**Solution**:
- Assessment must have questions and scoring models
- Check that there are no validation errors
- Contact administrator if issue persists

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Manual save (if not auto-saving) |
| `Ctrl/Cmd + Z` | Undo (revert to last saved state) |
| `Tab` | Move to next field |
| `Shift + Tab` | Move to previous field |
| `Delete` | Delete selected question (with confirmation) |
| `Escape` | Close editor / cancel edit |

---

## Related Resources

- **API Documentation**: `docs/api-authoring.md`
- **Data Model Diagram**: `docs/data-model.md`
- **Scoring Design Guide**: `docs/scoring-design.md`
- **Support**: Contact the admin team or file an issue on GitHub

---

## Phase C → Phase D/E Preview

- **Phase D** will add **AI-powered template generation** (suggest questions, auto-populate scoring rules)
- **Phase E** will add **interactive preview** (run through assessment in real-time)
- **Phase F** will add **i18n** (multi-language support) and production hardening

---

**Last Updated**: 2026-07-15
