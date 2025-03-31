import { Request, Response, NextFunction } from "express";
import { getUserByEmail } from "../database/postGresDBOperations";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import axios from "axios";

// Importing the UserData interface if needed
import { Data } from "../lib/UserData";  // Adjust this path as needed
import { calculateTax, calculateTotalAnnualIncome, computeHairCutPercentage } from "../lib/report-utils";

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

const generatePieChart = async (): Promise<Buffer> => {
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
        // Create the chart using QuickChart API
        const response = await axios.post("https://quickchart.io/chart/create", {
            chart: chartData
        });

        const chartUrl = response.data.url;

        // Now fetch the image from the URL and return it as a Buffer
        const imageResponse = await axios.get(chartUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data);  // Return the image as a Buffer
    } catch (error) {
        console.error("❌ Error generating pie chart:", error);
        throw new Error("Failed to generate pie chart.");
    }
};


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

            let annualSalary = 0
            annualSalary = calculateTotalAnnualIncome(userData)
            console.log("📌 Successfully computed Annual Salary :", annualSalary);

            let filingStatus: 'single' | 'joint' = 'single';  // Default to 'single'

            // Check if the spouse has an annual salary and if it's valid (non-empty, greater than 0)
            if (userData.data.spouseAnnualSalary && userData.data.spouseAnnualSalary !== "" && parseFloat(userData.data.spouseAnnualSalary) > 0) {
                filingStatus = 'joint';  // Set to 'joint' if spouse has a valid salary
            }

            let federalTaxes = calculateTax(annualSalary, filingStatus)
            console.log("📌 Successfully computed Federal Taxes :", federalTaxes);

            let estimateTaxBracket = federalTaxes / annualSalary
            console.log("📌 Successfully computed Federal Estimate TaxBracket :", estimateTaxBracket);

            let afterTaxAnnualIncome = annualSalary - federalTaxes
            let afterTaxMonthlyIncome = afterTaxAnnualIncome / 12

            console.log(`📌 Successfully computed After Taxes income. Annual : ${afterTaxAnnualIncome} and Monthly : ${afterTaxMonthlyIncome}`);

            let incomeHairCutPercentage = computeHairCutPercentage(userData)

            console.log("📌 Successfully computed Income Hair Cut due to Life Events:", incomeHairCutPercentage);

            // Calculate the yearly and monthly disposable income after applying the income haircut
            let afterTaxAnnualIncomeAfterHairCut = afterTaxAnnualIncome * (1 + incomeHairCutPercentage / 100); // Convert percentage to decimal
            let afterTaxMonthlyIncomeAfterHairCut = afterTaxAnnualIncomeAfterHairCut / 12;

            console.log(`📌 Successfully computed Disposable Income. Annual: ${afterTaxAnnualIncomeAfterHairCut} and Monthly: ${afterTaxMonthlyIncomeAfterHairCut}`);

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
            doc.fontSize(12).text(`Gross Annual Income: ${annualSalary}`);
            doc.fontSize(12).text(`Gross Monthly Income: ${annualSalary / 12}`);
            doc.text(`Estimated Federal Tax: ${federalTaxes}`);

            doc.text(`Estimated Tax Bracket: ${estimateTaxBracket}`);
            doc.text(`Estimated Net After-Tax Income: ${afterTaxMonthlyIncome}`);
            doc.text(`Estimated Monthly Debt Budget: ${afterTaxMonthlyIncomeAfterHairCut}`);
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
            const chartBuffer = await generatePieChart();

            doc.text("Household Spending Breakdown:");
            doc.image(chartBuffer, { width: 400 });
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

export default merlinReportHandler;

