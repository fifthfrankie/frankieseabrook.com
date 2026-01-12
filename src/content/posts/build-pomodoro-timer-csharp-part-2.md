---
title: "Build a Pomodoro Timer in C#: Part 2 - Progress Bar and Audio Feedback"
description: "Add visual feedback to your CLI Pomodoro timer with progress bars and audio notifications."
date: 2026-01-12
tags: ["csharp", "beginner", "tutorial"]
---

In Part 1, we built a basic timer. Now we'll add a visual progress indicator and audio feedback.

## Adding a Progress Bar

Update your `Program.cs`. Add this helper method:

```csharp
static string GetProgressBar(int remaining, int total)
{
    int filled = (int)((total - remaining) * 30 / total);
    return new string('█', filled) + new string('░', 30 - filled);
}
```

Then modify `RunTimer` to use it:

```csharp
static async Task RunTimer(int minutes, ConsoleColor color, string label)
{
    Console.WriteLine();
    var cts = new CancellationTokenSource();
    int totalSeconds = minutes * 60;

    try
    {
        for (int remaining = totalSeconds; remaining >= 0; remaining--)
        {
            Console.ForegroundColor = color;
            Console.Write($"\r{label}: {FormatTime(remaining)} {GetProgressBar(remaining, totalSeconds)}");
            Console.ResetColor();

            if (Console.KeyAvailable && Console.ReadKey(true).Key == ConsoleKey.Escape)
            {
                cts.Cancel();
            }

            await Task.Delay(1000, cts.Token);
        }

        Console.WriteLine();
        PlayCompletionSound(minutes == WorkMinutes);
        Console.WriteLine($"{label} complete!");
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine();
        Console.WriteLine("Timer cancelled.");
    }
}
```

## How It Works

**Progress Calculation:** `(total - remaining) * 30 / total` gives you 0-30 blocks filled. 30 blocks fit nicely in a terminal.

**String Constructor:** `new string('█', filled)` creates a string of `filled` block characters. `new string('░', 30 - filled)` creates empty blocks.

**Concatenation:** Combines filled and empty blocks into one string without brackets. Cleaner than `[████░░░]` format.

**Visual Feedback:** You now see time counting down with a bar filling up. Much better than just numbers.

## Adding Audio Feedback

Let's add sounds when timers complete:

```csharp
static void PlayCompletionSound(bool isWork)
{
    int beeps = isWork ? 3 : 2;
    int frequency = isWork ? 800 : 600;

    for (int i = 0; i < beeps; i++)
    {
        Console.Beep(frequency, 200);
        if (i < beeps - 1) Task.Delay(100).Wait();
    }
}
```

## How It Works

**Different Sounds:** Work sessions get 3 beeps at 800Hz (higher, more urgent). Breaks get 2 beeps at 600Hz (lower, more relaxed). You can identify which completed by sound alone.

**Beep Parameters:** `Console.Beep(frequency, duration)` takes Hz and milliseconds.

**Sync Wait:** `Task.Delay(100).Wait()` is synchronous. We can't use `await` in this non-async method.

## Running a Full Cycle

Here's how to use it:

```bash
dotnet run
```

```
> s
WORK: 25:00 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░
...
WORK: 00:01 ██████████████████████████████
[beep beep beep]
WORK complete!
> b
BREAK: 05:00 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░
...
[beep beep]
BREAK complete!
> q
Goodbye!
```

## Key Concepts

- **Visual feedback:** Progress bars give immediate sense of progress
- **String manipulation:** `new string(char, count)` for repeated characters
- **Audio feedback:** `Console.Beep(frequency, duration)` for sound
- **User experience:** Different sounds for different modes

## Next Up

Part 3 refactors the code for better structure and cleaner output.

The timer now feels like a real tool. Run through a few cycles to get the workflow down.
