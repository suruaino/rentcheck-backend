
import pool from "../src/config/db.js";

async function testDatabaseConnection() {
  try {
    const [rows] = await pool.query(`
      SELECT
        VERSION() AS mysqlVersion,
        DATABASE() AS databaseName
    `);

    console.log("Database connection successful!");
    console.log("MySQL version:", rows[0].mysqlVersion);
    console.log("Connected database:", rows[0].databaseName);

  } catch (error) {
    console.error("Database connection failed!");
    console.error(error.message);

    process.exitCode = 1;

  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
