import sqlite3 from "sqlite3";

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

// Define Type for Database Row
interface DatabaseRow {
    data: string;  // SQLite stores JSON as a TEXT field, so we parse it later
}

const db = new sqlite3.Database("DWDDatabase.db", (err) => {
    if (err) {
        console.error("❌ Error connecting to SQLite:", err.message);
    } else {
        console.log("✅ Connected to SQLite database");
    }
});

// Ensure table exists
db.run(
    `CREATE TABLE IF NOT EXISTS merlinusers (
      email TEXT PRIMARY KEY,
      data JSON
  )`
);

// Save User to Database
export const saveToDatabase = async (userData: UserData): Promise<UserData> => {
    return new Promise((resolve, reject) => {
        const { email, data } = userData;

        db.run(
            `INSERT INTO merlinusers (email, data)
             VALUES (?, json(?))
             ON CONFLICT(email) 
             DO UPDATE SET data = json(?)`,
            [email, JSON.stringify(data), JSON.stringify(data)], // Update existing record with new JSON data
            function (err) {
                if (err) {
                    return reject(err);
                }
                resolve({ email, data });
            }
        );
    });
};

// Get User by Email (Fix Type Issue)
export const getUserByEmail = async (email: string): Promise<UserData | null> => {
    return new Promise((resolve, reject) => {
        db.get<DatabaseRow>("SELECT data FROM merlinusers WHERE email = ?", [email], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (!row) {
                return resolve(null);
            }

            // ✅ Ensure TypeScript recognizes 'data' as a valid property
            const userData: UserData = {
                email,
                data: JSON.parse(row.data) // Convert JSON string to object
            };

            resolve(userData);
        });
    });
};

export default db;
