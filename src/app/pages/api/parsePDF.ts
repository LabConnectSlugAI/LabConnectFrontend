import { NextApiRequest, NextApiResponse } from "next";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Set the worker source for pdfjs-dist
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { file } = req.body;

    // Check if the file is provided
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate base64 string
    const base64Pattern = /^([A-Za-z0-9+/=]){1,}/;
    if (!base64Pattern.test(file)) {
      return res.status(400).json({ error: "Invalid base64 string" });
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(file, "base64");

    // Load the PDF document
    const pdf = await getDocument({ data: fileBuffer }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Filter out TextMarkedContent and only use TextItem
      text += content.items
        .filter((item) => "str" in item) // Ensure the item has a `str` property
        .map((item) => (item as { str: string }).str) // Type assertion for TypeScript
        .join(" ");
    }

    console.log("Extracted text:", text); // Log the extracted text

    res.status(200).json({ text });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    res.status(500).json({ error: "Failed to parse PDF" });
  }
}