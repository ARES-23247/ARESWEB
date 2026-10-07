import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),appCheck:vi.fn()}));
vi.mock("./firebaseAppCheck",()=>({getAppCheckHeader:mocks.appCheck}));
beforeEach(()=>{vi.stubGlobal("fetch",mocks.fetch);mocks.appCheck.mockResolvedValue({"X-Firebase-AppCheck":"app-check-token"});});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();mocks.fetch.mockReset();mocks.appCheck.mockReset();});
describe("BIOBUZZ App-Checked admission",()=>{
  it("keeps local play independent of an unconfigured service",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","");expect((await import("./biobuzzOnline")).biobuzzOnline).toBeUndefined();
  });
  it("sends App Check but never the Firebase ID token, and accepts only its exact WebSocket address",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","https://sim.example/");
    const {biobuzzOnline:client}=await import("./biobuzzOnline");
    const result={socketUrl:"wss://sim.example/play",token:"private-memory-only"};
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>result});
    expect(await client!.admit("create")).toEqual(result);
    expect(mocks.fetch).toHaveBeenLastCalledWith("https://sim.example/api/biobuzz/create",expect.objectContaining({body:"{}",method:"POST"}));
    const headers=new Headers(mocks.fetch.mock.lastCall?.[1]?.headers);
    expect(headers.get("X-Firebase-AppCheck")).toBe("app-check-token");expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("Authorization")).toBe(false);
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>({...result,socketUrl:"wss://attacker.example/play"})});
    await expect(client!.admit("join",{code:"AABBCCDD"})).rejects.toThrow("Unexpected");
    mocks.fetch.mockResolvedValue({ok:false,json:async()=>({error:"At capacity"})});await expect(client!.admit("queue")).rejects.toThrow("At capacity");
    mocks.fetch.mockResolvedValue({ok:false,json:async()=>({})});await expect(client!.admit("queue")).rejects.toThrow("unavailable");
  });
  it("supports the explicitly configured local service without App Check",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","http://127.0.0.1:3027");mocks.appCheck.mockResolvedValue({});
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>({socketUrl:"ws://127.0.0.1:3027/play"})});
    expect(await (await import("./biobuzzOnline")).biobuzzOnline!.admit("queue")).toHaveProperty("socketUrl");
    expect(new Headers(mocks.fetch.mock.lastCall?.[1]?.headers).has("X-Firebase-AppCheck")).toBe(false);
  });
});
