import * as Automerge from "@automerge/automerge";
let doc = Automerge.from({ text: "" });
doc = Automerge.change(doc, (d: any) => { Automerge.splice(d, ["text"], 0, 0, "hello"); });
export const bytes = Automerge.save(doc);
