import express from "express";
import cors from "cors";
import { merlinTrustHandler } from "./handlers/merlinTrustHandler"; // Import your function

const app = express();
app.use(cors());
app.use(express.json());

app.post("/merlin-trust-builder", merlinTrustHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
