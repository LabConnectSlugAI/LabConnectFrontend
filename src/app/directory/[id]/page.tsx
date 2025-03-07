"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "../../page.module.css"; // Ensure this path is correct
import Papa from "papaparse";

interface Lab {
  id: number;
  department: string;
  professor: string;
  contact: string;
  name: string;
  major: string;
  applicationLink: string;
  description: string;
}

interface CsvRow {
  Department: string;
  Professor: string;
  Contact: string;
  Name: string;
  Major: string;
  Apply: string;
  Description: string;
}

export default function LabProfile() {
  const { id } = useParams();
  const [lab, setLab] = useState<Lab | null>(null);

  useEffect(() => {
    const csvUrl =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmDz9hjnoVXz6sgthlfFxb9HLI8bNDqXa7VGPG1hgCTisC5i1N28FgWR0qmHqAHBepV1fE5_YpIbyq/pub?output=csv";

    Papa.parse<CsvRow>(csvUrl, {
      download: true,
      header: true,
      complete: (results) => {
        const labs: Lab[] = results.data.map((row, index) => ({
          id: index + 1,
          department: row.Department || "Unknown",
          professor: row.Professor || "Unknown",
          contact: row.Contact || "N/A",
          name: row.Name || "Unknown",
          major: row.Major || "N/A",
          applicationLink: row.Apply || "#",
          description: row.Description || "No description available.",
        }));

        const foundLab = labs.find((lab) => lab.id === Number(id));
        setLab(foundLab || null);
      },
    });
  }, [id]);

  if (!lab) {
    return <p className={styles.loading}>Loading lab details...</p>;
  }
  return (
    <div className="page-container">
      <div className="container">
        <div className="main-content">
          <div className="left-column">
            <h2>{lab.name}</h2>
            <div className="lab-description">{lab.description}</div>
            <div className="contact-details">
              <div className="section-title">Contact Details</div>
              <div>Email: {lab.contact}</div>
              {lab.professor && <div>Professor: {lab.professor}</div>}
            </div>
          </div>

          <div className="right-column">
            <div className="right-buttons">
              <a
                href={lab.applicationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="apply-button"
              >
                Apply!
              </a>
              <a href={`mailto:${lab.contact}`} className="contact-lab-button">
                Contact Lab!
              </a>
              <a href="./" className="back-button">
                Back to Lab Directory
              </a>
              <a href="./../" className="back-button">
                Back to Home
              </a>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .page-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: Arial, sans-serif;
        }
        .container {
          max-width: 1000px;
          margin: 0 auto;
          background-color: white;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          flex: 1;
          width: 100%;
        }
        .header {
          background-color: #f5f5f5;
          padding: 15px 20px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          display: flex;
          align-items: center;
        }
        .logo-text-lab {
          color: #14457f;
          font-size: 28px;
          font-weight: bold;
        }
        .logo-text-ucsc {
          color: #f5c526;
          font-size: 28px;
          font-weight: bold;
        }
        .nav-button {
          background-color: #ccc;
          padding: 5px 15px;
          border-radius: 5px;
          color: #333;
          text-decoration: none;
          font-size: 16px;
        }
        .main-content {
          display: flex;
          padding: 30px;
          min-height: 400px;
        }
        .left-column {
          flex: 7;
          padding-right: 40px;
        }
        .right-column {
          flex: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        h2 {
          font-size: 32px;
          margin-top: 0;
          margin-bottom: 20px;
          color: #14457f;
        }
        .lab-description {
          margin-bottom: 30px;
          font-size: 18px;
          line-height: 1.6;
        }
        .section-title {
          font-size: 24px;
          font-weight: bold;
          margin-top: 20px;
          margin-bottom: 15px;
          color: #333;
        }
        .contact-details {
          margin-bottom: 30px;
          font-size: 18px;
          line-height: 1.6;
        }
        .right-buttons {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }
        .apply-button {
          display: block;
          width: 90%;
          background-color: #e7b71b;
          border: none;
          color: black;
          padding: 12px 20px;
          border-radius: 5px;
          text-align: center;
          cursor: pointer;
          text-decoration: none;
          font-size: 18px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .apply-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        .contact-lab-button {
          display: block;
          width: 90%;
          background-color: #14457f;
          border: none;
          color: white;
          padding: 12px 20px;
          border-radius: 5px;
          text-align: center;
          cursor: pointer;
          text-decoration: none;
          font-size: 18px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .contact-lab-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        .back-button {
          display: block;
          width: 90%;
          background-color: #ddd;
          color: #333;
          padding: 12px 20px;
          border-radius: 5px;
          text-align: center;
          cursor: pointer;
          text-decoration: none;
          font-size: 18px;
          font-weight: bold;
          transition: background-color 0.2s;
        }
        .back-button:hover {
          background-color: #ccc;
        }
        .loading {
          text-align: center;
          padding: 50px;
          font-size: 20px;
          color: #666;
        }
      `}</style>
    </div>
  );
}
