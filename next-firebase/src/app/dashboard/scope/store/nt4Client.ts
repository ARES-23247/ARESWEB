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

    // Send subscribe message for all topics prefix-matched (use "" to include non-slash topics)
    const subMsg = [
      {
        method: "subscribe",
        params: {
          topics: [""],
          subuid: 1,
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
      const decoder = new MsgPackDecoder(buffer);
      while (decoder.hasMore()) {
        const msg = decoder.decode();
        if (Array.isArray(msg) && msg.length === 4) {
          const [topicId, timestampUs, typeId, value] = msg;
          const name = this.topicNames.get(topicId);
          if (name) {
            // NT4 timestamp is in microseconds, convert to milliseconds
            const msgTimestampMs = Number(timestampUs) / 1000;
            this.processTelemetryKey(name, value, msgTimestampMs);
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

    // Normalization bridge for swerve module state arrays:
    if (cleanKey === "AdvantageKit/RealOutputs/Swerve/ModuleAnglesActual" && Array.isArray(value) && value.length === 4) {
      this.currentFrameData["Drive/Swerve/Angle_FL"] = value[0];
      this.currentFrameData["Drive/Swerve/Angle_FR"] = value[1];
      this.currentFrameData["Drive/Swerve/Angle_BL"] = value[2];
      this.currentFrameData["Drive/Swerve/Angle_BR"] = value[3];
    }
    if (cleanKey === "AdvantageKit/RealOutputs/Swerve/ModuleAnglesTarget" && Array.isArray(value) && value.length === 4) {
      this.currentFrameData["Drive/Swerve/AngleTarget_FL"] = value[0];
      this.currentFrameData["Drive/Swerve/AngleTarget_FR"] = value[1];
      this.currentFrameData["Drive/Swerve/AngleTarget_BL"] = value[2];
      this.currentFrameData["Drive/Swerve/AngleTarget_BR"] = value[3];
    }
    if (cleanKey === "AdvantageKit/RealOutputs/Swerve/ModuleSpeedsActual" && Array.isArray(value) && value.length === 4) {
      this.currentFrameData["Drive/Swerve/Speed_FL"] = value[0];
      this.currentFrameData["Drive/Swerve/Speed_FR"] = value[1];
      this.currentFrameData["Drive/Swerve/Speed_BL"] = value[2];
      this.currentFrameData["Drive/Swerve/Speed_BR"] = value[3];
    }

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

class MsgPackDecoder {
  private view: DataView;
  private offset: number = 0;

  constructor(private buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  hasMore(): boolean {
    return this.offset < this.view.byteLength;
  }

  decode(): any {
    if (this.offset >= this.view.byteLength) {
      throw new Error("Out of bounds");
    }

    const b = this.view.getUint8(this.offset++);

    // Positive fixint
    if ((b & 0x80) === 0x00) {
      return b;
    }

    // Fixmap
    if ((b & 0xf0) === 0x80) {
      const len = b & 0x0f;
      const map: Record<string, any> = {};
      for (let i = 0; i < len; i++) {
        const key = this.decode();
        const val = this.decode();
        map[String(key)] = val;
      }
      return map;
    }

    // Fixarray
    if ((b & 0xf0) === 0x90) {
      const len = b & 0x0f;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.decode());
      }
      return arr;
    }

    // Fixstr
    if ((b & 0xe0) === 0xa0) {
      const len = b & 0x1f;
      return this.decodeString(len);
    }

    // Nil
    if (b === 0xc0) {
      return null;
    }

    // False / True
    if (b === 0xc2) return false;
    if (b === 0xc3) return true;

    // Bin 8, Bin 16, Bin 32
    if (b === 0xc4) {
      const len = this.view.getUint8(this.offset);
      this.offset += 1;
      return this.decodeBinary(len);
    }
    if (b === 0xc5) {
      const len = this.view.getUint16(this.offset, false);
      this.offset += 2;
      return this.decodeBinary(len);
    }
    if (b === 0xc6) {
      const len = this.view.getUint32(this.offset, false);
      this.offset += 4;
      return this.decodeBinary(len);
    }

    // Float 32 / 64
    if (b === 0xca) {
      const val = this.view.getFloat32(this.offset, false);
      this.offset += 4;
      return val;
    }
    if (b === 0xcb) {
      const val = this.view.getFloat64(this.offset, false);
      this.offset += 8;
      return val;
    }

    // Uint 8, 16, 32, 64
    if (b === 0xcc) {
      const val = this.view.getUint8(this.offset);
      this.offset += 1;
      return val;
    }
    if (b === 0xcd) {
      const val = this.view.getUint16(this.offset, false);
      this.offset += 2;
      return val;
    }
    if (b === 0xce) {
      const val = this.view.getUint32(this.offset, false);
      this.offset += 4;
      return val;
    }
    if (b === 0xcf) {
      let val = 0;
      if (typeof this.view.getBigUint64 === "function") {
        val = Number(this.view.getBigUint64(this.offset, false));
      } else {
        const high = this.view.getUint32(this.offset, false);
        const low = this.view.getUint32(this.offset + 4, false);
        val = high * 4294967296 + low;
      }
      this.offset += 8;
      return val;
    }

    // Int 8, 16, 32, 64
    if (b === 0xd0) {
      const val = this.view.getInt8(this.offset);
      this.offset += 1;
      return val;
    }
    if (b === 0xd1) {
      const val = this.view.getInt16(this.offset, false);
      this.offset += 2;
      return val;
    }
    if (b === 0xd2) {
      const val = this.view.getInt32(this.offset, false);
      this.offset += 4;
      return val;
    }
    if (b === 0xd3) {
      let val = 0;
      if (typeof this.view.getBigInt64 === "function") {
        val = Number(this.view.getBigInt64(this.offset, false));
      } else {
        const high = this.view.getInt32(this.offset, false);
        const low = this.view.getUint32(this.offset + 4, false);
        val = high * 4294967296 + low;
      }
      this.offset += 8;
      return val;
    }

    // Str 8, 16, 32
    if (b === 0xd9) {
      const len = this.view.getUint8(this.offset);
      this.offset += 1;
      return this.decodeString(len);
    }
    if (b === 0xda) {
      const len = this.view.getUint16(this.offset, false);
      this.offset += 2;
      return this.decodeString(len);
    }
    if (b === 0xdb) {
      const len = this.view.getUint32(this.offset, false);
      this.offset += 4;
      return this.decodeString(len);
    }

    // Array 16 / 32
    if (b === 0xdc) {
      const len = this.view.getUint16(this.offset, false);
      this.offset += 2;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.decode());
      }
      return arr;
    }
    if (b === 0xdd) {
      const len = this.view.getUint32(this.offset, false);
      this.offset += 4;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.decode());
      }
      return arr;
    }

    // Map 16 / 32
    if (b === 0xde) {
      const len = this.view.getUint16(this.offset, false);
      this.offset += 2;
      const map: Record<string, any> = {};
      for (let i = 0; i < len; i++) {
        const key = this.decode();
        const val = this.decode();
        map[String(key)] = val;
      }
      return map;
    }
    if (b === 0xdf) {
      const len = this.view.getUint32(this.offset, false);
      this.offset += 4;
      const map: Record<string, any> = {};
      for (let i = 0; i < len; i++) {
        const key = this.decode();
        const val = this.decode();
        map[String(key)] = val;
      }
      return map;
    }

    // Negative fixint
    if ((b & 0xe0) === 0xe0) {
      return b - 256;
    }

    throw new Error(`Unsupported MsgPack type: 0x${b.toString(16)}`);
  }

  private decodeString(length: number): string {
    if (this.offset + length > this.view.byteLength) {
      throw new Error("String out of bounds");
    }
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  private decodeBinary(length: number): Uint8Array {
    if (this.offset + length > this.view.byteLength) {
      throw new Error("Binary out of bounds");
    }
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }
}

