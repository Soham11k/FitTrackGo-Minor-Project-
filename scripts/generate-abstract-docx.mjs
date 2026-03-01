/**
 * Generates a Word document containing an abstract for FitTrack Go
 * that follows the Abstract Guidelines: purpose, concise (250-300 words),
 * clear language, structure (Introduction, Objectives, Methods, Conclusion),
 * and 5-7 keywords.
 * Output: docs/FitTrack-Go-Abstract.docx
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          text: "Guidelines while writing an abstract",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          text: "Key Takeaways",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 160, after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Understand the Purpose: ", bold: true }),
            new TextRun({
              text: "The abstract should provide a brief overview of the technical project, highlighting its significance, objectives, methods, and results. It must give readers a clear idea of what the project is about and its importance. Sufficient information should be included for reviewers to assess the nature and significance of the topic.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Keep it Concise: ", bold: true }),
            new TextRun({
              text: "Abstracts are typically limited to a specific word count or length. The aim is to convey necessary information succinctly, avoiding excessive detail or unnecessary jargon. A typical abstract length is around 250-300 words.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Use Clear and Precise Language: ", bold: true }),
            new TextRun({
              text: "The abstract must be written in clear, concise, and easily understandable language. Avoid technical jargon or abbreviations that might not be familiar to a broader audience. If specialized terms are essential, brief explanations should be provided.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Follow a Structure: ", bold: true }),
            new TextRun({
              text: "Introduction (background and problem statement); Objectives (goals of the project); Methods/Approach/Proposed Solution (solution and unique or innovative aspects); Conclusion/Implications (significance and potential impact).",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Keywords: ", bold: true }),
            new TextRun({
              text: "Identify 5-7 keywords that closely reflect the content of the abstract and the overall project. Keywords should enable readers to quickly grasp the essence of the project.",
            }),
          ],
          spacing: { after: 280 },
        }),
        new Paragraph({
          text: "FitTrack Go: A Fitness Tracking Application with Camera-Based Pose Detection and Cloud Synchronization",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "Abstract",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Introduction. ", bold: true }),
            new TextRun({
              text: "Fitness applications increasingly rely on sensors and cameras for real-time feedback and activity records. Many users lack access to a trainer and need guidance to perform exercises correctly. Existing apps often focus only on logging or on pre-recorded content, without using the camera to analyze form in real time. Combining run tracking, workout logging, and camera-based form analysis in one application remains a practical challenge.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Objectives. ", bold: true }),
            new TextRun({
              text: "FitTrack Go aims to provide one application that (1) offers a dashboard for activity summaries and streak metrics, (2) tracks runs using GPS with map, distance, pace, and splits, and saves them to the cloud, (3) lets users browse and log workouts by category, and (4) uses the device camera and pose detection to give real-time form feedback for exercises such as squats, push-ups, planks, and lunges, with data syncing across web and mobile.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Methods and proposed solution. ", bold: true }),
            new TextRun({
              text: "The application is built with Next.js and React and uses Supabase for authentication and storage. Pose estimation runs in the browser with MediaPipe Pose Landmarker, so no video is sent to servers. A custom form-analysis module interprets body landmarks to count repetitions and score form, with optional face verification and fall detection. The same codebase runs on web and Android via Capacitor, with offline-resilient writes that queue updates when the network is unavailable.",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Conclusion and implications. ", bold: true }),
            new TextRun({
              text: "FitTrack Go demonstrates that real-time, browser-based pose analysis can be combined with cloud-backed fitness tracking in a single application. The approach preserves privacy, supports cross-platform use, and gives users interpretable form feedback to improve technique, with potential for extension to more exercises and platforms.",
            }),
          ],
          spacing: { after: 160 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Keywords—", italic: true }),
            new TextRun({
              text: "fitness tracking; pose detection; MediaPipe; Next.js; Supabase; AI coach; cloud synchronization.",
            }),
          ],
          spacing: { after: 120 },
        }),
      ],
    },
  ],
})

const outDir = path.join(__dirname, "..", "docs")
const outPath = path.join(outDir, "FitTrack-Go-Abstract.docx")

fs.mkdirSync(outDir, { recursive: true })

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer)
  console.log("Generated:", outPath)
}).catch((err) => {
  console.error("Error generating document:", err)
  process.exit(1)
})
