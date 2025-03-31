import { Request, Response, NextFunction } from "express";
import { getUserByEmail } from "../database/postGresDBOperations";
import path from "path";
import puppeteer from "puppeteer"; // Import Puppeteer
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

const generatePdfWithPuppeteer = async (userData: any, email: string): Promise<string> => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Define the HTML content for the PDF
    const content = `
    <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1, h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #f4f4f4; }
                .chart-container { text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>Report for ${email}</h1>

            <h2>Income Analysis</h2>
            <table>
                <tr>
                    <th>Description</th>
                    <th>Amount</th>
                </tr>
                <tr><td>Gross Annual Income</td><td>$${userData.annualSalary.toFixed(2)}</td></tr>
                <tr><td>Gross Monthly Income</td><td>$${(userData.annualSalary / 12).toFixed(2)}</td></tr>
                <tr><td>Estimated Federal Tax</td><td>$${userData.federalTaxes.toFixed(2)}</td></tr>
                <tr><td>Estimated Tax Bracket</td><td>${(userData.federalTaxes / userData.annualSalary * 100).toFixed(2)}%</td></tr>
                <tr><td>Estimated Net After-Tax Income</td><td>$${(userData.annualSalary - userData.federalTaxes).toFixed(2)}</td></tr>
                <tr><td>Estimated Monthly Debt Budget</td><td>$${((userData.annualSalary - userData.federalTaxes) * 0.12 / 12).toFixed(2)}</td></tr>
            </table>

            <h2>Debt Analysis</h2>
            <table>
                <tr>
                    <th>Card Type</th>
                    <th>Balance</th>
                    <th>Utilization</th>
                    <th>Payoff Time (Months)</th>
                </tr>
                ${userData.debtCards.map((card: any) => `
                <tr>
                    <td>${card.cardType}</td>
                    <td>$${card.balance.toFixed(2)}</td>
                    <td>${(card.balance / card.creditLimit * 100).toFixed(2)}%</td>
                    <td>${Math.ceil(card.balance / (card.monthlyPaymentType === 'Minimum Required' ? 0.02 : 0.05))} months</td>
                </tr>
                `).join('')}
            </table>

            <h2>Household Spending Breakdown</h2>
            <div class="chart-container">
                <img src="data:image/png;base64,${userData.chartBase64}" alt="Spending Breakdown Chart" width="400">
            </div>

            <h2>Recommendations & Options</h2>
            <p>${userData.recommendations}</p>
        </body>
    </html>
    `;

    // Set the content and generate the PDF
    await page.setContent(content);
    const pdfPath = path.join(__dirname, `../uploads/${email}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4' });

    await browser.close();

    return pdfPath;
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

            let annualSalary = calculateTotalAnnualIncome(userData);
            console.log("📌 Successfully computed Annual Salary :", annualSalary);

            let filingStatus: 'single' | 'joint' = 'single';  // Default to 'single'

            // Check if the spouse has an annual salary and if it's valid (non-empty, greater than 0)
            if (userData.data.spouseAnnualSalary && parseFloat(userData.data.spouseAnnualSalary) > 0) {
                filingStatus = 'joint';  // Set to 'joint' if spouse has a valid salary
            }

            let federalTaxes = calculateTax(annualSalary, filingStatus);
            console.log("📌 Successfully computed Federal Taxes :", federalTaxes);

            let estimateTaxBracket = federalTaxes / annualSalary;
            console.log("📌 Successfully computed Federal Estimate TaxBracket :", estimateTaxBracket);

            let afterTaxAnnualIncome = annualSalary - federalTaxes;
            let afterTaxMonthlyIncome = afterTaxAnnualIncome / 12;

            console.log(`📌 Successfully computed After Taxes income. Annual: ${afterTaxAnnualIncome} and Monthly: ${afterTaxMonthlyIncome}`);

            let incomeHairCutPercentage = computeHairCutPercentage(userData);

            console.log("📌 Successfully computed Income Hair Cut due to Life Events:", incomeHairCutPercentage);

            // Calculate the yearly and monthly disposable income after applying the income haircut
            let afterTaxAnnualIncomeAfterHairCut = afterTaxAnnualIncome * (1 + incomeHairCutPercentage / 100); // Convert percentage to decimal
            let afterTaxMonthlyIncomeAfterHairCut = afterTaxAnnualIncomeAfterHairCut / 12;

            console.log(`📌 Successfully computed Disposable Income. Annual: ${afterTaxAnnualIncomeAfterHairCut} and Monthly: ${afterTaxMonthlyIncomeAfterHairCut}`);


            // Generate Pie Chart for Household Spending
            const chartBuffer = await generatePieChart();
            const chartBase64 = chartBuffer.toString('base64'); // Convert the chart to base64

            // Preparing data for the report
            const reportData = {
                email,
                annualSalary,
                federalTaxes,
                debtCards: userData.data.userCards,
                chartBase64,
                recommendations: generateRecommendations(userData)
            };

            // Generate PDF using Puppeteer
            const pdfPath = await generatePdfWithPuppeteer(reportData, email);

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

// Helper functions for Debt Analysis and Recommendations

const generateRecommendations = (userData: UserData): string => {
    if (userData.data.savingsValue > 10000) {
        return "Consider using your savings for debt consolidation.";
    } else {
        return "Explore debt consolidation options or a payment plan.";
    }
};

export default merlinReportHandler;
