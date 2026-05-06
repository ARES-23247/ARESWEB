/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ARESLib Simulation Physics and Hardware Abstractions
 * Built for ARES 23247 Simulation Playground
 */

declare namespace ARESLib {
  /**
   * Represents a generic hardware motor controller (e.g., SparkMax, TalonFX).
   */
  export class MotorController {
    /**
     * Set the motor speed from -1.0 to 1.0.
     * @param speed Target speed percentage.
     */
    set(speed: number): void;
    /**
     * Get the current motor velocity in RPM.
     */
    getVelocity(): number;
    /**
     * Get the current motor position in rotations.
     */
    getPosition(): number;
  }

  /**
   * Represents an entire Swerve Drive Kinematics system.
   */
  export class SwerveDrive {
    constructor(width: number, length: number);
    /**
     * Drive the chassis with given velocities.
     * @param vx Velocity X in meters/second.
     * @param vy Velocity Y in meters/second.
     * @param omega Angular velocity in radians/second.
     */
    drive(vx: number, vy: number, omega: number): void;
    
    /**
     * Gets current module states.
     */
    getStates(): Array<{ speed: number, angle: number }>;
  }

  /**
   * A classic Proportional-Integral-Derivative controller.
   */
  export class PIDController {
    constructor(kP: number, kI: number, kD: number);
    /**
     * Calculate the control effort for the given measurement.
     * @param measurement Current measured state.
     * @param setpoint Target setpoint.
     * @returns The control effort.
     */
    calculate(measurement: number, setpoint: number): number;
  }
}

/**
 * Define a test case in the Simulation Test Runner.
 * @param name The name of the test.
 * @param fn The function containing the assertions.
 */
declare function test(name: string, fn: () => void): void;

/**
 * Assert a value in a test case.
 * @param actual The actual value being tested.
 */
declare function expect(actual: any): {
  /** Assert exact equality (===) */
  toBe(expected: any): void;
  /** Assert deep equality */
  toEqual(expected: any): void;
  /** Assert numeric equality within a given precision */
  toBeCloseTo(expected: number, precision?: number): void;
};
