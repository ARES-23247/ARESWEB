-- Migration to optimize, combine, and inject simulations into ARESWEB Documentation
DELETE FROM docs;

INSERT INTO docs (slug, title, category, sort_order, description, content, status, is_deleted)
VALUES 
(
  'areslib-fundamentals', 
  'ARESLib Fundamentals', 
  'Getting Started', 
  1, 
  'The core architecture of ARESLib: Subsystems, Commands, and the Zero-Allocation Standard.', 
  '# ARESLib Fundamentals

Welcome to ARESLib, the core robot software library for ARES 23247. Writing code for a *FIRST*® robot can be tricky because we have to control motors, read sensors, and run complex math at the same time. If one piece of code takes too long, the whole robot might stutter or crash. 

## The Subsystem/Command Architecture

ARESLib solves this by organizing our code into **Subsystems** and **Commands**. 

1. **Subsystems**: A specific part of the robot (like `DriveSubsystem` or `ArmSubsystem`). A subsystem is responsible for its own hardware.
2. **Commands**: An action the robot performs (like `DriveToPointCommand`). Commands use subsystems to get the job done.

<codeplayground />

## The Zero-Allocation Standard

When the robot is playing a match, the code runs 50 times every second. If we create new objects (like `new Pose2d()`) during this loop, the Java Garbage Collector will eventually have to clean them up. This cleanup pauses the robot for a few milliseconds, which can cause the robot to miss a target.

To fix this, we **pre-allocate** all objects. We create them once when the robot turns on, and then reuse them. 

## Strict Hardware Abstraction
We never talk to hardware directly inside a Command. Commands must only talk to Subsystems. Subsystems handle the raw motors and sensors. Your `ShootCommand` should call `shooter.setSpeed(0.8)`, instead of calling `leftMotor.set(0.8)`. This makes the code much easier to read and test.',
  'published',
  0
),
(
  'telemetry-and-control', 
  'Telemetry & Control', 
  'HMI & Control', 
  2, 
  'Deterministic logging with AdvantageScope and making mechanisms smooth with PID.', 
  '# Telemetry & Control

Our robot records a log file on a USB drive during every match. When the match ends, we open the file in **AdvantageScope**. AdvantageScope reads the data and draws a 3D robot on a virtual field, letting us replay exactly what happened.

## Deterministic Logging

We record everything the robot does using AdvantageKit. If the robot does something unexpected, we can replay the match in a simulator to see exactly what went wrong.

> [!TIP]
> Always log the exact values you send to the motors. Do not log what you *think* you sent. Log the actual hardware state!

## PID Tuning

To make mechanisms move smoothly and stop exactly where we want, we use a **PID Controller**.

* **Proportional (P)**: The main driving force. The further you are from your target, the harder the motor pushes.
* **Integral (I)**: Ramps up power to push past friction if stuck near the target.
* **Derivative (D)**: Acts like a brake to prevent overshooting.

<configvisualizer />

Tuning means finding the perfect numbers. Start with P until the mechanism gets to the target but wobbles, then add D to act as a brake. Leave I at zero unless necessary!',
  'published',
  0
),
(
  'swerve-and-kinematics', 
  'Swerve Drive & SOTM', 
  'HMI & Control', 
  3, 
  'Understanding how we drive the robot and shoot on the move.', 
  '# Swerve Drive & SOTM

Instead of just turning the wheels forward and backward, swerve drive lets us rotate each wheel individually. The robot can drive sideways, spin in circles, and move diagonally all at the same time!

<swervesimulator />

## Field-Centric Control
We always use Field-Centric mode because it is much easier for the driver. Pushing forward on the joystick makes the robot drive toward the far end of the field, no matter which way the robot is facing. ARESLib uses the robot''s gyroscope to know which way is "forward" on the actual field.

## Shoot-On-The-Move (SOTM)
Because swerve drive lets us move in any direction independently of where the robot is facing, we can implement **Shoot-On-The-Move**. While the robot is driving across the field, the code constantly calculates the angle to the speaker and rotates the robot chassis to aim, while still driving in the direction the driver commands.

<sotmsimulator />

This uses complex kinematics and physics to calculate the exact firing angle based on the robot''s current speed and distance to the target.',
  'published',
  0
),
(
  'autonomous-and-vision', 
  'Autonomous & Vision', 
  'Autonomous', 
  4, 
  'PathPlanner odometry and AprilTag vision correction.', 
  '# Autonomous & Vision

During the first 15 seconds of a match, the robot has to drive itself using **PathPlanner**. We place waypoints, and PathPlanner calculates the smoothest path.

## Odometry
Odometry is a way of tracking the robot''s position by counting how many times the wheels have turned and using the gyroscope. ARESLib uses this math to make sure the robot stays exactly on the PathPlanner line.

## Vision & AprilTags
Odometry is great, but it''s not perfect. If the wheels slip on the carpet, the odometry gets confused. To fix this, we use cameras and **AprilTags**.

When our camera sees an AprilTag, it calculates exactly how far away the tag is, and at what angle. The robot does some quick math to figure out its own exact position.

When we add a vision measurement, the robot "snaps" back to the correct position on the field. This means even if we get bumped really hard, the camera will see a tag and fix our location instantly.

<codeplayground />',
  'published',
  0
);
