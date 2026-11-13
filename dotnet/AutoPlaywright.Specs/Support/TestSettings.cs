using System.Globalization;
using System.Text.Json;

namespace AutoPlaywright.Specs.Support;

public enum ArtifactMode
{
    Off,
    On,
    RetainOnFailure,
}

/// <summary>
/// Strongly-typed configuration. Precedence: environment variable &gt; <c>dotnet/.env</c> &gt;
/// <c>appsettings.json</c> &gt; built-in default. Variable names match docs/CONVENTIONS.md.
/// </summary>
public sealed class TestSettings
{
    private static readonly Lazy<TestSettings> LazyCurrent = new(Load);

    private readonly Dictionary<string, string> _values;

    private TestSettings(Dictionary<string, string> values) => _values = values;

    public static TestSettings Current => LazyCurrent.Value;

    public string Browser => Get("BROWSER", "chromium").ToLowerInvariant();

    public string? BrowserChannel => NullIfEmpty(Get("BROWSER_CHANNEL", string.Empty));

    public bool Headless => ParseBool(Get("HEADLESS", "true"));

    public float SlowMo => ParseInt(Get("SLOW_MO", "0"));

    public float Timeout => ParseInt(Get("TIMEOUT", "15000"));

    public float NavigationTimeout => ParseInt(Get("NAV_TIMEOUT", "30000"));

    public string BaseUrl => Get("BASE_URL", "https://www.saucedemo.com").TrimEnd('/');

    public string ApiBaseUrl => Get("API_BASE_URL", "https://jsonplaceholder.typicode.com").TrimEnd('/');

    public string DemoUrl => Get("DEMO_URL", "https://playwright.dev").TrimEnd('/');

    /// <summary>Bundled Todo API (backend/), used by <c>@backend</c> scenarios.</summary>
    public string BackendUrl => Get("BACKEND_URL", "http://localhost:3000").TrimEnd('/');

    /// <summary>When true, an unreachable Todo API fails scenarios instead of skipping them.</summary>
    public bool BackendRequired => ParseBool(Get("BACKEND_REQUIRED", "false"));

    public string UserPassword => Get("USER_PASSWORD", "secret_sauce");

    public ArtifactMode Trace => ParseMode(Get("TRACE", "retain-on-failure"));

    public ArtifactMode Video => ParseMode(Get("VIDEO", "off"));

    /// <summary><c>only-on-failure</c> maps to <see cref="ArtifactMode.RetainOnFailure"/>.</summary>
    public ArtifactMode Screenshot => ParseMode(Get("SCREENSHOT", "only-on-failure"));

    public string Get(string key, string fallback)
    {
        var env = Environment.GetEnvironmentVariable(key);
        if (!string.IsNullOrEmpty(env))
        {
            return env;
        }

        return _values.TryGetValue(key, out var value) && !string.IsNullOrEmpty(value) ? value : fallback;
    }

    private static TestSettings Load()
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var appSettings = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        if (File.Exists(appSettings))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(appSettings));
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                values[property.Name] = property.Value.ToString();
            }
        }

        // .env overrides appsettings.json (but never real environment variables).
        var dotEnv = Path.Combine(Paths.DotnetRoot, ".env");
        if (File.Exists(dotEnv))
        {
            foreach (var raw in File.ReadAllLines(dotEnv))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith('#'))
                {
                    continue;
                }

                if (line.StartsWith("export ", StringComparison.Ordinal))
                {
                    line = line[7..];
                }

                var eq = line.IndexOf('=', StringComparison.Ordinal);
                if (eq <= 0)
                {
                    continue;
                }

                var key = line[..eq].Trim();
                var value = line[(eq + 1)..].Trim().Trim('"', '\'');
                values[key] = value;
            }
        }

        return new TestSettings(values);
    }

    private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static bool ParseBool(string value) =>
        value.Trim().ToLowerInvariant() is "1" or "true" or "yes" or "on";

    private static int ParseInt(string value) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;

    private static ArtifactMode ParseMode(string value) => value.Trim().ToLowerInvariant() switch
    {
        "on" or "true" or "always" => ArtifactMode.On,
        "off" or "false" or "never" => ArtifactMode.Off,
        _ => ArtifactMode.RetainOnFailure,
    };
}
