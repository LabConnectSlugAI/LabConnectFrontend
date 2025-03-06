"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabaseClient";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface Lab {
  id: number;
  Department: string;
  "Professor Name": string;
  Contact: string;
  "Lab Name": string;
  Major: string;
  "How to apply": string;
  Description: string;
}

interface LabAnalysis extends Lab {
  match_reason?: string;
  similarity_score?: number;
}

interface ResumeDetails {
  major: string;
  keywords: string;
}

export default function LabSearch() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null); // Ref for synchronous file access
  const [labs, setLabs] = useState<LabAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allow PDF, PNG, and JPEG files.
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (
      file &&
      (file.type === "application/pdf" ||
        file.type === "image/png" ||
        file.type === "image/jpeg")
    ) {
      setSelectedFile(file);
      fileRef.current = file; // update the ref immediately
      console.log("Selected file:", file);
    } else {
      alert("Please upload a valid PDF, PNG, or JPEG file.");
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    fileRef.current = null;
  };

  const processFileAndFetchLabs = async () => {
    // Use the file from the ref to ensure it's available
    const file = fileRef.current;
    if (!file) {
      setError("Please upload a file");
      return;
    }
    setLoading(true);
    setError(null);
    setLabs([]);

    try {
      // Convert file to base64
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result?.toString();
          if (!result) return reject("Failed to read file");
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject("Error reading file");
        reader.readAsDataURL(file);
      });

      // First LLM call: Extract resume details (major and keywords)
      const resumeResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              `Extract the academic major and key skills or research interests from this document. The document will either be a resume or a transcript for a student at UC Santa Cruz
              who is interested in lab opportunities. Parse through the document to understand the student's skills, interests, background, and experience to find the best labs for them.
              Respond in the format: Major: <major>\nKeywords: <comma-separated keywords>.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analyze this document and extract the most relevant academic major along with additional keywords that represent skills or interests for the given student's resume or transcript.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${b64}`,
                  detail: "auto",
                },
              },
            ],
          },
        ],
        max_tokens: 150,
      });

      const resumeContent =
        resumeResponse.choices[0]?.message?.content?.trim();
      if (!resumeContent) throw new Error("Failed to extract resume details");

      // Parse the text response
      const majorMatch = resumeContent.match(/Major:\s*(.+)/);
      const keywordsMatch = resumeContent.match(/Keywords:\s*(.+)/);

      if (!majorMatch || !keywordsMatch) {
        throw new Error("Failed to parse document details");
      }

      const resumeDetails: ResumeDetails = {
        major: majorMatch[1].trim(),
        keywords: keywordsMatch[1].trim(),
      };

      // Fetch all labs from Supabase
      const { data: allLabs, error: supabaseError } = await supabase
        .from("labconnect")
        .select();
      if (supabaseError) throw supabaseError;
      if (!allLabs?.length) throw new Error("No labs found");

      // Second LLM call: Compare resume details with lab descriptions
      const comparisonResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `Analyze the following details about a UC Santa Cruz student and compare them with these lab descriptions.
For each lab in the list, provide:
- A similarity score (an integer between 1 and 5).
- A concise match reason (no more than about 20 words) explaining why the lab is a good match for the student.
Strongly consider the applicant's major ("${resumeDetails.major}") and keywords ("${resumeDetails.keywords}") when performing your analysis.
Respond in the following exact format for each lab: 
Lab ID: <id>
Similarity Score: <score>
Match Reason: <reason>
---`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Details:
Major: ${resumeDetails.major}
Keywords: ${resumeDetails.keywords}

Lab Descriptions:
${JSON.stringify(allLabs, null, 2)}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${b64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysisContent =
        comparisonResponse.choices[0]?.message?.content;
      if (!analysisContent)
        throw new Error("Failed to get lab analysis from LLM");

      // Parse the LLM response into an array of lab analyses
      const labAnalysis = analysisContent
        .split("---")
        .map((block) => {
          const idMatch = block.match(/Lab\s*ID:\s*(\d+)/i);
          const scoreMatch = block.match(/Similarity\s*Score:\s*(\d+)/i);
          const reasonMatch = block.match(/Match\s*Reason:\s*([\s\S]+)/i);
          if (!idMatch || !scoreMatch || !reasonMatch) return null;
          return {
            id: parseInt(idMatch[1]),
            similarity_score: parseInt(scoreMatch[1]),
            match_reason: reasonMatch[1].trim(),
          };
        })
        .filter((lab) => lab !== null) as {
        id: number;
        similarity_score: number;
        match_reason: string;
      }[];

      // Merge lab analysis with original lab data and sort by similarity score descending.
      const enhancedLabs = allLabs.map((lab: LabAnalysis) => {
        const analysis = labAnalysis.find((l) => l.id === lab.id);
        return {
          ...lab,
          similarity_score: analysis ? analysis.similarity_score : 0,
          match_reason: analysis ? analysis.match_reason : "No match details provided.",
        };
      }).sort(
        (a: LabAnalysis, b: LabAnalysis) =>
          (b.similarity_score || 0) - (a.similarity_score || 0)
      );

      // Filter labs to only include those with a similarity score of 3 or higher
      const highMatchLabs = enhancedLabs.filter(
        (lab: LabAnalysis) => lab.similarity_score && lab.similarity_score >= 3
      );

      // Display all labs.
      setLabs(highMatchLabs);
    } catch (err) {
      console.error("Error processing file:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process file. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* Logo and Tagline Section */}
        <div className={styles.logoSection}>
          <h1 className={styles.logoText}>
            <span className={styles.labConnect}>Slug Labs</span>{" "}
            <span className={styles.ucsc}>UCSC</span>
          </h1>
          <div className={styles.taglineContainer}>
            <p className={styles.tagline}>
              Discover Research, Unlock Opportunities
            </p>
            <div className={styles.divider}></div>
            <p className={styles.tagline}>
              The #1 spot to find research across UCSC
            </p>
          </div>
        </div>

        {/* File Upload Section */}
        <div className={styles.uploadSection}>
          <div>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className={styles.uploadButton}>
              <svg
                className={styles.uploadIcon}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Upload your transcript or resume
            </label>
          </div>
          {selectedFile && (
            <div className={styles.fileDisplay}>
              <div className={styles.fileContainer}>
                <div className={styles.fileHeader}>FILE NAME</div>
                <div className={styles.fileContent}>
                  <span className={styles.fileName}>{selectedFile.name}</span>
                  <button
                    className={styles.deleteButton}
                    onClick={handleRemoveFile}
                  >
                    <svg
                      className={styles.deleteIcon}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          <div>
            <button
              onClick={processFileAndFetchLabs}
              className={styles.connectButton}
              disabled={loading || !selectedFile}
            >
              {loading ? (
                <span className={styles.loading}>
                  <svg
                    className={styles.loadingIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className={styles.loadingCircle}
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className={styles.loadingPath}
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Find Matching Labs"
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Recommended Labs Grid */}
        {labs.length > 0 && (
          <div className={styles.recommendedSection}>
            <h2>Recommended Labs for You</h2>
            <div className={styles.compiledGrid}>
              {labs.map((lab, index) => (
                <div 
                  key={lab.id} 
                  className={styles.compiledCard} 
                  style={{ "--index": index } as React.CSSProperties}
                  data-top-match={lab.similarity_score && lab.similarity_score >= 3 ? "true" : "false"}
                >
                  <span className={styles.rankBadge}>{index + 1}</span>
                  <h3 className={styles.compiledLabName}>{lab["Lab Name"]}</h3>
                  <p className={styles.compiledProfessor}>
                    <strong>Prof.</strong> {lab["Professor Name"]}
                  </p>
                  <p className={styles.compiledDepartment}>
                    <strong>Department:</strong> {lab.Department}
                  </p>
                  <div className={styles.compiledScore}>
                    Match Score: 
                    <span style={{ marginLeft: '8px', color: lab.similarity_score ? '#2ecc71' : '#ff6b6b' }}>
                      {lab.similarity_score}/5
                    </span>
                  </div>
                  <div className={styles.compiledDescription}>
                    <p><strong>Match Reason: </strong></p>
                    <p>{lab.match_reason}</p>
                  </div>
                  <div className={styles.compiledDescription}>
                    <p><strong>Description:</strong></p>
                    <p className={styles.truncatedDescription}>
                      {lab.Description.split(" ").slice(0, 30).join(" ")}...
                    </p>
                    <Link href={`/lab/${lab.id}`} className={styles.moreButton}>
                      More
                    </Link>
                  </div>
                  <div className={styles.compiledApplication}>
                    <p><strong>How to apply:</strong></p>
                    <p>{lab["How to apply"]}</p>
                  </div>
                  <div className={styles.compiledContact}>
                    <p><strong>Contact:</strong> {lab.Contact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No labs message */}
        {!loading && !error && labs.length === 0 && (
          <p className={styles.noLabs}>
            Upload a resume to find matching labs
          </p>
        )}
      </main>
    </div>
  );
}
