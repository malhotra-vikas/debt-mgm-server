import { Pool } from "pg";

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

// Database Connection Pool using ENV variables
const pool = new Pool({
    user: process.env.DATABASE_USER,
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    port: Number(process.env.DATABASE_PORT) || 5432,
});

// Update User Data in Database
export const updateUserData = async (email: string, data: any): Promise<UserData> => {
    try {
        const result = await pool.query(
            `UPDATE merlinusers 
             SET data = $1 
             WHERE email = $2 
             RETURNING email, data`,
            [data, email]
        );

        if (result.rows.length === 0) {
            throw new Error("User not found");
        }

        // Return updated user data
        return {
            email: result.rows[0].email,
            data: result.rows[0].data,
        };
    } catch (err) {
        console.error("❌ Error updating user data in PostgreSQL:", err);
        throw err;
    }
};


// Save User to Database
export const saveToDatabase = async (userData: UserData): Promise<UserData> => {
    const { email, data } = userData;

    try {
        await pool.query(
            `INSERT INTO merlinusers (email, data)
             VALUES ($1, $2)
             ON CONFLICT (email)
             DO UPDATE SET data = EXCLUDED.data`,
            [email, data]
        );

        return { email, data };
    } catch (err) {
        console.error("❌ Error saving to PostgreSQL:", err);
        throw err;
    }
};

// Get User by Email
export const getUserByEmail = async (email: string): Promise<UserData | null> => {
    try {
        const result = await pool.query(
            "SELECT data FROM merlinusers WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return {
            email,
            data: result.rows[0].data,
        };
    } catch (err) {
        console.error("❌ Error retrieving user from PostgreSQL:", err);
        throw err;
    }
};

export default pool;
