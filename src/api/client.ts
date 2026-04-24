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
});

