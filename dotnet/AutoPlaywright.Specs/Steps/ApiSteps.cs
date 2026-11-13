using System.Diagnostics;
using System.Text.Json;
using AutoPlaywright.Specs.Support;
using AwesomeAssertions;
using Json.Schema;
using Microsoft.Playwright;
using NUnit.Framework;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

/// <summary>
/// The shared, keyword-agnostic API step library (docs/CONVENTIONS.md §7). Every step uses
/// <see cref="StepDefinitionAttribute"/> so it matches after Given, When or Then.
/// </summary>
[Binding]
public sealed class ApiSteps(ScenarioSession session, ApiSession api, ReportAttachments attach)
{
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };

    // ------------------------------------------------------------------ services

    [StepDefinition("I use the {string} API")]
    public async Task UseService(string service)
    {
        switch (service)
        {
            case "jsonplaceholder":
                api.BaseUrl = session.Settings.ApiBaseUrl;
                break;
            case "todo":
                api.BaseUrl = session.Settings.BackendUrl;
                await EnsureBackendIsUp();
                break;
            default:
                throw new ArgumentException($"Unknown API service '{service}'. Expected 'jsonplaceholder' or 'todo'.");
        }
    }

    private async Task EnsureBackendIsUp()
    {
        var context = await session.ApiAsync();
        string? problem = null;
        try
        {
            var health = await context.GetAsync(api.Url("/health"), new APIRequestContextOptions { Timeout = 5000 });
            if (!health.Ok)
            {
                problem = $"health check returned HTTP {health.Status}";
            }
        }
        catch (PlaywrightException ex)
        {
            problem = ex.Message.Split('\n')[0];
        }

        if (problem is null)
        {
            return;
        }

        var message = $"Todo API is not running at {api.BaseUrl} - start it with `node backend/server.mjs` ({problem})";
        if (session.Settings.BackendRequired)
        {
            throw new InvalidOperationException(message + ". BACKEND_REQUIRED=true, so this is a failure.");
        }

        attach.Log(message);
        Assert.Ignore(message);
    }

    // ------------------------------------------------------------------ authentication

    [StepDefinition("I log in to the API as {string} with password {string}")]
    public Task LogIn(string username, string password) =>
        Send("POST", "/api/auth/login", JsonSerializer.Serialize(new { username, password }), sendToken: false);

    [StepDefinition("I am authenticated as {string} with password {string}")]
    public async Task Authenticate(string username, string password)
    {
        await LogIn(username, password);
        api.Response.Status.Should().Be(200, $"logging in as '{username}' should succeed; body: {Truncate(api.LastBody)}");
        using var json = api.Json();
        api.Token = json.RootElement.GetProperty("token").GetString();
    }

    [StepDefinition("I am not authenticated")]
    public void NotAuthenticated() => api.Token = null;

    [StepDefinition("I use the bearer token {string}")]
    public void UseBearerToken(string token) => api.Token = api.Interpolate(token);

    // ------------------------------------------------------------------ requests

    [StepDefinition(@"^I send a (GET|POST|PUT|PATCH|DELETE) request to ""([^""]*)""$")]
    public Task SendWithoutBody(string method, string path) => Send(method, path, null);

    [StepDefinition(@"^I send a (POST|PUT|PATCH) request to ""([^""]*)"" with body:$")]
    public Task SendWithBody(string method, string path, string body) => Send(method, path, body);

    [StepDefinition("I store the response field {string} as {string}")]
    public void StoreField(string path, string name)
    {
        using var json = api.Json();
        api.Store(name, ApiSession.Render(Field(json.RootElement, path)));
    }

    private async Task Send(string method, string path, string? body, bool sendToken = true)
    {
        var context = await session.ApiAsync();
        var url = api.Url(api.Interpolate(path));
        var payload = body is null ? null : api.Interpolate(body);

        var headers = new Dictionary<string, string>();
        if (payload is not null)
        {
            headers["Content-Type"] = "application/json";
        }

        if (sendToken && api.Token is not null)
        {
            headers["Authorization"] = $"Bearer {api.Token}";
        }

        var options = new APIRequestContextOptions { Method = method, Headers = headers };
        if (payload is not null)
        {
            options.DataString = payload;
        }

        var stopwatch = Stopwatch.StartNew();
        var response = await context.FetchAsync(url, options);
        var text = await response.TextAsync();
        stopwatch.Stop();

        api.Record(response, text, stopwatch.Elapsed);
        AttachExchange(method, url, headers, payload, response, text, stopwatch.Elapsed);
    }

    // ------------------------------------------------------------------ assertions

    [StepDefinition("the response status should be {int}")]
    public void StatusShouldBe(int status) =>
        api.Response.Status.Should().Be(status, $"the response body was: {Truncate(api.LastBody)}");

    [StepDefinition("the response header {string} should contain {string}")]
    public void HeaderShouldContain(string header, string expected)
    {
        var headers = api.Response.Headers;
        var key = headers.Keys.FirstOrDefault(k => string.Equals(k, header, StringComparison.OrdinalIgnoreCase));
        key.Should().NotBeNull($"the response should have a '{header}' header; got: {string.Join(", ", headers.Keys)}");
        headers[key!].Should().Contain(api.Interpolate(expected));
    }

    [StepDefinition("the response field {string} should be {string}")]
    public void FieldShouldBe(string path, string expected)
    {
        using var json = api.Json();
        ApiSession.Render(Field(json.RootElement, path)).Should().Be(api.Interpolate(expected), $"field '{path}'");
    }

    [StepDefinition("the response field {string} should not be empty")]
    public void FieldShouldNotBeEmpty(string path)
    {
        using var json = api.Json();
        var value = Field(json.RootElement, path);
        value.ValueKind.Should().NotBe(JsonValueKind.Null, $"field '{path}' should not be null");
        ApiSession.Render(value).Should().NotBeEmpty($"field '{path}' should not be empty");
    }

    [StepDefinition("the response field {string} should contain {string}")]
    public void FieldShouldContain(string path, string text)
    {
        using var json = api.Json();
        var value = Field(json.RootElement, path);
        var expected = api.Interpolate(text);
        if (value.ValueKind == JsonValueKind.Array)
        {
            value.EnumerateArray().Select(ApiSession.Render).Should().Contain(expected, $"array field '{path}'");
        }
        else
        {
            ApiSession.Render(value).Should().Contain(expected, $"field '{path}'");
        }
    }

    [StepDefinition("the response should be a list of {int} items")]
    public void ShouldBeAList(int count)
    {
        using var json = api.Json();
        json.RootElement.ValueKind.Should().Be(JsonValueKind.Array, "the response body should be a JSON array");
        json.RootElement.GetArrayLength().Should().Be(count);
    }

    [StepDefinition("every item in the response should have field {string} equal to {string}")]
    public void EveryItemShouldHave(string path, string value)
    {
        var items = Items();
        items.Should().NotBeEmpty("the response array should not be empty");
        var expected = api.Interpolate(value);
        foreach (var (item, index) in items.Select((item, index) => (item, index)))
        {
            ApiSession.Render(Field(item, path)).Should().Be(expected, $"item {index} field '{path}'");
        }
    }

    [StepDefinition("the response should contain an item with field {string} equal to {string}")]
    public void ShouldContainItem(string path, string value) =>
        Matches(path, api.Interpolate(value)).Should().BeTrue(
            $"some item should have '{path}' = '{api.Interpolate(value)}'; body: {Truncate(api.LastBody)}");

    [StepDefinition("the response should not contain an item with field {string} equal to {string}")]
    public void ShouldNotContainItem(string path, string value) =>
        Matches(path, api.Interpolate(value)).Should().BeFalse(
            $"no item should have '{path}' = '{api.Interpolate(value)}'");

    [StepDefinition("the response should match the {string} schema")]
    public void ShouldMatchSchema(string name)
    {
        var file = Path.Combine(AppContext.BaseDirectory, "schemas", $"{name}.schema.json");
        File.Exists(file).Should().BeTrue($"schema '{name}' should exist at {file}");
        var schema = JsonSchema.FromText(File.ReadAllText(file));

        using var json = api.Json();
        var result = schema.Evaluate(json.RootElement, new EvaluationOptions { OutputFormat = OutputFormat.List });
        var errors = (result.Details ?? [])
            .Where(d => d.Errors is { Count: > 0 })
            .SelectMany(d => d.Errors!.Select(e => $"{(d.InstanceLocation.ToString() is { Length: > 0 } at ? at : "/")}: {e.Value} ({e.Key})"))
            .Distinct()
            .ToList();

        if (!result.IsValid)
        {
            attach.Json($"Schema violations: {name}", JsonSerializer.Serialize(errors, Pretty));
        }

        result.IsValid.Should().BeTrue($"the response should match schema '{name}':{Environment.NewLine}{string.Join(Environment.NewLine, errors)}");
    }

    [StepDefinition("the response time should be below {int} ms")]
    public void ResponseTimeBelow(int ms) =>
        api.LastDuration.TotalMilliseconds.Should().BeLessThan(ms, "the last request should be within the performance budget");

    [StepDefinition("the response body should be empty")]
    public void BodyShouldBeEmpty() => api.LastBody.Should().BeEmpty();

    // ------------------------------------------------------------------ helpers

    private static JsonElement Field(JsonElement root, string path)
    {
        if (!ApiSession.TryResolve(root, path, out var value))
        {
            throw new InvalidOperationException($"Response has no field '{path}': {Truncate(root.GetRawText())}");
        }

        return value;
    }

    private List<JsonElement> Items()
    {
        using var json = api.Json();
        json.RootElement.ValueKind.Should().Be(JsonValueKind.Array, "the response body should be a JSON array");
        return [.. json.RootElement.EnumerateArray().Select(e => e.Clone())];
    }

    private bool Matches(string path, string expected) =>
        Items().Any(item => ApiSession.TryResolve(item, path, out var value) && ApiSession.Render(value) == expected);

    private static string Truncate(string text) => ApiSession.Truncate(text);

    private void AttachExchange(
        string method,
        string url,
        Dictionary<string, string> headers,
        string? payload,
        IAPIResponse response,
        string text,
        TimeSpan duration)
    {
        var exchange = new Dictionary<string, object?>
        {
            ["request"] = new Dictionary<string, object?>
            {
                ["method"] = method,
                ["url"] = url,
                ["headers"] = headers.ToDictionary(
                    h => h.Key,
                    h => h.Key == "Authorization" ? "Bearer ***" : h.Value),
                ["body"] = ParseOrRaw(payload),
            },
            ["response"] = new Dictionary<string, object?>
            {
                ["status"] = response.Status,
                ["statusText"] = response.StatusText,
                ["headers"] = response.Headers,
                ["body"] = ParseOrRaw(text),
            },
            ["durationMs"] = Math.Round(duration.TotalMilliseconds, 1),
        };
        attach.Json($"{method} {url} → {response.Status}", JsonSerializer.Serialize(exchange, Pretty));
    }

    private static object? ParseOrRaw(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<JsonElement>(text);
        }
        catch (JsonException)
        {
            return text;
        }
    }
}
