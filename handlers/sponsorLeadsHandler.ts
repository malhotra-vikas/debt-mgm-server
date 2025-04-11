import fs from "fs";
import csvParser from "csv-parser";
import pool from "../lib/db";
import { addUserToMailchimp } from "../lib/mailchimpService";

// Define CSV row type
interface Sponsor {
    SPONSOR_NAME: string;
    CLIENT_FIRST: string;
    CLIENT_LAST: string;
    CLIENT_ZIP: string;
    CLIENT_EMAIL: string;
    CLIENT_MOBILE: string;
    CLIENT_STATE: string;
    CLIENT_DOB: string;
    CLIENT_ID: string;
    PROCESSOR_ACCT: string;
    CLIENT_STATUS: string;
    AFFILIATE_ENROLLED_DATE: string;
    SERVICE_TERM: number;
    DEBT_AMT_ENROLLED: number;
    DRAFTS: number;
    SETTLEMENTS_REACHED: number;
}

// Function to read CSV
const readCSV = (filePath: string): Promise<Sponsor[]> => {
    return new Promise((resolve, reject) => {
        const results: Sponsor[] = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", (err) => reject(err));
    });
};

// UPLOAD: Insert new rows into the database
export const uploadSponsorLeads = async (filePath: string) => {
    const sponsors = await readCSV(filePath);

    const client = await pool.connect();
    try {
        for (const sponsor of sponsors) {

            // Ensure values are safely converted before checking for empty strings
            const affiliateEnrolledDate =
                typeof sponsor.AFFILIATE_ENROLLED_DATE === "string" && sponsor.AFFILIATE_ENROLLED_DATE.trim() !== ""
                    ? sponsor.AFFILIATE_ENROLLED_DATE
                    : null;

            const serviceTerm = sponsor.SERVICE_TERM || 0;

            const debtAmtEnrolled = sponsor.DEBT_AMT_ENROLLED || 0;


            console.log("sponsor being added is ", sponsor)

            await client.query(
                `INSERT INTO sponsorsdata (sponsor_name, client_first, client_last, client_zip, client_email, client_mobile,
          client_state, client_dob, client_id, processor_acct, client_status, affiliate_enrolled_date, service_term,
          debt_amt_enrolled, drafts, settlements_reached, invited)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending')
          ON CONFLICT (CLIENT_ID) DO NOTHING`,
                [sponsor.SPONSOR_NAME, sponsor.CLIENT_FIRST, sponsor.CLIENT_LAST, sponsor.CLIENT_ZIP, sponsor.CLIENT_EMAIL,
                sponsor.CLIENT_MOBILE, sponsor.CLIENT_STATE, sponsor.CLIENT_DOB, sponsor.CLIENT_ID, sponsor.PROCESSOR_ACCT,
                sponsor.CLIENT_STATUS, affiliateEnrolledDate, serviceTerm, debtAmtEnrolled, sponsor.DRAFTS, sponsor.SETTLEMENTS_REACHED]
            );
        }
        console.log("Upload completed.");
    } catch (error) {
        console.error("Upload error:", error);
    } finally {
        client.release();
    }
};
// Add a new sponsor
export const getAllSponsors = async () => {
    const client = await pool.connect();

    try {
        // Corrected Query to SELECT all sponsors
        const result = await client.query(
            `SELECT sponsor_name, list, apikey, prefix FROM sponsors`
        );

        console.log("✅ Retrieved Sponsors:", result.rows);
        return result.rows; // Return sponsors data
    } catch (error) {
        console.error("❌ Error fetching sponsors:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Add a new sponsor
export const addNewSponsor = async (sponsorName: string, list: string, apiKey: string, prefix: string) => {
    const client = await pool.connect();

    console.log("Adding ", sponsorName)

    try {
        await client.query(
            `INSERT INTO sponsors (sponsor_name, list, apikey, prefix)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sponsor_name) DO NOTHING`,
            [sponsorName, list, apiKey, prefix]
        );
        console.log("Upload completed.");
    } catch (error) {
        console.error("Upload error:", error);
    } finally {
        client.release();
    }


}


// INVITE: Process pending invites
export const inviteSponsorLeads = async (sponsorName: string) => {
    const client = await pool.connect();
    let sponsor_name, list, apikey, prefix

    try {
        const sponsor = await client.query(`SELECT sponsor_name, list, apikey, prefix FROM sponsors WHERE sponsor_name = $1`, [sponsorName]);
        for (const row of sponsor.rows) {            

            sponsor_name = row["sponsor_name"]
            list = row["list"]
            apikey = row["apikey"]
            prefix = row["prefix"]

        }

    } catch (error) {
        console.error("Invite error:", error);
    }

    try {

        const result = await client.query(`SELECT sponsor_name, client_email, client_first, client_last FROM sponsorsdata WHERE invited = 'pending'`);
        for (const row of result.rows) {
            const { sponsor_name, client_email, client_first, client_last } = row;

            // Send to Mailchimp
            await addUserToMailchimp(client_email, client_first, client_last, list, apikey, prefix);
            console.log(`🚀 Adding ${client_email} to Mailchimp`);

            await client.query(`UPDATE sponsorsdata SET invited = 'invited' WHERE client_email = $1`, [client_email]);
            console.log(`🚀 Update  ${client_email} to invited`);

        }
        console.log("Invites sent successfully.");
    } catch (error) {
        console.error("Invite error:", error);
    } finally {
        client.release();
    }
};

// UPDATE: Update rows in the database and reset status to pending
export const updateSponsorLeads = async (filePath: string) => {
    const sponsors = await readCSV(filePath);

    const client = await pool.connect();
    try {
        for (const sponsor of sponsors) {

            // Ensure values are safely converted before checking for empty strings
            const affiliateEnrolledDate =
                typeof sponsor.AFFILIATE_ENROLLED_DATE === "string" && sponsor.AFFILIATE_ENROLLED_DATE.trim() !== ""
                    ? sponsor.AFFILIATE_ENROLLED_DATE
                    : null;

            const serviceTerm = sponsor.SERVICE_TERM || 0;

            const debtAmtEnrolled = sponsor.DEBT_AMT_ENROLLED || 0;

            await client.query(
                `UPDATE sponsorsdata SET client_first = $1, client_last = $2, client_zip = $3, client_mobile = $4,
          client_state = $5, client_dob = $6, processor_acct = $7, client_status = $8, affiliate_enrolled_date = $9,
          service_term = $10, debt_amt_enrolled = $11, drafts = $13, settlements_reached = $14, invited = 'pending'
          WHERE client_email = $12`,
                [sponsor.CLIENT_FIRST, sponsor.CLIENT_LAST, sponsor.CLIENT_ZIP, sponsor.CLIENT_MOBILE, sponsor.CLIENT_STATE,
                sponsor.CLIENT_DOB, sponsor.PROCESSOR_ACCT, sponsor.CLIENT_STATUS, affiliateEnrolledDate,
                serviceTerm, debtAmtEnrolled, sponsor.CLIENT_EMAIL, sponsor.DRAFTS, sponsor.SETTLEMENTS_REACHED]
            );
        }
        console.log("Update completed.");
    } catch (error) {
        console.error("Update error:", error);
    } finally {
        client.release();
    }
};

// DELETE: Remove sponsors from the database
export const deleteSponsorLeads = async (filePath: string) => {
    const sponsors = await readCSV(filePath);

    const client = await pool.connect();
    try {
        for (const sponsor of sponsors) {
            await client.query(`DELETE FROM sponsorsdata WHERE client_email = $1`, [sponsor.CLIENT_EMAIL]);
        }
        console.log("Delete completed.");
    } catch (error) {
        console.error("Delete error:", error);
    } finally {
        client.release();
    }
};


export const fetchLeadByClientId = async (clientId: string) => {
    const client = await pool.connect(); // Get a client from the pool
    try {
        // Use parameterized queries to prevent SQL injection
        const result = await client.query(
            `SELECT sponsor_name, client_first, client_last, client_zip, client_email, client_mobile,
                    client_state, client_dob, client_id, processor_acct, client_status, affiliate_enrolled_date, 
                    service_term, debt_amt_enrolled, drafts, settlements_reached 
             FROM sponsorsdata WHERE client_id = $1`, [clientId]
        );

        // Check if any results were returned
        if (result.rows.length > 0) {
            // Return the entire rows data (or an array of rows)
            return result.rows;  // Returns all rows as an array
        } else {
            console.log(`No client found with client_id: ${clientId}`);
            return []; // Return an empty array if no data is found
        }
    } catch (error) {
        console.error("Invite error:", error);
        throw new Error("Failed to fetch lead data");  // Throw error if there's an issue
    } finally {
        client.release(); // Always release the client back to the pool
    }
};
