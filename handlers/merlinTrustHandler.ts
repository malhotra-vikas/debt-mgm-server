export const merlinTrustHandler = async (req: any, res: any) => {
    try {
        const response = {
            message: "Hello from self-hosted server!",
        };
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};
