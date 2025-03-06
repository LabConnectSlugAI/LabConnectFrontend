import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import styles from "../../styles/lab.module.css";

export default function LabDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensure router is ready and ID is available
    if (!router.isReady || !id) return;

    async function fetchLab() {
      try {
        console.log("Fetching lab with ID:", id); // Debugging

        const { data, error } = await supabase
          .from("labconnect")
          .select()
          .eq("id", Number(id)) // Ensure ID is a number
          .single();

        if (error) throw error;

        setLab(data);
      } catch (error) {
        console.error("Error fetching lab:", error);
        setLab(null);
      } finally {
        setLoading(false);
      }
    }

    fetchLab();
  }, [id, router.isReady]);

  if (loading) return <p>Loading...</p>;
  if (!lab) return <p>Lab not found</p>;

  return (
    <div className={styles.container}>
      <h1>{lab["Lab Name"]}</h1>
      <p><strong>Professor:</strong> {lab["Professor Name"]}</p>
      {/* Additional Fields */}
      <p><strong>Description:</strong> {lab["Description"]}</p>
      <p><strong>How to apply:</strong> {lab["How to apply"]}</p>

      <button onClick={() => router.back()} className={styles.backButton}>
        Back
      </button>
    </div>
  );
}
