// Competition Manual V1, seconds from the start of AUTO.
export const MATCH_TIME = { autoEnd:30, teleopStart:38, nectarStart:98, end:158, settleEnd:168 } as const;
export function nectarPlacementOpen(timed:boolean,tick:number) {
  return !timed || tick>=MATCH_TIME.nectarStart*60;
}
