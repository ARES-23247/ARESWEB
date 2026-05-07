export interface CodeExample {
  name: string;
  description: string;
  code: string;
  language: string;
}

export const EXAMPLES: CodeExample[] = [
  {
    name: 'Swerve Drive Basics',
    description: 'Basic swerve drive velocity control using MARSLib',
    language: 'java',
    code: `// Swerve Drive Velocity Control Example
// This demonstrates how to control a swerve drive robot using MARSLib

package frc.robot.commands;

import com.marslib.swerve.SwerveDrive;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Command;

public class DriveCommand extends Command {
    private final SwerveDrive drive;
    private final Supplier<Double> vxSupplier;
    private final Supplier<Double> vySupplier;
    private final Supplier<Double> omegaSupplier;

    public DriveCommand(
        SwerveDrive drive,
        Supplier<Double> vxSupplier,
        Supplier<Double> vySupplier,
        Supplier<Double> omegaSupplier
    ) {
        this.drive = drive;
        this.vxSupplier = vxSupplier;
        this.vySupplier = vySupplier;
        this.omegaSupplier = omegaSupplier;
        addRequirements(drive);
    }

    @Override
    public void execute() {
        // Get driver input
        double vx = vxSupplier.get();  // Forward/Back velocity (m/s)
        double vy = vySupplier.get();  // Left/Right velocity (m/s)
        double omega = omegaSupplier.get();  // Rotational velocity (rad/s)

        // Create chassis speeds object
        ChassisSpeeds speeds = new ChassisSpeeds(vx, vy, omega);

        // Drive the robot
        drive.driveRobotRelative(speeds);
    }
}`
  },
  {
    name: 'Vision Alignment',
    description: 'AprilTag vision alignment using MARSLib vision system',
    language: 'java',
    code: `// Vision Alignment Example
// Automatically align robot to AprilTag using MARSLib vision

package frc.robot.commands;

import com.marslib.vision.MARSVision;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.wpilibj2.command.Command;

public class AlignToTagCommand extends Command {
    private final MARSVision vision;
    private final SwerveDrive drive;

    // PID controllers for alignment
    private final PIDController xController = new PIDController(3.0, 0.0, 0.1);
    private final PIDController yController = new PIDController(3.0, 0.0, 0.1);
    private final PIDController thetaController = new PIDController(2.0, 0.0, 0.05);

    public AlignToTagCommand(MARSVision vision, SwerveDrive drive) {
        this.vision = vision;
        this.drive = drive;
        addRequirements(drive);

        // Configure theta controller for continuous rotation
        thetaController.enableContinuousInput(-Math.PI, Math.PI);
    }

    @Override
    public void execute() {
        // Get latest vision pose estimate
        var poseEstimate = vision.getPoseEstimate();

        if (poseEstimate.isPresent()) {
            var pose = poseEstimate.get();

            // Target pose (example: tag at (5m, 2m) facing 0 radians)
            var targetPose = new Pose2d(5.0, 2.0, new Rotation2d(0.0));

            // Calculate error
            double xError = targetPose.getX() - pose.getX();
            double yError = targetPose.getY() - pose.getY();
            double thetaError = targetPose.getRotation().minus(pose.getRotation()).getRadians();

            // Calculate velocities using PID
            double vx = xController.calculate(xError, 0.0);
            double vy = yController.calculate(yError, 0.0);
            double omega = thetaController.calculate(thetaError, 0.0);

            // Drive to target
            var speeds = new ChassisSpeeds(vx, vy, omega);
            drive.driveRobotRelative(speeds);
        }
    }

    @Override
    public boolean isFinished() {
        // Finish when aligned within tolerance
        return xController.atSetpoint() && yController.atSetpoint() && thetaController.atSetpoint();
    }
}`
  },
  {
    name: 'PID Elevator Control',
    description: 'Elevator position control using MARSLib mechanisms',
    language: 'java',
    code: `// PID Elevator Control Example
// Position control for elevator mechanism using MARSLib

package frc.robot.subsystems;

import com.marslib.mechanisms.LinearMechanismIO;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.wpilibj2.command.Subsystem;

public class ElevatorSubsystem extends Subsystem {
    private final LinearMechanismIO io;
    private final PIDController pidController;

    private double targetPositionMeters = 0.0;

    public ElevatorSubsystem(LinearMechanismIO io) {
        this.io = io;

        // PID controller tuned for elevator
        // Gains should be determined through SysId characterization
        this.pidController = new PIDController(8.0, 0.0, 0.15);
    }

    @Override
    public void periodic() {
        // Get current position
        double currentPosition = io.getPosition();

        // Calculate control output
        double output = pidController.calculate(currentPosition, targetPositionMeters);

        // Apply feedforward for gravity compensation
        double feedforward = 0.5;  // Adjust based on elevator mass

        // Set motor voltage
        io.setVoltage(output + feedforward);
    }

    public void setPosition(double positionMeters) {
        this.targetPositionMeters = positionMeters;
    }

    public double getPosition() {
        return io.getPosition();
    }

    public boolean atPosition() {
        return pidController.atSetpoint();
    }
}

// Usage in a command:
public class MoveElevatorCommand extends Command {
    private final ElevatorSubsystem elevator;
    private final double targetPosition;

    public MoveElevatorCommand(ElevatorSubsystem elevator, double targetPosition) {
        this.elevator = elevator;
        this.targetPosition = targetPosition;
        addRequirements(elevator);
    }

    @Override
    public void initialize() {
        elevator.setPosition(targetPosition);
    }

    @Override
    public boolean isFinished() {
        return elevator.atPosition();
    }
}`
  },
  {
    name: 'State Machine Superstructure',
    description: 'Superstructure state machine using MARSLib state management',
    language: 'java',
    code: `// Superstructure State Machine Example
// Complex mechanism coordination using MARSLib state machines

package frc.robot.subsystems;

import com.marslib.util.MARSStateMachine;
import com.marslib.util.MARSStateMachine.State;
import edu.wpi.first.wpilibj2.command.Subsystem;

public class SuperstructureSubsystem extends Subsystem {
    // States for our state machine
    enum SuperstructureState implements State {
        IDLE("Idle"),
        INTAKING("Intaking"),
        SHOOTING("Shooting"),
        AMP_SCORING("Amp Scoring"),
        CLIMBING("Climbing"),
        ESTOP("Emergency Stop");

        final String displayName;
        SuperstructureState(String displayName) {
            this.displayName = displayName;
        }

        @Override
        public String toString() {
            return displayName;
        }
    }

    private final MARSStateMachine<SuperstructureState> stateMachine;
    private final IntakeSubsystem intake;
    private final ShooterSubsystem shooter;
    private final ElevatorSubsystem elevator;

    public SuperstructureSubsystem(
        IntakeSubsystem intake,
        ShooterSubsystem shooter,
        ElevatorSubsystem elevator
    ) {
        this.intake = intake;
        this.shooter = shooter;
        this.elevator = elevator;

        // Initialize state machine
        this.stateMachine = new MARSStateMachine<>("Superstructure", SuperstructureState.IDLE);

        // Define state transitions and behaviors
        setupStateMachine();
    }

    private void setupStateMachine() {
        // IDLE state - everything stopped
        stateMachine.addState(SuperstructureState.IDLE, () -> {
            intake.stop();
            shooter.stop();
            elevator.setPosition(0.0);
        });

        // INTAKING state - run intake, elevator down
        stateMachine.addState(SuperstructureState.INTAKING, () -> {
            intake.intake();
            elevator.setPosition(0.1);  // Low position
            shooter.idle();  // Prepare shooter
        });

        // SHOOTING state - run shooter, aim, feed
        stateMachine.addState(SuperstructureState.SHOOTING, () -> {
            if (shooter.atTargetSpeed()) {
                shooter.feed();  // Only feed when shooter is ready
            }
            elevator.setPosition(0.5);  // Shooting height
        });

        // ESTOP state - emergency stop everything
        stateMachine.addState(SuperstructureState.ESTOP, () -> {
            intake.stop();
            shooter.stop();
            elevator.holdPosition();
        });
    }

    @Override
    public void periodic() {
        // Update state machine
        stateMachine.update();
    }

    // Public methods to trigger state transitions
    public void startIntaking() {
        stateMachine.setState(SuperstructureState.INTAKING);
    }

    public void startShooting() {
        stateMachine.setState(SuperstructureState.SHOOTING);
    }

    public void emergencyStop() {
        stateMachine.setState(SuperstructureState.ESTOP);
    }

    public void returnToIdle() {
        stateMachine.setState(SuperstructureState.IDLE);
    }

    public SuperstructureState getCurrentState() {
        return stateMachine.getState();
    }
}`
  }
];
