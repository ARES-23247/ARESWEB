-- Migration to seed ARESWEB Documentation with high-quality, 8th-grade reading level technical writing.

INSERT INTO docs (slug, title, category, sort_order, description, content, status, is_deleted)
VALUES 
(
  'introduction', 
  'Introduction to ARESLib', 
  'Getting Started', 
  1, 
  'Welcome to ARESLib, the core robot software library for ARES 23247.', 
  '# Welcome to ARESLib

ARESLib is the core robot software library for ARES 23247. It helps us write robot code that is fast, safe, and easy to read. 

## Why do we need ARESLib?
Writing code for a *FIRST*® robot can be tricky. You have to control motors, read sensors, and run complex math at the same time. If one piece of code takes too long, the whole robot might stutter or crash. 

ARESLib solves this by organizing our code into **Subsystems** and **Commands**. 

### 1. Subsystems
A subsystem is a specific part of the robot. For example, the `DriveSubsystem` controls the wheels, and the `ArmSubsystem` controls the arm. A subsystem is responsible for its own hardware.

### 2. Commands
A command is an action the robot performs. For example, `DriveToPointCommand` tells the `DriveSubsystem` to move the robot to a specific spot on the field. Commands use subsystems to get the job done.

## Getting Started
To start writing code with ARESLib, you need to understand how to create a subsystem. 

```java
public class DriveSubsystem extends SubsystemBase {
    private final CANSparkMax leftMotor;
    
    public DriveSubsystem() {
        leftMotor = new CANSparkMax(1, MotorType.kBrushless);
    }
}
```

In other words, you create a class that extends `SubsystemBase`, and you set up your motors inside the constructor. We will cover this more in the next sections!',
  'published',
  0
),
(
  'areslib-standard',
  'The ARESLib Standard',
  'The ARESLib Standard',
  1,
  'How we ensure our robot code never fails on the field.',
  '# The ARESLib Standard

The ARESLib Standard is our set of rules for writing perfect robot code. We use these rules to make sure our robot never crashes during a match.

## 1. Zero Allocation During Matches
When the robot is playing a match, the code runs 50 times every second. If we create new objects (like `new Pose2d()`) during this loop, the Java Garbage Collector will eventually have to clean them up. This cleanup pauses the robot for a few milliseconds, which can cause the robot to miss a target.

To fix this, we **pre-allocate** all objects. This means we create them once when the robot turns on, and then we reuse them. 

## 2. Deterministic Logging
We record everything the robot does. This includes motor speeds, sensor readings, and controller inputs. We log this data using AdvantageKit. 

If the robot does something unexpected on the field, we can download the log file and replay the match in a simulator. This lets us see exactly what went wrong.

> [!TIP]
> Always log the exact values you send to the motors. Do not log what you *think* you sent. Log the actual hardware state!

## 3. Strict Hardware Abstraction
We never talk to hardware directly inside a Command. Commands must only talk to Subsystems. Subsystems handle the raw motors and sensors. 

In other words, your `ShootCommand` should call `shooter.setSpeed(0.8)`, instead of calling `leftMotor.set(0.8)`. This makes the code much easier to read and test.',
  'published',
  0
),
(
  'advantage-scope',
  'AdvantageScope Telemetry',
  'Reference',
  1,
  'How to use AdvantageScope to replay robot matches.',
  '# AdvantageScope Telemetry

AdvantageScope is a powerful tool we use to visualize our robot data. It lets us see 3D replays of the robot moving on the field, read charts of motor speeds, and watch camera feeds.

## How It Works
Our robot records a log file (an `.wpilog` file) on a USB drive during every match. When the match ends, we plug the USB drive into our computer and open the file in AdvantageScope.

AdvantageScope reads the data and draws a 3D robot on a virtual field. 

<swervesimulator />

## Setting Up Telemetry
To make the 3D robot move in AdvantageScope, we have to log its position (the X, Y, and rotation) using ARESLib.

```java
// Log the robot pose for AdvantageScope
Logger.recordOutput("Odometry/Robot", pose);
```

By logging the `pose` to `Odometry/Robot`, AdvantageScope automatically knows how to draw the robot on the field. 

## Checking Motor Speeds
You can also drag any motor speed from the left menu into a line graph. This helps you figure out if a motor is fighting another motor, or if it is drawing too much power.',
  'published',
  0
),
(
  'swerve-drive',
  'Swerve Drive Control',
  'HMI & Control',
  1,
  'Understanding how we drive the robot.',
  '# Swerve Drive Control

Swerve drive is a special type of drivetrain. Instead of just turning the wheels forward and backward, swerve drive lets us rotate each wheel individually. This means the robot can drive sideways, spin in circles, and move diagonally all at the same time!

## The Math Behind Swerve
Swerve drive uses a lot of trigonometry. We need to calculate the speed and angle for all four wheels based on what the driver does with the joystick.

ARESLib handles this math for us using `SwerveDriveKinematics`. 

### Field-Centric vs. Robot-Centric
There are two ways to drive a swerve robot:
1. **Robot-Centric**: Pushing forward on the joystick makes the robot drive in the direction its front is pointing.
2. **Field-Centric**: Pushing forward on the joystick makes the robot drive toward the far end of the field, no matter which way the robot is facing. 

We always use Field-Centric mode because it is much easier for the driver. To do this, ARESLib uses the robot''s gyroscope to know which way is "forward" on the actual field.

## Teleop Control
Here is how we link the joystick to the swerve drive:

```java
driveSubsystem.setDefaultCommand(
    new RunCommand(
        () -> driveSubsystem.drive(
            joystick.getLeftY(),
            joystick.getLeftX(),
            joystick.getRightX(),
            true // Field-centric mode
        ),
        driveSubsystem
    )
);
```

In other words, the left joystick moves the robot around, and the right joystick spins the robot.',
  'published',
  0
);
