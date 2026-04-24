import { initQueryClient } from "@ts-rest/react-query";
import { apiContract } from "../schemas/contracts";

export { fetchBlob, uploadFile, fetchJson } from "../utils/apiClient";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  console.log("TS-REST FETCH:", input);
  return originalFetch(input, init);
};

export const api = initQueryClient(apiContract, {
  baseUrl: "/api",
  baseHeaders: {
    "Content-Type": "application/json",
  },
  api: async (args) => {
    const originalFetch = globalThis.fetch;
    console.log("ts-rest fetching:", args.path);
    const res = await originalFetch(args.path, {
      method: args.method,
      headers: args.headers,
      body: args.body as any,
    });
    
    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    
    console.log("ts-rest response body:", body);
    
    return {
      status: res.status,
      body,
      headers: res.headers,
    };
  }
});

