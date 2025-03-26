import { Request, Response, NextFunction } from "express";
import { saveToDatabase, getUserByEmail, updateUserData } from "../database/postGresDBOperations";

const merlinDataHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("📌 Event Starting - Handling Request");

    try {
        if (req.method === "POST") {
            const { email, data } = req.body;

            // Validate input
            if (!email || !data) {
                res.status(400).json({ error: "Validation Error - Email and Data are required" });
                return;
            }

            console.log("📌 Storing Data:", req.body);

            // Save data in SQLite
            const savedRecord = await saveToDatabase({ email, data });

            console.log("✅ Data successfully stored:", savedRecord);

            res.status(201).json({
                message: "Data successfully stored",
                record: savedRecord
            });

        } else if (req.method === "GET") {
            const { email } = req.query;

            if (!email || typeof email !== "string") {
                res.status(400).json({ error: "Validation Error - Email is required as a query parameter" });
                return;
            }

            console.log("📌 Fetching Data for Email:", email);

            // Fetch user by email
            const userData = await getUserByEmail(email);

            if (!userData) {
                res.status(404).json({ error: "User not found" });
            } else {
                res.status(200).json(userData);
            }
        } else if (req.method === "PUT") {
            const { email, data } = req.body;

            // Validate input
            if (!email || !data) {
                res.status(400).json({ error: "Validation Error - Email and Data are required" });
                return;
            }

            console.log("📌 Updating Data for Email:", email);

            // Fetch user by email to check if they exist
            const userData = await getUserByEmail(email);

            if (userData) {
                // If user exists, update the data
                const updatedRecord = await updateUserData(email, data);
                console.log("✅ Data successfully updated:", updatedRecord);

                res.status(200).json({
                    message: "Data successfully updated",
                    record: updatedRecord
                });
            } else {
                // If user does not exist, create a new record (like POST)
                const savedRecord = await saveToDatabase({ email, data });

                console.log("✅ New record created:", savedRecord);

                res.status(201).json({
                    message: "New data successfully created",
                    record: savedRecord
                });
            }

        } else {
            res.status(405).json({ error: "Method Not Allowed" });
        }

    } catch (error) {
        console.error("❌ Error in merlinDataHandler:", error);
        next(error);
    }
};

export default merlinDataHandler;
