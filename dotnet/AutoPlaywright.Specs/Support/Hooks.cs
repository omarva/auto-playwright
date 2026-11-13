using System.Globalization;
using System.Runtime.InteropServices;
using Allure.Net.Commons;
using Microsoft.Playwright;
using Reqnroll;

namespace AutoPlaywright.Specs.Support;

[Binding]
public sealed class Hooks(
    ScenarioSession session,
    FeatureContext feature,
    ScenarioContext scenario,
    ReportAttachments attach)
{
    [BeforeTestRun]
    public static void BeforeTestRun()
    {
        Assertions.SetDefaultExpectTimeout(TestSettings.Current.Timeout);
        Directory.CreateDirectory(Paths.AllureResults);
        Directory.CreateDirectory(Paths.Screenshots);
        Directory.CreateDirectory(Paths.Traces);
    }

    [AfterTestRun]
    public static async Task AfterTestRun()
    {
        string? playwrightVersion = typeof(IPage).Assembly.GetName().Version?.ToString(3);
        await BrowserPool.DisposeAsync().ConfigureAwait(false);
        WriteAllureEnvironment(playwrightVersion);
    }

    /// <summary>
    /// The features are linked from ../../features, which Allure would otherwise turn into a
    /// "......features.api" package and a "../../" full name. Normalise both to "features/api".
    /// </summary>
    [BeforeScenario(Order = -100)]
    public void NormaliseAllureMetadata()
    {
        var lifecycle = AllureLifecycle.Instance;
        if (!lifecycle.Context.HasTest)
        {
            return;
        }

        var folder = string.Join('/', (feature.FeatureInfo.FolderPath ?? string.Empty)
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Where(segment => segment != ".."));
        lifecycle.UpdateTestCase(test =>
        {
            test.labels.RemoveAll(label => label.name == "package");
            test.labels.Add(Label.Package(folder.Replace('/', '.')));
            test.fullName = $"{folder}/{feature.FeatureInfo.Title}: {scenario.ScenarioInfo.Title}";
        });
    }

    /// <summary>Fresh, isolated browser context and page for every @ui scenario.</summary>
    [BeforeScenario("ui", Order = 0)]
    public async Task StartBrowserContext()
    {
        var settings = session.Settings;
        session.Browser = await BrowserPool.RentAsync().ConfigureAwait(false);

        var options = new BrowserNewContextOptions
        {
            BaseURL = settings.BaseUrl,
            ViewportSize = new ViewportSize { Width = 1280, Height = 720 },
            IgnoreHTTPSErrors = true,
        };

        if (settings.Video != ArtifactMode.Off)
        {
            session.VideoDirectory = Path.Combine(Paths.Videos, Guid.NewGuid().ToString("N"));
            options.RecordVideoDir = session.VideoDirectory;
            options.RecordVideoSize = new RecordVideoSize { Width = 1280, Height = 720 };
        }

        session.Context = await session.Browser.NewContextAsync(options).ConfigureAwait(false);
        session.Context.SetDefaultTimeout(settings.Timeout);
        session.Context.SetDefaultNavigationTimeout(settings.NavigationTimeout);

        if (settings.Trace != ArtifactMode.Off)
        {
            await session.Context.Tracing.StartAsync(new TracingStartOptions
            {
                Title = scenario.ScenarioInfo.Title,
                Screenshots = true,
                Snapshots = true,
                Sources = true,
            }).ConfigureAwait(false);
        }

        session.Page = await session.Context.NewPageAsync().ConfigureAwait(false);
    }

    [AfterScenario(Order = 10_000)]
    public async Task FinishScenario()
    {
        var failed = scenario.TestError is not null
            || scenario.ScenarioExecutionStatus != ScenarioExecutionStatus.OK;
        var name = $"{Paths.SafeFileName(scenario.ScenarioInfo.Title)}-{DateTime.UtcNow:HHmmssfff}";

        try
        {
            if (session.Context is not null)
            {
                await FinishBrowserContext(failed, name).ConfigureAwait(false);
            }
        }
        finally
        {
            await session.DisposeApiAsync().ConfigureAwait(false);
            if (session.Browser is not null)
            {
                BrowserPool.Return(session.Browser);
            }
        }
    }

    private static bool Keep(ArtifactMode mode, bool failed) =>
        mode == ArtifactMode.On || (mode == ArtifactMode.RetainOnFailure && failed);

    private static void WriteAllureEnvironment(string? playwrightVersion)
    {
        var settings = TestSettings.Current;
        var lines = new[]
        {
            "Language=C# (.NET " + Environment.Version.ToString(3) + ")",
            "Framework=Reqnroll + NUnit",
            "Playwright=" + (playwrightVersion ?? "unknown"),
            "Browser=" + settings.Browser,
            "Headless=" + settings.Headless.ToString(CultureInfo.InvariantCulture),
            "Base.URL=" + settings.BaseUrl,
            "API.URL=" + settings.ApiBaseUrl,
            "OS=" + RuntimeInformation.OSDescription,
        };
        Directory.CreateDirectory(Paths.AllureResults);
        File.WriteAllLines(Path.Combine(Paths.AllureResults, "environment.properties"), lines);
    }

    private async Task FinishBrowserContext(bool failed, string name)
    {
        var settings = session.Settings;
        var context = session.Context!;

        if (session.HasPage && !session.Page.IsClosed && Keep(settings.Screenshot, failed))
        {
            var path = Path.Combine(Paths.Screenshots, $"{name}.png");
            try
            {
                var png = await session.Page.ScreenshotAsync(new PageScreenshotOptions { Path = path, FullPage = true })
                    .ConfigureAwait(false);
                attach.Png(failed ? "Screenshot on failure" : "Final screenshot", png, path);
            }
            catch (PlaywrightException ex)
            {
                attach.Log($"Could not capture screenshot: {ex.Message}");
            }
        }

        if (settings.Trace != ArtifactMode.Off)
        {
            if (Keep(settings.Trace, failed))
            {
                var tracePath = Path.Combine(Paths.Traces, $"{name}.zip");
                await context.Tracing.StopAsync(new TracingStopOptions { Path = tracePath }).ConfigureAwait(false);
                attach.File("Playwright trace (open at trace.playwright.dev)", tracePath, "application/zip");
            }
            else
            {
                await context.Tracing.StopAsync().ConfigureAwait(false);
            }
        }

        var video = session.HasPage ? session.Page.Video : null;
        await context.CloseAsync().ConfigureAwait(false);

        if (video is not null && session.VideoDirectory is not null)
        {
            var recorded = await video.PathAsync().ConfigureAwait(false);
            if (Keep(settings.Video, failed))
            {
                var target = Path.Combine(Paths.Videos, $"{name}.webm");
                File.Move(recorded, target, overwrite: true);
                attach.File("Video", target, "video/webm");
            }

            Directory.Delete(session.VideoDirectory, recursive: true);
        }
    }
}
