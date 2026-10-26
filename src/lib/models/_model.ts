import mongoose, { Schema, type Model } from "mongoose";

/** Register a model once; dev hot reload re-evaluates this module but mongoose keeps its registry. */
export function defineModel<T>(name: string, schema: Schema<T>, collection: string): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema, collection);
}

/**
 * ERD tables: exactly the ERD's columns. Mongo's own _id stays internal; each table's primary key is its
 * ERD column (account_id, character_id, …), an integer from `counters`. No timestamps or version keys.
 */
export const erdOptions = { versionKey: false, id: false } as const;

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({ _id: String, seq: { type: Number, required: true } }, { versionKey: false });
export const Counter = defineModel<ICounter>("Counter", counterSchema, "counters");

/** Next integer primary key for an ERD table, e.g. nextId("accounts"). */
export async function nextId(table: string) {
  const c = await Counter.findOneAndUpdate({ _id: table }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return c.seq;
}

/** Make sure the counter is at least `atLeast` (after seeding fixed ids). */
export async function bumpCounter(table: string, atLeast: number) {
  await Counter.updateOne({ _id: table }, { $max: { seq: atLeast } }, { upsert: true });
}

/** An integer primary key column. */
export const pk = { type: Number, required: true, unique: true } as const;
