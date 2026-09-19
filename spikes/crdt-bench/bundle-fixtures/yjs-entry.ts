import * as Y from "yjs";
const doc = new Y.Doc();
const text = doc.getText("t");
text.insert(0, "hello");
const map = doc.getMap("m");
map.set("k", 1);
export const update = Y.encodeStateAsUpdateV2(doc);
