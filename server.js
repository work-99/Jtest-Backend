"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const db_1 = require("./src/config/db");
const constants_1 = require("./src/utils/constants");
const emailPoller_1 = require("./src/services/emailPoller");
const contactPoller_1 = require("./src/services/contactPoller");
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
        app_1.default.listen(constants_1.PORT, () => {
            console.log(`Server running on port ${constants_1.PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
        // Start email polling in the background
        (0, emailPoller_1.startEmailPolling)();
        // Start contact polling in the background
        (0, contactPoller_1.startContactPolling)();
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
