import JSZip from "jszip";
import { nativeAuto } from "./core/auto";
import type { AutoProgram } from "./core/types";
export async function exportAuto(program: AutoProgram): Promise<Blob> {
  const id = "biobuzz-" + crypto.randomUUID();
  const { routine, catalog } = nativeAuto(program, id);
  const zip = new JSZip();
  zip.file(".ares/routines/" + id + ".aresroutine", JSON.stringify(routine, null, 2));
  zip.file(".ares/autonomous-catalog.json", JSON.stringify(catalog, null, 2));
  zip.file("README.txt", "BIOBUZZ auto. Import this ZIP in ARES Studio's auto editor with a BIOBUZZ RobotBuilder project open.\n");
  return zip.generateAsync({ type: "blob" });
}
