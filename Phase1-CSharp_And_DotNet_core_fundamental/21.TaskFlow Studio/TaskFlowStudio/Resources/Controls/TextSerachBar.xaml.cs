using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace TaskFlowStudio.Resources.Controls
{
    /// <summary>
    /// Interaction logic for TextSerachBar.xaml
    /// </summary>
    public partial class TextSearchbar : UserControl
    {
        public TextSearchbar()
        {
            InitializeComponent();
        }

        // 🔹 SearchText (main reusable DP)
        public string Text
        {
            get => (string)GetValue(SearchTextProperty);
            set => SetValue(SearchTextProperty, value);
        }

        public static readonly DependencyProperty SearchTextProperty =
            DependencyProperty.Register(
                nameof(Text),
                typeof(string),
                typeof(TextSearchbar),
                new FrameworkPropertyMetadata(
                    string.Empty,
                    FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

        // 🔹 Optional placeholder (future-ready)
        public string Placeholder
        {
            get => (string)GetValue(PlaceholderProperty);
            set => SetValue(PlaceholderProperty, value);
        }

        public static readonly DependencyProperty PlaceholderProperty =
            DependencyProperty.Register(
                nameof(Placeholder),
                typeof(string),
                typeof(TextSearchbar),
                new PropertyMetadata("Search"));

        // 🔹 Clear button logic (UI-only, allowed)
        private void Clear_Click(object sender, RoutedEventArgs e)
        {
            Text = string.Empty;
        }
    }

}
