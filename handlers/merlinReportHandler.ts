import { Request, Response, NextFunction } from "express";
import { getUserByEmail } from "../database/postGresDBOperations";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import axios from "axios";

import { Data } from "../lib/UserData";  // Adjust this path as needed

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

const merlinReportHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("📌 Event Starting - Handling Request");

    try {
        if (req.method === "GET") {
            const { email } = req.query;

            // Input validation
            if (!email || typeof email !== "string") {
                console.log("📌 Validation Error - Email is required as a query parameter");
                res.status(400).json({ error: "Validation Error - Email is required as a query parameter" });
                return;
            }

            console.log("📌 Fetching Data for Email:", email);

            // Fetch user by email from the database
            const userData: UserData | null = await getUserByEmail(email);

            if (!userData) {
                console.log("📌 User not found for Email:", email);
                res.status(404).json({ error: "User not found" });
                return;
            }

            console.log("📌 Successfully fetched user data for Email:", email);

            // Generate PDF report
            const pdfPath = path.join(__dirname, `../uploads/${email}.pdf`);
            const doc = new PDFDocument();

            // Pipe PDF output to a file
            doc.pipe(fs.createWriteStream(pdfPath));

            // Add a title
            doc.fontSize(18).text(`Report for ${email}`, { align: "center" });
            doc.moveDown();

            // Income Analysis Section
            doc.fontSize(14).text("Income Analysis", { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Gross Monthly Income: ${userData.data.monthly}`);
            doc.text(`Estimated Tax Bracket: ${await estimateTaxBracket(userData.data.annualSalary)}`);
            doc.text(`Estimated Net After-Tax Income: ${calculateNetIncome(userData.data.monthly)}`);
            doc.text(`Estimated Monthly Debt Budget: ${calculateDebtBudget(userData.data.monthly)}`);
            doc.moveDown();

            // Debt Analysis Section
            doc.fontSize(14).text("Debt Analysis", { underline: true });
            doc.moveDown();
            userData.data.userCards.forEach((card: { cardType: any; balance: number; creditLimit: number; monthlyPaymentType: string; }) => {
                doc.text(`Card Type: ${card.cardType}`);
                doc.text(`Balance: ${card.balance}`);
                doc.text(`Utilization: ${calculateUtilization(card.balance, card.creditLimit)}%`);
                doc.text(`Estimated Time to Payoff: ${calculatePayoffTime(card.balance, card.monthlyPaymentType)}`);
                doc.text(`Estimated Interest to Pay: ${calculateInterest(card.balance, card.monthlyPaymentType)}`);
                doc.text(`Estimated Minimum Payment: ${card.monthlyPaymentType}`);
                doc.moveDown();
            });

            // Generate Pie Chart for Household Spending
            const chartUrl = await generatePieChart();

            doc.text("Household Spending Breakdown:");
            doc.image(chartUrl, { width: 400 });
            doc.moveDown();

            // Recommendations & Options Section
            doc.fontSize(14).text("Recommendations & Options", { underline: true });
            doc.moveDown();
            const recommendations = generateRecommendations(userData);
            doc.fontSize(12).text(recommendations);
            doc.moveDown();

            // Finalize the PDF document
            doc.end();

            // Return the PDF path in the response
            res.status(200).json({
                message: "PDF report generated successfully",
                reportUrl: `/uploads/${email}.pdf`
            });

        } else {
            console.log("📌 Method Not Allowed: ", req.method);
            res.status(405).json({ error: "Method Not Allowed" });
        }

    } catch (error) {
        console.error("❌ Error in merlinReportHandler:", error);
        next(error);
    }
};

// Helper functions (same as before)

const estimateTaxBracket = async (annualSalary: string): Promise<string> => {
    return "25%"; // Example
};

const calculateNetIncome = (grossIncome: number): string => {
    const netIncome = grossIncome * 0.75; // Assuming 25% tax
    return `$${netIncome.toFixed(2)}`;
};

const calculateDebtBudget = (netIncome: number): string => {
    const debtBudget = netIncome * 0.12;
    return `$${debtBudget.toFixed(2)}`;
};

const calculateUtilization = (balance: number, creditLimit: number): number => {
    return (balance / creditLimit) * 100;
};

const calculatePayoffTime = (balance: number, paymentType: string): string => {
    const monthlyPayment = paymentType === "Minimum Required" ? balance * 0.02 : balance * 0.05;
    const monthsToPayoff = balance / monthlyPayment;
    return `${Math.ceil(monthsToPayoff)} months`;
};

const calculateInterest = (balance: number, paymentType: string): string => {
    const annualInterestRate = paymentType === "Minimum Required" ? 0.18 : 0.15;
    const interest = balance * annualInterestRate;
    return `$${interest.toFixed(2)}`;
};

const generateRecommendations = (userData: UserData): string => {
    if (userData.data.savingsValue > 10000) {
        return "Consider using your savings for debt consolidation.";
    } else {
        return "Explore debt consolidation options or a payment plan.";
    }
};

const generatePieChart = async (): Promise<string> => {
    const chartData = {
        type: "pie",
        data: {
            labels: ["Housing", "Transportation", "Food", "Insurance & Pensions", "Healthcare", "Misc", "Savings/Disposable"],
            datasets: [{
                data: [33, 17, 13, 12, 5, 8, 12],
                backgroundColor: ["#FF5733", "#FFBD33", "#FF33D7", "#33D7FF", "#33FF57", "#FF33FF", "#D733FF"]
            }]
        }
    };

    try {
        const response = await axios.post("https://quickchart.io/chart/create", {
            chart: chartData
        });

        // Return the URL of the generated chart
        return response.data.url;
    } catch (error) {
        console.error("❌ Error generating pie chart:", error);
        throw new Error("Failed to generate pie chart.");
    }
};

export default merlinReportHandler;
