import React, { useState, useEffect } from "react";
import { RiCloseLargeFill, RiArrowLeftSLine } from "@remixicon/react";
import {
  getUserExperiments,
  ExperimentData,
  getExperimentsDetail,
  updateExperiment,
  ExperimentDetailResponse,
} from "../../services/apiServices";
import MarkdownRenderer from "../chat/MarkdownRenderer";
import { VSCodeAPI } from "../../chat";

const FeedbackHistory = (props: {
  handleClose: () => void;
  userId: string;
  vscode: VSCodeAPI;
}) => {
  const { handleClose, userId, vscode } = props;
  const [feedbackHistory, setFeedbackHistory] = useState<ExperimentData[]>([]);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [editInfo, setEditInfo] = useState<ExperimentData | null>(null);
  const [editDetailInfo, setEditDetailInfo] =
    useState<ExperimentDetailResponse | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getFeedbackHistory = async () => {
    setIsLoading(true);
    const response = await getUserExperiments(userId);
    setFeedbackHistory(response?.data ?? []);
    setIsLoading(false);
  };

  const getDetailInfo = async (experimentId: number) => {
    setIsLoading(true);
    const response = await getExperimentsDetail(userId, experimentId);
    if (response?.data) {
      setTags(response?.data?.tags?.join(",") || "");
      setFeedbackText(response?.data?.notes || "");
      setStatus(response?.data?.status || "");
      setEditDetailInfo(response?.data);
    }
    setIsLoading(false);
  };

  const handleUpdateFeedback = async () => {
    console.log(feedbackText, "feedbackText");
    // Collect feedback data
    if (!editInfo) {
      console.error("No current chat found");
      return;
    }
    if (!editInfo.id) {
      console.error("No current feedback found");
      return;
    }

    setIsSubmittingFeedback(true);
    const experiment_status = status;
    const experiment_tags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    const experiment_record = feedbackText;

    await updateExperiment(editInfo.id.toString(), {
      status: experiment_status,
      tags: experiment_tags,
      notes: experiment_record,
    })
      .then((res) => {
        console.log("Feedback submitted successfully:", res);
        setFeedbackText("");
        setTags("");
        setStatus("");
        setEditInfo(null);
        getFeedbackHistory();
      })
      .catch((error) => {
        console.error("Error submitting feedback:", error);
        // Handle error (e.g., show an error message to the user)
      })
      .finally(() => {
        setIsSubmittingFeedback(false);
      });
  };

  useEffect(() => {
    getFeedbackHistory();
  }, []);

  useEffect(() => {
    if (editInfo) {
      setTags(editInfo.tags?.join(",") || "");
      setStatus(editInfo.status);
      if (editInfo.id) {
        getDetailInfo(Number(editInfo.id));
      }
      // setFeedbackText(editInfo.node_text || "");
    }
  }, [editInfo]);

  if (editInfo) {
    return (
      <div className="flex flex-col h-screen w-full bg-LS-Gray-07 m-auto  justify-between">
        <div className="flex flex-col">
          <div className="self-stretch p-4 inline-flex justify-between items-center">
            <div className="inline-flex justify-start items-center gap-1.5">
              <RiArrowLeftSLine
                size={14}
                className="text-LS-Gray-05 hover:opacity-50 cursor-pointer"
                onClick={() => {
                  setEditInfo(null);
                }}
              />
              <div className="justify-start text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
                {editInfo.title || "Untitled"}
              </div>
            </div>
            <RiCloseLargeFill
              size={14}
              className="text-LS-Gray-05 cursor-pointer hover:opacity-50 "
              onClick={handleClose}
            />
          </div>
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-full">
              <div className="text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
                Loading...
              </div>
            </div>
          ) : editDetailInfo ? (
            <div className="inline-flex flex-col justify-start items-center gap-3 p-5">
              <div className="justify-start text-LS-Gray-01 text-xs font-normal font-inter leading-[20px] w-full">
                Details
              </div>
              <div className="w-full bg-neutral-800 rounded outline outline-1 outline-white/10 flex flex-col justify-start items-center overflow-hidden">
                <div className="w-full bg-neutral-800 border-b border-white/10 inline-flex justify-start items-center">
                  <div className="w-36 self-stretch px-3 py-1.5 border-r border-white/10 flex justify-start items-center gap-3">
                    <div className="text-left justify-center text-LS-Gray-01 text-sm font-medium font-funnel-sans leading-tight">
                      Model
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex justify-start items-center gap-3">
                    <div className="flex-1 justify-center text-LS-Gray-04 text-sm font-normal font-funnel-sans leading-tight">
                      {editDetailInfo?.model_name || "-"}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 border-b border-white/10 inline-flex justify-start items-center">
                  <div className="w-36 self-stretch px-3 py-1.5 border-r border-white/10 flex justify-start items-center gap-3">
                    <div className="text-left justify-center text-LS-Gray-01 text-sm font-medium font-funnel-sans leading-tight">
                      Prompt Id
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex justify-start items-center gap-3">
                    <div className="flex-1 justify-center text-LS-Gray-04 text-sm font-normal font-funnel-sans leading-tight">
                      {editDetailInfo?.prompt_id || "-"}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 border-b border-white/10 inline-flex justify-start items-center">
                  <div className="w-36 self-stretch px-3 py-1.5 border-r border-white/10 flex justify-start items-center gap-3">
                    <div className="text-left justify-center text-LS-Gray-01 text-sm font-medium font-funnel-sans leading-tight">
                      Prompt Description
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex justify-start items-center gap-3">
                    <div className="flex-1 justify-center text-LS-Gray-04 text-sm font-normal font-funnel-sans leading-tight">
                      {editDetailInfo?.notes || "-"}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 border-b border-white/10 inline-flex justify-start items-center">
                  <div className="w-36 self-stretch px-3 py-1.5 border-r border-white/10 flex justify-start items-center gap-3">
                    <div className="text-left justify-center text-LS-Gray-01 text-sm font-medium font-funnel-sans leading-tight">
                      Output
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex justify-start items-center gap-3">
                    <MarkdownRenderer
                      content={editDetailInfo?.raw_output || ""}
                      isInMessage={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-full">
              <div className="text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
                No feedback found
              </div>
            </div>
          )}
        </div>

        <div className="self-stretch p-4 inline-flex flex-col justify-start items-end gap-3">
          <div className="self-stretch bg-zinc-800 rounded border-t border-white/5 flex flex-col justify-start items-end overflow-hidden">
            <div className="self-stretch p-4 flex flex-col justify-start items-end gap-3">
              <div className="flex gap-2 justify-start items-center w-full rounded border border-white/5 p-2">
                <div className="text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
                  Tags
                </div>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => {
                    let str = e.target.value;
                    let trimmedStr = str.trim();
                    let result = trimmedStr.replace(/\s/g, "");
                    setTags(result);
                  }}
                  placeholder="Enter the tags... eg: refined, production-ready"
                  className="flex-1 px-3 py-2 focus:outline-none w-full bg-transparent 
                   bg-zinc-800 text-LS-Gray-01  resize-none overflow-y-auto leading-[20px]"
                />
              </div>
              <div className="flex gap-2 justify-start items-center w-full rounded border border-white/5 p-2">
                <div className="text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
                  status
                </div>
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Enter the status"
                  className="flex-1 px-3 py-2 focus:outline-none w-full bg-transparent 
                   bg-zinc-800 text-LS-Gray-01  resize-none overflow-y-auto leading-[20px]
                  "
                />
              </div>
              <textarea
                className="w-full h-24 p-2 bg-zinc-800 text-LS-Gray-01 rounded border border-white/5 resize-none overflow-y-auto leading-[20px] focus:outline-none"
                placeholder="Please enter the record..."
                rows={3}
                onChange={(e) => setFeedbackText(e.target.value)}
                value={feedbackText}
              />

              <button
                disabled={isSubmittingFeedback}
                onClick={handleUpdateFeedback}
                className="px-3 py-1.5 bg-LS-Gray-06 rounded flex flex-col justify-center items-center overflow-hidden text-LS-Gray-03 text-sm font-normal font-inter leading-[20px] hover:opacity-50 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {isSubmittingFeedback ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-LS-Gray-07 m-auto ">
      <div className="self-stretch p-4 inline-flex justify-between items-center">
        <div className="flex-1 flex justify-between items-center">
          <div className="justify-start text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
            Feedback History
          </div>

          <RiCloseLargeFill
            size={14}
            className="text-LS-Gray-05 cursor-pointer hover:opacity-50 "
            onClick={handleClose}
          />
        </div>
      </div>
      <div className="self-stretch p-4 inline-flex flex-col justify-start items-start gap-2.5">
        {feedbackHistory?.map((item: ExperimentData) => (
          //     <div className="self-stretch px-3 py-2.5 bg-zinc-800 rounded outline outline-1 outline-offset-[-1px] outline-white/5 inline-flex flex-col justify-start items-start gap-2.5 overflow-hidden">
          //     <div className="self-stretch justify-start text-LS-Gray-01 text-xs font-normal font-['Inter'] leading-none">History 2</div>
          // </div>
          <div
            className="self-stretch px-3 py-2.5 hover:bg-blue-500/30 bg-zinc-800 rounded outline outline-1 outline-offset-[-1px] outline-white/10 flex flex-col justify-start items-start gap-2.5 overflow-hidden cursor-pointer hover:opacity-50 "
            onClick={() => {
              setEditInfo(item);
            }}
            key={item.id}
          >
            <div className="self-stretch justify-start text-LS-Gray-01 text-xs font-normal font-inter leading-[20px]">
              {item.title || "Untitled"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackHistory;
