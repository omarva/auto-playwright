using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Support;

/// <summary>
/// Everything a single scenario owns. Reqnroll creates one instance per scenario and injects it
/// into every step-definition class, so state is shared between steps but never between scenarios.
/// </summary>
public sealed class ScenarioSession
{
    private IPage? _page;
    private IAPIRequestContext? _api;

    public TestSettings Settings { get; } = TestSettings.Current;

    public IBrowser? Browser { get; internal set; }

    public IBrowserContext? Context { get; internal set; }

    /// <summary>The scenario's page. Only available for <c>@ui</c> scenarios.</summary>
    public IPage Page
    {
        get => _page ?? throw new InvalidOperationException(
            "No browser page for this scenario. Tag the feature or scenario with @ui.");
        internal set => _page = value;
    }

    public bool HasPage => _page is not null;

    public string? VideoDirectory { get; internal set; }

    /// <summary>Last HTTP response captured by the API steps.</summary>
    public IAPIResponse? LastResponse { get; set; }

    public string LastResponseBody { get; set; } = string.Empty;

    public bool HasApi => _api is not null;

    /// <summary>Lazily creates the scenario's <see cref="IAPIRequestContext"/>.</summary>
    public async Task<IAPIRequestContext> ApiAsync()
    {
        if (_api is not null)
        {
            return _api;
        }

        var playwright = await BrowserPool.GetPlaywrightAsync().ConfigureAwait(false);
        _api = await playwright.APIRequest.NewContextAsync(new APIRequestNewContextOptions
        {
            BaseURL = Settings.ApiBaseUrl,
            Timeout = Settings.NavigationTimeout,
            ExtraHTTPHeaders = new Dictionary<string, string> { ["Accept"] = "application/json" },
        }).ConfigureAwait(false);
        return _api;
    }

    internal async Task DisposeApiAsync()
    {
        if (_api is not null)
        {
            await _api.DisposeAsync().ConfigureAwait(false);
            _api = null;
        }
    }
}
