using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Support;

/// <summary>
/// Per-scenario state of the generic API step library (see docs/CONVENTIONS.md §7): the active
/// service, bearer token, stored variables and the last response.
/// </summary>
public sealed partial class ApiSession(ScenarioSession session)
{
    private readonly Dictionary<string, string> _variables = new(StringComparer.Ordinal);

    /// <summary>Base URL of the active service. Defaults to <c>jsonplaceholder</c>.</summary>
    public string BaseUrl { get; set; } = session.Settings.ApiBaseUrl;

    /// <summary>Bearer token sent with every request, or <c>null</c> when unauthenticated.</summary>
    public string? Token { get; set; }

    public IAPIResponse? LastResponse { get; private set; }

    public string LastBody { get; private set; } = string.Empty;

    public TimeSpan LastDuration { get; private set; }

    public IAPIResponse Response =>
        LastResponse ?? throw new InvalidOperationException("No request has been sent in this scenario yet.");

    public string Url(string path) =>
        Uri.TryCreate(path, UriKind.Absolute, out var absolute) && absolute.Scheme.StartsWith("http", StringComparison.Ordinal)
            ? path
            : BaseUrl.TrimEnd('/') + "/" + path.TrimStart('/');

    public void Store(string name, string value) => _variables[name] = value;

    /// <summary>Replaces every <c>${name}</c> with a stored variable; unknown names are an error.</summary>
    public string Interpolate(string text) =>
        VariablePattern().Replace(text, match =>
            _variables.TryGetValue(match.Groups[1].Value, out var value)
                ? value
                : throw new InvalidOperationException(
                    $"Unknown scenario variable '${{{match.Groups[1].Value}}}'. Known: {string.Join(", ", _variables.Keys)}"));

    public void Record(IAPIResponse response, string body, TimeSpan duration)
    {
        LastResponse = response;
        LastBody = body;
        LastDuration = duration;
        session.LastResponse = response;
        session.LastResponseBody = body;
    }

    /// <summary>Parses the last response body as JSON (callers dispose the document).</summary>
    public JsonDocument Json()
    {
        try
        {
            return JsonDocument.Parse(LastBody);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Response body is not valid JSON: {Truncate(LastBody)}", ex);
        }
    }

    /// <summary>
    /// Resolves a dot path (<c>address.geo.lat</c>, <c>0.email</c>); numeric segments index arrays.
    /// Returns <c>false</c> if any segment is missing.
    /// </summary>
    public static bool TryResolve(JsonElement root, string path, out JsonElement value)
    {
        value = root;
        foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            if (value.ValueKind == JsonValueKind.Array && int.TryParse(segment, out var index))
            {
                if (index < 0 || index >= value.GetArrayLength())
                {
                    return false;
                }

                value = value[index];
            }
            else if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(segment, out value))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Shared rendering rule: strings as raw text, everything else as compact JSON.</summary>
    public static string Render(JsonElement element) =>
        element.ValueKind == JsonValueKind.String ? element.GetString()! : JsonSerializer.Serialize(element);

    public static string Truncate(string text, int max = 500) => text.Length <= max ? text : text[..max] + "…";

    [GeneratedRegex(@"\$\{(\w+)\}")]
    private static partial Regex VariablePattern();
}
