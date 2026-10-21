# SR No

There are two clean ways to handle this depending on how you show the SR No. in your DataGridView.

- **Recommended (and simplest):** don't store SR in data — render it dynamically (`RowPostPaint` or row header).
- **Alternative:** if SR is a real column you must keep in the data, insert/update that value when adding/removing
  rows.

Below I give both approaches with copy-paste code and tips so you can pick the one that matches your app.

## Option A — Best practice: Show SR dynamically (no data change)

Add a normal data row (no SR value), and use `RowPostPaint` or `RowHeader` to show the serial number. This avoids
keeping SR in your model and always stays correct after sorting/filtering.

**Setup (RowPostPaint into first column cell)**

Assume Column 0 is reserved for SR (read-only), but you don't store SR in your data:

```csharp
// Hook this once (e.g., in Form_Load)
dataGridView1.RowPostPaint += DataGridView1_RowPostPaint;

private void DataGridView1_RowPostPaint(object sender, DataGridViewRowPostPaintEventArgs e)
{
    // Option A1: draw on row header (no SR column needed)
    var grid = (DataGridView)sender;
    string rowNumber = (e.RowIndex + 1).ToString();
    var headerBounds = new Rectangle(e.RowBounds.Left, e.RowBounds.Top, grid.RowHeadersWidth, e.RowBounds.Height);
    TextRenderer.DrawText(e.Graphics, rowNumber, grid.RowHeadersDefaultCellStyle.Font, headerBounds, grid.RowHeadersDefaultCellStyle.ForeColor, TextFormatFlags.VerticalCenter | TextFormatFlags.Right);

    // Option A2: if you DO have a cell (col 0) reserved for SR and want text there:
    // grid.Rows[e.RowIndex].Cells[0].Value = rowNumber;
}
```

**Add a row (no SR in data):**

```csharp
string[] dataArr = new[] { "John", "john@example.com" }; // matches actual columns (excluding SR)
dataGridView1.Rows.Add(dataArr); // SR will be rendered automatically
```

- **Pros:** always correct after insert/delete/sort/filter, no need to update SR values.
- **Use when:** SR is display-only.

## Option B — SR is an actual column in grid/data

If your grid contains an SR column that must be part of the rows (e.g. you export SR to CSV), you must populate/maintain it.

**1) If adding rows manually (unbound grid)**

```csharp
// Suppose col0 is SR, then Name, Email...
int nextSr = dataGridView1.Rows.Count + 1; // (if AllowUserToAddRows=false)
object[] rowWithSr = new object[] { nextSr, "John", "john@example.com" };
dataGridView1.Rows.Add(rowWithSr);
```

**After deletes, re-generate SRs:**

```csharp
private void UpdateSerialNumbers()
{
    for (int i = 0; i < dataGridView1.Rows.Count; i++)
    {
        // skip new row if present
        if (dataGridView1.Rows[i].IsNewRow) continue;
        dataGridView1.Rows[i].Cells["SrColumn"].Value = (i + 1);
    }
}
```

**Hook it up:**

```csharp
dataGridView1.RowsAdded += (s,e) => UpdateSerialNumbers();
dataGridView1.RowsRemoved += (s,e) => UpdateSerialNumbers();
```

# Issue

Yes — `Program.TransactionData.Clear()` can definitely cause issues depending on how the list is being used in your WinForms app.

Let me explain clearly.

## ✅ 1. If the List is bound to DataGridView → YES, it WILL cause issues

**Example:**

```csharp
dataGridViewMain.DataSource = Program.TransactionData;
Program.TransactionData.Clear();
```

When you call `Clear()`, the underlying collection changes but `DataGridView` does NOT automatically refresh, and:

- `DataGridView` still thinks rows exist
- But list has 0 items
- So `DataGridView` tries to repaint old cells → `IndexOutOfRangeException`

This is a very common `DataGridView` exception.

**✔ Fix 1 — Reset DataSource properly**

```csharp
dataGridViewMain.DataSource = null;
Program.TransactionData.Clear();
dataGridViewMain.DataSource = Program.TransactionData;
```

# Keyset paging (RECOMMENDED for large data), for reading records

If `Id` is monotonically increasing (PK), use this instead.

**First page**

```csharp
int lastId = 0;

var page1 = await db.TableTransactions
    .AsNoTracking()
    .Where(t => t.Id > lastId)
    .OrderBy(t => t.Id)
    .Take(1024)
    .ToListAsync();

lastId = page1.LastOrDefault()?.Id ?? lastId;
```

**Next page**

```csharp
var page2 = await db.TableTransactions
    .AsNoTracking()
    .Where(t => t.Id > lastId)
    .OrderBy(t => t.Id)
    .Take(1024)
    .ToListAsync();

lastId = page2.LastOrDefault()?.Id ?? lastId;
```

**Stop condition**

```csharp
if (page2.Count < 1024)
{
    // no more records
}
```

## Which should YOU use?

| Case                    | Use           |
| ----------------------- | ------------- |
| Small table             | Skip + Take   |
| Large table (10k+)      | Keyset paging |
| Continuous scrolling    | Keyset paging |
| Stable sorting required | Keyset paging |
