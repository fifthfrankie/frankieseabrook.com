---
title: "Build a CLI Pomodoro Timer in C#: Part 2 - Progress Bar and Timing Accuracy"
description: "Add a visual progress bar while fixing rendering bugs and timing drift. Real bugs from the build process."
date: 2026-01-12
tags: ["csharp", "beginner", "tutorial"]
---

In Part 1, we fixed display flickering, color bleeding, and case sensitivity. Now we'll add a progress bar and discover timing accuracy issues.

## Adding a Progress Bar

I wanted visual feedback - a progress bar showing how much time remains.

```csharp
static string GetProgressBar(TimeSpan remaining, TimeSpan total)
{
    var percent = (int)((remaining.TotalSeconds / total.TotalSeconds) * 100);
    var filledBars = percent / 2; // 50 bars total = 2% each
    return new string('█', filledBars) + new string('░', 50 - filledBars);
}

// Update the timer loop:
while (remaining > TimeSpan.Zero)
{
    Console.Write($"\r{sessionName}: {remaining:mm\\:ss} [{GetProgressBar(remaining, duration)}]");
    await Task.Delay(1000);
    remaining = remaining.Subtract(TimeSpan.FromSeconds(1));
}
```

## Bug #4: Progress Bar Flickers

**What I saw:** Progress bar jitters and appears to jump around when updated. Characters from previous renders show as artifacts.

**Why it happened:** Overwriting with `\r` doesn't clear leftover characters from previous, longer progress bars. As percentage decreases (25% → 24%), bar gets shorter but old characters remain at the end.

**How I spotted it:** Started a timer and watched the progress bar closely. Saw faint characters after the bar.

**The fix:** Write spaces after the progress bar to clear any leftover characters.

```csharp
// Before (artifacts remain):
Console.Write($"\r[{progressBar}] {percent}%");

// After (cleans up):
var progressSpaces = new string(' ', 50 - progressBar.Length);
Console.Write($"\r[{progressBar}{progressSpaces}] {percent}%  ");
```

**Lesson:** When overwriting content with `\r`, you must clear leftover characters or you get visual artifacts.

## Bug #5: Timer Drifts Over Time

**What I saw:** After running a 25-minute work session, the timer shows slightly different time than actual elapsed. Over multiple sessions, drift accumulates.

**Why it happened:** `Task.Delay(1000)` takes approximately 1 second. Execution time between iterations (progress bar calculation, string formatting, console writes) adds up. Accumulated delays cause drift.

**How I spotted it:** Let a 25-minute timer run for the full duration. Compared displayed time against a separate clock. Saw ~5-10 second difference.

**The fix:** Calculate remaining time based on actual elapsed time from a Stopwatch, not accumulated delays.

```csharp
// Before (drifts over time):
while (remaining > TimeSpan.Zero)
{
    await Task.Delay(1000);
    remaining = remaining.Subtract(TimeSpan.FromSeconds(1));
}

// After (accurate):
var stopwatch = Stopwatch.StartNew();
while (stopwatch.Elapsed < duration)
{
    remaining = duration - stopwatch.Elapsed;
    await Task.Delay(100);
}
```

Note: We now check 10 times per second (100ms delay) for more responsive cancellation, but display only when seconds change.

**Lesson:** Never accumulate fixed delays for timing. Always measure actual elapsed time.

## Optimizing Display Updates

After implementing Stopwatch, I noticed another issue - console writes every 100ms even when nothing visible changes.

**The problem:** Display shows `25:00`, then 100ms later still `25:00`, then `25:00` again. Nine wasted updates before `24:59`.

**The fix:** Only update display when second value actually changes.

```csharp
var lastDisplayed = TimeSpan.Zero;
while (stopwatch.Elapsed < duration)
{
    var elapsed = stopwatch.Elapsed;
    remaining = duration - elapsed;

    // Only update display when second changes
    if (remaining.Seconds != lastDisplayed.Seconds)
    {
        UpdateDisplay(remaining, duration);
        lastDisplayed = remaining;
    }

    await Task.Delay(100); // Check cancellation frequently
}
```

**Impact:** Reduced CPU usage from constant display updates while maintaining responsive cancellation.

**Lesson:** Separate display refresh rate from cancellation check rate for efficiency.

## Updated Code

Here's the code with progress bar and timing fixes:

```csharp
using System;
using System.Diagnostics;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("Pomodoro Timer");
        Console.WriteLine("Commands: s/start - Start work session");
        Console.WriteLine("          b/break - Start break");
        Console.WriteLine("          q/quit  - Exit\n");

        while (true)
        {
            Console.Write("> ");
            var input = Console.ReadLine();

            if (input == null) continue;

            switch (input.ToLower())
            {
                case "s":
                case "start":
                    await RunTimerAsync(TimeSpan.FromMinutes(25), "Work Session", ConsoleColor.Green);
                    break;
                case "b":
                case "break":
                    await RunTimerAsync(TimeSpan.FromMinutes(5), "Break", ConsoleColor.Blue);
                    break;
                case "q":
                case "quit":
                case "exit":
                    return;
                default:
                    Console.WriteLine($"Unknown command: {input}");
                    break;
            }
        }
    }

    static async Task RunTimerAsync(TimeSpan duration, string sessionName, ConsoleColor color)
    {
        try
        {
            Console.ForegroundColor = color;
            Console.Write($"{sessionName} started!");
            Console.ResetColor();
            Console.WriteLine();

            var stopwatch = Stopwatch.StartNew();
            var lastDisplayed = TimeSpan.Zero;

            while (stopwatch.Elapsed < duration)
            {
                var elapsed = stopwatch.Elapsed;
                var remaining = duration - elapsed;

                // Only update display when second changes
                if (remaining.Seconds != lastDisplayed.Seconds)
                {
                    UpdateDisplay(sessionName, remaining, duration, color);
                    lastDisplayed = remaining;
                }

                await Task.Delay(100);
            }

            Console.Write($"\r{(new string(' ', 80))}\r");
            Console.ForegroundColor = color;
            Console.WriteLine($"{sessionName} complete!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"\nError: {ex.Message}");
        }
    }

    static void UpdateDisplay(string sessionName, TimeSpan remaining, TimeSpan duration, ConsoleColor color)
    {
        var percent = (int)((remaining.TotalSeconds / duration.TotalSeconds) * 100);
        var filledBars = percent / 2;
        var progressBar = new string('█', filledBars) + new string('░', 50 - filledBars);
        var progressSpaces = new string(' ', 50 - progressBar.Length);

        Console.ForegroundColor = color;
        Console.Write($"\r{sessionName}: {remaining:mm\\:ss} [{progressBar}{progressSpaces}] {percent}%  ");
        Console.ResetColor();
    }
}
```

## Key Concepts

- **Stopwatch:** Accurate elapsed time measurement for timing-sensitive operations
- **String manipulation:** `new string(char, count)` for repeated characters
- **Conditional rendering:** Only update display when visible changes occur
- **Visual feedback:** Progress bars with percentage display
- **Optimization:** Separate update rates for different purposes

## What We Fixed

1. **Progress bar artifacts:** Write spaces to clear leftover characters
2. **Timing drift:** Use Stopwatch for accurate elapsed time instead of accumulated delays
3. **Wasted updates:** Only render when seconds change, check cancellation more frequently

## Next Up

Part 3 adds cancellation handling and final polish. We'll handle ESC key, Ctrl+C, and discover edge cases in async cancellation.

Run the current code. Watch the progress bar - it's now smooth and accurate. Start a 25-minute timer and let it run full duration to verify timing accuracy.
