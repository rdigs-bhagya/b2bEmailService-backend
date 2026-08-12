const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");

const ddb = new DynamoDBClient({ region: "us-east-1" });
const USERS_TABLE = process.env.USERS_TABLE || "b2b_users";

async function createAdminUser() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: node scripts/createAdminUser.js <email> <password>");
    process.exit(1);
  }

  console.log(`Creating user ${email} in table ${USERS_TABLE}...`);

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          email: email.trim().toLowerCase(),
          passwordHash: passwordHash,
          name: "Admin User",
          createdAt: new Date().toISOString(),
        },
      })
    );

    console.log(`User ${email} created successfully.`);
  } catch (error) {
    console.error("Error creating user:", error);
  }
}

createAdminUser();
