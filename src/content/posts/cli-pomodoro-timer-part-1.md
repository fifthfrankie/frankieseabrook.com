---
title: "Build a CLI Pomodoro Timer in C#: Part 1 - Getting Started and First Bugs"
description: "Build a CLI Pomodoro timer from scratch while learning from real bugs: display flickering, color bleeding, and case sensitivity."
date: 2026-01-12
tags: ["csharp", "beginner", "tutorial"]
---

In this series, we'll build a CLI Pomodoro timer in C#. I'm not going to show you perfect code that magically works. I'll show you what broke, how I found it, and how I fixed it. Learning is failing first.

## What We're Building

A command-line timer with 25-minute work sessions and 5-minute breaks. Commands: `s` to start, `b` for break, `q` to quit.

## Initial Approach

I started with basic async timer logic:
- `Task.Delay()` for timing
- `Console.Clear()` to refresh display every second
- Simple command loop
- Color-coded output (green for work, blue for break)

```csharp
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("Pomodoro Timer");
        Console.WriteLine("Commands: s (start), b (break), q (quit)");

        while (true)
        {
            var input = Console.ReadLine();

            switch (input)
            {
                case "s":
                    await RunTimerAsync(25, "Work");
                    break;
                case "b":
                    await RunTimerAsync(5, "Break");
                    break;
                case "q":
                    return;
            }
        }
    }

    static async Task RunTimerAsync(int minutes, string mode)
    {
        var remaining = TimeSpan.FromMinutes(minutes);

        while (remaining > TimeSpan.Zero)
        {
            Console.Clear();
            Console.WriteLine($"{mode}: {remaining:mm\\:ss}");
            await Task.Delay(1000);
            remaining = remaining.Subtract(TimeSpan.FromSeconds(1));
        }

        Console.WriteLine($"{mode} complete!");
    }
}
```

Run it and type `s`. The timer works.

But it has issues.

## Bug #1: Display Flickers

**What I saw:** Screen flashes every second. Hard to read countdown. Jarring.

**Why it happened:** `Console.Clear()` wipes entire console buffer and redraws everything. Frequent updates make it visually jarring.

**How I spotted it:** Started a work session and watched the display. Every second, the whole screen cleared and rewrote.

**The fix:** Use `\r` (carriage return) to overwrite current line instead of clearing entire console.

```csharp
// Before (causes flickering):
Console.Clear();
Console.WriteLine($"{mode}: {remaining:mm\\:ss}");

// After (smooth update):
Console.Write($"\r{mode}: {remaining:mm\\:ss}  ");
```

Note the extra spaces at the end - they clear leftover characters from previous, longer text.

**Lesson:** For frequent updates, prefer line-level updates over full screen clears.

## Bug #2: Color Bleeds Everywhere

**What I saw:** Work timer (green) finishes, then "Timer complete!" appears in green. Next prompt and all subsequent output stay green. Can't tell status from normal text.

**Why it happened:** `Console.ForegroundColor` is set but never reset. Color state persists until explicitly changed.

**How I spotted it:** Started work session, waited for completion, then typed another command. Everything appeared in green.

**The fix:** Reset color immediately after writing colored text.

```csharp
// Before (color persists):
Console.ForegroundColor = ConsoleColor.Green;
Console.WriteLine("Work started!");
await RunTimerAsync(25);

// After (color resets):
Console.ForegroundColor = ConsoleColor.Green;
Console.Write("Work started!");
Console.ResetColor();
Console.WriteLine();
await RunTimerAsync(25);
```

**Lesson:** Treat console color as a borrowed resource. Always return it to default state immediately after use.

## Bug #3: Case Sensitivity Frustrates Users

**What I saw:** Typing `s` works for start. Typing `S` doesn't. `q` quits but `Q` doesn't. Users try random case combinations.

**Why it happened:** Direct string comparison without normalization.

**How I spotted it:** Typed `S` and nothing happened. Got frustrated trying different case variations.

**The fix:** Convert input to lowercase before comparison.

```csharp
// Before:
switch (input)
{
    case "s":
    case "start":
        StartWork();
        break;
}

// After:
switch (input.ToLower())
{
    case "s":
    case "start":
        StartWork();
        break;
}
```

**Lesson:** User input should always be normalized. Users expect case-insensitivity in CLI tools.

## Updated Code

Here's the code after fixing these three bugs:

```csharp
using System;
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
                    await RunTimerAsync(25, "Work Session", ConsoleColor.Green);
                    break;
                case "b":
                case "break":
                    await RunTimerAsync(5, "Break", ConsoleColor.Blue);
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

    static async Task RunTimerAsync(int minutes, string sessionName, ConsoleColor color)
    {
        var remaining = TimeSpan.FromMinutes(minutes);

        try
        {
            Console.ForegroundColor = color;
            Console.Write($"{sessionName} started!");
            Console.ResetColor();
            Console.WriteLine();

            while (remaining > TimeSpan.Zero)
            {
                Console.Write($"\r{sessionName}: {remaining:mm\\:ss}  ");
                await Task.Delay(1000);
                remaining = remaining.Subtract(TimeSpan.FromSeconds(1));
            }

            Console.WriteLine();
            Console.ForegroundColor = color;
            Console.WriteLine($"{sessionName} complete!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"\nError: {ex.Message}");
        }
    }
}
```

## Key Concepts

- **Console I/O:** `Console.ReadLine()`, `Console.Write()`, `Console.WriteLine()`
- **Async programming:** `await Task.Delay()` for non-blocking timing
- **String formatting:** `{time:mm\\:ss}` for time display
- **Console colors:** `ForegroundColor` and `ResetColor()`
- **Carriage return:** `\r` for line-level updates vs `Console.Clear()`
- **Input normalization:** `.ToLower()` for case-insensitive comparisons
- **Exception handling:** Try-catch for error recovery

## What We Fixed

1. **Display flickering:** Replaced `Console.Clear()` with `\r` for smooth updates
2. **Color bleeding:** Reset color immediately after use
3. **Case sensitivity:** Normalize input before comparison

## Next Up

Part 2 adds a progress bar. We'll discover bugs in bar rendering and timing accuracy issues.

Run the current code. Start a work session. Watch for the flickering, color bleeding, and case sensitivity issues - these are the bugs we just fixed.
