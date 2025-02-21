import { Link } from "react-router";
import { TitleBar } from "../../components/TitleBar";
import { useEffect, useState } from "react";
import { ArrowRightCircle, Check, Square } from "lucide-react";
import { findDelimiter, parseCSVLine } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import { FileSettings } from "../../lib/models";

const ColumnHeader = ({
  isOn,
  title,
  onChange,
}: {
  isOn: boolean;
  title: string;
  onChange: (isOn: boolean) => void;
}) => {
  return (
    <div
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-md p-2 ${
        isOn ? "bg-accent text-background" : "hover:bg-accent-200"
      }`}
      onClick={() => onChange(!isOn)}
    >
      <Check size={16} className={`text-background ${isOn ? "" : "hidden"}`} />
      <Square size={16} className={`text-text ${isOn ? "hidden" : ""}`} />
      <p className="w-full select-none font-normal">{title}</p>
      <input
        type="checkbox"
        checked={isOn}
        onChange={() => onChange(!isOn)}
        className="hidden"
      ></input>
    </div>
  );
};

export default function FilePreview() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [previewData, setPreviewData] = useState<string[][]>([]);

  const exampleLineCount = 10;

  useEffect(() => {
    const unsubscribe = window.file.onReceivePath((path) => {
      console.log("Received file path: ", path);
      setFilePath(path);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log("Requesting file path");
    window.file.requestPath();
  }, []);

  useEffect(() => {
    const findBestDelimiter = async () => {
      if (!filePath) {
        return;
      }
      try {
        const input = await window.electron.readFile(filePath);
        const lines = input.split("\n");
        const bestDelimiter = findDelimiter(lines);
        console.log("Best delimiter: ", bestDelimiter);
        setDelimiter(bestDelimiter);
      } catch (error) {
        console.error("Error finding best delimiter:", error);
      }
    };

    findBestDelimiter();
  }, [filePath]);

  useEffect(() => {
    const fetchPreviewData = async () => {
      if (!delimiter || !filePath) {
        return;
      }
      try {
        const input = await window.electron.readFile(filePath);
        const lines = input.split("\n");
        const parsedData = lines
          .slice(0, lines.length > 100 ? 100 : lines.length)
          .map((line) => parseCSVLine(line, delimiter));
        // Fill in missing values by copying the last non-empty value
        const fillIndexes = Array(parsedData.length).fill(
          parsedData.length - 1
        );
        for (let i = 0; i < parsedData.length; i++) {
          for (let j = 0; j < parsedData[i].length; j++) {
            if (!parsedData[i][j]) {
              for (let k = fillIndexes[j]; k >= 0; k--) {
                if (parsedData[k][j]) {
                  parsedData[i][j] = parsedData[k][j];
                  fillIndexes[j] = k - 1;
                  break;
                }
              }
            }
          }
        }
        setPreviewData(parsedData.slice(0, exampleLineCount + 1));
      } catch (error) {
        console.error("Error fetching preview data:", error);
      }
    };

    fetchPreviewData();
  }, [filePath, delimiter]);

  useEffect(() => {
    const unsubscribe = window.database.onReceiveCurrentRun(({ run }) => {
      if (run) {
        // Parse the stored file settings
        const settings = JSON.parse(run.file_settings) as FileSettings;
        console.log("File settings: ", settings);

        // Update state based on the loaded settings
        setHasHeader(settings.has_header);
        setDelimiter(settings.delimiter);
        setSelectedColumns(settings.selected_columns);

        // Set file path
        setFilePath(run.file_path);
      }
    });

    // Request current run data
    window.database.requestCurrentRun();

    return () => unsubscribe();
  }, []);

  const displayData = hasHeader
    ? previewData.slice(1)
    : previewData.slice(0, exampleLineCount);
  const headers = hasHeader ? previewData[0] : [];
  const columnCount = displayData.length > 0 ? displayData[0].length : 0;

  const toggleColumn = (index: number) => {
    selectedColumns.includes(index)
      ? setSelectedColumns(selectedColumns.filter((col) => col !== index))
      : setSelectedColumns([...selectedColumns, index]);
  };

  console.log("File path: ", filePath);
  console.log("Selected columns: ", selectedColumns);
  console.log("Has header: ", hasHeader);
  console.log("Display data: ", displayData);

  if (!filePath) {
    return (
      <div className="h-screen w-screen">
        <TitleBar index={1} />
        <div
          id="mainContent"
          className="dark:dark flex flex-col items-center justify-start gap-4 bg-background px-24"
        >
          <div className="mt-24 flex w-full justify-center p-8">
            <h1 className="text-4xl">
              No file selected. Please select a file first.
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen">
      <TitleBar index={1} />
      <div
        id="mainContent"
        className="dark:dark flex flex-col justify-start gap-4 bg-background px-24 pt-8 text-text xl:gap-8 xl:px-32 xl:pb-8"
      >
        <h1 className="flex w-full flex-col text-5xl">File Preview</h1>
        <div className="flex flex-col gap-2 border-b pb-4">
          <div className="flex w-full items-start justify-between">
            <div className="flex flex-col">
              <p>Header row</p>
              <p className="text-wrap text-base font-normal text-gray-500">
                Whether the first line of data already contains responses.
              </p>
            </div>
            <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="delimiter">
              <div className="flex flex-col">
                <p>Line separator</p>
                <p className="text-base font-normal text-gray-500">
                  Enter the character that separates each column
                </p>
              </div>
            </label>
            <Input
              id="delimiter"
              value={delimiter || ""}
              onChange={(e) => setDelimiter(e.target.value)}
              className="w-20 text-center"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between">
            <p>
              Select all columns that contain responses to open-ended questions:
            </p>
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedColumns(
                    selectedColumns.length === 0
                      ? [...Array(headers.length).keys()]
                      : []
                  );
                }}
              >
                Toggle all
              </Button>
            </div>
          </div>
          <div className="scrollbar overflow-x-auto">
            <table className="w-full overflow-hidden">
              <thead>
                <tr>
                  {hasHeader &&
                    headers &&
                    headers.map((header, index) => (
                      <th
                        key={index}
                        className="border-x border-b border-dashed border-text p-1"
                      >
                        <ColumnHeader
                          key={index}
                          onChange={() => toggleColumn(index)}
                          title={header}
                          isOn={selectedColumns.includes(index)}
                        />
                      </th>
                    ))}
                  {!hasHeader &&
                    Array(columnCount)
                      .fill(0)
                      .map((_, index) => (
                        <th
                          key={index}
                          className="border-x border-b border-dashed border-text p-1"
                        >
                          <ColumnHeader
                            key={index}
                            onChange={() => toggleColumn(index)}
                            title={`Column ${index}`}
                            isOn={selectedColumns.includes(index)}
                          />
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {displayData &&
                  displayData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-x border-dashed border-text p-2 select-none"
                        >
                          <p className="line-clamp-1 max-w-64 text-center">
                            {cell}
                          </p>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="my-2"></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-4">
          {selectedColumns.length !== 1 ? (
            <p>{selectedColumns.length} columns selected</p>
          ) : (
            <p>{selectedColumns.length} column selected</p>
          )}
          <Link to="/algorithm_settings">
            <Button
              onClick={() => {
                window.file.setSettings({
                  delimiter: delimiter || ",",
                  has_header: hasHeader,
                  selected_columns: selectedColumns,
                });
              }}
              disabled={selectedColumns.length <= 0}
              size="lg"
            >
              Continue
              <ArrowRightCircle />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
