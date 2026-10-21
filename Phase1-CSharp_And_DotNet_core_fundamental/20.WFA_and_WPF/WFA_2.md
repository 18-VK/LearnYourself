# Modal vs Modeless dialogs — quick note

**Modal** dialogs block the calling window until closed. In WinForms you call `ShowDialog()` and check the returned
`DialogResult`. Examples: `MessageBox`, `OpenFileDialog`, `SaveFileDialog`, `ColorDialog`, `FontDialog`.

**Modeless** windows allow interaction with other windows while open. Use `Show()` (not commonly used for standard
system dialogs). Example: a custom tool window you create as a `Form`.

**How to show a dialog (pattern):**

- Create the dialog (or call a static helper for `MessageBox`).
- Optionally set properties (filters, initial folder, title, default file name, etc.).
- Call `ShowDialog(this)` (pass owner) and inspect the `DialogResult`.
- If accepted, read dialog results (e.g. file path, selected color).
- Dispose the dialog (use `using` or call `Dispose()`).

## 1) MessageBox — simple alerts / confirmations

**When to use:** show info, warnings, errors, or ask Yes/No/Cancel confirmations.

**API:** `MessageBox.Show(...)` returns a `DialogResult`.

**Examples:**

Show an information message:

```csharp
MessageBox.Show("Operation completed", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
```

Ask for confirmation:

```csharp
var result = MessageBox.Show("Delete selected item?", "Confirm", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
if (result == DialogResult.Yes) {
    // delete
}
```

## 2) OpenFileDialog — pick file(s) to open

**Purpose:** let user choose one or more files to open.

**Key properties:** `Filter`, `InitialDirectory`, `Multiselect`, `Title`, `RestoreDirectory`.

**Result:** `FileName` (single) or `FileNames` (array).

**Example:**

```csharp
using (var ofd = new OpenFileDialog()) {
    ofd.Title = "Open text file";
    ofd.Filter = "Text files (*.txt)|*.txt|CSV files (*.csv)|*.csv|All files (*.*)|*.*";
    ofd.Multiselect = true;
    ofd.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    if (ofd.ShowDialog(this) == DialogResult.OK) {
        foreach (var file in ofd.FileNames) {
            // e.g., File.ReadAllText(file)
        }
    }
}
```

## 3) SaveFileDialog — select path to save

**Purpose:** let user select the path/filename to save a file.

**Key props:** `Filter`, `DefaultExt`, `AddExtension`, `FileName`, `InitialDirectory`.

**Example:**

```csharp
using (var sfd = new SaveFileDialog()) {
    sfd.Title = "Save contacts";
    sfd.Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*";
    sfd.DefaultExt = "csv";
    sfd.FileName = "contacts.csv";
    if (sfd.ShowDialog(this) == DialogResult.OK) {
        File.WriteAllText(sfd.FileName, csvContent);
    }
}
```

**Tip:** if file exists, prompt user to overwrite (the dialog itself shows that warning by default).

## 4) FolderBrowserDialog — choose a folder

**Purpose:** pick a directory (e.g. for import/export folder or image folder).

**Note:** In older .NET Framework the dialog is fine; in some new scenarios you might use `CommonOpenFileDialog` from Windows API Code Pack, but `FolderBrowserDialog` works for most apps.

**Example:**

```csharp
using (var fbd = new FolderBrowserDialog()) {
    fbd.Description = "Select the folder to save exports";
    fbd.ShowNewFolderButton = true;
    if (fbd.ShowDialog(this) == DialogResult.OK) {
        string folder = fbd.SelectedPath;
        // use folder
    }
}
```

## 5) ColorDialog — pick a color

**Purpose:** let user choose colors. Useful for theme settings, drawing apps.

**Key props:** `Color`, `AllowFullOpen`, `AnyColor`, `SolidColorOnly`, `CustomColors`.

**Example:**

```csharp
using (var cd = new ColorDialog()) {
    cd.AllowFullOpen = true;
    cd.AnyColor = true;
    cd.Color = panelPreview.BackColor; // current color
    if (cd.ShowDialog(this) == DialogResult.OK) {
        panelPreview.BackColor = cd.Color;
    }
}
```

## 6) FontDialog — select font

**Purpose:** choose a `Font` (family, size, style). Good for editors.

**Key props:** `Font`, `ShowColor` (if you want color too), `MinSize`, `MaxSize`.

**Example:**

```csharp
using (var fd = new FontDialog()) {
    fd.ShowColor = true; // optionally pick color too
    fd.Font = richTextBox1.Font;
    fd.Color = richTextBox1.ForeColor;
    if (fd.ShowDialog(this) == DialogResult.OK) {
        richTextBox1.Font = fd.Font;
        richTextBox1.ForeColor = fd.Color;
    }
}
```

## 7) ErrorProvider — inline validation UI (not a modal dialog)

**Purpose:** visually indicate invalid fields (small red icon with tooltip). Useful for validation instead of message boxes.

**Example:**

```csharp
private ErrorProvider _error = new ErrorProvider();

private bool ValidateInputs()
{
    bool ok = true;
    if (string.IsNullOrWhiteSpace(txtName.Text)) {
        _error.SetError(txtName, "Name is required");
        ok = false;
    } else {
        _error.SetError(txtName, "");
    }
    return ok;
}
```

`ValidateChildren()` is a WinForms method that:

Forces validation on all child controls of a container (Form / Panel / GroupBox).

It triggers:

- `Validating`
- `Validated`

events on each child control.

e.g.:

```csharp
this.ValidateChildren();
```

Used when clicking Save / Submit.

In real applications:

- Users click Save
- Some fields may not have lost focus yet
- Validation must still run

👉 `ValidateChildren()` ensures everything is validated before saving.

**Example:**

```csharp
private void btnSave_Click(object sender, EventArgs e)
{
    if (!this.ValidateChildren())
    {
        MessageBox.Show("Please correct validation errors.");
        return;
    }

    // Save data
}
```

- ✔ Forces validation
- ✔ Prevents invalid save

### Validation Scope (Important)

You can validate:

- Entire form
- Specific container

```csharp
panel1.ValidateChildren();
groupBox1.ValidateChildren();
```

### this.AutoValidate()

```csharp
public LoginForm()
{
    InitializeComponent();

    // Disable auto validation; validate only when we want
    this.AutoValidate = AutoValidate.Disable;
}
```

- ✔ Very common professional setup
- ✔ Useful in multi-step forms

## 8) Custom Input Dialog (InputBox) — simple modal prompt

WinForms has no built-in `InputBox`. Create a tiny modal form for single-line input — handy for quick prompts.

**Example InputBox implementation (quick inline class):**

```csharp
public static class Prompt
{
    public static string ShowDialog(string text, string caption)
    {
        using (Form prompt = new Form())
        {
            prompt.Width = 400; prompt.Height = 150;
            prompt.FormBorderStyle = FormBorderStyle.FixedDialog;
            prompt.Text = caption;
            prompt.StartPosition = FormStartPosition.CenterParent;
            Label textLabel = new Label() { Left = 10, Top = 10, Text = text, AutoSize = true };
            TextBox inputBox = new TextBox() { Left = 10, Top = 35, Width = 360 };
            Button ok = new Button() { Text = "OK", Left = 210, Width = 75, Top = 70, DialogResult = DialogResult.OK };
            Button cancel = new Button() { Text = "Cancel", Left = 295, Width = 75, Top = 70, DialogResult = DialogResult.Cancel };
            prompt.Controls.AddRange(new Control[] { textLabel, inputBox, ok, cancel });
            prompt.AcceptButton = ok;
            prompt.CancelButton = cancel;

            return prompt.ShowDialog() == DialogResult.OK ? inputBox.Text : null;
        }
    }
}
```

**Usage:**

```csharp
string name = Prompt.ShowDialog("Enter your name:", "Input Required");
if (name != null) {
    MessageBox.Show("You entered: " + name);
}
```

# Example : using through designer

**OpenFileDialog (Using Designer):**

**Step 1: Add Dialog Using Designer**

- Open your Form Designer.
- Go to Toolbox → Dialogs.
- Drag `OpenFileDialog` onto your form.
- It will appear below the form (component tray).

**✔ Step 2: Set Properties (Optional)**

- Select `openFileDialog1` and set:
- `Filter = "Text Files|*.txt|All Files|*.*"`
- `Title = "Select a Document"`

**✔ Step 3: Add a Button on form**

Name it: `btnOpenFile`

**✔ Step 4: Double-click the button → Code:**

```csharp
private void btnOpenFile_Click(object sender, EventArgs e)
{
    if (openFileDialog1.ShowDialog() == DialogResult.OK)
    {
        string path = openFileDialog1.FileName;
        MessageBox.Show("Selected File: " + path);
    }
}
```
