using NUnit.Framework;

// Each feature (NUnit fixture) runs on its own worker; scenarios inside a feature run sequentially.
// The worker count comes from test.runsettings (NUnit.NumberOfTestWorkers) or the PARALLEL variable via run-tests.
[assembly: Parallelizable(ParallelScope.Fixtures)]
