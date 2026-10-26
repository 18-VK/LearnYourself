
namespace Personal_Finance_Tracker
{
    public partial class ReadOption
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
            LblReadOpImpCsv = new Label();
            LblReadOpReadDB = new Label();
            btnReadOpOk = new Button();
            BtnReadOpCancel = new Button();
            RbtnReadOpReadDB = new RadioButton();
            RbtnReadOpsImpCSV = new RadioButton();
            tableLayoutPanel1.SuspendLayout();
            SuspendLayout();
            // 
            // tableLayoutPanel1
            // 
            tableLayoutPanel1.ColumnCount = 2;
            tableLayoutPanel1.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            tableLayoutPanel1.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            tableLayoutPanel1.Controls.Add(LblReadOpImpCsv, 0, 0);
            tableLayoutPanel1.Controls.Add(LblReadOpReadDB, 1, 0);
            tableLayoutPanel1.Controls.Add(btnReadOpOk, 0, 2);
            tableLayoutPanel1.Controls.Add(BtnReadOpCancel, 1, 2);
            tableLayoutPanel1.Controls.Add(RbtnReadOpReadDB, 1, 1);
            tableLayoutPanel1.Controls.Add(RbtnReadOpsImpCSV, 0, 1);
            tableLayoutPanel1.Dock = DockStyle.Fill;
            tableLayoutPanel1.Location = new Point(0, 0);
            tableLayoutPanel1.Name = "tableLayoutPanel1";
            tableLayoutPanel1.RowCount = 3;
            tableLayoutPanel1.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));
            tableLayoutPanel1.RowStyles.Add(new RowStyle(SizeType.Percent, 20F));
            tableLayoutPanel1.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));
            tableLayoutPanel1.Size = new Size(307, 178);
            tableLayoutPanel1.TabIndex = 0;
            // 
            // LblReadOpImpCsv
            // 
            LblReadOpImpCsv.Anchor = AnchorStyles.None;
            LblReadOpImpCsv.AutoSize = true;
            LblReadOpImpCsv.Location = new Point(31, 25);
            LblReadOpImpCsv.Name = "LblReadOpImpCsv";
            LblReadOpImpCsv.Size = new Size(90, 21);
            LblReadOpImpCsv.TabIndex = 2;
            LblReadOpImpCsv.Text = "Import CSV";
            // 
            // LblReadOpReadDB
            // 
            LblReadOpReadDB.Anchor = AnchorStyles.None;
            LblReadOpReadDB.AutoSize = true;
            LblReadOpReadDB.Location = new Point(173, 25);
            LblReadOpReadDB.Name = "LblReadOpReadDB";
            LblReadOpReadDB.Size = new Size(113, 21);
            LblReadOpReadDB.TabIndex = 3;
            LblReadOpReadDB.Text = "Read Database";
            // 
            // btnReadOpOk
            // 
            btnReadOpOk.Anchor = AnchorStyles.None;
            btnReadOpOk.Location = new Point(29, 127);
            btnReadOpOk.Name = "btnReadOpOk";
            btnReadOpOk.Size = new Size(94, 29);
            btnReadOpOk.TabIndex = 0;
            btnReadOpOk.Text = "Ok";
            btnReadOpOk.UseVisualStyleBackColor = true;
            btnReadOpOk.Click += btnReadOpOk_Click;
            // 
            // BtnReadOpCancel
            // 
            BtnReadOpCancel.Anchor = AnchorStyles.None;
            BtnReadOpCancel.Location = new Point(183, 127);
            BtnReadOpCancel.Name = "BtnReadOpCancel";
            BtnReadOpCancel.Size = new Size(94, 29);
            BtnReadOpCancel.TabIndex = 1;
            BtnReadOpCancel.Text = "Cancel";
            BtnReadOpCancel.UseVisualStyleBackColor = true;
            BtnReadOpCancel.Click += BtnReadOpCancel_Click;
            // 
            // RbtnReadOpReadDB
            // 
            RbtnReadOpReadDB.Anchor = AnchorStyles.Top;
            RbtnReadOpReadDB.AutoSize = true;
            RbtnReadOpReadDB.Location = new Point(221, 74);
            RbtnReadOpReadDB.Name = "RbtnReadOpReadDB";
            RbtnReadOpReadDB.Size = new Size(17, 16);
            RbtnReadOpReadDB.TabIndex = 5;
            RbtnReadOpReadDB.TabStop = true;
            RbtnReadOpReadDB.UseVisualStyleBackColor = true;
            // 
            // RbtnReadOpsImpCSV
            // 
            RbtnReadOpsImpCSV.Anchor = AnchorStyles.Top;
            RbtnReadOpsImpCSV.AutoSize = true;
            RbtnReadOpsImpCSV.Location = new Point(68, 74);
            RbtnReadOpsImpCSV.Name = "RbtnReadOpsImpCSV";
            RbtnReadOpsImpCSV.Size = new Size(17, 16);
            RbtnReadOpsImpCSV.TabIndex = 4;
            RbtnReadOpsImpCSV.TabStop = true;
            RbtnReadOpsImpCSV.UseVisualStyleBackColor = true;
            // 
            // ReadOption
            // 
            AutoScaleDimensions = new SizeF(9F, 21F);
            AutoScaleMode = AutoScaleMode.Font;
            AutoSize = true;
            ClientSize = new Size(307, 178);
            Controls.Add(tableLayoutPanel1);
            Cursor = Cursors.Hand;
            Location = new Point(250, 250);
            Name = "ReadOption";
            StartPosition = FormStartPosition.CenterParent;
            Text = "Select read option";
            tableLayoutPanel1.ResumeLayout(false);
            tableLayoutPanel1.PerformLayout();
            ResumeLayout(false);
        }

        #endregion

        private TableLayoutPanel tableLayoutPanel1;
        private Label LblReadOpImpCsv;
        private Label LblReadOpReadDB;
        private Button btnReadOpOk;
        private Button BtnReadOpCancel;
        public RadioButton RbtnReadOpsImpCSV;
        public RadioButton RbtnReadOpReadDB;
    }
}