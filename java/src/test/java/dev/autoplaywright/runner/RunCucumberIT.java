package dev.autoplaywright.runner;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * JUnit Platform suite that runs every scenario in the shared {@code features/} folder.
 *
 * <p>Plugins, parallelism and tag filters live in {@code junit-platform.properties} and the Maven
 * failsafe configuration.
 */
@Suite
@SuiteDisplayName("Auto Playwright - Java")
@IncludeEngines("cucumber")
@SelectPackages("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "dev.autoplaywright")
public class RunCucumberIT {}
