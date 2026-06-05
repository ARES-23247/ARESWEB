import { TelemetryFrame } from "./scopeStore";

/**
 * Pure TypeScript client for FRC/FTC NetworkTables v4 over WebSockets.
 * Handles handshakes, topic announcements, and throttled update-dispatching.
 */
export class NT4Client {
  private ws: WebSocket | null = null;
  private topicNames = new Map<number, string>();
  private currentFrameData: Record<string, any> = {};
  private lastTimestamp = 0;

  constructor(
    private host: string,
    private onFrame: (frame: TelemetryFrame) => void,
    private onStatusChange: (status: "disconnected" | "connecting" | "connected") => void
  ) {}

  connect() {
    this.onStatusChange("connecting");
    const port = 5810; // Standard NT4 port

    try {
      // Use the official networktables.org sub-protocol
      this.ws = new WebSocket(`ws://${this.host}:${port}/nt/v4/websocket`, ["networktables.org"]);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.onStatusChange("connected");
        this.subscribeAll();
        console.log(`[NT4Client] Connected to NT4 server at ${this.host}:${port}`);
      };

      this.ws.onclose = () => {
        this.onStatusChange("disconnected");
        console.log("[NT4Client] Disconnected from NT4 server.");
      };

      this.ws.onerror = (err) => {
        console.error("[NT4Client] WebSocket error:", err);
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          this.handleJsonMessage(event.data);
        } else {
          // Binary message handling if required (JSON mode is fallback/standard for web clients)
          this.handleBinaryMessage(event.data);
        }
      };
    } catch (e) {
      console.error("[NT4Client] Connection failed:", e);
      this.onStatusChange("disconnected");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Send subscribe message for all topics prefix-matched
    const subMsg = [
      {
        method: "subscribe",
        params: {
          topics: ["/"],
          options: {
            prefix: true,
            periodic: 0.02, // 20ms update frequency (50Hz)
            logging: true
          }
        },
        uid: 1
      }
    ];

    this.ws.send(JSON.stringify(subMsg));
  }

  private handleJsonMessage(dataStr: string) {
    try {
      const messages = JSON.parse(dataStr);
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        if (msg.method === "announce") {
          // Topic description metadata
          const { name, id } = msg.params;
          this.topicNames.set(id, name);
        } else if (msg.topic !== undefined && msg.value !== undefined) {
          // Value update
          const name = this.topicNames.get(msg.topic);
          if (name) {
            this.processTelemetryKey(name, msg.value);
          }
        }
      }
    } catch (e) {
      console.error("[NT4Client] Failed to parse JSON message:", e);
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    // NT4 sends binary packets for compact double-array updates
    // Data layout: [1-byte type, 3-byte padding, 4-byte topic ID, 8-byte timestamp, binary value]
    const view = new DataView(buffer);
    if (buffer.byteLength < 16) return;

    const topicId = view.getInt32(4);
    const name = this.topicNames.get(topicId);
    if (!name) return;

    // Standard double array prefix or pose coordinates
    if (name === "AdvantageScope/RobotPose" || name === "AdvantageScope/RawOdomPose" || name === "AdvantageScope/VisionPose") {
      const arrayLength = (buffer.byteLength - 16) / 8;
      const values: number[] = [];
      for (let i = 0; i < arrayLength; i++) {
        values.push(view.getFloat64(16 + i * 8));
      }
      this.processTelemetryKey(name, values);
    }
  }

  private processTelemetryKey(key: string, value: any) {
    // Strip leading slash if present in topic name
    const cleanKey = key.startsWith("/") ? key.substring(1) : key;
    this.currentFrameData[cleanKey] = value;

    // Use TimestampMs key as the trigger to flush/emit the frame
    if (cleanKey === "TimestampMs" || cleanKey === "drive/TimestampMs") {
      const currentTimestamp = Number(value);
      if (currentTimestamp !== this.lastTimestamp) {
        this.lastTimestamp = currentTimestamp;
        this.emitFrame(currentTimestamp);
      }
    }
  }

  private emitFrame(timestamp: number) {
    // Map accumulated telemetry keys into the structured TelemetryFrame
    const x = Number(this.currentFrameData["Drive/Pose_X"] || this.currentFrameData["Drive/Odom_X"] || 0.0);
    const y = Number(this.currentFrameData["Drive/Pose_Y"] || this.currentFrameData["Drive/Odom_Y"] || 0.0);
    
    // Scale coordinate metrics if raw meters are detected to match web visualization space
    let scaledX = x;
    let scaledY = y;
    let heading = Number(this.currentFrameData["Drive/Drive_Heading"] || this.currentFrameData["Drive/Odom_Heading"] || 0.0);

    if (Math.abs(x) < 5.0 && Math.abs(y) < 5.0) {
      // Metric EKF meters -> visual inches, shifted to bottom-left arena space
      scaledX = -y * 39.3701 + 72;
      scaledY = x * 39.3701 + 72;
      heading = heading + Math.PI / 2;
    }

    const frame: TelemetryFrame = {
      timestamp: timestamp,
      x: scaledX,
      y: scaledY,
      heading: heading,
      battery: Number(this.currentFrameData["Robot/BatteryVoltage"] || this.currentFrameData["battery"] || 12.6),
      loopTime: Number(this.currentFrameData["Robot/LoopTime"] || 10.0),
      motors: {
        lf: Number(this.currentFrameData["Drive/MotorPower_FL"] || 0.0),
        rf: Number(this.currentFrameData["Drive/MotorPower_FR"] || 0.0),
        lr: Number(this.currentFrameData["Drive/MotorPower_BL"] || 0.0),
        rr: Number(this.currentFrameData["Drive/MotorPower_BR"] || 0.0)
      },
      slides: {
        height: Number(this.currentFrameData["Superstructure/Elevator_Height"] || 0.0),
        current: Number(this.currentFrameData["Drive/MotorCurrent_FL"] || 0.0) // Mock slides currents to showcase charts
      },
      intake: {
        current: Number(this.currentFrameData["Drive/MotorCurrent_FR"] || 0.0)
      }
    };

    this.onFrame(frame);
  }
}
