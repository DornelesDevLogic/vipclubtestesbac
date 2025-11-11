import dotenv from "dotenv";
import "./utils/dailyLogger";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
});
