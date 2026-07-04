import { Pool } from "pg";
import dotenv from "dotenv";

//Load environment variables
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DB_URL,
    // Verify the server's TLS certificate (Neon's certs chain to a public CA
    // in Node's default trust store). The previous rejectUnauthorized:false
    // accepted ANY certificate, so a man-in-the-middle could read credentials
    // and data.
    ssl: true,
    // This runs on serverless: each warm instance holds its own pool, so keep
    // it small and let idle connections go quickly. For real concurrency,
    // DB_URL should be Neon's pooled ("-pooler") connection string so all
    // instances share PgBouncer instead of exhausting Postgres connections.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

export default pool;
