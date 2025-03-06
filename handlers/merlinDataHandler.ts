import { Request, Response, NextFunction } from "express";
import { saveToDatabase, getUserByEmail } from "../database/dbOperations";

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
        } else {
            res.status(405).json({ error: "Method Not Allowed" });
        }

    } catch (error) {
        console.error("❌ Error in storeDataHandler:", error);
        next(error);
    }
};

export default merlinDataHandler;
