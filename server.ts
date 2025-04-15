import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";

import merlinTrustHandler from "./handlers/merlinTrustHandler";
import merlinQuestionAppenderHandler from "./handlers/merlinQuestionAppenderHandler";
import merlinDataHandler from "./handlers/merlinDataHandler";

import path from "path";
import fs from "fs";

import {
    uploadSponsorLeads,
    inviteSponsorLeads,
    updateSponsorLeads,
    deleteSponsorLeads,
    addNewSponsor,
    getAllSponsors,
    fetchLeadByClientId,
} from "./handlers/sponsorLeadsHandler"; // Import your new CSV processing functions
import merlinSideChatsHandler from "./handlers/merlinSideChatsHandler";
import merlinIntentHandler from "./handlers/merlinIntentHandler";
import merlinReportHandler from "./handlers/merlinReportHandler";

const app = express();
app.use(cors());
app.use(express.json());

// Ensure "uploads" directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}


// Configure Multer storage to rename files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Multer does not have `req.body` at this point, we handle it later
        cb(null, file.originalname); // Temporarily store with original name
    }
});

const upload = multer({ storage });


// Existing routes
app.get("/merlin-trust-builder", merlinTrustHandler);
app.get("/merlin-empathy-response", merlinQuestionAppenderHandler);
app.get("/merlin-data-handler", merlinDataHandler);
app.post("/merlin-data-handler", merlinDataHandler);
app.get("/merlin-side-chats-handler", merlinSideChatsHandler);
app.get("/merlin-intent-handler", merlinIntentHandler);

app.get("/merlin-report-builder", merlinReportHandler);

// --- New Sponsor CSV Processing Routes ---

// 1️⃣ Upload sponsors from CSV
app.post("/upload-sponsor-leads", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }
        // Extract sponsor name after Multer has processed the request
        const sponsorName = req.body.sponsor_name || "unknown_sponsor"; // Default if missing
        const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
        const newFileName = `${sponsorName}_${dateStr}.csv`;

        // Rename file to match the required format
        const newFilePath = path.join(uploadDir, newFileName);
        fs.renameSync(req.file.path, newFilePath);

        console.log(`📁 File saved as: ${newFileName}`);

        await uploadSponsorLeads(newFilePath);
        res.json({ message: "Sponsor Leads uploaded successfully", file: newFileName });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to upload sponsor leads" });
    }
});

// 2️⃣ Invite sponsors where status = "pending"
app.post("/invite-sponsor-leads", async (req: Request, res: Response): Promise<void> => {
    const { sponsorName } = req.body;

    try {
        await inviteSponsorLeads(sponsorName);
        res.json({ message: "Pending sponsor Leads invited successfully" });
    } catch (error) {
        console.error("Invite Error:", error);
        res.status(500).json({ error: "Failed to invite sponsor leads" });
    }
});

// 3️⃣ Update sponsors from CSV (sets status to "pending")
app.post("/update-sponsor-leads", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }
        await updateSponsorLeads(req.file.path);
        res.json({ message: "Sponsor Leads updated successfully" });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: "Failed to update sponsor leads" });
    }
});

// 4️⃣ Delete sponsors from CSV
app.post("/delete-sponsor-leads", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }
        await deleteSponsorLeads(req.file.path);
        res.json({ message: "Sponsor Leads deleted successfully" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Failed to delete sponsor leads" });
    }
});

// 4️⃣ Delete sponsors from CSV
app.post("/add-sponsor", async (req: Request, res: Response): Promise<void> => {
    try {
        const { sponsorName, list, apiKey, prefix } = req.body;

        // Validate required fields
        if (!sponsorName || !list || !apiKey || !prefix) {
            res.status(400).json({ message: "Missing required fields." });
            return;
        }

        await addNewSponsor(sponsorName, list, apiKey, prefix);
        res.json({ message: "Sponsors Added successfully" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Failed to add sponsors" });
    }
});

// 5 Get all sponsors
app.get("/get-all-sponsors", async (req: Request, res: Response): Promise<void> => {
    try {
        const sponsors = await getAllSponsors();
        res.json({ 
            success: true,
            sponsors: sponsors 
        });
    } catch (error) {
        console.error("Get Sponsors Error:", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to retrieve sponsors" 
        });
    }
});

// 6 fetch lead by id
app.get("/fetch-lead-by-clientid", async (req: Request, res: Response): Promise<void> => {
    try {
        const { client } = req.query;

        console.log("Got CLient to fetch ", client)

        if (!client) {
            res.status(400).json({ message: "Client ID is required" });
            return;
        }

        // Call the fetchLeadByClientId function, assuming it's imported correctly
        const leads = await fetchLeadByClientId(client as string);

        // If no leads found, return a 404
        if (!leads || leads.length === 0) {
            res.status(404).json({ message: "No leads found for this client ID" });
            return;
        }

        res.json({ message: "Leads fetched successfully", data: leads });
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch sponsor leads" });
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'dist/uploads')));

// Example route to serve a PDF
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'dist/uploads', req.params.filename);
    res.sendFile(filePath);
});

const PORT = 3020;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});


