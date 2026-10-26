void MainEntry()
{
    try
    {
        ProcessData();
    }
    catch (Exception ex)
    {
        Console.WriteLine("Exception caught in Main: " + ex.Message);
    }
}

static void ProcessData()
{
    try
    {
        int[] numbers = { 1, 2, 3 };
        Console.WriteLine(numbers[5]); // This will throw IndexOutOfRangeException
    }
    catch (Exception ex)
    {
        Console.WriteLine("Exception caught in ProcessData: " + ex.Message);
        throw; // Re-throws the same exception
    }
}

MainEntry();