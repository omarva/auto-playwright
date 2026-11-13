using System.Text;
using Allure.Net.Commons;
using Reqnroll;

namespace AutoPlaywright.Specs.Support;

/// <summary>
/// Sends one attachment to every report at once: Allure, and the Cucumber Messages / HTML
/// formatters (through Reqnroll's output helper). Files are also kept under reports/artifacts.
/// </summary>
public sealed class ReportAttachments(IReqnrollOutputHelper output)
{
    public void Png(string name, byte[] content, string? savedPath = null)
    {
        AllureApi.AddAttachment(name, "image/png", content, ".png");
        if (savedPath is not null)
        {
            output.AddAttachment(savedPath);
        }
    }

    public void Json(string name, string json) => Text(name, json, "application/json", ".json");

    public void Text(string name, string content, string mime = "text/plain", string extension = ".txt")
    {
        AllureApi.AddAttachment(name, mime, Encoding.UTF8.GetBytes(content), extension);
        output.WriteLine($"--- {name} ---{Environment.NewLine}{content}");
    }

    public void File(string name, string path, string mime)
    {
        if (!System.IO.File.Exists(path))
        {
            return;
        }

        AllureApi.AddAttachment(name, mime, System.IO.File.ReadAllBytes(path), Path.GetExtension(path));
        output.AddAttachment(path);
    }

    public void Log(string message) => output.WriteLine(message);
}
