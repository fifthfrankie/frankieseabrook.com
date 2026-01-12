---
title: "Build a Pomodoro Timer in C#: Part 1 - Setup and Timer Logic"
description: "Learn console I/O, async programming, and string formatting by building a CLI Pomodoro timer from scratch."
date: 2026-01-12
tags: ["csharp", "beginner", "tutorial"]
---

In this series, we'll build a command-line Pomodoro timer from scratch. It's a simple project that teaches console I/O, timing, and state management.

## What We're Building

A CLI timer that runs 25-minute work sessions with 5-minute breaks. Three commands: `s` to start, `b` for break, `q` to quit.

## Setup

Create a new console application:

```bash
dotnet new console -n PomodoroTimer
cd PomodoroTimer
dotnet run
```

You'll see the default "Hello, World!" output. Replace it.

## Core Timer Logic

Open `Program.cs`. Here's the basic structure:

```csharp
using System;

class Program
{
    private const int WorkMinutes = 25;
    private const int BreakMinutes = 5;

    static async Task Main(string[] args)
    {
        Console.WriteLine("Pomodoro Timer");
        Console.WriteLine("Commands: s/start/work, b/break/rest, q/quit/exit");
        Console.WriteLine();

        while (true)
        {
            Console.Write("> ");
            string input = Console.ReadLine()?.Trim().ToLower() ?? "";

            if (input == "q" || input == "quit" || input == "exit")
            {
                break;
            }

            if (input == "s" || input == "start" || input == "work")
            {
                await RunTimer(WorkMinutes, ConsoleColor.Cyan, "WORK");
            }
            else if (input == "b" || input == "break" || input == "rest")
            {
                await RunTimer(BreakMinutes, ConsoleColor.Green, "BREAK");
            }
            else if (!string.IsNullOrEmpty(input))
            {
                Console.WriteLine("Unknown command. Try: s, b, or q");
            }
        }

        Console.WriteLine("Goodbye!");
    }

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
                Console.Write($"\r{label}: {FormatTime(remaining)}");
                Console.ResetColor();

                if (Console.KeyAvailable && Console.ReadKey(true).Key == ConsoleKey.Escape)
                {
                    cts.Cancel();
                }

                await Task.Delay(1000, cts.Token);
            }

            Console.WriteLine();
            Console.WriteLine($"{label} complete!");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine();
            Console.WriteLine("Timer cancelled.");
        }
    }

    static string FormatTime(int seconds)
    {
        int mins = seconds / 60;
        int secs = seconds % 60;
        return $"{mins:00}:{secs:00}";
    }
}
```

## How It Works

**Main Loop:** Infinite `while(true)` that reads input and dispatches commands. Clean separation - input handling delegates to `RunTimer`.

**Async/Await:** `Task.Delay(1000)` is non-blocking. The timer doesn't freeze your program. Using `await` in a loop creates a natural countdown without threads.

**Formatting:** `{mins:00}:{secs:00}` pads with zeros to 2 digits. So `5` becomes `05`, `12` stays `12`.

**Carriage Return:** `\r` moves cursor to start of line without advancing. This updates the time in-place instead of clearing the screen.

**Null Handling:** `?? ""` handles null from `ReadLine()`. Prevents null reference exceptions.

Run it:

```bash
dotnet run
```

Type `s` to start a work session. You'll see a 25:00 countdown updating in-place.

## Key Concepts

- **Console I/O:** Reading input with `Console.ReadLine()`, writing output with `Console.Write()`
- **Async programming:** `await Task.Delay()` instead of `Thread.Sleep()` - keeps the app responsive
- **String formatting:** `{0:00}` for zero-padded numbers
- **Control flow:** While loops for command handling, for loops for iteration
- **Null coalescing:** `?? ""` for safe null handling

## Next Up

Part 2 adds a visual progress bar and better sound feedback.

Run what you have now. Get comfortable with the basic timer before we add more.
