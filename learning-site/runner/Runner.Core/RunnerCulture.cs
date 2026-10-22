using System.Globalization;

namespace LearnYourself.Runner;

/// <summary>
/// Every run uses the same culture (en-US) in the browser and in the build-time check, so number, date and currency
/// formatting in "Expected output" matches what the learner's browser prints, whatever its language setting.
/// </summary>
public static class RunnerCulture
{
    public static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("en-US");

    public static void Apply()
    {
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.DefaultThreadCurrentUICulture = Culture;
        CultureInfo.CurrentCulture = CultureInfo.CurrentUICulture = Culture;
    }
}
