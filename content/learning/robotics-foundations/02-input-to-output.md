# Follow a command from the gamepad to a motor

Pressing a gamepad button does not write to a motor right away. ARES moves the request through a
series of small steps. This makes the command easier to test and stop safely.

## What you will learn

- Trace one driver request through ARES.
- Explain why an action is not a motor command.
- Find the place where hardware is read and written.

## Key words

- **Action:** a message that says what happened or what the robot should try to do.
- **State:** the robot's current data at one point in time.
- **Reducer:** a function that uses an action to make the next state.
- **Controller:** code that turns state into a safe output.
- **I/O:** the input and output boundary for sensors and devices.

```mermaid
%% aria: A gamepad request becomes an action, then state, then a controller output before a hardware or simulator adapter uses it.
flowchart LR
    A["Gamepad"] --> B["Binding"]
    B --> C["Action"]
    C --> D["Reducer"]
    D --> E["Robot state"]
    E --> F["Controller"]
    F --> G["Cached I/O"]
    G --> H["Robot or simulator"]
    H --> I["Telemetry"]
```

## Why ARES uses these steps

An action describes a request, such as “drive forward.” It does not contain a motor voltage. The
reducer updates state without touching hardware, files, networks, or a clock. This keeps the same
input and state from giving different answers.

At the start of each robot loop, ARES reads each sensor once and saves the result. Controllers use
that saved sample. After the new state is ready, ARES writes safe outputs and sends telemetry. All
controllers in that loop see the same sensor data.

## Trace one real request

Choose one drive control in a starter project. Write down each item you find:

1. The gamepad button or stick.
2. The binding that reads it.
3. The action that is sent.
4. The state field that changes.
5. The controller that reads that field.
6. The I/O method that gets the output.
7. One telemetry value that shows the result.

Stop and inspect the generated project if a step is missing. Do not guess a class or topic name.

## Check your understanding

Why should a reducer never read an encoder? The short answer is that hardware can change at any
time. Reading it inside the reducer would make state changes hard to repeat and test.

This source and simulator activity does not prove real motor wiring, direction, encoder scale, or
current limits.
