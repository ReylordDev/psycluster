import { useNavigate } from "react-router";
import { TitleBar } from "../../components/TitleBar";
import {
  Pencil,
  Save,
  ChevronDown,
  List,
  GitCompare,
  AlertTriangle,
  GitMerge,
  CheckCheck,
  FolderOpen,
  Play,
  Loader,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { formatTime, iterateRecord } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

import { TooltipWrapper } from "../../components/Tooltip";
import { progressionMessages, Run, Timesteps } from "../../lib/models";
import { Progress } from "../../components/ui/progress";
import { Input } from "../../components/ui/input";

export default function Results() {
  const [run, setRun] = useState<Run | null>(null);
  const [timesteps, setTimesteps] = useState<Timesteps | null>(null);
  const [runName, setRunName] = useState<string | null>(null);
  const [runNameInput, setRunNameInput] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isValidRunName, setIsValidRunName] = useState(false);
  const navigate = useNavigate();

  function validateRunName(newName: string) {
    if (!newName) return false;
    if (newName.length > 255) return false;
    return true;
  }

  const updateRunName = (newName: string) => {
    if (!isValidRunName) return;
    window.database.updateRunName(run.id, newName);
    setRunName(newName);
    setIsEditing(false);
  };

  const handleNewRun = useCallback(
    (action: "new_file" | "change_settings") => {
      if (action === "new_file") {
        window.state.resetRunId();
        navigate("/");
      } else {
        window.state.setRunId(run.id);
        navigate("/algorithm_settings");
      }
    },
    [navigate, run?.id]
  );

  useEffect(() => {
    console.log("Subscribing to current run");
    const unsubscribe = window.database.onReceiveCurrentRun(
      ({ run, timesteps }) => {
        console.log("Received current run", run);
        setRun(run);
        setRunName(run.name);
        setTimesteps(timesteps);
        setRunNameInput(run.name);
      }
    );
    return () => {
      unsubscribe(); // Assuming the subscription returns a cleanup function
    };
  }, []);

  useEffect(() => {
    console.log("Requesting current run");
    window.database.requestCurrentRun();
  }, []);

  if (!run) {
    return (
      <div className="w-screen h-screen bg-background text-text">
        <TitleBar index={4} />
        <div className="flex flex-col items-center justify-center h-full">
          <Loader className="animate-spin" size={64} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen">
      <TitleBar index={4} />
      <div
        id="mainContent"
        className="dark:dark flex flex-col bg-background px-32 pt-6 pb-8 gap-8 text-text"
      >
        <div className="flex flex-col gap-8">
          <div className="flex w-full justify-between gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center gap-4">
                {isEditing ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex gap-4 items-center"
                  >
                    <Input
                      value={runNameInput}
                      onChange={(e) => {
                        setRunNameInput(e.target.value);
                        setIsValidRunName(validateRunName(e.target.value));
                      }}
                      className="text-3xl min-w-[500px]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateRunName(runNameInput);
                        if (e.key === "Escape") {
                          setRunNameInput(run.name);
                          setIsEditing(false);
                        }
                      }}
                    />
                    <Button
                      onClick={() => updateRunName(runNameInput)}
                      disabled={!isValidRunName}
                    >
                      <Save className="text-white" size={24} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <h1 className="text-4xl">{runName}</h1>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="text-secondary" size={28} />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pb-4 pl-5 text-accent">
                <CheckCheck className="rounded bg-background" size={24} />
                <p className="text-xl font-semibold">
                  Your results have been saved.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <TooltipWrapper
                wrappedContent={
                  <Button
                    onClick={() =>
                      window.electron.showItemInFolder(run.output_file_path)
                    }
                  >
                    <FolderOpen />
                    Open Output Location
                  </Button>
                }
                tooltipContent={
                  <p className="text-left">
                    Click to show the results directory in the file explorer.
                  </p>
                }
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Play />
                    New Run
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="text-lg"
                    onClick={() => handleNewRun("new_file")}
                  >
                    Select New File
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-lg"
                    onClick={() => handleNewRun("change_settings")}
                  >
                    Change Algorithm Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex justify-between gap-8 h-full w-full">
            <div className="grid gap-8 grid-cols-2">
              <ResultsCard
                title="Cluster Assignments"
                description="See which responses were grouped together"
                onClick={() => navigate("/cluster_assignments")}
                icon={<List />}
              />
              <ResultsCard
                title="Cluster Similarities"
                description="Compare the similarities between clusters"
                onClick={() => navigate("/cluster_similarities")}
                icon={<GitCompare />}
              />
              <ResultsCard
                title="Outliers"
                description="Identify responses that don't fit into any cluster"
                onClick={() => navigate("/outliers")}
                icon={<AlertTriangle />}
              />
              <ResultsCard
                title="Cluster Mergers"
                description="See which clusters were merged together"
                onClick={() => navigate("/mergers")}
                icon={<GitMerge />}
              />
            </div>
            <Card className="h-full w-1/3">
              <CardHeader>
                <CardTitle>Run Duration</CardTitle>
                <CardDescription>
                  Total Duration: {formatTime(timesteps.total_duration, true)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {iterateRecord(timesteps.steps).map(
                  ([step, timestamp], index) => {
                    if (step !== "start")
                      return (
                        <div key={step} className="flex flex-col gap-2">
                          <div className="flex justify-between">
                            <p>{progressionMessages[step]}</p>
                            <p>
                              {formatTime(
                                timestamp -
                                  iterateRecord(timesteps.steps)[index - 1][1],
                                true
                              )}
                            </p>
                          </div>
                          <Progress
                            value={
                              ((timestamp -
                                iterateRecord(timesteps.steps)[index - 1][1]) *
                                100) /
                              timesteps.total_duration
                            }
                            max={timesteps.total_duration}
                          />
                        </div>
                      );
                  }
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsCard({
  title,
  description,
  onClick,
  icon,
}: {
  title: string;
  description: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="h-8">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-center h-full">
        <Button onClick={onClick}>
          {icon}
          {title}
        </Button>
      </CardContent>
    </Card>
  );
}
