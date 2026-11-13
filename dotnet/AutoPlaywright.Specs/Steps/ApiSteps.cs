using System.Text.Json;
using AutoPlaywright.Specs.Support;
using AwesomeAssertions;
using Microsoft.Playwright;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class ApiSteps(ScenarioSession session, ReportAttachments attach)
{
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };

    [When("I send a GET request to {string}")]
    public async Task WhenISendAGetRequest(string path)
    {
        var api = await session.ApiAsync();
        AttachRequest("GET", path, null);
        await Capture(await api.GetAsync(path));
    }

    [When("I send a POST request to {string} with body:")]
    public async Task WhenISendAPostRequest(string path, string body)
    {
        var api = await session.ApiAsync();
        AttachRequest("POST", path, body);
        await Capture(await api.PostAsync(path, new APIRequestContextOptions
        {
            DataString = body,
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
        }));
    }

    [Then("the response status should be {int}")]
    public void ThenTheResponseStatusShouldBe(int status) =>
        Response.Status.Should().Be(status, $"the response body was: {session.LastResponseBody}");

    [Then("the response header {string} should contain {string}")]
    public void ThenTheResponseHeaderShouldContain(string header, string expected)
    {
        Response.Headers.Should().ContainKey(header.ToLowerInvariant());
        Response.Headers[header.ToLowerInvariant()].Should().Contain(expected);
    }

    [Then("the response field {string} should be {string}")]
    public void ThenTheResponseFieldShouldBe(string field, string expected)
    {
        using var json = JsonDocument.Parse(session.LastResponseBody);
        json.RootElement.TryGetProperty(field, out var value).Should().BeTrue($"the response should have a '{field}' field");
        var actual = value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText();
        actual.Should().Be(expected);
    }

    [Then("the response should be a list of {int} items")]
    public void ThenTheResponseShouldBeAListOf(int count)
    {
        using var json = JsonDocument.Parse(session.LastResponseBody);
        json.RootElement.ValueKind.Should().Be(JsonValueKind.Array);
        json.RootElement.GetArrayLength().Should().Be(count);
    }

    private IAPIResponse Response =>
        session.LastResponse ?? throw new InvalidOperationException("No request has been sent in this scenario.");

    private static string PrettyJson(string text)
    {
        try
        {
            using var doc = JsonDocument.Parse(text);
            return JsonSerializer.Serialize(doc.RootElement, Pretty);
        }
        catch (JsonException)
        {
            return text;
        }
    }

    private void AttachRequest(string method, string path, string? body)
    {
        var request = new Dictionary<string, object?>
        {
            ["method"] = method,
            ["url"] = session.Settings.ApiBaseUrl + path,
            ["body"] = body is null ? null : JsonSerializer.Deserialize<JsonElement>(body),
        };
        attach.Json($"Request: {method} {path}", JsonSerializer.Serialize(request, Pretty));
    }

    private async Task Capture(IAPIResponse response)
    {
        session.LastResponse = response;
        session.LastResponseBody = await response.TextAsync();

        var summary = new Dictionary<string, object?>
        {
            ["status"] = response.Status,
            ["statusText"] = response.StatusText,
            ["url"] = response.Url,
            ["headers"] = response.Headers,
        };
        attach.Json($"Response: {response.Status} (meta)", JsonSerializer.Serialize(summary, Pretty));
        attach.Json("Response body", PrettyJson(session.LastResponseBody));
    }
}
