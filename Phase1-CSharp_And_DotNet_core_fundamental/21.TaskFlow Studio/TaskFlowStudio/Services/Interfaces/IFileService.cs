using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Policy;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace TaskFlowStudio
{
    public interface IFileService
    {
        public string? OpenFileDialog(string Filter, string Title, string InitialDirectory = "");

        public Task<string?> SaveFileAsync(string defaultFileName,string filter,string title,byte[] buffer,Encoding encoding,
           CancellationToken cancellationToken = default);

        public string? BrowseFolder(string InitialDirectory, string Title);
        public List<string> BrowseFolders(string InitialDirectory, string Title);
    }
}
