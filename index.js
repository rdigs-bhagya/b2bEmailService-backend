const serverless = require("serverless-http");
const express = require("express");
const routes = require('./routes')
const cors = require('cors');
const app = express();
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.options('*', cors());
app.use(cors());
app.use('/api/v1', routes);
 
// Define the serverless function handler
module.exports.handler = serverless(app);
