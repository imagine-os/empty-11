import { LoroDoc } from "loro-crdt";
const doc = new LoroDoc();
doc.getText("t").insert(0, "hello");
export const bytes = doc.export({ mode: "snapshot" });
