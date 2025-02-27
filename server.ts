import express from "express";
import cors from "cors";
import merlinTrustHandler from "./handlers/merlinTrustHandler"; // ✅ Use default import
import merlinQuestionAppenderHandler from "./handlers/merlinQuestionAppenderHandler"; // ✅ Use default import

const app = express();
app.use(cors());
app.use(express.json());

app.get("/merlin-trust-builder", merlinTrustHandler);
app.get("/merlin-empathy-response", merlinQuestionAppenderHandler);

const PORT = 3020;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
