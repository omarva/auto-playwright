package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** The demo store sign-in page. */
public class LoginPage extends BasePage {

  public LoginPage(Page page) {
    super(page);
  }

  public LoginPage open() {
    page.navigate("/");
    return this;
  }

  public void login(String username, String password) {
    usernameInput().fill(username);
    passwordInput().fill(password);
    loginButton().click();
  }

  public Locator usernameInput() {
    return byTestId("username");
  }

  public Locator passwordInput() {
    return byTestId("password");
  }

  public Locator loginButton() {
    return byTestId("login-button");
  }

  public Locator error() {
    return byTestId("error");
  }
}
