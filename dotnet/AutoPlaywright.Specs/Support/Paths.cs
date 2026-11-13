namespace AutoPlaywright.Specs.Support;

/// <summary>
/// Resolves the fixed report layout (see docs/CONVENTIONS.md) relative to the <c>dotnet/</c> folder,
/// no matter which bin/ output directory the tests run from.
/// </summary>
public static class Paths
{
    private const string Marker = "AutoPlaywright.slnx";

    private static readonly Lazy<string> LazyRoot = new(FindRoot);

    /// <summary>The <c>dotnet/</c> folder of the repository.</summary>
    public static string DotnetRoot => LazyRoot.Value;

    public static string Reports => Path.Combine(DotnetRoot, "reports");

    public static string AllureResults => Path.Combine(Reports, "allure-results");

    public static string Artifacts => Path.Combine(Reports, "artifacts");

    public static string Screenshots => Path.Combine(Artifacts, "screenshots");

    public static string Traces => Path.Combine(Artifacts, "traces");

    public static string Videos => Path.Combine(Artifacts, "videos");

    /// <summary>Turns a scenario title into a safe, readable file name.</summary>
    public static string SafeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars().Concat([' ', '(', ')', '<', '>', '"', '\'']).ToHashSet();
        var cleaned = new string([.. name.Select(c => invalid.Contains(c) ? '-' : char.ToLowerInvariant(c))]);
        while (cleaned.Contains("--", StringComparison.Ordinal))
        {
            cleaned = cleaned.Replace("--", "-", StringComparison.Ordinal);
        }

        cleaned = cleaned.Trim('-', '.');
        return cleaned.Length > 100 ? cleaned[..100] : cleaned;
    }

    private static string FindRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, Marker)))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        // Fallback: bin/<Configuration>/<TFM>/ -> project -> dotnet/
        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
    }
}
