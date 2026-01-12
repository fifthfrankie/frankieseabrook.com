---
title: "Build a CLI Pomodoro Timer in C#: Part 3 - Cancellation and Final Polish"
description: "Add graceful cancellation handling and final polish. Real bugs from async cancellation and efficiency optimizations."
date: 2026-01-12
tags: ["csharp", "beginner", "tutorial"]
---

In Part 2, we added a progress bar and fixed timing drift. Now we'll handle cancellation and add final polish to make this a production-ready tool.

## The Problem with Cancellation

Right now, there's no way to stop a timer mid-session. Users are stuck waiting for 25 minutes.

## Bug #6: Cancellation Leaves Task in Bad State

I tried adding cancellation with `CancellationTokenSource`:

```csharp
var cts = new CancellationTokenSource();

while (!cts.Token.IsCancellationRequested && remaining > TimeSpan.Zero)
{
    await Task.Delay(1000, cts.Token);
    remaining = remaining.Subtract(TimeSpan.FromSeconds(1));
}
```

**What I saw:** Pressed a key to cancel, got `OperationCanceledException`, program continued but felt unstable. Subsequent timers behaved unexpectedly.

**Why it happened:** `Task.Delay()` with cancellation token throws `OperationCanceledException` which needs explicit handling. The cancellation token cancels the task but doesn't clean up state.

**How I spotted it:** Added ESC key detection and tried cancelling mid-timer. Saw exception in output.

**The fix:** Wrap async operation in try-catch and check cancellation token state.

```csharp
try
{
    while (elapsed < duration && !cts.Token.IsCancellationRequested)
    {
        elapsed = stopwatch.Elapsed;
        remaining = duration - elapsed;

        if (remaining.Seconds != lastDisplayed.Seconds)
        {
            UpdateDisplay(sessionName, remaining, duration, color);
            lastDisplayed = remaining;
        }

        await Task.Delay(100, cts.Token);
    }

    Console.Write($"\r{(new string(' ', 80))}\r");
    Console.ForegroundColor = color;
    Console.WriteLine($"{sessionName} complete!");
    Console.ResetColor();
}
catch (OperationCanceledException)
{
    Console.WriteLine("\nTimer cancelled.");
}
```

**Lesson:** Async cancellation requires explicit exception handling. Cancellation tokens don't magically stop tasks - they need coordination.

## Bug #7: Console.ReadLine() Blocks Cancellation

**What I saw:** Had to press Enter to cancel. Can't just press ESC.

**Why it happened:** `Console.ReadLine()` blocks until user presses Enter. Can't detect ESC key while waiting for input.

**How I spotted it:** Tried pressing ESC during timer - nothing happened. Pressed ESC + Enter, then it cancelled.

**The fix:** Use `Console.ReadKey()` to detect ESC key press immediately without requiring Enter.

```csharp
// Check for ESC key during timer
if (Console.KeyAvailable)
{
    var key = Console.ReadKey(true);
    if (key.Key == ConsoleKey.Escape)
    {
        cts.Cancel();
    }
}
```

**Lesson:** For hotkeys and immediate actions, use `ReadKey()` instead of `ReadLine()`.

## Bug #8: Ctrl+C Exits Abruptly

**What I saw:** Pressing Ctrl+C causes immediate termination without cleanup or confirmation.

**Why it happened:** Default behavior of `Console.CancelKeyPress` is to terminate immediately.

**How I spotted it:** Pressed Ctrl+C during timer - program closed instantly.

**The fix:** Add event handler to gracefully handle Ctrl+C with confirmation.

```csharp
static CancellationTokenSource _cts = new();

static async Task<int> Main(string[] args)
{
    Console.CancelKeyPress += (sender, e) =>
    {
        e.Cancel = true; // Prevent immediate termination
        _cts.Cancel();
        Console.WriteLine("\n\nCtrl+C pressed. Quitting...");
    };

    // ... rest of code

    while (!_cts.Token.IsCancellationRequested)
    {
        // ... main loop
    }

    return 0;
}
```

**Lesson:** Console applications should handle Ctrl+C gracefully to allow cleanup and user confirmation.

## Efficiency Win #1: Combined Display Writes

**Before:** Multiple `Console.Write()` calls for timer, progress bar, and percentage.

```csharp
Console.Write($"\r{sessionName}: {remaining:mm\\:ss} ");
Console.Write($"[{progressBar}{progressSpaces}] ");
Console.Write(percent + "%");
Console.ResetColor();
```

**After:** Single `Console.Write()` with interpolated string containing all display elements.

```csharp
Console.ForegroundColor = color;
Console.Write($"\r{sessionName}: {remaining:mm\\:ss} [{progressBar}{progressSpaces}] {percent}%  ");
Console.ResetColor();
```

**Impact:** Reduced number of console I/O operations from 3-4 per second to 1 per second.

**Lesson:** Minimize console I/O operations by combining multiple writes.

## Efficiency Win #2: Separate Display and Cancellation Rates

**Before:** Checked cancellation token once per second when updating display.

**After:** Check cancellation token 10 times per second, update display once per second.

```csharp
while (elapsed < duration && !_cts.Token.IsCancellationRequested)
{
    if (Console.KeyAvailable)
    {
        var key = Console.ReadKey(true);
        if (key.Key == ConsoleKey.Escape)
        {
            _cts.Cancel();
        }
    }

    elapsed = stopwatch.Elapsed;
    remaining = duration - elapsed;

    // Only update display when second changes
    if (remaining.Seconds != lastDisplayed.Seconds)
    {
        var percent = (int)((remaining.TotalSeconds / duration.TotalSeconds) * 100);
        var filledBars = (int)((double)percent / 2);
        var progressBar = new string('█', filledBars) + new string('░', 50 - filledBars);

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write($"\rTime: {remaining:mm\\:ss} [{progressBar}] {percent}%  ");
        Console.ResetColor();

        lastDisplayed = remaining;
    }

    await Task.Delay(100, _cts.Token);
}
```

**Impact:** More responsive cancellation (max 100ms delay to cancel) while maintaining efficient display updates.

**Lesson:** Separate display refresh rate from cancellation check rate for efficiency.

## Final Code

Here's the complete, production-ready implementation:

```csharp
using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace PomodoroTimer;

class Program
{
    private static CancellationTokenSource _cts = new();

    static async Task<int> Main(string[] args)
    {
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            _cts.Cancel();
            Console.WriteLine("\n\nCtrl+C pressed. Quitting...");
        };

        Console.WriteLine("Pomodoro Timer");
        Console.WriteLine("Commands: s/start - Start work session");
        Console.WriteLine("          b/break - Start break");
        Console.WriteLine("          q/quit  - Exit");
        Console.WriteLine("          ESC     - Cancel current timer\n");

        while (!_cts.Token.IsCancellationRequested)
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
                    return 0;
                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine($"Unknown command: {input}");
                    Console.ResetColor();
                    break;
            }
        }

        return 0;
    }

    static async Task RunTimerAsync(TimeSpan duration, string sessionName, ConsoleColor color)
    {
        Console.ForegroundColor = color;
        Console.WriteLine($"{sessionName} started! Press ESC to cancel.");
        Console.ResetColor();

        try
        {
            await RunTimerLoopAsync(duration);

            Console.Write($"\r{(new string(' ', 80))}\r");

            Console.ForegroundColor = color;
            Console.WriteLine($"{sessionName} complete!");
            Console.ResetColor();
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("\nTimer cancelled.");
        }
    }

    static async Task RunTimerLoopAsync(TimeSpan duration)
    {
        var stopwatch = Stopwatch.StartNew();
        var lastDisplayed = TimeSpan.Zero;

        try
        {
            while (stopwatch.Elapsed < duration && !_cts.Token.IsCancellationRequested)
            {
                if (Console.KeyAvailable)
                {
                    var key = Console.ReadKey(true);
                    if (key.Key == ConsoleKey.Escape)
                    {
                        _cts.Cancel();
                        break;
                    }
                }

                var remaining = duration - stopwatch.Elapsed;

                if (remaining.Seconds != lastDisplayed.Seconds)
                {
                    var percent = (int)((remaining.TotalSeconds / duration.TotalSeconds) * 100);
                    var filledBars = (int)((double)percent / 2);
                    var progressBar = new string('█', filledBars) + new string('░', 50 - filledBars);

                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.Write($"\rTime: {remaining:mm\\:ss} [{progressBar}] {percent}%  ");
                    Console.ResetColor();

                    lastDisplayed = remaining;
                }

                await Task.Delay(100, _cts.Token);
            }

            if (_cts.Token.IsCancellationRequested)
            {
                _cts = new CancellationTokenSource();
            }
        }
        catch (OperationCanceledException)
        {
            _cts = new CancellationTokenSource();
            throw;
        }
    }
}
```

## Key Concepts

- **Cancellation tokens:** Pattern for stopping async operations cleanly
- **Exception handling:** Explicit handling of `OperationCanceledException`
- **Non-blocking I/O:** `KeyAvailable` and `ReadKey(true)` for responsive input
- **Event handlers:** `Console.CancelKeyPress` for graceful shutdown
- **Efficiency:** Combining writes, separating update rates
- **Console colors:** Proper color management with immediate reset

## What We Fixed

1. **Async cancellation:** Explicit exception handling for clean task termination
2. **Blocking input:** ESC key detection with `ReadKey()` instead of `ReadLine()`
3. **Abrupt exit:** Graceful Ctrl+C handling with cleanup
4. **Multiple I/O operations:** Combined writes into single call
5. **Slow cancellation:** Separated display updates from cancellation checks

## Efficiency Wins Summary

| Win | Before | After | Impact |
|------|---------|---------|---------|
| Display updates | Every 100ms | Only when seconds change | Reduced CPU usage |
| Cancellation response | Up to 1s delay | Max 100ms delay | More responsive |
| Console I/O | 3-4 calls per second | 1 call per second | Fewer operations |

## Key Takeaways

1. **Console color management:** Always reset immediately after use
2. **Display updates:** Use `\r` for line-level updates, clear leftovers with spaces
3. **Async cancellation:** Cancellation tokens need explicit coordination and exception handling
4. **Timing accuracy:** Never accumulate delays - measure elapsed time with Stopwatch
5. **User input normalization:** Normalize input for forgiving user experience
6. **Efficiency vs responsiveness:** Separate display rate from cancellation check rate
7. **Graceful shutdown:** Handle Ctrl+C and cancellation explicitly
8. **Test edge cases:** Intentionally break things - reveals real bugs
9. **Document failures:** Bugs and fixes are more valuable than perfect code
10. **Keep it simple:** Built-in Console API is often sufficient

## What's Next

You have a working, production-ready Pomodoro timer. Here are ways to extend it:

- Save session history to a file
- Add custom durations via command-line args
- Multiple consecutive work sessions before long break
- Statistics: total focus time per day
- Configuration file for settings

Run the final version. Do a full 25-minute work session. Try canceling mid-timer with ESC. Test Ctrl+C handling. The timer is now robust, efficient, and handles edge cases gracefully.

## Learning Journey

This wasn't just writing code - it was discovering and fixing real bugs:

- Flickering display → `\r` instead of `Console.Clear()`
- Color bleeding → Reset color immediately
- Case sensitivity → Normalize input
- Progress bar artifacts → Clear leftover characters
- Timing drift → Use Stopwatch for accuracy
- Blocking cancellation → Use `ReadKey()` for ESC detection
- Abrupt exit → Graceful Ctrl+C handling
- Wasted updates → Conditional rendering

Each bug taught a lesson. Each fix improved the code. That's how you build production-ready tools - not by writing perfect code, but by finding what breaks and fixing it.
