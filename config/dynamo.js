const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "us-east-1"
});

module.exports = dynamo;
