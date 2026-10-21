
namespace Personal_Finance_Tracker
{
    partial class SelectData
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            tableLayoutPanel1 = new TableLayoutPanel();
            tableLayoutPanel2 = new TableLayoutPanel();
            btnOk = new Button();
            btnCancel = new Button();
            tableLayoutPanel3 = new TableLayoutPanel();
            lblAmount = new Label();
            lblType = new Label();
            lblDate = new Label();
            lbl = new Label();
            dateTimePicker1 = new DateTimePicker();
            comboBoxType = new ComboBox();
            textBoxAmt = new TextBox();
            comboBoxCategory = new ComboBox();
            tableLayoutPanel1.SuspendLayout();
            tableLayoutPanel2.SuspendLayout();
            tableLayoutPanel3.SuspendLayout();
            SuspendLayout();
            // 
            // tableLayoutPanel1
            // 
            tableLayoutPanel1.ColumnCount = 1;
            tableLayoutPanel1.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            tableLayoutPanel1.Controls.Add(tableLayoutPanel2, 0, 1);
            tableLayoutPanel1.Controls.Add(tableLayoutPanel3, 0, 0);
            tableLayoutPanel1.Dock = DockStyle.Fill;
            tableLayoutPanel1.Location = new Point(0, 0);
            tableLayoutPanel1.Name = "tableLayoutPanel1";
            tableLayoutPanel1.RowCount = 2;
            tableLayoutPanel1.RowStyles.Add(new RowStyle(SizeType.Percent, 80F));
            tableLayoutPanel1.RowStyles.Add(new RowStyle(SizeType.Percent, 20F));
            tableLayoutPanel1.Size = new Size(432, 353);
            tableLayoutPanel1.TabIndex = 0;
            // 
            // tableLayoutPanel2
            // 
            tableLayoutPanel2.ColumnCount = 4;
            tableLayoutPanel2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 10F));
            tableLayoutPanel2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40F));
            tableLayoutPanel2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40F));
            tableLayoutPanel2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 10F));
            tableLayoutPanel2.Controls.Add(btnOk, 1, 0);
            tableLayoutPanel2.Controls.Add(btnCancel, 2, 0);
            tableLayoutPanel2.Dock = DockStyle.Fill;
            tableLayoutPanel2.Location = new Point(3, 285);
            tableLayoutPanel2.Name = "tableLayoutPanel2";
            tableLayoutPanel2.RowCount = 1;
            tableLayoutPanel2.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            tableLayoutPanel2.Size = new Size(426, 65);
            tableLayoutPanel2.TabIndex = 0;
            // 
            // btnOk
            // 
            btnOk.Anchor = AnchorStyles.None;
            btnOk.Location = new Point(67, 15);
            btnOk.Name = "btnOk";
            btnOk.Size = new Size(120, 35);
            btnOk.TabIndex = 0;
            btnOk.Text = "Process";
            btnOk.UseVisualStyleBackColor = true;
            btnOk.Click += btnOk_Click;
            // 
            // btnCancel
            // 
            btnCancel.Anchor = AnchorStyles.None;
            btnCancel.Location = new Point(237, 15);
            btnCancel.Name = "btnCancel";
            btnCancel.Size = new Size(120, 35);
            btnCancel.TabIndex = 1;
            btnCancel.Text = "Cancel";
            btnCancel.UseVisualStyleBackColor = true;
            btnCancel.Click += btnCancel_Click;
            // 
            // tableLayoutPanel3
            // 
            tableLayoutPanel3.ColumnCount = 2;
            tableLayoutPanel3.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            tableLayoutPanel3.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            tableLayoutPanel3.Controls.Add(lblAmount, 0, 0);
            tableLayoutPanel3.Controls.Add(lblType, 0, 1);
            tableLayoutPanel3.Controls.Add(lblDate, 0, 3);
            tableLayoutPanel3.Controls.Add(lbl, 0, 2);
            tableLayoutPanel3.Controls.Add(dateTimePicker1, 1, 3);
            tableLayoutPanel3.Controls.Add(comboBoxType, 1, 1);
            tableLayoutPanel3.Controls.Add(textBoxAmt, 1, 0);
            tableLayoutPanel3.Controls.Add(comboBoxCategory, 1, 2);
            tableLayoutPanel3.Location = new Point(3, 3);
            tableLayoutPanel3.Name = "tableLayoutPanel3";
            tableLayoutPanel3.RowCount = 4;
            tableLayoutPanel3.RowStyles.Add(new RowStyle(SizeType.Percent, 25F));
            tableLayoutPanel3.RowStyles.Add(new RowStyle(SizeType.Percent, 25F));
            tableLayoutPanel3.RowStyles.Add(new RowStyle(SizeType.Percent, 25F));
            tableLayoutPanel3.RowStyles.Add(new RowStyle(SizeType.Percent, 25F));
            tableLayoutPanel3.Size = new Size(426, 276);
            tableLayoutPanel3.TabIndex = 1;
            // 
            // lblAmount
            // 
            lblAmount.Anchor = AnchorStyles.None;
            lblAmount.Location = new Point(46, 24);
            lblAmount.Name = "lblAmount";
            lblAmount.Size = new Size(120, 21);
            lblAmount.TabIndex = 0;
            lblAmount.Text = "Amount";
            lblAmount.TextAlign = ContentAlignment.MiddleLeft;
            // 
            // lblType
            // 
            lblType.Anchor = AnchorStyles.None;
            lblType.Location = new Point(46, 93);
            lblType.Name = "lblType";
            lblType.Size = new Size(120, 21);
            lblType.TabIndex = 1;
            lblType.Text = "Type";
            lblType.TextAlign = ContentAlignment.MiddleLeft;
            // 
            // lblDate
            // 
            lblDate.Anchor = AnchorStyles.None;
            lblDate.Location = new Point(46, 231);
            lblDate.Name = "lblDate";
            lblDate.Size = new Size(120, 21);
            lblDate.TabIndex = 3;
            lblDate.Text = "Date";
            // 
            // lbl
            // 
            lbl.Anchor = AnchorStyles.None;
            lbl.Location = new Point(46, 162);
            lbl.Name = "lbl";
            lbl.Size = new Size(120, 21);
            lbl.TabIndex = 2;
            lbl.Text = "Category";
            lbl.TextAlign = ContentAlignment.MiddleLeft;
            // 
            // dateTimePicker1
            // 
            dateTimePicker1.Anchor = AnchorStyles.None;
            dateTimePicker1.Location = new Point(219, 227);
            dateTimePicker1.Name = "dateTimePicker1";
            dateTimePicker1.Size = new Size(200, 29);
            dateTimePicker1.TabIndex = 4;
            // 
            // comboBoxType
            // 
            comboBoxType.Anchor = AnchorStyles.None;
            comboBoxType.FormattingEnabled = true;
            comboBoxType.Items.AddRange(new object[] { "Income", "Expense" });
            comboBoxType.Location = new Point(244, 89);
            comboBoxType.Name = "comboBoxType";
            comboBoxType.Size = new Size(150, 29);
            comboBoxType.TabIndex = 5;
            // 
            // textBoxAmt
            // 
            textBoxAmt.Anchor = AnchorStyles.None;
            textBoxAmt.Location = new Point(244, 20);
            textBoxAmt.Name = "textBoxAmt";
            textBoxAmt.Size = new Size(150, 29);
            textBoxAmt.TabIndex = 6;
            textBoxAmt.Validating += textBoxAmt_Validating;
            // 
            // comboBoxCategory
            // 
            comboBoxCategory.Anchor = AnchorStyles.None;
            comboBoxCategory.FormattingEnabled = true;
            comboBoxCategory.Items.AddRange(new object[] { "Electronics", "Grocery", "Pharmacy", "Automobile", "Rent", "Salary", "Travel", "Utility" });
            comboBoxCategory.Location = new Point(244, 158);
            comboBoxCategory.Name = "comboBoxCategory";
            comboBoxCategory.Size = new Size(151, 29);
            comboBoxCategory.TabIndex = 7;
            // 
            // SelectData
            // 
            AutoScaleDimensions = new SizeF(9F, 21F);
            AutoScaleMode = AutoScaleMode.Font;
            ClientSize = new Size(432, 353);
            Controls.Add(tableLayoutPanel1);
            MinimumSize = new Size(450, 400);
            Name = "SelectData";
            StartPosition = FormStartPosition.CenterParent;
            Text = "  ";
            tableLayoutPanel1.ResumeLayout(false);
            tableLayoutPanel2.ResumeLayout(false);
            tableLayoutPanel3.ResumeLayout(false);
            tableLayoutPanel3.PerformLayout();
            ResumeLayout(false);
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            this.Dispose();
            this.DialogResult = DialogResult.Cancel;
        }

        #endregion

        private TableLayoutPanel tableLayoutPanel1;
        private TableLayoutPanel tableLayoutPanel2;
        private Button btnOk;
        private Button btnCancel;
        private TableLayoutPanel tableLayoutPanel3;
        private Label lblAmount;
        private Label lblType;
        private Label lblDate;
        private Label lbl;
        public DateTimePicker dateTimePicker1;
        public ComboBox comboBoxType;
        public TextBox textBoxAmt;
        public ComboBox comboBoxCategory;
    }
}