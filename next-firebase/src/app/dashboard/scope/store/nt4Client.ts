import { TelemetryFrame } from "./scopeStore";

/**
 * Pure TypeScript client for FRC/FTC NetworkTables v4 over WebSockets.
 * Handles handshakes, topic announcements, and throttled update-dispatching.
 */
export class NT4Client {
  private ws: WebSocket | null = null;
  private topicNames = new Map<number, string>();
  private topicTypes = new Map<number, string>();
  private currentFrameData: Record<string, any> = {};
  private lastTimestamp = 0;
  private reconnectTimeout: any = null;
  private destroyed = false;

  constructor(
    private host: string,
    private onFrame: (frame: TelemetryFrame) => void,
    private onStatusChange: (status: "disconnected" | "connecting" | "connected") => void
  ) {}

  connect() {
    if (this.destroyed) return;
    this.onStatusChange("connecting");

    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    const scheme = isSecure ? "wss" : "ws";
    const port = isSecure ? 5811 : 5810;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      // Use the official networktables.org sub-protocol
      this.ws = new WebSocket(`${scheme}://${this.host}:${port}/nt/v4/websocket`, ["networktables.org"]);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.onStatusChange("connected");
        this.subscribeAll();
        console.log(`[NT4Client] Connected to NT4 server at ${this.host}:${port}`);
      };

      this.ws.onclose = () => {
        this.onStatusChange("disconnected");
        console.log("[NT4Client] Disconnected from NT4 server.");
        this.scheduleReconnect();
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
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimeout) return;

    console.log("[NT4Client] Scheduling reconnect in 1.5 seconds...");
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 1500);
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
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
          const { name, id, type } = msg.params;
          this.topicNames.set(id, name);
          if (type) {
            this.topicTypes.set(id, type);
          }
        } else if (msg.topic !== undefined && msg.value !== undefined) {
          // Value update
          const name = this.topicNames.get(msg.topic);
          if (name) {
            const timestampMs = msg.timestamp ? Number(msg.timestamp) / 1000 : Date.now();
            this.processTelemetryKey(name, msg.value, timestampMs);
          }
        }
      }
    } catch (e) {
      console.error("[NT4Client] Failed to parse JSON message:", e);
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    try {
      const view = new DataView(buffer);
      if (buffer.byteLength < 16) return;

      const typeId = view.getUint8(0);
      const topicId = view.getInt32(4, true); // NT4 uses little-endian byte ordering
      const name = this.topicNames.get(topicId);
      if (!name) return;

      // Bytes 8..15: NT4 timestamp in microseconds
      let msgTimestampMs = Date.now();
      try {
        if (typeof view.getBigInt64 === "function") {
          msgTimestampMs = Number(view.getBigInt64(8, true)) / 1000;
        } else {
          const low = view.getUint32(8, true);
          const high = view.getUint32(12, true);
          msgTimestampMs = (high * 4294967296 + low) / 1000;
        }
      } catch (e) {
        // use Date.now() on error
      }

      const typeStr = this.topicTypes.get(topicId);
      const payloadLength = buffer.byteLength - 16;

      // Determine decoding path: prioritize announced typeStr, fallback to typeId heuristically
      let isDouble = false;
      let isDoubleArray = false;
      let isFloat = false;
      let isFloatArray = false;
      let isInt = false;

      if (typeStr) {
        isDouble = typeStr === "double";
        isDoubleArray = typeStr === "double[]" || name.includes("Pose") || name.includes("Swerve");
        isFloat = typeStr === "float";
        isFloatArray = typeStr === "float[]";
        isInt = typeStr === "int" || typeStr === "integer";
      } else {
        isDoubleArray = typeId === 6 || typeId === 7 || name.includes("Pose") || name.includes("Swerve");
        isDouble = typeId === 1 || (typeId === 2 && !isDoubleArray);
        isFloat = typeId === 3 || typeId === 10;
        isFloatArray = typeId === 9 || typeId === 12;
        isInt = typeId === 2 || typeId === 9;
      }

      if (isDoubleArray) {
        const arrayLength = Math.floor(payloadLength / 8);
        if (arrayLength <= 0) return;

        const values: number[] = [];
        for (let i = 0; i < arrayLength; i++) {
          const offset = 16 + i * 8;
          if (offset + 8 <= buffer.byteLength) {
            values.push(view.getFloat64(offset, true));
          }
        }
        // If it was announced as a single double, pass it as a plain number, otherwise keep it as an array
        const processedValue = (arrayLength === 1 && (typeId === 1 || typeId === 2 || typeStr === "double")) ? values[0] : values;
        this.processTelemetryKey(name, processedValue, msgTimestampMs);
      } else if (isDouble) {
        if (payloadLength >= 8 && 16 + 8 <= buffer.byteLength) {
          const val = view.getFloat64(16, true);
          this.processTelemetryKey(name, val, msgTimestampMs);
        }
      } else if (isFloatArray) {
        const arrayLength = Math.floor(payloadLength / 4);
        if (arrayLength <= 0) return;

        const values: number[] = [];
        for (let i = 0; i < arrayLength; i++) {
          const offset = 16 + i * 4;
          if (offset + 4 <= buffer.byteLength) {
            values.push(view.getFloat32(offset, true));
          }
        }
        this.processTelemetryKey(name, values, msgTimestampMs);
      } else if (isFloat) {
        if (payloadLength >= 4 && 16 + 4 <= buffer.byteLength) {
          const val = view.getFloat32(16, true);
          this.processTelemetryKey(name, val, msgTimestampMs);
        }
      } else if (isInt) {
        if (payloadLength >= 8 && 16 + 8 <= buffer.byteLength) {
          if (typeof view.getBigInt64 === "function") {
            const val = Number(view.getBigInt64(16, true));
            this.processTelemetryKey(name, val, msgTimestampMs);
          } else {
            const val = view.getInt32(16, true);
            this.processTelemetryKey(name, val, msgTimestampMs);
          }
        }
      }
    } catch (e) {
      console.error("[NT4Client] Error in handleBinaryMessage:", e);
    }
  }

  private processTelemetryKey(key: string, value: any, msgTimestampMs: number = Date.now()) {
    // Strip leading slash if present in topic name
    const cleanKey = key.startsWith("/") ? key.substring(1) : key;
    this.currentFrameData[cleanKey] = value;

    // Use TimestampMs key or pose updates as the trigger to flush/emit the frame
    const isFrameTrigger = 
      cleanKey === "TimestampMs" || 
      cleanKey.endsWith("/TimestampMs") || 
      cleanKey === "drive/TimestampMs" || 
      cleanKey.endsWith("EstimatedPose") || 
      cleanKey.endsWith("RobotState") ||
      cleanKey === "AdvantageScope/RobotPose" ||
      cleanKey === "Drive/Pose_X";

    if (isFrameTrigger) {
      let currentTimestamp = msgTimestampMs;
      // If we explicitly received a timestamp topic, prioritize the parsed value if valid
      if (cleanKey === "TimestampMs" || cleanKey.endsWith("/TimestampMs") || cleanKey === "drive/TimestampMs") {
        const parsedVal = Number(value);
        if (!isNaN(parsedVal) && parsedVal !== 0) {
          currentTimestamp = parsedVal;
        }
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

