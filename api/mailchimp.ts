import { Request, Response } from "express";

import { addUserToMailchimp } from "../lib/mailchimpService";

/**
 * Handles the POST request to send user details to Mailchimp.
 * @param request - The request object containing user details.
 */
export async function POST(request: Request) {
    try {
        const { email, fname, lname, link } = await request.json();

        console.log("🚀 Mailchimp API called with:");
        console.log("Email:", email);
        console.log("FName:", fname);
        console.log("Link:", link);

        // Send data to Mailchimp
        await addUserToMailchimp(email, fname, lname, "A", " ", " ");

        return res.status(200).json({ success: true, message: "User successfully added to Mailchimp." });

    } catch (error: any) {
        console.error("Error from Mailchimp API:", error);
        return res.status(500).json({ success: true, message: ""Failed to process user." });

    }
}
