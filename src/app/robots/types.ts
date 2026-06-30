export interface RobotVersion {
  name: string;
  weightLbs?: number;
  drivetrainType?: string;
  cadViewerUrl?: string;
  primaryMechanism?: string;
  content: string;
}

export interface RobotItem {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  weightLbs?: number;
  drivetrainType?: string;
  programmingLanguage?: string;
  revealVideoId?: string;
  onshapeUrl?: string;
  cadViewerUrl?: string;
  primaryMechanism?: string;
  content?: string;
  versions?: RobotVersion[];
}
