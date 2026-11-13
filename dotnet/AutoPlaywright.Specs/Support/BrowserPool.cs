using System.Collections.Concurrent;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Support;

/// <summary>
/// Process-wide Playwright driver plus a pool of browsers. A scenario rents a browser,
/// creates its own isolated <see cref="IBrowserContext"/>, and returns the browser afterwards,
/// so the pool grows to exactly one browser per concurrently running worker. Browsers are
/// launched lazily, so API-only runs never start one.
/// </summary>
public static class BrowserPool
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly ConcurrentBag<IBrowser> Idle = [];
    private static readonly ConcurrentBag<IBrowser> All = [];
    private static IPlaywright? _playwright;

    public static async Task<IPlaywright> GetPlaywrightAsync()
    {
        if (_playwright is not null)
        {
            return _playwright;
        }

        await Gate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_playwright is null)
            {
                var playwright = await Playwright.CreateAsync().ConfigureAwait(false);
                playwright.Selectors.SetTestIdAttribute("data-test");
                _playwright = playwright;
            }

            return _playwright;
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task<IBrowser> RentAsync()
    {
        while (Idle.TryTake(out var browser))
        {
            if (browser.IsConnected)
            {
                return browser;
            }
        }

        var launched = await LaunchAsync().ConfigureAwait(false);
        All.Add(launched);
        return launched;
    }

    public static void Return(IBrowser browser)
    {
        if (browser.IsConnected)
        {
            Idle.Add(browser);
        }
    }

    public static async Task DisposeAsync()
    {
        foreach (var browser in All)
        {
            await browser.CloseAsync().ConfigureAwait(false);
        }

        All.Clear();
        Idle.Clear();
        _playwright?.Dispose();
        _playwright = null;
    }

    private static async Task<IBrowser> LaunchAsync()
    {
        var settings = TestSettings.Current;
        var playwright = await GetPlaywrightAsync().ConfigureAwait(false);

        IBrowserType type = settings.Browser switch
        {
            "chromium" or "chrome" or "msedge" or "edge" => playwright.Chromium,
            "firefox" => playwright.Firefox,
            "webkit" or "safari" => playwright.Webkit,
            _ => throw new InvalidOperationException(
                $"Unsupported BROWSER '{settings.Browser}'. Use chromium, firefox or webkit."),
        };

        var options = new BrowserTypeLaunchOptions
        {
            Headless = settings.Headless,
            SlowMo = settings.SlowMo,
        };

        if (type == playwright.Chromium && settings.BrowserChannel is { } channel)
        {
            options.Channel = channel;
        }

        return await type.LaunchAsync(options).ConfigureAwait(false);
    }
}
