import mongoose from "mongoose";
import { env } from "./env";

// One connection per process. Dev hot reload re-evaluates modules, so the promise lives on globalThis.
const g = globalThis as typeof globalThis & { __kqMongoose?: Promise<typeof mongoose> };

export function connectDb() {
  g.__kqMongoose ??= mongoose
    .connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: env.NODE_ENV !== "production" })
    .catch((err) => {
      g.__kqMongoose = undefined; // let the next request retry
      throw err;
    });
  return g.__kqMongoose;
}

export async function disconnectDb() {
  if (g.__kqMongoose) {
    await mongoose.disconnect();
    g.__kqMongoose = undefined;
  }
}
