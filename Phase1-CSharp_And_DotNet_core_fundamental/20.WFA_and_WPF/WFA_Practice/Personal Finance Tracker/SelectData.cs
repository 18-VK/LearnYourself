using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Personal_Finance_Tracker
{
    public partial class SelectData : Form
    {
        public ErrorProvider ErrProvider;
        public SelectData()
        {
            ErrProvider = new ErrorProvider();
            InitializeComponent();
        }

        private void btnOk_Click(object sender, EventArgs e)
        {
            this.Close();
            this.DialogResult = DialogResult.OK;
        }
        private void textBoxAmt_Validating(object sender, CancelEventArgs e)
        {
            if (!decimal.TryParse(textBoxAmt.Text, out _))
            {

                ErrProvider.SetError(textBoxAmt, "Enter a valid number");
                e.Cancel = true; // stop user from leaving the field
            }
            else
            {
                ErrProvider.SetError(textBoxAmt, "");
            }
        }

        
    }
}
