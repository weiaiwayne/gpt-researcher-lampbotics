"use client";
import React, { useState, useRef, useEffect } from "react";
import { useResearchHistory } from "@/hooks/useResearchHistory";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAnalytics } from "@/hooks/useAnalytics";
import { config } from "@/config/task";
import { useRouter } from "next/navigation";
import { InputArea } from "../ResearchBlocks/elements/InputArea";
import { TypeAnimation } from "../TypeAnimation";
import { GiHamburger } from "react-icons/gi";
import { BsQuestionCircle } from "react-icons/bs";

export function ResearchForm({
  onSubmit,
  agent,
  reportType,
}: {
  onSubmit: (data: {
    prompt: string;
    agent: string;
    report_type: string;
    files?: File[];
    research_goal: string;
  }) => void;
  agent: string;
  reportType: string;
}) {
  const router = useRouter();
  const researchGoalRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { researchHistory, addResearch } = useResearchHistory();
  const { isConnected, connect, disconnect } = useWebSocket();
  const { trackEvent } = useAnalytics();
  const [prompt, setPrompt] = useState<string>("");
  const [researchGoal, setResearchGoal] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    const latestResearch = researchHistory[researchHistory.length - 1];
    if (latestResearch) {
      setPrompt(latestResearch.prompt);
      setResearchGoal(latestResearch.research_goal);
    }
  }, [researchHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || !researchGoal) {
      return;
    }
    trackEvent({
      category: "Form",
      action: "Submit",
      label: "Research Form",
      value: 1,
    });

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("agent", agent);
    formData.append("report_type", reportType);
    formData.append("research_goal", researchGoal);

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    const researchData = {
      prompt,
      agent,
      report_type: reportType,
      files: selectedFiles,
      research_goal: researchGoal,
    };
    addResearch(researchData);

    onSubmit(researchData);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      const files = Array.from(event.dataTransfer.files);
      setSelectedFiles(files);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-6"
    >
      <div>
        <label
          htmlFor="prompt"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          <div className="flex items-center">
            <GiHamburger className="mr-2" />
            Your AI Whopper Bread (Prompt)
          </div>
        </label>
        <div className="mt-2">
          <InputArea
            inputRef={promptRef}
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={config.task_placeholder}
            maxRows={8}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="research_goal"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          <div className="flex items-center">
            <BsQuestionCircle className="mr-2" />
            What is the core question of the AI Whopper?
          </div>
        </label>
        <div className="mt-2">
          <InputArea
            inputRef={researchGoalRef}
            id="research_goal"
            value={researchGoal}
            onChange={(e) => setResearchGoal(e.target.value)}
            placeholder="Type your research goal here..."
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="files"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          <div className="flex items-center">
            <GiHamburger className="mr-2" />
            Your AI Whopper Tomatoes, Sauces & Lettuce (Documents)
          </div>
        </label>
        <div
          className="mt-2 flex justify-center px-6 py-10 border-2 border-dashed border-gray-300 rounded-md cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4 flex text-sm leading-6 text-gray-600">
              <label
                htmlFor="files"
                className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
              >
                <span>Upload a file</span>
                <input
                  id="files"
                  name="files"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  multiple
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs leading-5 text-gray-600">
              PDF, DOCX, TXT, up to 10MB
            </p>
          </div>
        </div>
        {selectedFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium leading-6 text-gray-900">
              Selected Files:
            </h4>
            <ul className="mt-2 list-disc list-inside">
              {selectedFiles.map((file) => (
                <li key={file.name} className="text-sm text-gray-600">
                  {file.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Start Building Your AI Whopper!
      </button>
    </form>
  );
}