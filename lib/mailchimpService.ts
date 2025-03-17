import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Load Mailchimp environment variables
//const listId = process.env.MAILCHIMP_LIST_ID;
//const apiKey = process.env.MAILCHIMP_API_KEY;
//const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;

//if (!listId || !apiKey || !serverPrefix) {
//    throw new Error("❌ Missing required Mailchimp environment variables.");
//}

// Define TypeScript Types for Mailchimp Payload
interface MergeFields {
    FNAME: string;
    LNAME: string;
    MMERGE6?: string; // IP Address
    MMERGE7?: string; // Custom field (Tool Name, etc.)
}

interface AddUserPayload {
    email_address: string;
    status: "subscribed" | "pending";
    merge_fields?: MergeFields;
}

interface MailchimpResponse {
    id: string;
    email_address: string;
    status: string;
    [key: string]: any;
}

/**
 * Adds or updates a user in the Mailchimp list and assigns them to a journey.
 * @param email - The user's email address.
 * @param fName - First name.
 * @param lName - Last name.
 * @param journeyId - The Mailchimp journey ID.
 */
export const addUserToMailchimp = async (
    email: string,
    fName: string,
    lName: string,
    listId: string,
    apiKey: string,
    serverPrefix: string
): Promise<void> => {
    const emailHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${emailHash}`;

    if (!listId || !apiKey || !serverPrefix) {
        throw new Error("❌ Missing required Mailchimp environment variables.");
    }

    const payload: AddUserPayload = {
        email_address: email,
        status: "subscribed", // Use "pending" if confirmation email is required
        merge_fields: {
            FNAME: fName,
            LNAME: lName,
            MMERGE6: "User IP Placeholder", // Replace with actual IP if needed
            MMERGE7: "Credit Card Payoff Calculator",
        },
    };

    try {
        // Check if user exists in Mailchimp
        const checkResponse = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
                "Content-Type": "application/json",
            },
        });

        if (checkResponse.ok) {
            console.log(`⚠️ User ${email} already exists. Updating info...`);
        } else if (checkResponse.status !== 404) {
            throw new Error(`❌ Failed to check user status: ${await checkResponse.text()}`);
        }

        // Add or update the user in the list
        const addResponse = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data: MailchimpResponse = await addResponse.json();

        if (!addResponse.ok) {
            console.error("❌ Error adding/updating user:", data);
            throw new Error(`Failed to add/update user: ${data.detail || addResponse.statusText}`);
        }

        console.log(`✅ User ${email} added/updated successfully in Mailchimp.`);

        // Trigger Mailchimp journey for this user
        //await addUserToMailchimpJourney(email, journeyId);
    } catch (error) {
        console.error(`❌ Error processing Mailchimp user ${email}:`, error);
        throw error;
    }
};

/**
 * Adds a user to a Mailchimp journey.
 * @param email - The user's email.
 * @param journeyId - The Mailchimp journey ID.
 */
/*
const addUserToMailchimpJourney = async (email: string, journeyId: string): Promise<void> => {
    const journeyUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/journeys/${journeyId}/actions/add`;

    const payload = { email_address: email };

    try {
        const response = await fetch(journeyUrl, {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorDetail = await response.json();
            console.error(`❌ Failed to add ${email} to journey ${journeyId}:`, errorDetail);
            throw new Error(`Failed to add user to Mailchimp journey: ${errorDetail.detail || response.statusText}`);
        }

        console.log(`✅ User ${email} successfully added to Mailchimp journey ${journeyId}.`);
    } catch (error) {
        console.error(`❌ Error adding user to Mailchimp journey ${journeyId}:`, error);
        throw error;
    }
};
*/
