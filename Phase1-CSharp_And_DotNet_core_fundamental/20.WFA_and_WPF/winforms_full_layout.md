# WinForms Layout Tutorial

## Design a form with:

-   At top a menu strip no margin
-   After that a data grid with margin left right
-   Button in middle
-   Status strip at bottom no margin

## Overview

This document contains the **complete full response** exactly as
previously generated, including all steps, examples, explanations, and
designer instructions.

------------------------------------------------------------------------

## Full Content

### Clear, Designer-focused step-by-step to build the exact layout you asked for:

### Layout goal (visual):

    +-------------------------------------------+
    | MenuStrip (docked at top, no outer margin)|
    +-------------------------------------------+
    |                                           |
    |   [ left margin ]  DataGridView  [right ] |
    |                                           |
    |                (centered button)          |
    |                                           |
    +-------------------------------------------+
    | StatusStrip (docked bottom, no margin)    |
    +-------------------------------------------+

------------------------------------------------------------------------

## Steps in the Designer (quick)

1.  **Create project & open Form Designer**
    -   New → Windows Forms App (.NET) → Form1 opened.
2.  **Set form padding to zero**
    -   Select the Form (click the background).
    -   In Properties: `Padding = 0,0,0,0`.
3.  **Add MenuStrip (no margin)**
    -   Toolbox → Drag **MenuStrip**.\
    -   Set:
        -   `Dock = Top`\
        -   `Margin = 0,0,0,0`
4.  **Add StatusStrip (no margin)**
    -   Toolbox → Drag **StatusStrip**.\
    -   Set:
        -   `Dock = Bottom`\
        -   `Margin = 0,0,0,0`
5.  **Add outer TableLayoutPanel (tlpOuter)**
    -   Drag TLP → set `Dock = Fill`.\
    -   `RowCount = 2`
        -   Row0 = Percent 100\
        -   Row1 = AutoSize
6.  **Add tlpGridWrapper (for grid margins)**
    -   Place in Row0.\
    -   `ColumnCount = 3`:
        -   Left: Absolute 20\
        -   Center: Percent 100\
        -   Right: Absolute 20
7.  **Place DataGridView inside center column**
    -   `Dock = Fill`\
    -   `AutoSizeColumnsMode = Fill`
8.  **Add tlpButtonWrapper in Row1**
    -   Same 3-column layout as grid wrapper.
9.  **Center button**
    -   Place Button in middle column.\
    -   `Anchor = None`\
    -   `AutoSize = True`

------------------------------------------------------------------------

## Designer summary (properties)

**Form** - Padding = `0`

**MenuStrip** - `Dock = Top`\
- `Margin = 0`

**StatusStrip** - `Dock = Bottom`\
- `Margin = 0`

**tlpOuter** - `Dock = Fill`\
- Row0 = Percent\
- Row1 = AutoSize

**tlpGridWrapper** - Columns: 20px \| 100% \| 20px\
- `Dock = Fill`

**DataGridView** - `Dock = Fill`\
- `AutoSizeColumnsMode = Fill`

**tlpButtonWrapper** - Same layout as grid wrapper

**Button** - `AutoSize = True`\
- `Anchor = None`

------------------------------------------------------------------------

## Minimal code layout (pseudo)

```csharp
menuStrip.Dock = DockStyle.Top;
menuStrip.Margin = new Padding(0);

statusStrip.Dock = DockStyle.Bottom;
statusStrip.Margin = new Padding(0);

tlpOuter.Dock = DockStyle.Fill;

tlpGridWrapper.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 20));
tlpGridWrapper.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
tlpGridWrapper.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 20));

dgvMain.Dock = DockStyle.Fill;

btnCenter.Anchor = AnchorStyles.None;
btnCenter.AutoSize = true;
```

------------------------------------------------------------------------

## End of complete content
