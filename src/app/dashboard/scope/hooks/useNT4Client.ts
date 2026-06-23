import { useState, useRef, useEffect } from "react";
import { useScopeStore } from "../store/scopeStore";
import { NT4Client } from "../store/nt4Client";

export function useNT4Client() {
  const {
    isStreaming,
    setStreaming,
    setStreamSource,
    setConnectionStatus,
    setTelemetryData,
    setPlaying,
    addLiveFrame,
    setNtClient
  } = useScopeStore();

  const [ipAddress, setIpAddress] = useState("192.168.43.1");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [directConnect, setDirectConnect] = useState(false);
  const ntClientRef = useRef<NT4Client | null>(null);

  const handleConnectLive = (targetIp?: string) => {
    const connectIp = targetIp || ipAddress;
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
    }

    setStreaming(true);
    setStreamSource("local");
    setTelemetryData(null); // Clear static log logs
    setPlaying(false);

    const client = new NT4Client(
      connectIp,
      (frame) => {
        addLiveFrame(frame);
      },
      (status) => {
        setConnectionStatus(status);
      },
      directConnect
    );

    ntClientRef.current = client;
    setNtClient(client);
    client.connect();
    setShowLiveModal(false);
  };

  const handleDisconnectLive = () => {
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
      ntClientRef.current = null;
    }
    setNtClient(null);
    setStreaming(false);
    setStreamSource(null);
    setConnectionStatus("disconnected");
  };

  useEffect(() => {
    return () => {
      if (ntClientRef.current) {
        ntClientRef.current.disconnect();
      }
      setNtClient(null);
    };
  }, [setNtClient]);

  const handlePublishValue = (key: string, value: any, type: string) => {
    if (ntClientRef.current) {
      ntClientRef.current.publishValue(key, value, type);
    } else {
      console.log(`[Tuner Offline] Tuning ${key} to ${value} (${type})`);
    }
  };

  return {
    ipAddress,
    setIpAddress,
    showLiveModal,
    setShowLiveModal,
    directConnect,
    setDirectConnect,
    ntClientRef,
    handleConnectLive,
    handleDisconnectLive,
    handlePublishValue
  };
}
