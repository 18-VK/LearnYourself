using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Personal_Finance_Tracker.Model;

namespace Personal_Finance_Tracker
{
    internal static class Program
    {
        /// <summary>
        ///  The main entry point for the application.
        /// </summary>
        /// 
        // For Grid
        public static List<ClsTransaction> TransactionData = new List<ClsTransaction>();
        // For Original source 
        public static List<ClsTransaction> SourceTransactionData = new List<ClsTransaction>();

        public static int SourceOfData = 1; // default by DB
        public const int SourceDB = 1;
        public const int SourceImportFile = 2;
        public static ulong mLastDBRecord;
        public const int PageSize = 1024;
        public static string? MCurrentCSV { get; set; }

        // public static IConfiguration _config { get; set; } can also use this..

        private static void Application_ThreadException(object sender, ThreadExceptionEventArgs e)
        {
            MessageBox.Show("UI Exception: " + e.Exception.Message);
            // log it if needed
        }
        private static void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            var ex = e.ExceptionObject as Exception;
            MessageBox.Show("Non-UI Exception: " + ex?.Message);
        }
        [STAThread]
        static void Main(string[] args)
        {
            // Config builder, Production type set up 

            var host = Host.CreateDefaultBuilder()
               .ConfigureServices((context, services) =>
               {
                   
                   services.AddSingleton<IConfiguration>(context.Configuration);
                   services.AddTransient<MainForm>();
               })
           .Build();


            // Catch ALL UI thread exceptions
            Application.ThreadException += Application_ThreadException;
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            // Catch ALL non-UI thread exceptions
            AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
            ApplicationConfiguration.Initialize();
            //Application.Run(new MainForm()); instead of this IDE Generated code 
            Application.Run(host.Services.GetRequiredService<MainForm>());
        }

    }
}