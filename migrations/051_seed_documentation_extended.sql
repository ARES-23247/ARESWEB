-- Migration to add extended ARESWEB Documentation
-- Covers Autonomous Pathing, Vision & AprilTags, and PID Tuning at an 8th-grade reading level.

INSERT INTO docs (slug, title, category, sort_order, description, content, status, is_deleted)
VALUES 
(
  'autonomous-pathing', 
  'Autonomous Pathing', 
  'Autonomous', 
  1, 
  'How to make the robot drive itself using PathPlanner.', 
  '# Autonomous Pathing

During the first 15 seconds of a match, the robot has to drive itself. This is called the **Autonomous** period (or "Auto" for short). To do this, we don''t write out every single turn by hand. Instead, we use a tool called **PathPlanner**.

## What is PathPlanner?
PathPlanner is an app that lets us draw lines and curves on a virtual field. We place "waypoints" (dots) where we want the robot to go, and PathPlanner calculates the smoothest path between them.

### Following a Path
Once we draw a path and save it to the robot, ARESLib takes over. It uses a command called `PathPlannerAuto` to follow the path perfectly.

Here is how you run a path in your code:

```java
// Load the path from the deploy folder
PathPlannerPath path = PathPlannerPath.fromPathFile("MyAwesomePath");

// Create a command to follow the path
Command autoCommand = AutoBuilder.followPath(path);
```

## Odometry
How does the robot know where it is on the path? We use **Odometry**. Odometry is a way of tracking the robot''s position by counting how many times the wheels have turned and using the gyroscope to see which way the robot is facing. 

If the robot knows it started at `(0, 0)`, and the wheels drove forward 2 meters, the odometry says the robot is now at `(2, 0)`. ARESLib uses this math to make sure the robot stays exactly on the PathPlanner line.',
  'published',
  0
),
(
  'vision-apriltags', 
  'Vision & AprilTags', 
  'Sensors & Vision', 
  1, 
  'How the robot uses cameras to see the field.', 
  '# Vision & AprilTags

Odometry is great, but it''s not perfect. If the wheels slip on the carpet or another robot bumps into us, the odometry gets confused. The robot thinks it is somewhere else, and our autonomous paths will fail!

To fix this, we give the robot eyes. We use cameras and **AprilTags**.

## What is an AprilTag?
An AprilTag looks like a QR code. *FIRST* places these tags all over the field walls and targets. Each tag has a specific number, so the robot knows exactly which part of the field it is looking at.

## How Vision Updates Odometry
When our camera sees an AprilTag, it calculates exactly how far away the tag is, and at what angle. Because we know where the tag is permanently attached to the field, the robot can do some quick math to figure out its own exact position.

We call this a **Vision Measurement**. 

```java
// Add a vision measurement to fix our odometry
poseEstimator.addVisionMeasurement(
    visionPose, 
    Timer.getFPGATimestamp()
);
```

When we add a vision measurement, the robot "snaps" back to the correct position on the field. This means even if we get bumped really hard, the camera will see a tag and fix our location instantly.

## Best Practices
- Always mount cameras securely so they don''t shake.
- We use coprocessors (like Orange Pi or Raspberry Pi) to process the camera images so the main robot brain doesn''t slow down.
- In ARESLib, all vision data must be logged to AdvantageScope so we can see what the camera saw during a match.',
  'published',
  0
),
(
  'pid-tuning', 
  'PID Tuning', 
  'HMI & Control', 
  2, 
  'How to make motors move smoothly to a target.', 
  '# PID Tuning

When we tell a motor to spin to a certain position (like raising an arm to 45 degrees), we can''t just turn the motor on full power and then turn it off when it gets there. If we do that, the arm will swing past the target because of momentum.

To make mechanisms move smoothly and stop exactly where we want, we use a **PID Controller**.

## What does PID stand for?

### 1. Proportional (P)
This is the main driving force. The further you are from your target (the "error"), the harder the motor pushes. As the arm gets closer to 45 degrees, the error shrinks, so the motor slows down. 
*If P is too high, the arm will shake back and forth. If P is too low, the arm moves too slowly.*

### 2. Integral (I)
Sometimes, the arm gets *really close* to the target, but stops just short because the P power is too small to overcome friction. The "I" looks at how long you have been stuck near the target and slowly ramps up the power to push it the rest of the way. 
*(Note: We rarely use I in FRC because it can cause dangerous wind-up. Usually, P and D are enough).*

### 3. Derivative (D)
This acts like a brake. If the arm is moving toward the target too quickly, the D term slows it down to prevent it from overshooting. It looks at how fast the error is shrinking.

## Tuning a PID Controller
Tuning means finding the perfect numbers for P, I, and D. 

1. Start with P, I, and D all at zero.
2. Slowly increase P until the mechanism gets to the target but wobbles just a little bit.
3. Increase D to act as a brake and stop the wobble.
4. Leave I at zero unless absolutely necessary!

```java
// Setting up a PID Controller in ARESLib
PIDController armPid = new PIDController(0.05, 0.0, 0.01);

// Calculate the power needed to reach the target
double motorPower = armPid.calculate(currentAngle, targetAngle);
armMotor.set(motorPower);
```

By tuning the PID controller, our robot moves like a professional machine instead of a jittery toy.',
  'published',
  0
);
