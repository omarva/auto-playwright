package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import dev.autoplaywright.config.Config;
import java.util.Map;

/** playwright.dev – the target of the {@code @demo} showcase feature. */
public class PlaywrightSitePage extends BasePage {

  private static final Map<String, String> INSTALLATION_GUIDES =
      Map.of(
          "Node.js", "/docs/intro",
          "Python", "/python/docs/intro",
          "Java", "/java/docs/intro",
          ".NET", "/dotnet/docs/intro");

  public PlaywrightSitePage(Page page) {
    super(page);
  }

  public void openHome() {
    page.navigate(Config.demoUrl() + "/");
  }

  public void openInstallationGuide(String language) {
    String path = INSTALLATION_GUIDES.get(language);
    if (path == null) {
      throw new IllegalArgumentException(
          "Unknown language '" + language + "'. Known: " + INSTALLATION_GUIDES.keySet());
    }
    page.navigate(Config.demoUrl() + path);
  }

  public void clickLink(String name) {
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName(name)).first().click();
  }

  public Locator heading(String name) {
    return page.getByRole(
            AriaRole.HEADING, new Page.GetByRoleOptions().setName(name).setExact(true))
        .first();
  }
}
