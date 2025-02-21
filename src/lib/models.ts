// Python Models
// These have to match the models in models.py

import { UUID } from "crypto";

type Action =
  | "set_file_path"
  | "get_file_path"
  | "set_file_settings"
  | "set_algorithm_settings"
  | "run_clustering"
  | "get_runs"
  | "get_current_run"
  | "set_run_id"
  | "reset_run_id"
  | "update_run_name"
  | "get_cluster_assignments"
  | "get_cluster_similarities"
  | "update_cluster_name"
  | "delete_run"
  | "get_outliers"
  | "get_mergers";

export interface ClusterNamePayload {
  clusterId: UUID;
  name: string;
}

export interface Command {
  action: Action;
  data?:
    | { filePath: string }
    | FileSettings
    | AlgorithmSettings
    | null
    | { runId: UUID }
    | { runId: UUID; name: string }
    | ClusterNamePayload;
}

export type ClusteringStep =
  | "start"
  | "process_input_file"
  | "load_model"
  | "embed_responses"
  | "detect_outliers"
  | "auto_cluster_count"
  | "cluster"
  | "merge"
  | "save";

export interface ProgressMessage {
  step: ClusteringStep | Action | "init";
  status: "todo" | "start" | "complete" | "error";
  timestamp: number;
}

export interface ClusteringProgressMessage {
  step: ClusteringStep;
  status: "todo" | "start" | "complete" | "error";
  timestamp: number;
}

export interface CurrentRunMessage {
  run: Run;
  timesteps: Timesteps;
}

export interface _ClusterAssignmentDetail {
  id: UUID;
  index: number;
  name: string;
  is_merger_result: boolean;
  responses: Response[];
  count: number;
}

export interface ClusterAssignmentsMessage {
  clusters: _ClusterAssignmentDetail[];
}

export interface _ClusterSimilarityDetail {
  id: UUID;
  index: number;
  name: string;
  is_merger_result: boolean;
  responses: Response[];
  similarity_pairs: Record<UUID, number>;
  count: number;
}

export interface ClusterSimilaritiesMessage {
  clusters: _ClusterSimilarityDetail[];
}

export interface _OutlierDetail {
  id: UUID;
  response: Response;
  similarity: number;
}

export interface OutliersMessage {
  outliers: _OutlierDetail[];
  threshold: number;
}

export interface _ClusterMergerDetail {
  id: UUID;
  index: number;
  name: string;
  responses: Response[];
  count: number;
}

export interface _MergerDetail {
  id: UUID;
  name: string;
  clusters: _ClusterMergerDetail[];
  similarity_pairs: SimilarityPair[];
}

export interface MergersMessage {
  mergers: _MergerDetail[];
  threshold: number;
}

export interface Error {
  error: string;
}

export interface Message {
  type:
    | "progress"
    | "error"
    | "file_path"
    | "runs"
    | "run"
    | "cluster_assignments"
    | "cluster_similarities"
    | "outliers"
    | "mergers";
  data:
    | ProgressMessage
    | Error
    | string
    | null
    | Run[]
    | ClusterAssignmentsMessage
    | ClusterSimilaritiesMessage
    | CurrentRunMessage
    | OutliersMessage
    | MergersMessage;
}

export interface FileSettings {
  delimiter: string;
  has_header: boolean;
  selected_columns: number[];
}

export interface AutomaticClusterCount {
  cluster_count_method: "auto";
  max_clusters: number;
}

interface ManualClusterCount {
  cluster_count_method: "manual";
  cluster_count: number;
}

export type ClusterCount = AutomaticClusterCount | ManualClusterCount;

export interface OutlierDetectionSettings {
  nearest_neighbors: number;
  z_score_threshold: number;
}

export interface AgglomerativeClusteringSettings {
  similarity_threshold: number;
}

export interface AlgorithmSettings {
  method: ClusterCount;
  excluded_words: string[];
  seed?: number;
  outlier_detection?: OutlierDetectionSettings;
  agglomerative_clustering?: AgglomerativeClusteringSettings;
}

export interface Response {
  id: UUID;
  text: string;
  embedding: number[] | null;
  is_outlier: boolean;
  similarity: number | null;
  count: number;
  cluster_id: UUID | null;
  cluster: Cluster | null;
  outlier_statistic: OutlierStatistic | null;
}

export interface Cluster {
  id: UUID;
  index: number;
  name: string;
  center: number[];
  responses: Response[];
  count: number;
  is_merger_result: boolean;

  result_id: UUID;
  result: ClusteringResult;

  merger_id: UUID;
  merger: Merger;

  similarity_pair_id: UUID;
  similarity_pair: SimilarityPair;
}

interface OutlierStatistic {
  id: UUID;
  similarity: number;

  response_id: UUID;
  response: Response;

  outlier_statistics_id: UUID;
  outlier_statistics: OutlierStatistics;
}

interface OutlierStatistics {
  id: UUID;
  threshold: number;
  outliers: OutlierStatistic[];

  clustering_result_id: UUID;
  clustering_result: ClusteringResult;
}

export interface SimilarityPair {
  id: UUID;
  similarity: number;

  cluster_1_id: UUID;
  cluster_2_id: UUID;

  cluster_1: Cluster;
  cluster_2: Cluster;

  merger_id: UUID;
  merger: Merger;

  result_id: UUID;
  result: ClusteringResult;
}

interface Merger {
  id: UUID;
  name: string;
  clusters: Cluster[];
  similarity_pairs: SimilarityPair[];

  merging_statistics_id: UUID;
  merging_statistics: MergingStatistics;
}

interface MergingStatistics {
  id: UUID;
  threshold: number;
  mergers: Merger[];

  clustering_result_id: UUID;
  clustering_result: ClusteringResult;
}

export interface Timesteps {
  id: UUID;
  total_duration: number;
  steps: Record<ClusteringStep, number>;
}

export interface ClusteringResult {
  id: UUID;
  clusters: Cluster[];
  outlier_statistics: OutlierStatistics;
  merger_statistics: MergingStatistics;
  inter_cluster_similarities: SimilarityPair[];
  timesteps: Timesteps;
  run_id: UUID;
  run: Run;
  all_responses: Response[];
}

export interface Run {
  id: UUID;
  name: string;
  file_path: string;
  output_file_path: string;
  assignments_file_path: string;
  created_at: number;
  file_settings: string; // FileSettings;
  algorithm_settings: string; //AlgorithmSettings;
}

// Frontend-only models

export const progressionMessages: Record<ClusteringStep, string> = {
  start: "Starting clustering process",
  process_input_file: "Reading input file",
  load_model: "Loading language model",
  embed_responses: "Embedding responses",
  detect_outliers: "Detecting outliers",
  auto_cluster_count: "Determining cluster count",
  cluster: "Clustering",
  merge: "Merging clusters",
  save: "Saving results",
};

export interface AppSettings {
  darkMode: boolean;
  tutorialMode: boolean;
}

declare global {
  interface Window {
    electron: {
      showFilePath: (file: File) => string;
      showItemInFolder: (path: string) => void;
      readFile: (path: string) => Promise<string>;
      getLogsPath: () => Promise<string>;
      getLocale: () => Promise<string>;
      openUrl: (url: string) => void;
      setTitleBarMask: (mask: boolean) => void;
    };
    settings: {
      getAll: () => Promise<AppSettings>;
      setDarkMode: (darkMode: boolean) => void;
      setTutorialMode: (tutorialMode: boolean) => void;
      onSettingsChanged: (
        callback: (settings: AppSettings) => void
      ) => () => void;
    };
    file: {
      // Consider making this a promise-returning function
      setPath: (path: string) => void;
      requestPath: () => void;
      onReceivePath: (callback: (path: string) => void) => () => void;
      setSettings: (settings: FileSettings) => void;
      getExampleFilePath: () => Promise<string>;
    };
    algorithm: {
      setSettings: (settings: AlgorithmSettings) => void;
      runClustering: () => void;
    };
    progress: {
      onClusteringUpdate: (
        callback: (progress: ClusteringProgressMessage) => void
      ) => () => void;
    };
    database: {
      requestAllRuns: () => void;
      onReceiveAllRuns: (callback: (runs: Run[]) => void) => () => void;
      requestCurrentRun: () => void;
      onReceiveCurrentRun: (
        callback: (currentRun: CurrentRunMessage) => void
      ) => () => void;
      updateRunName: (runId: UUID, name: string) => void;
      requestCurrentClusterAssignments: () => void;
      onReceiveCurrentClusterAssignments: (
        callback: (clusterAssignemnts: ClusterAssignmentsMessage) => void
      ) => () => void;
      requestCurrentClusterSimilarities: () => void;
      onReceiveCurrentClusterSimilarities: (
        callback: (clusterSimilarities: ClusterSimilaritiesMessage) => void
      ) => () => void;
      updateClusterName: (payload: ClusterNamePayload) => void;
      deleteRun: (runId: UUID) => void;
      requestCurrentOutliers: () => void;
      onReceiveCurrentOutliers: (
        callback: (outliers: OutliersMessage) => void
      ) => () => void;
      requestCurrentMergers: () => void;
      onReceiveCurrentMergers: (
        callback: (mergers: MergersMessage) => void
      ) => () => void;
    };
    state: {
      setRunId: (runId: UUID) => void;
      resetRunId: () => void;
    };
  }
}

export const CHANNEL_TYPES = {
  ELECTRON: "electron",
  SETTINGS: "settings",
  FILE: "file",
  ALGORITHM: "algorithm",
  PROGRESS: "progress",
  DATABASE: "database",
  STATE: "state",
};
export const CHANNELS = {
  ELECTRON: {
    READ_FILE: "electron:read-file",
    GET_LOGS_PATH: "electron:get-logs-path",
    SHOW_ITEM_IN_FOLDER: "electron:show-item-in-folder",
    GET_LOCALE: "electron:get-locale",
    OPEN_URL: "electron:open-url",
    SET_TITLE_BAR_MASK: "electron:set-title-bar-mask",
  },
  SETTINGS: {
    GET_ALL: "settings:get-all",
    SET_DARK_MODE: "settings:set-dark-mode",
    SET_TUTORIAL_MODE: "settings:set-tutorial-mode",
    SETTINGS_CHANGED: "settings:settings-changed",
  },
  FILE: {
    SET_PATH: "file:set-path",
    PATH_REQUEST: "file:get-path",
    PATH_RESPONSE: "file:path",
    SET_SETTINGS: "file:set-settings",
    EXAMPLE_FILE_PATH: "file:example-file-path",
  },
  ALGORITHM: {
    SET_SETTINGS: "algorithm:set-settings",
    RUN_CLUSTERING: "algorithm:run-clustering",
  },
  CLUSTERING_PROGRESS: {
    UPDATE: "cluster-progress:update",
  },
  DATABASE: {
    ALL_RUNS_REQUEST: "database:all-runs-request",
    ALL_RUNS_RESPONSE: "database:all-runs-response",
    CURRENT_RUN_REQUEST: "database:current-run-request",
    CURRENT_RUN_RESPONSE: "database:current-run-response",
    UPDATE_RUN_NAME: "database:update-run-name",
    CURRENT_CLUSTER_ASSIGNMENTS_REQUEST: "database:current-clusters-request",
    CURRENT_CLUSTER_ASSIGNMENTS_RESPONSE: "database:current-clusters-response",
    CURRENT_CLUSTER_SIMILARITIES_REQUEST:
      "database:current-cluster-similarities-request",
    CURRENT_CLUSTER_SIMILARITIES_RESPONSE:
      "database:current-cluster-similarities-response",
    UPDATE_CLUSTER_NAME: "database:update-cluster-name",
    DELETE_RUN: "database:delete-run",
    CURRENT_OUTLIERS_REQUEST: "database:current-outliers-request",
    CURRENT_OUTLIERS_RESPONSE: "database:current-outliers-response",
    CURRENT_MERGERS_REQUEST: "database:current-mergers-request",
    CURRENT_MERGERS_RESPONSE: "database:current-mergers-response",
  },
  STATE: {
    SET_RUN_ID: "state:set-run-id",
    RESET_RUN_ID: "state:reset-run-id",
  },
};

export const PYTHON_SERVICE_EVENTS = {
  ERROR: "error",
  FILE_PATH: "file-path",
  ClUSTERING_PROGRESS: "cluster-progress",
  DATABASE: {
    ALL_RUNS: "database-all-runs",
    CURRENT_RUN: "database-current-run",
    CURRENT_CLUSTER_ASSIGNMENTS: "database-current-clusters",
    CURRENT_CLUSTER_SIMILARITIES: "database-current-cluster-similarities",
    CURRENT_OUTLIERS: "database-current-outliers",
    CURRENT_MERGERS: "database-current-mergers",
  },
  READY: "ready",
};

export const SETTINGS_SERVICE_EVENTS = {
  SETTINGS_CHANGED: "settings-changed",
};
