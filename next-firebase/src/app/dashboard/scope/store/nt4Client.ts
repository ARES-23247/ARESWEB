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
    const isPoseTopic = name.includes("Pose") || name.endsWith("EstimatedPose") || name.endsWith("TargetPose");
    if (isPoseTopic) {
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

    // Use TimestampMs key or pose updates as the trigger to flush/emit the frame
    const isFrameTrigger = 
      cleanKey === "TimestampMs" || 
      cleanKey.endsWith("/TimestampMs") || 
      cleanKey === "drive/TimestampMs" || 
      cleanKey.endsWith("EstimatedPose") || 
      cleanKey.endsWith("RobotState");

    if (isFrameTrigger) {
      let currentTimestamp = Number(value);
      if (isNaN(currentTimestamp)) {
        currentTimestamp = Date.now();
      }
      if (currentTimestamp !== this.lastTimestamp) {
        this.lastTimestamp = currentTimestamp;
        this.emitFrame(currentTimestamp);
      }
    }
  }

  private emitFrame(timestamp: number) {
    const values: Record<string, number> = {};
    Object.keys(this.currentFrameData).forEach((key) => {
      const numVal = Number(this.currentFrameData[key]);
      if (!isNaN(numVal)) {
        values[key] = numVal;
      }
    });

    // Auto-detect coordinates
    const getVal = (prefixes: string[], fallback: number) => {
      for (const p of prefixes) {
        if (this.currentFrameData[p] !== undefined) {
          const v = Number(this.currentFrameData[p]);
          if (!isNaN(v)) return v;
        }
      }
      return fallback;
    };

    let x = getVal(["Drive/Pose_X", "Drive/Odom_X", "Drive/PoseX", "PoseX", "x"], 0.0);
    let y = getVal(["Drive/Pose_Y", "Drive/Odom_Y", "Drive/PoseY", "PoseY", "y"], 0.0);
    let heading = getVal(["Drive/Drive_Heading", "Drive/Pose_Heading", "Drive/Odom_Heading", "PoseHeading", "heading"], 0.0);

    // Look for pose array overrides
    const poseArrayKeys = [
      "AdvantageKit/RealOutputs/ARES/EstimatedPose",
      "AdvantageKit/RealOutputs/ARES/TargetPose",
      "AdvantageScope/RobotPose",
      "AdvantageScope/RawOdomPose",
      "AdvantageScope/VisionPose",
      "estimatedPose",
      "targetPose",
      "RealOutputs/ARES/EstimatedPose",
      "RealOutputs/ARES/TargetPose",
      "ARES/EstimatedPose",
      "ARES/TargetPose"
    ];
    for (const key of poseArrayKeys) {
      const arr = this.currentFrameData[key];
      if (Array.isArray(arr) && arr.length >= 3) {
        x = Number(arr[0]) || 0;
        y = Number(arr[1]) || 0;
        heading = Number(arr[2]) || 0;
        break;
      }
    }

    // Ensure coordinate metrics are stored as raw center-origin meters.
    // If coordinates look like bottom-left inches (large values), convert to center-origin meters:
    if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
      const tempX = x;
      x = (y - 72) / 39.3701;
      y = -(tempX - 72) / 39.3701;
      heading = heading - Math.PI / 2;
    }

    const frame: TelemetryFrame = {
      timestamp: timestamp,
      x: x,
      y: y,
      heading: heading,
      values
    };

    this.onFrame(frame);
  }

  publishValue(key: string, value: any, type: string = "double") {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const pubuid = Math.floor(Math.random() * 1000000);
    const cleanKey = key.startsWith("/") ? key : `/${key}`;

    const pubMsg = [
      {
        method: "publish",
        params: {
          name: cleanKey,
          type: type,
          pubuid: pubuid
        },
        uid: Math.floor(Math.random() * 10000)
      }
    ];

    try {
      this.ws.send(JSON.stringify(pubMsg));

      const setMsg = [
        {
          method: "set",
          params: {
            pubuid: pubuid,
            value: value
          },
          uid: Math.floor(Math.random() * 10000)
        }
      ];
      this.ws.send(JSON.stringify(setMsg));

      const unpubMsg = [
        {
          method: "unpublish",
          params: {
            pubuid: pubuid
          },
          uid: Math.floor(Math.random() * 10000)
        }
      ];
      this.ws.send(JSON.stringify(unpubMsg));
      console.log(`[NT4Client] Published value ${value} to key ${cleanKey}`);
    } catch (e) {
      console.error("[NT4Client] Failed to send publish messages over WebSocket:", e);
    }
  }
}

