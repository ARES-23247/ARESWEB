import { afterEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock("./api",()=>({authenticatedFetch:mocks.fetch}));
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();mocks.fetch.mockReset();});
describe("BIOBUZZ authenticated admission",()=>{
  it("keeps local play independent of an unconfigured service",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","");expect((await import("./biobuzzOnline")).biobuzzOnline).toBeUndefined();
  });
  it("uses the site transport and accepts only its exact WebSocket address",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","https://sim.example/");
    const {biobuzzOnline:client}=await import("./biobuzzOnline");
    const result={socketUrl:"wss://sim.example/play",token:"private-memory-only"};
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>result});
    expect(await client!.admit("create")).toEqual(result);
    expect(mocks.fetch).toHaveBeenLastCalledWith("https://sim.example/api/biobuzz/create",expect.objectContaining({body:"{}",method:"POST"}));
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>({...result,socketUrl:"wss://attacker.example/play"})});
    await expect(client!.admit("join",{code:"AABBCCDD"})).rejects.toThrow("Unexpected");
    mocks.fetch.mockResolvedValue({ok:false,json:async()=>({error:"At capacity"})});await expect(client!.admit("queue")).rejects.toThrow("At capacity");
    mocks.fetch.mockResolvedValue({ok:false,json:async()=>({})});await expect(client!.admit("queue")).rejects.toThrow("unavailable");
  });
  it("supports the explicitly configured local service",async()=>{
    vi.stubEnv("VITE_BIOBUZZ_ORIGIN","http://127.0.0.1:3027");
    mocks.fetch.mockResolvedValue({ok:true,json:async()=>({socketUrl:"ws://127.0.0.1:3027/play"})});
    expect(await (await import("./biobuzzOnline")).biobuzzOnline!.admit("queue")).toHaveProperty("socketUrl");
  });
});
