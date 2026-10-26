using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static System.Net.WebRequestMethods;
using File = System.IO.File;

namespace TaskFlowStudio.Services
{
    class FileService : IFileService
    {
        public string? BrowseFolder(string InitialDirectory, string Title)
        {
            var dialog = new OpenFolderDialog
            {
                Title = Title,
                Multiselect = false,
                ValidateNames = true,
                InitialDirectory = Directory.Exists(InitialDirectory)
                    ? InitialDirectory
                    : null
            };

            return dialog.ShowDialog() == true
                ? dialog.FolderName
                : null;
        }

        public List<string> BrowseFolders(string InitialDirectory, string Title)
        {
            var dialog = new OpenFolderDialog
            {
                Title = Title,
                Multiselect = true,
                ValidateNames = true,
                InitialDirectory = Directory.Exists(InitialDirectory)
                    ? InitialDirectory
                    : null
            };

            return dialog.ShowDialog() == true
                ? dialog.FolderNames.ToList()
                : new List<string>();
        }


        public string? OpenFileDialog(string Filter, string Title, string InitialDirectory = "")
        {
            var dialog = new OpenFileDialog
            {
                Filter = Filter,
                Title = Title,
                InitialDirectory = InitialDirectory
            };

            return dialog?.ShowDialog() == true ? dialog.FileName : null;
        }


        public async Task<string?> SaveFileAsync(
           string defaultFileName,
           string filter,
           string title,
           byte[] buffer,
           Encoding encoding,
           CancellationToken cancellationToken = default)
        {
            var dialog = new SaveFileDialog
            {
                FileName = defaultFileName,
                Filter = filter,
                Title = title,
                OverwritePrompt = true,
                CheckPathExists = true,
                RestoreDirectory = true
            };

            if (dialog.ShowDialog() != true)
                return null;

            try
            {
                string text = encoding.GetString(buffer);

                await File.WriteAllTextAsync(
                    dialog.FileName,
                    text,
                    encoding,
                    cancellationToken);

                return dialog.FileName;
            }
            catch (OperationCanceledException)
            {
                return null; // user cancelled
            }
            catch (IOException ex)
            {
                throw;
            }
        }
    }
}
